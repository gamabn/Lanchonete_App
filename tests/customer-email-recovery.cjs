const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, Error, AbortSignal, encodeURIComponent, process: { env: { NODE_ENV: 'production' } },
    require(name) { assert.ok(name in mocks, name); return mocks[name]; }, ...globals });
  return exports;
}
function route(options = {}) {
  const calls = [];
  const module = load('src/app/api/client/[id]/email/recovery/[action]/route.ts', {
    'next/server': { NextResponse }, axios: { isAxiosError: e => Boolean(e.isAxiosError) },
    '@/lib/customerCookie': { customerCookieName: id => `__Host-gama_customer_${id}` },
    '@/app/util/api': { async post(...args) {
      calls.push(args);
      if (options.status) throw { isAxiosError: true, response: { status: options.status, data: { error: 'smtp-secret', customer_credential: 'secret' } } };
      return { data: options.data || { challengeId: 'opaque-id', restaurant_id: 'A', customer_credential: 'jwt-for-A' } };
    } },
  });
  return { ...module, calls };
}
const context = (action = 'request', id = 'A') => ({ params: Promise.resolve({ id, action }) });
const request = (body = { email: 'alice@example.com' }, origin = 'https://app.example') => new NextRequest('https://app.example/api/client/A/email/recovery/request', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
test('recovery request needs no session, forwards restaurant scope and returns only opaque ID and neutral message', async () => {
  const h = route(); const response = await h.POST(request(), context());
  assert.equal(response.status, 202); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  const body = await response.json(); assert.equal(body.challengeId, 'opaque-id'); assert.match(body.message, /^Se houver/);
  assert.ok(!JSON.stringify(body).includes('jwt-for-A'));
  assert.equal(h.calls[0][0], '/client/A/email/recovery/request'); assert.equal(h.calls[0][2].headers, undefined);
});
test('confirmation sets only store HttpOnly Secure Strict cookie and never exposes JWT in JSON', async () => {
  const h = route(); const response = await h.POST(request({ challengeId: 'opaque-id', code: '012345' }), context('confirm'));
  assert.deepEqual(await response.json(), { recovered: true });
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /__Host-gama_customer_A=jwt-for-A/); assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=strict/i); assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/); assert.doesNotMatch(cookie, /Domain=|gama_customer_B/);
});
test('invalid codes, throttling and SMTP/backend failures set no cookie and sanitize responses', async () => {
  for (const status of [400, 429, 500, 503]) {
    const response = await route({ status }).POST(request(), context('confirm'));
    assert.equal(response.status, [400, 429].includes(status) ? status : 503);
    assert.equal(response.headers.get('set-cookie'), null); assert.ok(!JSON.stringify(await response.json()).includes('secret'));
  }
});
test('another restaurant credential or missing credential cannot set a session cookie', async () => {
  for (const data of [{ restaurant_id: 'B', customer_credential: 'other-token' }, { restaurant_id: 'A' }]) {
    const response = await route({ data }).POST(request(), context('confirm'));
    assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
  }
});
test('foreign origin and unknown action fail before backend access', async () => {
  for (const [origin, action, status] of [['https://foreign.example', 'request', 403], ['https://app.example', 'unknown', 404]]) {
    const h = route(); const response = await h.POST(request({}, origin), context(action));
    assert.equal(response.status, status); assert.equal(h.calls.length, 0);
  }
});
function componentHarness() {
  const state = [], refs = [], calls = [], active = [], busy = [];
  let cursor, refCursor, recovered = 0;
  let reply = { ok: true, json: async () => ({ challengeId: 'opaque-id', recovered: true }) };
  const jsx = (type, props) => ({ type, props });
  const module = load('src/app/clients/[idClient]/pedidos/component/CustomerEmailRecovery.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, react: {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
      useRef(initial) { const i = refCursor++; if (!refs[i]) refs[i] = { current: initial }; return refs[i]; },
    },
  }, { fetch: async (url, init) => { calls.push({ url, init }); return reply; } });
  function render() { cursor = refCursor = 0; return module.default({ restaurantId: 'A', onRecovered: () => recovered++, onActiveChange: value => active.push(value), onBusyChange: value => busy.push(value) }); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of Object.values(node)) { const found = find(child, predicate); if (found) return found; }
  }
  return { render, find, calls, active, busy, recovered: () => recovered, reply: value => { reply = value; } };
}
async function ready(h) {
  h.find(h.render(), n => n.type === 'button').props.onClick();
  h.find(h.render(), n => n.props?.['aria-label'] === 'E-mail para recuperação').props.onChange({ target: { value: 'alice@example.com' } });
  h.find(h.render(), n => n.type === 'button' && n.props?.children === 'Solicitar código').props.onClick();
  await new Promise(setImmediate);
  h.find(h.render(), n => n.props?.['aria-label'] === 'Código de recuperação').props.onChange({ target: { value: '012345' } });
}
test('discreet recovery option sends email then code and refreshes identity only after recovery', async () => {
  const h = componentHarness(); assert.equal(h.find(h.render(), n => n.type === 'button').props.children, 'Recuperar meu cadastro');
  await ready(h); assert.deepEqual(h.active, [true]);
  assert.match(h.find(h.render(), n => n.props?.role === 'status').props.children, /^Se houver/);
  h.find(h.render(), n => n.type === 'button' && n.props?.children === 'Recuperar cadastro').props.onClick(); await new Promise(setImmediate);
  assert.equal(h.calls[0].url, '/api/client/A/email/recovery/request');
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { email: 'alice@example.com' });
  assert.deepEqual(JSON.parse(h.calls[1].init.body), { challengeId: 'opaque-id', code: '012345' });
  assert.equal(h.calls[1].init.credentials, 'same-origin'); assert.equal(h.recovered(), 1);
});
test('invalid confirmation preserves input and never reports recovery; double clicks submit once', async () => {
  const h = componentHarness(); await ready(h);
  let finish; h.reply(new Promise(resolve => { finish = resolve; }));
  const button = h.find(h.render(), n => n.type === 'button' && n.props?.children === 'Recuperar cadastro');
  button.props.onClick(); button.props.onClick(); assert.equal(h.calls.length, 2);
  finish({ ok: false, json: async () => ({ error: 'Código inválido ou expirado.' }) }); await new Promise(setImmediate);
  assert.equal(h.recovered(), 0); assert.equal(h.find(h.render(), n => n.props?.role === 'alert').props.children, 'Código inválido ou expirado.');
  assert.ok(h.find(h.render(), n => n.props?.['aria-label'] === 'Código de recuperação'));
});
