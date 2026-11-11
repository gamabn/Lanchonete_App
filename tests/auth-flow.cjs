const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
/////////======================s
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => name in mocks ? mocks[name] : require(name),
    AbortController, AbortSignal, URL, console, ...globals,
  }, { filename: file });
  return exports;
}
function contextHarness() {
  let cursor = 0;
  const state = [], effects = [], requests = [], navigation = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return state[index] ||= { current: initial };
    },
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
  };
  const { ContextProvider } = load('src/app/Context/index.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '../util/api': {}, '@/app/util/chatApi': {}, '../components/ModalItem': {},
    'next/navigation': { useRouter: () => ({ replace: path => navigation.push(path), refresh() {} }) },
  }, {
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
  });
  const render = () => { cursor = 0; return ContextProvider({ children: null }).props.value; };
  return { render, effects, requests, navigation };
}
const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('old 401 cannot overwrite login; logout and a second login work', async () => {
  const h = contextHarness();
  h.render(); h.effects[0](); // initial anonymous request remains pending
  const oldRequest = h.requests[0];
  const login = h.render().login('a@example.com', 'secret');
  assert.equal(oldRequest.options.signal.aborted, true);
  h.requests[1].resolve(response(200, { success: true }));
  await tick();
  h.requests[2].resolve(response(200, { id: 'restaurant' }));
  await login;
  oldRequest.resolve(response(401));
  await tick();
  assert.equal(h.render().authStatus, 'authenticated');
  assert.equal(h.render().user.id, 'restaurant');
  const logout = h.render().logout();
  h.requests[3].resolve(response(200)); await logout;
  assert.equal(h.render().authStatus, 'unauthenticated');
  assert.equal(h.navigation[0], '/auth/login');
  const again = h.render().login('a@example.com', 'secret');
  h.requests[4].resolve(response(200)); await tick();
  h.requests[5].resolve(response(200, { id: 'restaurant' })); await again;
  assert.equal(h.render().authStatus, 'authenticated');
});

test('invalid login settles loading; expiry clears user; outages allow retry', async () => {
  const h = contextHarness(); h.render();
  const login = h.render().login('a@example.com', 'bad');
  const rejection = assert.rejects(login, /inválidos/);
  h.requests[0].resolve(response(401, { message: 'Credenciais inválidos' })); await tick();
  h.requests[1].resolve(response(401)); await rejection;
  assert.equal(h.render().loadingAuth, false);
  assert.equal(h.render().authStatus, 'unauthenticated');
  const valid = h.render().revalidateAuth();
  h.requests[2].resolve(response(200, { id: 'restaurant' })); await valid;
  const outage = h.render().revalidateAuth();
  h.requests[3].resolve(response(503)); await outage;
  assert.equal(h.render().authStatus, 'error');
  assert.equal(h.render().user.id, 'restaurant');
  const expired = h.render().revalidateAuth();
  h.requests[4].resolve(response(401)); await expired;
  assert.equal(h.render().authStatus, 'unauthenticated');
  assert.equal(h.render().user, null);
});

test('middleware protects private routes and never deletes a newer session cookie', async () => {
  let status = 200;
  const { middleware } = load('src/middleware.ts', {
    'next/server': { NextRequest, NextResponse },
    '@/app/util/backend': { backendUrl: 'http://backend.test' },
  }, { fetch: async url => { assert.equal(url, 'http://backend.test/me'); return response(status); } });
  const anonymous = await middleware(new NextRequest('http://app.test/dashboard'));
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get('location'), /auth\/login/);
  for (const [upstream, expected] of [[200, 200], [401, 307], [500, 503]]) {
    status = upstream;
    const result = await middleware(new NextRequest('http://app.test/dashboard/product', { headers: { cookie: 'token=valid' } }));
    assert.equal(result.status, expected);
    assert.equal(result.headers.get('set-cookie'), null);
  }
});


test('duplicate login is rejected without another POST', async () => {
  const h = contextHarness(); h.render();
  const first = h.render().login('a@example.com', 'secret');
  await assert.rejects(h.render().login('a@example.com', 'secret'), /andamento/);
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve(response(200)); await tick();
  h.requests[1].resolve(response(200, { id: 'restaurant' })); await first;
});

test('login API creates an httpOnly cookie and handles invalid credentials', async () => {
  let invalid = false;
  const { POST } = load('src/app/api/login/route.ts', {
    '@/app/util/api': { post: async () => {
      if (invalid) throw { isAxiosError: true, response: { status: 400 } };
      return { data: { token: 'session-token' } };
    } },
    'next/headers': {},
  }, { process: { env: { NODE_ENV: 'production' } } });
  const request = () => ({ json: async () => ({ email: 'a@example.com', password: 'secret' }) });
  const success = await POST(request());
  assert.equal(success.status, 200);
  const cookie = success.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.deepEqual(await success.json(), { success: true });
  invalid = true;
  const failure = await POST(request());
  assert.equal(failure.status, 401);
  assert.equal(failure.headers.get('set-cookie'), null);
});

test('profile API forwards cookie to backend and preserves expired-session 401', async () => {
  let token, fail = false;
  const { GET } = load('src/app/api/profile/route.ts', {
    '@/app/util/api': { get: async (path, options) => {
      assert.equal(path, '/me');
      assert.equal(options.headers.Authorization, 'Bearer session-token');
      if (fail) throw { isAxiosError: true, response: { status: 401 } };
      return { data: { id: 'restaurant' } };
    } },
    'next/headers': { cookies: async () => ({ get: () => token && { value: token } }) },
  });
  assert.equal((await GET()).status, 401);
  token = 'session-token';
  const success = await GET();
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  fail = true;
  const expired = await GET();
  assert.equal(expired.status, 401);
  assert.equal(expired.headers.get('set-cookie'), null);
});
