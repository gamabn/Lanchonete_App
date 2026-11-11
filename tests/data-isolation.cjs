const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, Buffer, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
function imageRoute(token, calls) {
  return load('src/app/api/store-image/route.ts', {
    'next/server': { NextResponse }, 'next/headers': { cookies: async () => ({ get: () => token && { value: token } }) },
    axios: { isAxiosError: () => false },
    '@/app/util/api': {
      get: async (url, config) => { assert.equal(url, '/me'); assert.equal(config.headers.Authorization, 'Bearer owner-A'); return { data: { id: 'A' } }; },
      put: async (url, form, config) => { calls.push({ url, form, config }); return { data: { id: 'A', image_url: 'new-image' } }; },
    },
  });
}
test('image proxy uses the authenticated profile and never a client-supplied establishment ID', async () => {
  const calls = [];
  const { PUT } = imageRoute('owner-A', calls);
  const request = { headers: new Headers({ origin: 'http://localhost' }), nextUrl: { origin: 'http://localhost' }, formData: async () => ({ id: 'B' }) };
  assert.equal((await PUT(request)).status, 200);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/user/image/A');
  assert.equal(calls[0].config.headers.Authorization, 'Bearer owner-A');
});
test('image proxy denies anonymous or cross-origin uploads', async () => {
  for (const [token, origin, expected] of [[undefined, 'http://localhost', 401], ['owner-A', 'http://evil.example', 403]]) {
    const calls = []; const { PUT } = imageRoute(token, calls);
    const response = await PUT(new NextRequest('http://localhost/api/store-image', { method: 'PUT', headers: { origin } }));
    assert.equal(response.status, expected); assert.equal(calls.length, 0);
  }
});
test('profile API refuses anonymous updates and does not forward a caller-supplied ID', async () => {
  let calls = 0;
  const { PUT } = load('src/app/api/user/route.ts', {
    'next/server': { NextResponse }, '@/app/util/api': { put: async (url, body, config) => {
      calls++; assert.equal('id' in body, false); assert.equal(config.headers.Authorization, 'Bearer owner-A'); return { data: { name: body.name } };
    } },
  });
  const data = { id: 'B', name: 'A', email: 'a@example.com', phone: 'phone', city: 'City', neighborhood: 'Area', street: 'Street', number: '1' };
  const req = token => ({ cookies: { get: () => token && { value: token } }, json: async () => data });
  assert.equal((await PUT(req())).status, 401); assert.equal(calls, 0);
  assert.equal((await PUT(req('owner-A'))).status, 200); assert.equal(calls, 1);
});

function productRoute(token, upstream) {
  return load('src/app/api/product/route.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: () => token && { value: token } }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { request: upstream, get: upstream },
  });
}

test('product proxy forwards multipart and surfaces Express error under both keys', async () => {
  const form = new FormData();
  form.set('price', '12,50');
  form.set('file', new File(['image bytes'], 'image.png', { type: 'image/png' }));
  const { POST } = productRoute('owner-A', async config => {
    assert.equal(config.url, '/product');
    assert.equal(config.headers.Authorization, 'Bearer owner-A');
    const parsed = await new Response(config.data, { headers: config.headers }).formData();
    assert.equal(parsed.get('price'), '12,50');
    assert.equal(parsed.get('file').name, 'image.png');
    throw { response: { status: 400, data: { error: 'Imagem inválida.' } } };
  });
  const result = await POST(new NextRequest('http://localhost/api/product', { method: 'POST', body: form }));
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), { error: 'Imagem inválida.', message: 'Imagem inválida.' });
});

test('product proxy bounds multipart before calling the backend', async () => {
  const form = new FormData();
  form.set('file', new File([Buffer.alloc(6 * 1024 * 1024)], 'large.png', { type: 'image/png' }));
  const { PUT } = productRoute('owner-A', async () => assert.fail('Oversized upload forwarded'));
  const result = await PUT(new NextRequest('http://localhost/api/product', { method: 'PUT', body: form }));
  assert.equal(result.status, 413);
});

function configuredProductProxy(token, upstream) {
  return load('src/app/api/product/configuredProxy.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: () => token && { value: token } }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { request: upstream },
  });
}

test('configured product proxies require a cookie and forward scoped operations to fixed routes', async () => {
  const files = 'src/app/api/product';
  const productId = '00000000-0000-4000-8000-000000000010';
  const anonymous = configuredProductProxy(undefined, () => assert.fail('Anonymous request forwarded'));
  const anonymousList = load(`${files}/templates/route.ts`, { '../configuredProxy': anonymous });
  assert.equal((await anonymousList.GET()).status, 401);

  const calls = [];
  const proxy = configuredProductProxy('owner-A', async config => {
    calls.push(config);
    assert.equal(config.headers.Authorization, 'Bearer owner-A');
    if (config.method === 'POST') return { status: 201, data: { product: { id: productId, published: false } } };
    if (config.url === '/product-templates') return { status: 200, data: [{ slug: 'pizza' }] };
    throw { response: { status: 404, data: { error: 'Produto não encontrado.' } } };
  });
  const { GET: list } = load(`${files}/templates/route.ts`, { '../configuredProxy': proxy });
  const { POST } = load(`${files}/from-template/route.ts`, { '../configuredProxy': proxy });
  const { GET: configuration } = load(`${files}/[productId]/configuration/route.ts`, { '../../configuredProxy': proxy });
  const createRequest = origin => new NextRequest('http://localhost/api/product/from-template', {
    method: 'POST', headers: { origin }, body: JSON.stringify({ templateSlug: ' pizza ', restaurantId: 'owner-B' }),
  });
  assert.equal((await POST(createRequest('https://other.example'))).status, 403);
  assert.equal((await configuration(null, { params: Promise.resolve({ productId: 'invalid' }) })).status, 400);
  assert.equal(calls.length, 0);

  const templates = await list();
  assert.deepEqual(await templates.json(), [{ slug: 'pizza' }]);
  const created = await POST(createRequest('http://localhost'));
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  assert.equal((await created.json()).product.id, productId);
  assert.deepEqual(Object.keys(calls[1].data), ['templateSlug']);
  assert.equal(calls[1].data.templateSlug, 'pizza');
  const missing = await configuration(null, { params: Promise.resolve({ productId }) });
  assert.equal(missing.status, 404);
  assert.deepEqual(calls.map(call => call.url), [
    '/product-templates', '/products/from-template', `/products/${productId}/admin-configuration`,
  ]);
});

test('configured editor forwards PATCH operations with the session and preserves validation details', async () => {
  const productId = '00000000-0000-4000-8000-000000000010';
  const calls = [];
  const proxy = configuredProductProxy('owner-A', async config => {
    calls.push(config);
    assert.equal(config.headers.Authorization, 'Bearer owner-A');
    throw { response: { status: 422, data: { error: 'Configuração inválida.', details: ['O mínimo exige duas opções.'] } } };
  });
  const { PATCH } = load('src/app/api/product/[productId]/configuration/route.ts', { '../../configuredProxy': proxy });
  const context = { params: Promise.resolve({ productId }) };
  const makeRequest = origin => new NextRequest(`http://localhost/api/product/${productId}/configuration`, {
    method: 'PATCH', headers: { origin }, body: JSON.stringify({ name: 'Quentinha' }),
  });
  assert.equal((await PATCH(makeRequest('https://other.example'), context)).status, 403);
  assert.equal(calls.length, 0);
  const response = await PATCH(makeRequest('http://localhost'), context);
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url, `/products/${productId}/admin-configuration`);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: 'Configuração inválida.', details: ['O mínimo exige duas opções.'] });
});
