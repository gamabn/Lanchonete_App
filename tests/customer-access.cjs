const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const customer = { id: 'alice', restaurant_id: 'A', name: 'Alice', phone: '111', city: 'City' };
const context = id => ({ params: Promise.resolve({ id }) });
function route(cookies = {}, implementation = {}) {
  const calls = [];
  const methods = {};
  for (const method of ['get', 'post', 'put']) methods[method] = async (...args) => {
    calls.push({ method, args });
    if (implementation[method]) return implementation[method](...args);
    return { data: method === 'get' ? [customer] : { ...customer, customer_credential: 'profile-secret' } };
  };
  const mocks = {
    '@/lib/customerCookie': { customerCookieName: id => `__Host-gama_customer_${encodeURIComponent(id)}` },
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: name => cookies[name] && { value: cookies[name] } }) },
    axios: { isAxiosError: error => Boolean(error && error.isAxiosError) }, '@/app/util/api': methods,
  };
  const sessionExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/customerSession.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports: sessionExports, require: name => mocks[name], Error, encodeURIComponent });
  mocks['@/lib/customerSession'] = sessionExports;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/client/[id]/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; },
    process: { env: { NODE_ENV: 'production' } }, encodeURIComponent });
  return { ...exports, calls };
}
function request(method, body = {}, origin = 'https://app.example') {
  return new NextRequest('https://app.example/api/client/A', {
    method, headers: { origin, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}
test('new customer credential is stored only in a host-only HttpOnly secure cookie', async () => {
  const h = route({}, { post: async () => ({ data: { ...customer, customer_credential: 'profile-secret', password: 'private', internal_field: 'hidden' } }) });
  const response = await h.POST(request('POST', { name: 'Alice', phone: '111', city: 'City' }), context('A'));
  assert.equal(response.status, 201); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const cookie = response.cookies.get('__Host-gama_customer_A');
  assert.equal(cookie.value, 'profile-secret'); assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, 'strict');
  assert.equal(cookie.path, '/'); assert.equal(cookie.domain, undefined); assert.equal(cookie.maxAge, 2592000);
  assert.deepEqual(await response.json(), customer);
  assert.equal(h.calls[0].args[0], '/client/A');
});
test('profile reads and writes forward only the matching customer cookie, not the admin session', async () => {
  const h = route({ token: 'admin-jwt', '__Host-gama_customer_A': 'customer-A', '__Host-gama_customer_B': 'customer-B' });
  const response = await h.GET(request('GET'), context('A'));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), [customer]);
  assert.equal(h.calls[0].args[1].headers.Authorization, 'Bearer customer-A');
  assert.equal(h.calls[0].args[0], '/client/A');
  await h.PUT(request('PUT', { name: 'Alice', phone: '111', city: 'City' }), context('A'));
  const config = h.calls[1].args[2];
  assert.equal(config.headers.Authorization, 'Bearer customer-A');
  assert.equal(config.headers['X-Customer-Restaurant'], 'A');
  assert.equal(h.calls[1].args[0], '/client/update');
});
test('missing customer cookie never falls back to admin, chat credentials, URLs or another store', async () => {
  const h = route({ token: 'admin-jwt', chat_credential: 'chat-secret', '__Host-gama_customer_B': 'customer-B' });
  const response = await h.GET(new NextRequest('https://app.example/api/client/A?phone=111&credential=guess'), context('A'));
  assert.equal(response.status, 401);
  assert.equal((await h.PUT(request('PUT'), context('A'))).status, 401);
  assert.equal(h.calls.length, 0);
});
test('cross-origin creation and updates are blocked before backend calls', async () => {
  const h = route({ '__Host-gama_customer_A': 'customer-A' });
  for (const method of ['POST', 'PUT']) {
    const response = await h[method](request(method, {}, 'https://evil.example'), context('A'));
    assert.equal(response.status, 403);
  }
  assert.equal(h.calls.length, 0);
});
test('invalid/expired credentials and duplicate legacy records preserve safe backend errors', async () => {
  for (const status of [401, 403, 404, 409]) {
    const fail = async () => { throw { isAxiosError: true, response: { status, data: { secret: 'sensitive backend details' } } }; };
    const h = route({ '__Host-gama_customer_A': 'credential' }, { get: fail, post: fail, put: fail });
    const method = status === 409 ? 'POST' : 'GET';
    const response = await h[method](request(method), context('A'));
    assert.equal(response.status, status);
    assert.equal(JSON.stringify(await response.json()).includes('sensitive backend'), false);
    assert.equal(response.cookies.get('__Host-gama_customer_A'), undefined);
  }
});
test('creation without a newly issued credential or with another establishment fails closed', async () => {
  for (const data of [customer, { ...customer, restaurant_id: 'B', customer_credential: 'other' }]) {
    const h = route({}, { post: async () => ({ data }) });
    const response = await h.POST(request('POST'), context('A'));
    assert.equal(response.status, 503); assert.equal(response.cookies.get('__Host-gama_customer_A'), undefined);
  }
});

test('logout expires only the current restaurant HttpOnly cookie without contacting the backend', async () => {
  const h = route({
    '__Host-gama_customer_A': 'customer-A', '__Host-gama_customer_B': 'customer-B', token: 'owner',
  });
  const blocked = await h.DELETE(request('DELETE', {}, 'https://other.example'), context('A'));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.cookies.get('__Host-gama_customer_A'), undefined);
  const result = await h.DELETE(request('DELETE'), context('A'));
  assert.equal(result.status, 200);
  const cookie = result.cookies.get('__Host-gama_customer_A');
  assert.equal(cookie.value, '');
  assert.equal(cookie.maxAge, 0);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'strict');
  assert.equal(cookie.path, '/');
  assert.equal(result.cookies.get('__Host-gama_customer_B'), undefined);
  assert.equal(result.cookies.get('token'), undefined);
  assert.equal(h.calls.length, 0);
});

test('missing and expired sessions return distinct codes and POST with an existing session never creates a record', async () => {
  const missing = route();
  assert.equal((await (await missing.GET(request('GET'), context('A'))).json()).code, 'SESSION_MISSING');
  const expired = route({ '__Host-gama_customer_A': 'expired' }, { get: async () => {
    throw { isAxiosError: true, response: { status: 401, data: { code: 'SESSION_EXPIRED' } } };
  } });
  const expiredResult = await expired.GET(request('GET'), context('A'));
  assert.equal((await expiredResult.json()).code, 'SESSION_EXPIRED');
  const existing = route({ '__Host-gama_customer_A': 'customer-A' });
  const response = await existing.POST(request('POST', customer), context('A'));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'SESSION_EXISTS');
  assert.equal(existing.calls.some(call => call.method === 'post'), false);
});

test('confirmed updates reject a replaced session or a different person before writing the profile', async () => {
  const h = route({ '__Host-gama_customer_A': 'customer-A' });
  for (const [expected, name] of [['bob', 'Alice'], ['alice', 'Bob']]) {
    const req = new NextRequest('https://app.example/api/client/A', {
      method: 'PUT', headers: { origin: 'https://app.example', 'x-customer-id': expected },
      body: JSON.stringify({ name, phone: '111', city: 'City' }),
    });
    const response = await h.PUT(req, context('A'));
    assert.equal(response.status, 409);
  }
  assert.equal(h.calls.some(call => call.method === 'put'), false);
});
