const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function route(cookie = 'customer-token', failStatus) {
  const calls = [], exports = {};
  const mocks = {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: name => name === 'customer:A' && cookie ? { value: cookie } : undefined }) },
    '@/lib/customerCookie': { customerCookieName: id => `customer:${id}` },
    axios: { isAxiosError: error => Boolean(error.isAxiosError) },
    '@/app/util/api': { post: async (...args) => {
      calls.push(args);
      if (failStatus) throw { isAxiosError: true, response: { status: failStatus, data: { error: 'provider-secret' } } };
      return { status: 202, data: { challengeId: 'test-challenge', verified: true, customer_credential: 'must-not-leak' } };
    } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(
    'src/app/api/client/[id]/email/verification/[action]/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require(name) { assert.ok(name in mocks, name); return mocks[name]; }, encodeURIComponent });
  return { ...exports, calls };
}
const context = (id = 'A', action = 'request') => ({ params: Promise.resolve({ id, action }) });
function request(origin = 'https://app.example') {
  return new NextRequest('https://app.example/api/client/A/email/verification/request', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }),
  });
}
test('only the matching HttpOnly customer cookie is forwarded, with no cookie/JWT replacement', async () => {
  const h = route(); const response = await h.POST(request(), context());
  assert.equal(response.status, 202);
  assert.equal(h.calls[0][0], '/client/A/email/verification/request');
  assert.equal(h.calls[0][2].headers.Authorization, 'Bearer customer-token');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!JSON.stringify(await response.json()).includes('must-not-leak'));
});
test('missing cookie, another restaurant, foreign origin and unknown actions fail before backend calls', async () => {
  for (const [cookie, origin, ctx, status] of [
    [null, 'https://app.example', context(), 401],
    ['token', 'https://app.example', context('B'), 401],
    ['token', 'https://foreign.example', context(), 403],
    ['token', 'https://app.example', context('A', 'recover'), 404],
  ]) {
    const h = route(cookie); assert.equal((await h.POST(request(origin), ctx)).status, status);
    assert.equal(h.calls.length, 0);
  }
});
test('verification confirmation reuses the same session and sanitizes upstream errors', async () => {
  const h = route(); const response = await h.POST(request(), context('A', 'confirm'));
  assert.equal((await response.json()).verified, true);
  assert.equal(response.headers.get('set-cookie'), null);
  for (const status of [400, 401, 403, 429, 503]) {
    const failed = await route('token', status).POST(request(), context());
    assert.equal(failed.status, status);
    assert.ok(!JSON.stringify(await failed.json()).includes('provider-secret'));
  }
});

function componentHarness() {
  const state = [], refs = [], calls = []; let cursor, refCursor;
  let reply = { ok: true, json: async () => ({ challengeId: 'challenge', verified: true }) };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(
    'src/app/clients/[idClient]/pedidos/component/CustomerEmailVerification.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, AbortSignal,
    fetch: async (url, init) => { calls.push({ url, init }); return reply; },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      assert.equal(name, 'react');
      return {
        useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
          return [state[i], value => { state[i] = value; }]; },
        useRef(initial) { const i = refCursor++; if (!refs[i]) refs[i] = { current: initial }; return refs[i]; },
      };
    },
  });
  function render() { cursor = refCursor = 0; return exports.default({ restaurantId: 'A' }); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of Object.values(node)) { const result = find(child, predicate); if (result) return result; }
  }
  return { render, find, calls, reply: value => { reply = value; } };
}

test('optional email component shows code and confirmation after sending, then success without changing checkout', async () => {
  const { render, find, calls } = componentHarness();
  let tree = render(); assert.equal(calls.length, 0);
  find(tree, node => node.type === 'button').props.onClick();
  tree = render();
  find(tree, node => node.props?.['aria-label'] === 'E-mail para verificação').props.onChange({ target: { value: 'alice@example.com' } });
  tree = render();
  find(tree, node => node.type === 'button' && node.props?.children === 'Enviar código').props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'alice@example.com' });
  assert.equal(calls[0].init.credentials, 'same-origin');
  tree = render();
  assert.ok(find(tree, node => node.type === 'button' && node.props?.children === 'Confirmar código'));
  assert.equal(find(tree, node => node.props?.['aria-label'] === 'E-mail para verificação').props.disabled, true);
  find(tree, node => node.props?.['aria-label'] === 'Código de verificação').props.onChange({ target: { value: '012345' } });
  tree = render();
  find(tree, node => node.type === 'button' && node.props?.children === 'Confirmar código').props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(calls[1].init.body), { challengeId: 'challenge', code: '012345' });
  assert.equal(calls[1].url, '/api/client/A/email/verification/confirm');
  assert.equal(find(render(), node => node.type === 'input'), undefined);
  assert.equal(find(render(), node => node.props?.role === 'status').props.children, 'E-mail verificado com sucesso.');
});

async function readyToConfirm(h) {
  h.find(h.render(), node => node.type === 'button' && node.props).props.onClick();
  h.find(h.render(), node => node.props?.['aria-label'] === 'E-mail para verificação').props.onChange({ target: { value: 'alice@example.com' } });
  h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Enviar código').props.onClick();
  await new Promise(setImmediate);
  h.find(h.render(), node => node.props?.['aria-label'] === 'Código de verificação').props.onChange({ target: { value: '012345' } });
}

test('invalid and expired codes show an error while leaving confirmation available', async () => {
  for (const error of ['Código inválido.', 'Código expirado.']) {
    const h = componentHarness(); await readyToConfirm(h);
    h.reply({ ok: false, json: async () => ({ error }) });
    h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Confirmar código').props.onClick();
    await new Promise(setImmediate);
    assert.equal(h.find(h.render(), node => node.props?.role === 'alert').props.children, error);
    assert.equal(h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Confirmar código').props.disabled, false);
  }
});

test('confirmation is disabled during the request and double clicks produce one POST', async () => {
  const h = componentHarness(); await readyToConfirm(h);
  let finish;
  h.reply(new Promise(resolve => { finish = resolve; }));
  const button = h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Confirmar código');
  button.props.onClick(); button.props.onClick();
  assert.equal(h.calls.length, 2); // One request-code POST and one confirmation POST.
  assert.equal(h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Aguarde…').props.disabled, true);
  finish({ ok: true, json: async () => ({ verified: true }) });
  await new Promise(setImmediate);
  assert.equal(h.find(h.render(), node => node.props?.role === 'status').props.children, 'E-mail verificado com sucesso.');
});

test('changing email requires an explicit action and clears the previous challenge', async () => {
  const h = componentHarness(); await readyToConfirm(h);
  h.find(h.render(), node => node.type === 'button' && node.props?.children === 'Alterar e-mail').props.onClick();
  assert.equal(h.find(h.render(), node => node.props?.['aria-label'] === 'E-mail para verificação').props.disabled, false);
  assert.equal(h.find(h.render(), node => node.props?.['aria-label'] === 'Código de verificação'), undefined);
  assert.equal(h.calls.length, 1);
});
