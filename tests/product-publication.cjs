const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Error, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, ...globals,
  });
  return exports;
}

const id = '00000000-0000-4000-8000-000000000010';
const client = load('src/app/dashboard/product/configuredProductClient.ts');

function editorHarness(options = {}) {
  const states = [], refs = [], calls = [], updates = [];
  let stateIndex = 0, refIndex = 0;
  let configuration = {
    product: { id, name: 'Quentinha', price: '15.00', published: false, available: true, image_url: null },
    variants: [{ id: 'size', name: 'P', price: '15.00', available: true, groupLimits: [] }],
    groups: [],
  };
  let published = false, releasePublish;
  const wait = options.deferPublish ? new Promise(resolve => { releasePublish = resolve; }) : Promise.resolve();
  const jsx = (type, props) => ({ type, props });
  const Editor = load('src/app/dashboard/product/ConfiguredProductEditor.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useRef(initial) {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/image': {},
    './configuredProductClient': {
      ...client,
      async requestProduct(url, _fallback, init = {}) {
        calls.push({ url, init });
        if (url.endsWith('/validate-publication')) {
          if (options.validationNetworkError) throw new Error('Falha de rede.');
          return options.validation || { valid: true, errors: [] };
        }
        if (url.endsWith('/publish')) {
          await wait;
          if (options.publishError) throw options.publishError;
          published = true;
          return { product: { ...configuration.product, published } };
        }
        assert.ok(url.endsWith('/configuration'));
        return { ...configuration, product: { ...configuration.product, published } };
      },
    },
  }, { window: { confirm: () => options.confirm !== false } }).default;

  function render() {
    stateIndex = 0; refIndex = 0;
    return Editor({
      configuration,
      onRefresh(data) { configuration = data; updates.push(data); },
      onBusy() {},
    });
  }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of Object.values(node)) {
      const result = find(child, predicate);
      if (result) return result;
    }
  }
  function button(tree, label) {
    return find(tree, node => node.type === 'button' && node.props?.children === label);
  }
  const flush = () => new Promise(setImmediate);
  return { render, find, button, calls, updates, flush, release: () => releasePublish?.() };
}

test('validation gates publication, confirmation and repeated clicks produce one publish request and update status', async () => {
  const h = editorHarness({ deferPublish: true });
  let tree = h.render();
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
  h.button(tree, 'Validar produto').props.onClick();
  await h.flush();
  tree = h.render();
  const publish = h.button(tree, 'Publicar produto');
  assert.ok(publish);
  publish.props.onClick();
  publish.props.onClick();
  assert.equal(h.calls.filter(call => call.url.endsWith('/publish')).length, 1);
  h.release();
  await h.flush();
  tree = h.render();
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
  assert.equal(h.updates.at(-1).product.published, true);
  assert.match(JSON.stringify(tree), /Publicado/);
});

test('invalid products display individual backend errors and never offer publication', async () => {
  const h = editorHarness({ validation: { valid: false, errors: ['Nenhum tamanho ativo.', 'Opções insuficientes.'] } });
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  const tree = h.render();
  assert.match(JSON.stringify(tree), /Nenhum tamanho ativo/);
  assert.match(JSON.stringify(tree), /Opções insuficientes/);
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
});

test('cancelling confirmation leaves the product unpublished', async () => {
  const h = editorHarness({ confirm: false });
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  h.button(h.render(), 'Publicar produto').props.onClick();
  await h.flush();
  assert.equal(h.calls.some(call => call.url.endsWith('/publish')), false);
});

test('unsaved edits invalidate validation and prevent stale button callbacks from publishing', async () => {
  const h = editorHarness();
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  let tree = h.render();
  const publish = h.button(tree, 'Publicar produto');
  const form = h.find(tree, node => node.type === 'form' && node.props?.onSubmit?.name === 'saveConfiguration');
  form.props.onChangeCapture();
  publish.props.onClick();
  tree = h.render();
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
  assert.equal(h.button(tree, 'Validar produto').props.disabled, true);
  assert.equal(h.calls.some(call => call.url.endsWith('/publish')), false);
});

test('network validation errors allow a safe GET retry and keep publication unavailable', async () => {
  const h = editorHarness({ validationNetworkError: true });
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  const tree = h.render();
  assert.match(JSON.stringify(tree), /Falha de rede/);
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
  assert.equal(h.button(tree, 'Validar produto').props.disabled, false);
});

test('publication revalidation failures display server details and require another validation', async () => {
  const h = editorHarness({
    publishError: new client.ProductRequestError('Produto inválido.', 422, ['O grupo exige duas opções disponíveis.']),
  });
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  h.button(h.render(), 'Publicar produto').props.onClick();
  await h.flush();
  const tree = h.render();
  assert.match(JSON.stringify(tree), /O grupo exige duas opções disponíveis/);
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
});

test('an ambiguous publication network failure blocks further writes until status is reloaded', async () => {
  const h = editorHarness({ publishError: new Error('Falha de rede.') });
  h.button(h.render(), 'Validar produto').props.onClick();
  await h.flush();
  h.button(h.render(), 'Publicar produto').props.onClick();
  await h.flush();
  const tree = h.render();
  assert.ok(h.button(tree, 'Recarregar configuração'));
  assert.equal(h.button(tree, 'Validar produto').props.disabled, true);
  assert.equal(h.button(tree, 'Publicar produto'), undefined);
});

test('publication proxies use only the admin cookie, reject cross-origin requests and preserve validation details', async () => {
  let token = 'owner-token';
  const calls = [];
  const proxy = load('src/app/api/product/configuredProxy.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { async request(config) {
      calls.push(config);
      if (config.method === 'PATCH') throw { response: { status: 422, data: { error: 'Inválido.', details: ['Revise as opções.'] } } };
      return { status: 200, data: { valid: true, errors: [] } };
    } },
  });
  const { GET } = load('src/app/api/product/[productId]/validate-publication/route.ts', { '../../configuredProxy': proxy });
  const { PATCH } = load('src/app/api/product/[productId]/publish/route.ts', { '../../configuredProxy': proxy });
  const context = { params: Promise.resolve({ productId: id }) };
  const request = origin => new NextRequest(`https://app.example/api/product/${id}/publish`, {
    method: 'PATCH', headers: { origin }, body: '{}',
  });
  token = undefined;
  assert.equal((await GET(null, context)).status, 401);
  token = 'owner-token';
  assert.equal((await PATCH(request('https://other.example'), context)).status, 403);
  const valid = await GET(null, context);
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  const published = await PATCH(request('https://app.example'), context);
  assert.equal(published.status, 422);
  assert.deepEqual((await published.json()).details, ['Revise as opções.']);
  assert.equal(calls[0].url, `/products/${id}/validate-publication`);
  assert.equal(calls[1].url, `/products/${id}/publish`);
  assert.equal(calls[1].headers.Authorization, 'Bearer owner-token');
});
