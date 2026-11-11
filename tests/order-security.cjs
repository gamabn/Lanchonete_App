const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, process: { env: { NODE_ENV: 'production' } }, encodeURIComponent });
  return exports;
}
const cookieHelper = load('src/lib/customerCookie.ts');
function routes(cookies, options = {}) {
  const calls = [];
  const mocks = {
    'next/server': { NextResponse }, '@/lib/customerCookie': cookieHelper,
    'next/headers': { cookies: async () => ({ get: name => cookies[name] && { value: cookies[name] } }) },
    axios: { isAxiosError: error => Boolean(error && error.isAxiosError) },
    '@/app/util/api': {
      get: async () => ({ data: [{ id: options.customerId || 'alice', restaurant_id: 'A' }] }),
      post: async (...args) => {
        calls.push({ method: 'POST', args });
        if (options.fail) throw { isAxiosError: true, response: { status: options.fail, data: { private: 'backend secret' } } };
        return { status: 201, data: { order: { id: 'order-A', total_price: '30.00' }, chat_credential: 'chat-token' } };
      },
      request: async config => { calls.push(config); return { data: { id: 'order-A', status: 'enviado' } }; },
    },
  };
  mocks['@/lib/customerSession'] = load('src/lib/customerSession.ts', mocks);
  return { public: load('src/app/api/orders/[id]/route.ts', mocks), admin: load('src/app/api/orders/admin/route.ts', mocks), calls };
}
const context = { params: Promise.resolve({ id: 'A' }) };
const input = { items: [{ product_id: 'p1', quantity: 2 }], bairro_id: 'bairro-A', payment_method: 'Dinheiro', change_for: '50' };
const request = (method, body = input, origin = 'https://app.example') => new NextRequest('https://app.example/api/orders/A', {
  method, headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
test('checkout proxy uses only the selected establishment customer HttpOnly credential', async () => {
  assert.equal(cookieHelper.customerCookieName('A'), '__Host-gama_customer_A');
  const h = routes({ '__Host-gama_customer_A': 'customer-A', '__Host-gama_customer_B': 'customer-B', token: 'admin-token' });
  const response = await h.public.POST(request('POST'), context);
  assert.equal(response.status, 201); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(h.calls[0].args[0], '/order/A');
  assert.equal(h.calls[0].args[2].headers.Authorization, 'Bearer customer-A');
  assert.deepEqual(h.calls[0].args[1], input);
  assert.equal((await response.json()).chat_credential, 'chat-token');
});
test('public checkout does not fall back to an owner, chat credential or another establishment', async () => {
  const h = routes({ token: 'admin-token', '__Host-gama_customer_B': 'customer-B', chat_credential: 'chat-secret' });
  const response = await h.public.POST(request('POST'), context);
  assert.equal(response.status, 401); assert.equal(h.calls.length, 0);
});
test('public and administrative order writes reject cross-origin requests', async () => {
  const h = routes({ token: 'admin-token', '__Host-gama_customer_A': 'customer-A' });
  assert.equal((await h.public.POST(request('POST', input, 'https://evil.example'), context)).status, 403);
  assert.equal((await h.admin.PATCH(request('PATCH', {}, 'https://evil.example'))).status, 403);
  assert.equal((await h.admin.DELETE(request('DELETE', {}, 'https://evil.example'))).status, 403);
  assert.equal(h.calls.length, 0);
});
test('administrative status and deletion forward the owner session to protected endpoints', async () => {
  const h = routes({ token: 'admin-token', '__Host-gama_customer_A': 'customer-A' });
  assert.equal((await h.admin.PATCH(request('PATCH', { id: 'order-A', status: 'enviado' }))).status, 200);
  assert.equal((await h.admin.DELETE(request('DELETE', { id: 'order-A' }))).status, 200);
  assert.equal(h.calls[0].url, '/order'); assert.equal(h.calls[1].url, '/order_item');
  assert.equal(h.calls[0].headers.Authorization, 'Bearer admin-token');
  assert.equal(h.calls[1].headers.Authorization, 'Bearer admin-token');
});
test('a customer session alone cannot authorize administrative order writes', async () => {
  const h = routes({ '__Host-gama_customer_A': 'customer-A' });
  assert.equal((await h.admin.PATCH(request('PATCH'))).status, 401);
  assert.equal((await h.admin.DELETE(request('DELETE'))).status, 401);
  assert.equal(h.calls.length, 0);
});
test('checkout proxy preserves authorization/validation errors without leaking backend details', async () => {
  for (const status of [401, 403, 422, 503]) {
    const h = routes({ '__Host-gama_customer_A': 'customer-A' }, { fail: status });
    const response = await h.public.POST(request('POST'), context);
    assert.equal(response.status, status); assert.equal(JSON.stringify(await response.json()).includes('backend secret'), false);
    assert.equal(h.calls.length, 1);
  }
});

test('checkout rejects a session replaced after confirmation before sending the order upstream', async () => {
  const h = routes({ '__Host-gama_customer_A': 'customer-A' }, { customerId: 'bob' });
  const req = new NextRequest('https://app.example/api/orders/A', {
    method: 'POST', headers: { origin: 'https://app.example', 'x-customer-id': 'alice' },
    body: JSON.stringify(input),
  });
  const response = await h.public.POST(req, context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'SESSION_CHANGED');
  assert.equal(h.calls.length, 0);
});
