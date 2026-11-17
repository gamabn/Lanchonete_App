const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const categoryModule = {exports:{}};
new Function('exports', ts.transpileModule(fs.readFileSync('src/app/dashboard/product/productCategory.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(categoryModule.exports);
const categoryHelpers = categoryModule.exports;
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
  const states = [], refs = [], calls = [], updates = [], pending = [];
  let stateIndex = 0, refIndex = 0;
  let configuration = {
    product: { id: options.productId ?? id, category: options.category ?? null, name: 'Quentinha', price: '15.00', published: Boolean(options.published), available: true, image_url: null },
    variants: options.variants || [{ id: 'size', name: 'P', price: '15.00', available: true, groupLimits: [] }],
    groups: options.groups || [],
  };
  let published = Boolean(options.published), releasePublish;
  const wait = options.deferPublish ? new Promise(resolve => { releasePublish = resolve; }) : Promise.resolve();
  const jsx = (type, props, key) => ({ type, props, key });
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
    './CategoryField':{__esModule:true,default:()=>null},
    './productCategory':categoryHelpers,
    './productReview':load('src/app/dashboard/product/productReview.ts'),
    './configuredProductClient': {
      ...client,
      async requestProduct(url, _fallback, init = {}) {
        calls.push({ url, init });
        if (url === '/api/product' && init.method === 'PUT') {
          if (options.imageError) throw options.imageError;
          configuration.product.image_url = 'saved-image';
          return configuration.product;
        }
        if (url === '/api/product/options' || url.startsWith('/api/product/options/')) { if (options.optionError) throw options.optionError; return {}; }
        if (url.endsWith('/structure')) {
          if (options.structureError) throw options.structureError;
          const body = JSON.parse(init.body);
          if (body.action === 'addGroup') configuration.groups.push({ id: 'new-group', name: body.name, required: body.required,
            minSelect: body.minSelect, maxSelect: body.maxSelect, options: [] });
          if (body.action === 'addVariant') configuration.variants.push({ id: 'new-size', name: body.name, price: body.price, available: true, groupLimits: [] });
          if (body.action === 'removeGroup') configuration.groups = configuration.groups.filter(group => group.id !== body.id);
          return { message: 'Estrutura salva.' };
        }
        if (init.method === 'DELETE') {
          if (options.deleteError) throw options.deleteError;
          await wait;
          updates.push('deleted');
          return { message: 'Excluído.' };
        }
        if (url.endsWith('/deactivate')) {
          configuration.product.available = false;
          return configuration.product;
        }
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
        if (url.endsWith('/configuration') && init.method === 'PATCH') {
          if (options.saveError) throw options.saveError;
          const body = JSON.parse(init.body);
          configuration.product.category = body.category;
        }
        if (url.endsWith('/configuration') && !init.method && options.refreshError) throw options.refreshError;
        assert.ok(url.endsWith('/configuration'));
        return { ...configuration, product: { ...configuration.product, published } };
      },
    },
    './PrivateTemplateControls': { SavePrivateTemplate: () => null },
  }, { File, window: { confirm: () => options.confirm !== false }, FormData: class {
    constructor(form) { this.values = form.values; }
    set(key, value) { this.values[key] = value; }
    get(key) { return this.values[key] ?? null; }
    has(key) { return Boolean(this.values[key]); }
  } }).default;

  function render() {
    stateIndex = 0; refIndex = 0;
    return Editor({
      configuration,
      onRefresh(data) { configuration = data; updates.push(data); },
      onBusy() {},
      onPendingChange(value) { pending.push(value); },
      onDeleted() { updates.push('removed-from-list'); },
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
    return find(tree, node => node.type === 'button' && (Array.isArray(node.props?.children) ? node.props.children.join('') : node.props?.children) === label);
  }
  const flush = () => new Promise(setImmediate);
  return { render, find, button, calls, updates, pending, flush, replaceProduct(productId) { configuration = { ...configuration, product: { ...configuration.product, id: productId } }; }, release: () => releasePublish?.() };
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

test('admin configuration proxy preserves editor GET/PATCH contracts and upstream errors', async () => {
  let token = 'admin-test-token';
  let status = 200;
  const calls = [];
  const configuration = { product: { id }, variants: [], groups: [] };
  const body = { name: 'Produto', variants: [], groups: [] };
  const proxy = load('src/app/api/product/configuredProxy.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: name => {
      assert.equal(name, 'token'); return token ? { value: token } : undefined;
    } }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { async request(config) {
      calls.push(config);
      if (status !== 200) throw { response: { status, data: { error: 'Rejeitado.', details: ['Revise os dados.'] } } };
      return { status, data: config.method === 'GET' ? configuration : { product: { id } } };
    } },
  });
  const route = load('src/app/api/product/[productId]/configuration/route.ts', { '../../configuredProxy': proxy });
  const context = { params: Promise.resolve({ productId: id }) };
  const request = (origin = 'https://app.example', data = body) => new NextRequest(`https://app.example/api/product/${id}/configuration`, {
    method: 'PATCH', headers: { origin }, body: JSON.stringify(data),
  });
  const get = await route.GET(null, context);
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), configuration);
  const patch = await route.PATCH(request(), context);
  assert.equal(patch.status, 200);
  assert.deepEqual(await patch.json(), { product: { id } });
  assert.deepEqual(calls.map(call => call.method), ['GET', 'PATCH']);
  for (const call of calls) {
    assert.equal(call.url, `/products/${id}/admin-configuration`);
    assert.equal(call.headers.Authorization, 'Bearer admin-test-token');
  }
  assert.deepEqual(calls[1].data, body);
  assert.equal(get.headers.get('cache-control'), 'no-store');
  for (const code of [400, 401, 404, 422]) {
    status = code;
    assert.equal((await route.GET(null, context)).status, code);
    assert.equal((await route.PATCH(request(), context)).status, code);
  }
  const before = calls.length;
  token = undefined;
  assert.equal((await route.GET(null, context)).status, 401);
  assert.equal((await route.PATCH(request(), context)).status, 401);
  token = 'admin-test-token';
  assert.equal((await route.PATCH(request('https://other.example'), context)).status, 403);
  assert.equal((await route.PATCH(request('https://app.example', []), context)).status, 400);
  const invalid = { params: Promise.resolve({ productId: 'invalid' }) };
  assert.equal((await route.GET(null, invalid)).status, 400);
  assert.equal((await route.PATCH(request(), invalid)).status, 400);
  assert.equal(calls.length, before);
});

test('draft deletion requires confirmation, prevents duplicate clicks and handles history conflicts', async () => {
  const cancelled = editorHarness({ confirm: false });
  cancelled.button(cancelled.render(), 'Excluir rascunho').props.onClick();
  await cancelled.flush();
  assert.equal(cancelled.calls.length, 0);
  const h = editorHarness({ deferPublish: true });
  const remove = h.button(h.render(), 'Excluir rascunho');
  remove.props.onClick(); remove.props.onClick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, '/api/product');
  assert.equal(h.calls[0].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { product_id: id });
  h.release(); await h.flush();
  assert.ok(h.updates.includes('removed-from-list'));
  const rejected = editorHarness({ deleteError: new client.ProductRequestError('Produto com pedidos. Desative o produto.', 409) });
  rejected.button(rejected.render(), 'Excluir rascunho').props.onClick();
  await rejected.flush();
  assert.match(JSON.stringify(rejected.render()), /Produto com pedidos/);
});

test('published product offers deactivation instead of permanent deletion and refreshes availability', async () => {
  const h = editorHarness({ published: true });
  const tree = h.render();
  assert.equal(h.button(tree, 'Excluir rascunho'), undefined);
  h.button(tree, 'Desativar produto').props.onClick();
  await h.flush();
  assert.equal(h.calls[0].url, `/api/product/${id}/deactivate`);
  assert.equal(h.calls[0].init.method, 'PATCH');
  assert.equal(h.updates.at(-1).product.available, false);
  assert.equal(h.updates.at(-1).product.published, true);
});

test('deactivation proxy uses admin cookie and enforces origin', async () => {
  let token = 'owner';
  const calls = [];
  const proxy = load('src/app/api/product/configuredProxy.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: name => {
      assert.equal(name, 'token'); return token ? { value: token } : undefined;
    } }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { async request(config) {
      calls.push(config);
      return { status: 200, data: { id, available: false } };
    } },
  });
  const { PATCH } = load('src/app/api/product/[productId]/deactivate/route.ts', { '../../configuredProxy': proxy });
  const context = { params: Promise.resolve({ productId: id }) };
  const req = origin => new NextRequest(`https://app.example/api/product/${id}/deactivate`, { method: 'PATCH', headers: { origin }, body: '{}' });
  assert.equal((await PATCH(req('https://evil.example'), context)).status, 403);
  token = undefined;
  assert.equal((await PATCH(req('https://app.example'), context)).status, 401);
  assert.equal(calls.length, 0);
  token = 'owner';
  assert.equal((await PATCH(req('https://app.example'), context)).status, 200);
  assert.equal(calls[0].url, `/products/${id}/deactivate`);
  assert.equal(calls[0].headers.Authorization, 'Bearer owner');
});

test('unsaved edits block deletion and cancelled deactivation makes no request', async () => {
  const h = editorHarness();
  const tree = h.render();
  const remove = h.button(tree, 'Excluir rascunho');
  const form = h.find(tree, node => node.type === 'form' && node.props?.onSubmit?.name === 'saveConfiguration');
  form.props.onChangeCapture();
  remove.props.onClick();
  await h.flush();
  assert.equal(h.calls.length, 0);
  assert.equal(h.button(h.render(), 'Excluir rascunho').props.disabled, true);
  const cancelled = editorHarness({ confirm: false, published: true });
  cancelled.button(cancelled.render(), 'Desativar produto').props.onClick();
  await cancelled.flush();
  assert.equal(cancelled.calls.length, 0);
});

test('existing editor adds named sizes and groups through scoped structure endpoint then reloads', async () => {
  const h = editorHarness();
  const form = name => h.find(h.render(), node => node.type === 'form' && node.props?.['aria-label'] === name);
  const size = form('Adicionar tamanho');
  size.props.onChangeCapture({ currentTarget: { values: { name: "700 ml", price: "25,90" } } });
  size.props.onSubmit({ preventDefault() {}, currentTarget: { values: { name: '700 ml', price: '25,90' }, reset() {} } });
  await h.flush();
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { action: 'addVariant', name: '700 ml', price: '25.90' });
  assert.equal(h.calls[0].url, `/api/product/${id}/structure`);
  assert.equal(h.updates.at(-1).variants.length, 2);
  const group = form('Adicionar grupo');
  group.props.onChangeCapture({ currentTarget: { values: { name: "Coberturas", "new-group-min": "0", "new-group-max": "3" } } });
  group.props.onSubmit({ preventDefault() {}, currentTarget: {
    values: { name: 'Coberturas', 'new-group-min': '0', 'new-group-max': '3' }, reset() {},
  } });
  await h.flush();
  assert.deepEqual(JSON.parse(h.calls[2].init.body), { action: 'addGroup', name: 'Coberturas', required: false, minSelect: 0, maxSelect: 3 });
  assert.equal(h.updates.at(-1).groups[0].name, 'Coberturas');
  h.button(h.render(), 'Remover grupo').props.onClick();
  await h.flush();
  assert.deepEqual(JSON.parse(h.calls[4].init.body), { action: 'removeGroup', id: 'new-group' });
  assert.equal(h.updates.at(-1).groups.length, 0);
});

test('structure failures preserve the editor and show errors; pending edits block structural writes', async () => {
  const h = editorHarness({ structureError: new client.ProductRequestError('Grupo com pedidos não pode ser removido.', 409) });
  let tree = h.render();
  const group = h.find(tree, node => node.type === 'form' && node.props?.['aria-label'] === 'Adicionar grupo');
  group.props.onSubmit({ preventDefault() {}, currentTarget: { values: { name: 'G', 'new-group-min': '0', 'new-group-max': '1' }, reset() {} } });
  await h.flush();
  assert.match(JSON.stringify(h.render()), /Grupo com pedidos/);
  const before = h.calls.length;
  tree = h.render();
  h.find(tree, node => node.type === 'form' && node.props?.onSubmit?.name === 'saveConfiguration').props.onChangeCapture();
  group.props.onSubmit({ preventDefault() {}, currentTarget: { values: {}, reset() {} } });
  await h.flush();
  assert.equal(h.calls.length, before);
});

test('creation and structural proxies preserve session, reject cross-origin and anonymous writes', async () => {
  let token = 'admin';
  const calls = [];
  const proxy = load('src/app/api/product/configuredProxy.ts', {
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({ get: name => { assert.equal(name, 'token'); return token ? { value: token } : undefined; } }) },
    axios: { isAxiosError: error => Boolean(error.response) },
    '@/app/util/api': { async request(config) { calls.push(config); return { status: 201, data: { product: { id, published: false } } }; } },
  });
  const create = load('src/app/api/product/configured/route.ts', { '../configuredProxy': proxy });
  const structure = load('src/app/api/product/[productId]/structure/route.ts', { '../../configuredProxy': proxy });
  const context = { params: Promise.resolve({ productId: id }) };
  const req = origin => new NextRequest('https://app.example/api/product/configured', { method: 'POST', headers: { origin }, body: JSON.stringify({ name: 'Açaí', variantName: '300 ml', price: '10' }) });
  for (const route of [create, structure]) {
    assert.equal((await route.POST(req('https://evil.example'), context)).status, 403);
    token = undefined;
    assert.equal((await route.POST(req('https://app.example'), context)).status, 401);
    token = 'admin';
    assert.equal((await route.POST(req('https://app.example'), context)).status, 201);
  }
  assert.deepEqual(calls.map(call => call.url), ['/products/configured', `/products/${id}/structure`]);
  assert.ok(calls.every(call => call.headers.Authorization === 'Bearer admin'));
  assert.equal((await structure.POST(req('https://app.example'), { params: Promise.resolve({ productId: 'invalid' }) })).status, 400);
});

for (const category of ['Bebidas', null]) {
  test(`configuration category ${category} survives variant saves and supports explicit removal`, async () => {
    const h=editorHarness({category});
    let tree=h.render();
    const field=h.find(tree,n=>n.props?.suggestions && Object.prototype.hasOwnProperty.call(n.props,'defaultValue'));
    assert.equal(field.props.defaultValue,category??'');
    const values={name:'Quentinha',description:'Descrição',available:true,'size-size-name':'P','size-price':'15.00','size-available':true,category:category??''};
    let form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
    form.props.onChangeCapture();
    assert.match(JSON.stringify(h.render()),/Salve as alterações/);
    form.props.onSubmit({preventDefault(){},currentTarget:{values}});await h.flush();
    let call=h.calls.find(c=>c.init.method==='PATCH'&&c.url.endsWith('/configuration'));
    assert.equal(JSON.parse(call.init.body).category,category);
    assert.equal(JSON.parse(call.init.body).variants[0].price,'15.00');
    tree=h.render();form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
    form.props.onChangeCapture();form.props.onSubmit({preventDefault(){},currentTarget:{values:{...values,category:''}}});await h.flush();
    call=h.calls.filter(c=>c.init.method==='PATCH'&&c.url.endsWith('/configuration')).at(-1);
    assert.equal(JSON.parse(call.init.body).category,null);
    assert.equal(h.updates.at(-1).product.category,null);
  });
}

function collectEditorNodes(node, predicate, output = []) {
  if (!node || typeof node !== 'object') return output;
  if (predicate(node)) output.push(node);
  for (const value of Object.values(node)) collectEditorNodes(value, predicate, output);
  return output;
}

test('editor presents essentials first and all secondary actions inside final management section',()=>{
 const h=editorHarness();const tree=h.render();
 const headings=collectEditorNodes(tree,n=>n.type==='h3').map(n=>n.props.children);
 assert.deepEqual(headings,['Revisão do produto','Informações do produto','Tamanhos e preços','Personalizações','Adicionar tamanhos e grupos','Imagem do produto','Validação e publicação','Gerenciar produto']);
 const management=h.find(tree,n=>n.type==='section'&&h.find(n,c=>c.type==='h3'&&c.props?.children==='Gerenciar produto'));
 assert.ok(h.find(management,n=>n.type?.name==='SavePrivateTemplate'));
 assert.ok(h.button(management,'Desativar produto'));assert.ok(h.button(management,'Excluir rascunho'));
 const main=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 assert.equal(h.button(tree,'Salvar informações e configuração').props.form,main.props.id);
 assert.equal(h.find(main,n=>n.type?.name==='SavePrivateTemplate'),undefined);
 function check(node,inForm=false){
  if(!node||typeof node!=='object')return;
  if(node.type==='form')assert.equal(inForm,false,'Forms must remain siblings');
  for(const value of Object.values(node))check(value,inForm||node.type==='form');
 }
 check(tree);
});

test('pending configuration preserves fields and revision and blocks secondary actions',()=>{
 const h=editorHarness();let tree=h.render();
 const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 const fields=collectEditorNodes(form,n=>n.type==='input'||n.type==='textarea').map(n=>n.props.name);
 const revision=h.find(form,n=>n.type==='fieldset').key;
 form.props.onChangeCapture();tree=h.render();
 const updated=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 assert.deepEqual(collectEditorNodes(updated,n=>n.type==='input'||n.type==='textarea').map(n=>n.props.name),fields);
 assert.equal(h.find(updated,n=>n.type==='fieldset').key,revision);
 assert.equal(h.button(tree,'Desativar produto').props.disabled,true);assert.equal(h.button(tree,'Excluir rascunho').props.disabled,true);
 assert.equal(h.find(tree,n=>n.type?.name==='SavePrivateTemplate').props.disabled,true);
 assert.equal(h.calls.length,0);
});

test('image remains a separate multipart save with the same product and imageOnly contract',async()=>{
 const h=editorHarness();const tree=h.render();
 const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveImage');
 let resets=0;const file=new File(['png'],'product.png',{type:'image/png'});
 form.props.onSubmit({preventDefault(){},currentTarget:{values:{file},reset(){resets++;}}});await h.flush();
 const call=h.calls.find(c=>c.url==='/api/product');assert.equal(call.init.method,'PUT');
 assert.equal(call.init.body.get('file'),file);assert.equal(call.init.body.get('product_id'),id);assert.equal(call.init.body.get('imageOnly'),'true');assert.equal(call.init.body.get('category'),null);
 assert.equal(resets,1);
});

test('option/additional form keeps its independent payload and descriptive save action',async()=>{
 const group={id:'g',name:'Extras',required:false,minSelect:0,maxSelect:1,options:[{id:'o',name:'Queijo',additionalPrice:2,available:true}]};
 const h=editorHarness({groups:[group]});const tree=h.render();
 const option=h.find(tree,n=>n.type?.name==='OptionForm'&&n.props.option);
 const optionTree=option.type(option.props);assert.ok(h.button(optionTree,'Salvar opção e adicional'));
 optionTree.props.onSubmit({preventDefault(){},currentTarget:{values:{name:'Queijo',price:'2,00',available:true}}});await h.flush();
 const call=h.calls.find(c=>c.url==='/api/product/options/o');assert.equal(call.init.method,'PATCH');
 assert.deepEqual(JSON.parse(call.init.body),{name:'Queijo',additionalPrice:2,available:true});
});

const groupFixture = (id,name,required=false,minSelect=0,maxSelect=2) => ({id,name,required,minSelect,maxSelect,options:[{id:`${id}-option`,name:`Opção ${name}`,additionalPrice:2,available:true}]});
function groupSection(h,tree,name){return h.find(tree,n=>n.type==='section'&&n.props?.['aria-label']===`Grupo ${name}`);}
function renderBoundControls(section){
 return collectEditorNodes(section,n=>n.type?.name==='BoundFields').flatMap(n=>collectEditorNodes(n.type(n.props),c=>c.type==='input'));
}

test('each group owns its rules, summary, count and option forms without nested forms',()=>{
 const h=editorHarness({groups:[groupFixture('g1','Proteínas',true,1,2),groupFixture('g2','Bebidas')]});const tree=h.render();
 const main=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 for(const [groupId,name] of [['g1','Proteínas'],['g2','Bebidas']]){
  const card=groupSection(h,tree,name);assert.ok(card);
  assert.match(JSON.stringify(card),/1 opção cadastrada/);
  const optionNodes=collectEditorNodes(card,n=>n.type?.name==='OptionForm');assert.equal(optionNodes.length,2);
  assert.ok(optionNodes.every(n=>n.props.groupId===groupId));assert.equal(optionNodes[0].props.option.id,groupId+'-option');
  const metadata=h.find(card,n=>n.type==='fieldset');
  assert.ok(collectEditorNodes(metadata,n=>n.type==='input').every(n=>n.props.form===main.props.id));
  assert.ok(renderBoundControls(metadata).every(n=>n.props.form===main.props.id));
  assert.equal(main.props.id,`product-configuration-${id}`);
  for(const node of optionNodes){const rendered=node.type(node.props);assert.equal(rendered.type,'form');assert.equal(rendered.props.form,undefined);}
 }
 function checkForms(node, inside = false) {
  if (!node || typeof node !== 'object') return;
  if (node.type?.name === 'OptionForm' || node.type?.name === 'BoundFields') return checkForms(node.type(node.props), inside);
  if (node.type === 'form') assert.equal(inside, false, 'Group and option forms cannot be nested');
  for (const value of Object.values(node)) checkForms(value, inside || node.type === 'form');
 }
 checkForms(tree);
 assert.match(JSON.stringify(groupSection(h,tree,'Proteínas')),/Obrigatório/);assert.match(JSON.stringify(groupSection(h,tree,'Proteínas')),/Escolha de 1 a 2 opções/);
 assert.match(JSON.stringify(groupSection(h,tree,'Bebidas')),/Opcional/);assert.match(JSON.stringify(groupSection(h,tree,'Bebidas')),/Escolha até 2 opções/);
});

test('new options and existing availability updates use only the matching group/option contracts',async()=>{
 const h=editorHarness({groups:[groupFixture('g1','Proteínas'),groupFixture('g2','Bebidas')]});let tree=h.render();
 const card=groupSection(h,tree,'Bebidas');const fresh=h.find(card,n=>n.type?.name==='OptionForm'&&!n.props.option);
 let resets=0;fresh.type(fresh.props).props.onSubmit({preventDefault(){},currentTarget:{values:{name:'Nova bebida',price:'3,50'},reset(){resets++;}}});await h.flush();
 const create=h.calls.find(c=>c.url==='/api/product/options');assert.deepEqual(JSON.parse(create.init.body),{name:'Nova bebida',additionalPrice:3.5,groupId:'g2'});assert.equal(resets,1);
 tree=h.render();const existing=h.find(groupSection(h,tree,'Proteínas'),n=>n.type?.name==='OptionForm'&&n.props.option);
 existing.type(existing.props).props.onSubmit({preventDefault(){},currentTarget:{values:{name:'Opção Proteínas',price:'2,00',available:false}}});await h.flush();
 const update=h.calls.find(c=>c.url==='/api/product/options/g1-option');assert.deepEqual(JSON.parse(update.init.body),{name:'Opção Proteínas',additionalPrice:2,available:false});
});

test('collapsing preserves pending metadata and option forms, revision and disabled state',()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();let card=groupSection(h,tree,'Extras');
 const metadata=h.find(card,n=>n.type==='fieldset');metadata.props.onChangeCapture();
 const existing=h.find(card,n=>n.type?.name==='OptionForm'&&n.props.option);existing.props.onDirty(true);
 const originalKeys=collectEditorNodes(card,n=>n.type==='fieldset'||n.type?.name==='OptionForm').map(n=>n.key);
 h.button(card,'Recolher grupo').props.onClick();tree=h.render();card=groupSection(h,tree,'Extras');
 assert.equal(h.find(card,n=>n.props?.id===`product-${id}-group-g`).props.hidden,true);
 assert.equal(h.find(card,n=>n.type==='fieldset').props.disabled,false);
 assert.equal(collectEditorNodes(card,n=>n.type?.name==='OptionForm').length,2);
 assert.deepEqual(collectEditorNodes(card,n=>n.type==='fieldset'||n.type?.name==='OptionForm').map(n=>n.key),originalKeys);
 assert.equal(h.button(tree,'Validar produto').props.disabled,true);assert.equal(h.button(card,'Remover grupo').props.disabled,true);
 assert.equal(h.find(card,n=>n.type?.name==='OptionForm'&&n.props.option).props.disabled,false);
 h.button(card,'Expandir grupo').props.onClick();tree=h.render();assert.equal(h.find(groupSection(h,tree,'Extras'),n=>n.props?.id===`product-${id}-group-g`).props.hidden,false);
 assert.equal(h.calls.length,0);
});

test('hidden invalid group controls reopen their panel without changing dirty state',()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();tree=h.render();
 const panel=h.find(groupSection(h,tree,'Extras'),n=>n.props?.id===`product-${id}-group-g`);
 const target={hidden:true};panel.props.onInvalidCapture({currentTarget:target});assert.equal(target.hidden,false);
 tree=h.render();assert.equal(h.find(groupSection(h,tree,'Extras'),n=>n.props?.id===`product-${id}-group-g`).props.hidden,false);assert.equal(h.calls.length,0);
});

test('size-specific rule indicator compares real limits while preserving general and size payloads',async()=>{
 const group=groupFixture('g','Extras',true,1,2);
 const variants=[{id:'size',name:'Grande',price:'15.00',available:true,groupLimits:[{groupId:'g',minSelect:1,maxSelect:3}]}];
 const h=editorHarness({groups:[group],variants});let tree=h.render();
 assert.match(JSON.stringify(groupSection(h,tree,'Extras')),/Regras específicas por tamanho:.*Grande/);
 h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();tree=h.render();
 const main=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 // The browser includes associated controls even when their group's panel is hidden.
 const values={name:'Quentinha',description:'',category:'',available:true,'size-size-name':'Grande','size-price':'15.00','size-available':true,
  'group-g-name':'Extras','g-required':true,'g-min':'1','g-max':'2','size-g-min':'1','size-g-max':'3'};
 main.props.onSubmit({preventDefault(){},currentTarget:{values}});await h.flush();
 const body=JSON.parse(h.calls.find(c=>c.init.method==='PATCH').init.body);
 assert.deepEqual(body.groups,[{id:'g',name:'Extras',required:true,minSelect:1,maxSelect:2}]);
 assert.deepEqual(body.variants[0].groupLimits,[{groupId:'g',minSelect:1,maxSelect:3}]);
 const normal=editorHarness({groups:[group],variants:[{...variants[0],groupLimits:[{groupId:'g',minSelect:1,maxSelect:2}]}]});
 assert.equal(JSON.stringify(groupSection(normal,normal.render(),'Extras')).includes('Regras específicas por tamanho'),false);
});

test('external group fields are scoped to the current product form',()=>{
 for(const productId of ['product-A','product-B']){
  const h=editorHarness({productId,groups:[groupFixture('same-group','Extras')]});const tree=h.render();const card=groupSection(h,tree,'Extras');
  assert.equal(h.find(card,n=>n.type==='input'&&n.props?.name==='group-same-group-name').props.form,`product-configuration-${productId}`);
  assert.ok(h.find(card,n=>n.props?.id===`product-${productId}-group-same-group`));
 }
});

const navigationItems = [
 ['information','Informações do produto'],['sizes','Tamanhos e preços'],['customizations','Personalizações'],
 ['publication','Imagem e publicação'],['management','Gerenciar produto'],
];
function navigationButtons(h,tree){
 const nav=h.find(tree,n=>n.type==='nav'&&n.props?.['aria-label']==='Seções do produto');
 return collectEditorNodes(nav,n=>n.type==='button'&&n.props);
}

test('section shortcuts allow direct access, focus their targets and never hide/unmount forms or save',()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();
 const interactions=[];tree.props.ref.current={querySelector(selector){interactions.push(selector);return {focus:options=>interactions.push(['focus',options]),scrollIntoView:options=>interactions.push(['scroll',options])};}};
 const original=collectEditorNodes(tree,n=>n.type==='form'||n.type==='fieldset'||n.type?.name==='OptionForm').map(n=>({type:n.type,key:n.key}));
 for(const [key,label] of [...navigationItems].reverse()){
  h.button(tree,label).props.onClick();tree=h.render();
  const buttons=navigationButtons(h,tree);assert.equal(buttons.filter(b=>b.props['aria-pressed']).length,1);
  assert.equal(buttons.find(b=>b.props.children===label).props['aria-pressed'],true);
  assert.equal(buttons.find(b=>b.props.children===label).props['aria-controls'],`product-${id}-section-${key}`);
  assert.equal(h.find(tree,n=>n.props?.id===`product-${id}-section-${key}`).props.tabIndex,-1);
  assert.equal(h.find(tree,n=>n.props?.id===`product-${id}-section-${key}`).props.hidden,undefined);
  assert.deepEqual(collectEditorNodes(tree,n=>n.type==='form'||n.type==='fieldset'||n.type?.name==='OptionForm').map(n=>({type:n.type,key:n.key})),original);
 }
 assert.ok(interactions.some(item=>typeof item==='string'&&item.includes('management')));
 assert.equal(interactions.filter(item=>Array.isArray(item)&&item[0]==='focus').length,5);
 assert.equal(interactions.filter(item=>Array.isArray(item)&&item[0]==='scroll').length,5);
 assert.equal(h.calls.length,0);
});

test('section navigation preserves pending configuration/option changes and collapsed groups',()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();
 h.find(groupSection(h,tree,'Extras'),n=>n.type?.name==='OptionForm'&&n.props.option).props.onDirty(true);
 h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();
 for(const [,label] of navigationItems){tree=h.render();h.button(tree,label).props.onClick();}
 tree=h.render();assert.equal(h.button(tree,'Validar produto').props.disabled,true);
 assert.ok(h.button(groupSection(h,tree,'Extras'),'Expandir grupo'));
 assert.equal(h.find(groupSection(h,tree,'Extras'),n=>n.type==='fieldset').props.disabled,false);
 assert.equal(h.find(tree,n=>n.type?.name==='SavePrivateTemplate').props.disabled,true);
 assert.equal(h.calls.length,0);
});

test('selected image and its independent multipart save survive section navigation',async()=>{
 const h=editorHarness();let tree=h.render();const image=new File(['selected'],'selected.png',{type:'image/png'});
 let resets=0;const formElement={values:{file:image},reset(){resets++;}};
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveImage').props.onChangeCapture({currentTarget:formElement});
 for(const [,label] of navigationItems){tree=h.render();h.button(tree,label).props.onClick();}
 tree=h.render();assert.equal(resets,0);assert.equal(h.calls.length,0);assert.equal(h.button(tree,'Validar produto').props.disabled,true);
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveImage').props.onSubmit({preventDefault(){},currentTarget:formElement});await h.flush();
 assert.equal(h.calls.find(c=>c.url==='/api/product').init.body.get('file'),image);assert.equal(resets,1);
});

test('invalid collapsed group selects its section and reopens without disabling its fields',()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();
 h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();tree=h.render();
 const card=groupSection(h,tree,'Extras'),panel=h.find(card,n=>n.props?.id===`product-${id}-group-g`);
 tree.props.onInvalidCapture({target:{closest:()=>({dataset:{editorSection:'customizations'}})}});
 const element={hidden:true};panel.props.onInvalidCapture({currentTarget:element});tree=h.render();
 assert.equal(element.hidden,false);assert.equal(h.button(tree,'Personalizações').props['aria-pressed'],true);
 assert.ok(h.button(groupSection(h,tree,'Extras'),'Recolher grupo'));
 assert.equal(h.find(groupSection(h,tree,'Extras'),n=>n.type==='fieldset').props.disabled,false);
 assert.equal(h.calls.length,0);
});

test('keyboard focus updates section indication and mobile shortcuts remain scrollable',()=>{
 const h=editorHarness();let tree=h.render();
 const nav=h.find(tree,n=>n.type==='nav'&&n.props?.['aria-label']==='Seções do produto');assert.match(nav.props.className,/overflow-x-auto/);
 for(const [key,label] of navigationItems){
  h.find(tree,n=>n.props?.id===`product-${id}-section-${key}`).props.onFocusCapture();tree=h.render();
  assert.equal(h.button(tree,label).props['aria-pressed'],true);
  assert.equal(h.button(tree,label).props.type,'button');assert.equal(h.button(tree,label).props.disabled,undefined);
 }
});

test('navigation targets and form ownership remain local to each product',()=>{
 for(const productId of ['tenant-A-product','tenant-B-product']){
  const h=editorHarness({productId});const tree=h.render();const buttons=navigationButtons(h,tree);
  assert.equal(buttons[0].props['aria-pressed'],true);
  assert.ok(buttons.every(button=>button.props['aria-controls'].startsWith(`product-${productId}-section-`)));
  assert.equal(h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.id,`product-configuration-${productId}`);
 }
});

const configValues = {name:'Quentinha',description:'',category:'',available:true,'size-size-name':'P','size-price':'15.00','size-available':true};
test('confirmed configuration save clears its pending flag even when reload fails',async()=>{
 const h=editorHarness({refreshError:new Error('Reload failed')});let tree=h.render();
 const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');form.props.onChangeCapture();assert.equal(h.pending.at(-1),true);
 form.props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});await h.flush();tree=h.render();
 assert.equal(h.pending.at(-1),false);assert.ok(h.button(tree,'Recarregar configuração'));
});
test('failed configuration save keeps its pending flag',async()=>{
 const h=editorHarness({saveError:new Error('Save failed')});const tree=h.render();
 const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');form.props.onChangeCapture();
 form.props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});await h.flush();assert.equal(h.pending.at(-1),true);
});
test('saving an option does not clear pending configuration or another option',async()=>{
 const g=groupFixture('g','Extras');g.options.push({...g.options[0],id:'second'});
 const h=editorHarness({groups:[g]});let tree=h.render();
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();
 const options=collectEditorNodes(groupSection(h,tree,'Extras'),n=>n.type?.name==='OptionForm'&&n.props.option);
 options.forEach(n=>n.props.onDirty(true));options[0].type(options[0].props).props.onSubmit({preventDefault(){},currentTarget:{values:{name:'Opção Extras',price:'2',available:true}}});await h.flush();tree=h.render();
 assert.equal(h.pending.at(-1),true);assert.equal(h.button(tree,'Validar produto').props.disabled,true);
});
test('section navigation does not change pending status or trigger leave callbacks',()=>{
 const h=editorHarness();let tree=h.render();h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();const count=h.pending.length;
 for(const [,label] of navigationItems){tree=h.render();h.button(tree,label).props.onClick();}
 assert.equal(h.pending.length,count);assert.equal(h.pending.at(-1),true);assert.equal(h.calls.length,0);
});

test('returning configuration to its saved values clears its pending flag without a write',()=>{
 const h=editorHarness();let tree=h.render();const formElement={values:{...configValues}};tree.props.ref.current={querySelector:()=>formElement};
 let form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 form.props.onChangeCapture();assert.equal(h.pending.at(-1),false);
 formElement.values.name='Temporary';form.props.onChangeCapture();assert.equal(h.pending.at(-1),true);
 formElement.values.name='Quentinha';form.props.onChangeCapture();assert.equal(h.pending.at(-1),false);assert.equal(h.calls.length,0);
});
test('clearing a new size/group form restores its initial clean state',()=>{
 const h=editorHarness();const tree=h.render();
 for(const [label,filled,empty] of [
  ['Adicionar tamanho',{name:'G',price:'10'},{name:'',price:''}],
  ['Adicionar grupo',{name:'Extras','new-group-min':'0','new-group-max':'1'},{name:'','new-group-min':'0','new-group-max':'1'}],
 ]){
  const form=h.find(tree,n=>n.type==='form'&&n.props?.['aria-label']===label);
  form.props.onChangeCapture({currentTarget:{values:filled}});assert.equal(h.pending.at(-1),true);
  form.props.onChangeCapture({currentTarget:{values:empty}});assert.equal(h.pending.at(-1),false);
 }
 assert.equal(h.calls.length,0);
});

function reviewSection(h,tree){return h.find(tree,n=>n.type==='section'&&n.props?.['aria-label']==='Revisão do produto');}

test('review separates loaded data, pending changes and publication without automatic validation',()=>{
 const h=editorHarness({category:'Quentinhas'});let tree=h.render();let output=JSON.stringify(tree);
 assert.match(output,/Não publicado · Rascunho/);assert.match(output,/Dados carregados do servidor/);
 assert.doesNotMatch(output,/Dados salvos\./);assert.ok(reviewSection(h,tree));assert.match(JSON.stringify(reviewSection(h,tree)),/Quentinhas/);
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();tree=h.render();
 assert.match(JSON.stringify(tree),/Alterações não salvas/);assert.match(JSON.stringify(reviewSection(h,tree)),/Alterações pendentes neste salvamento/);assert.equal(h.calls.length,0);
});

test('confirmed save shows saved but unpublished and never claims whole-product success while another form is pending',async()=>{
 const h=editorHarness();let tree=h.render();let form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');
 form.props.onChangeCapture();form.props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});tree=h.render();assert.match(JSON.stringify(tree),/Salvamento em andamento/);assert.doesNotMatch(JSON.stringify(tree),/Dados salvos\./);
 await h.flush();tree=h.render();assert.match(JSON.stringify(tree),/Dados salvos\./);assert.match(JSON.stringify(tree),/Não publicado · Rascunho/);
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveImage').props.onChangeCapture({currentTarget:{values:{file:new File(['pending'],'pending.png')}}});tree=h.render();
 form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');form.props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});await h.flush();tree=h.render();
 assert.match(JSON.stringify(tree),/ainda há alterações não salvas/);assert.doesNotMatch(JSON.stringify(tree),/Dados salvos\./);assert.equal(h.pending.at(-1),true);
});

test('published state stays independent from local changes and does not publish again',()=>{
 const h=editorHarness({published:true});let tree=h.render();assert.match(JSON.stringify(tree),/Publicado/);
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();tree=h.render();
 assert.match(JSON.stringify(tree),/Alterações não salvas/);assert.match(JSON.stringify(tree),/Publicado/);assert.equal(h.button(tree,'Publicar produto'),undefined);assert.equal(h.calls.length,0);
});

test('failed option save identifies and opens its group while preserving pending data',async()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')],optionError:new Error('Não foi possível salvar esta opção.')});let tree=h.render();
 const option=h.find(groupSection(h,tree,'Extras'),n=>n.type?.name==='OptionForm'&&n.props.option);option.props.onDirty(true);
 h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();
 option.type(option.props).props.onSubmit({preventDefault(){},currentTarget:{values:{name:'Nova descrição',price:'3,00',available:true}}});await h.flush();tree=h.render();
 assert.ok(h.button(groupSection(h,tree,'Extras'),'Recolher grupo'));assert.match(JSON.stringify(tree),/Não foi possível salvar esta opção/);assert.ok(h.button(tree,'Revisar Personalizações'));assert.equal(h.pending.at(-1),true);
 const keys=collectEditorNodes(groupSection(h,tree,'Extras'),n=>n.type?.name==='OptionForm').map(n=>n.key);h.button(tree,'Revisar Personalizações').props.onClick();tree=h.render();assert.deepEqual(collectEditorNodes(groupSection(h,tree,'Extras'),n=>n.type?.name==='OptionForm').map(n=>n.key),keys);
});

test('backend validation opens the uniquely matched collapsed group and offers a focused review target',async()=>{
 const message='Grupo Extras: obrigatoriedade ou limites gerais inválidos.';
 const h=editorHarness({groups:[groupFixture('g','Extras')],validation:{valid:false,errors:[message]}});let tree=h.render();h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();
 h.button(tree,'Validar produto').props.onClick();await h.flush();tree=h.render();assert.ok(h.button(groupSection(h,tree,'Extras'),'Recolher grupo'));
 assert.match(JSON.stringify(tree),/Configuração precisa de revisão/);assert.equal(h.button(tree,'Publicar produto'),undefined);
 const focused=[];tree.props.ref.current={querySelector:selector=>{focused.push(selector);return {querySelector:()=>({hidden:true}),focus:()=>focused.push('focus'),scrollIntoView:()=>focused.push('scroll')};}};
 h.button(tree,'Revisar Personalizações').props.onClick();assert.ok(focused.some(value=>value.includes('data-review-group="g"')));assert.ok(focused.includes('focus'));
});

test('local group-bound errors point to the specific group without issuing a save',async()=>{
 const h=editorHarness({groups:[groupFixture('g','Extras')]});let tree=h.render();h.button(groupSection(h,tree,'Extras'),'Recolher grupo').props.onClick();
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onChangeCapture();
 const values={...configValues,'group-g-name':'Extras','g-min':'3','g-max':'1'};
 h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onSubmit({preventDefault(){},currentTarget:{values}});await h.flush();tree=h.render();
 assert.equal(h.calls.length,0);assert.ok(h.button(groupSection(h,tree,'Extras'),'Recolher grupo'));assert.ok(h.button(tree,'Revisar Personalizações'));assert.equal(h.pending.at(-1),true);
});

test('validation request failure does not invent a valid or invalid configuration',async()=>{
 const h=editorHarness({validationNetworkError:true});h.button(h.render(),'Validar produto').props.onClick();await h.flush();const tree=h.render();
 assert.ok(h.button(tree,'Revisar Validação e publicação'));assert.doesNotMatch(JSON.stringify(tree),/Configuração precisa de revisão/);assert.equal(h.button(tree,'Publicar produto'),undefined);
});

test('ambiguous publication error shows the last confirmed state and never claims success',async()=>{
 const h=editorHarness({publishError:new Error('Falha de rede.')});h.button(h.render(),'Validar produto').props.onClick();await h.flush();h.button(h.render(),'Publicar produto').props.onClick();await h.flush();const tree=h.render();
 assert.match(JSON.stringify(tree),/Último estado confirmado/);assert.ok(h.button(tree,'Recarregar configuração'));assert.doesNotMatch(JSON.stringify(tree),/Produto publicado\./);assert.equal(h.button(tree,'Publicar produto'),undefined);
});

test('sensitive errors are replaced with safe text and cannot enter review or validation messages',async()=>{
 const h=editorHarness({saveError:new Error('Bearer SECRET_TOKEN')});const tree=h.render();const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration');form.props.onChangeCapture();form.props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});await h.flush();assert.equal(JSON.stringify(h.render()).includes('SECRET_TOKEN'),false);
 const v=editorHarness({validation:{valid:false,errors:['SELECT password FROM products']}});v.button(v.render(),'Validar produto').props.onClick();await v.flush();assert.equal(JSON.stringify(v.render()).includes('SELECT password'),false);
});

test('review evidence, notices and validation do not leak into another product scope',async()=>{
 const h=editorHarness({saveError:new Error('Produto anterior indisponível')});let tree=h.render();h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveConfiguration').props.onSubmit({preventDefault(){},currentTarget:{values:configValues}});await h.flush();assert.match(JSON.stringify(h.render()),/Produto anterior indisponível/);
 h.replaceProduct('another-restaurant-product');tree=h.render();assert.equal(JSON.stringify(tree).includes('Produto anterior indisponível'),false);
 const v=editorHarness();v.button(v.render(),'Validar produto').props.onClick();await v.flush();assert.ok(v.button(v.render(),'Publicar produto'));
 v.replaceProduct('another-product');assert.equal(v.button(v.render(),'Publicar produto'),undefined);
});

test('failed image save keeps the selected file, its pending flag and a link to the image section',async()=>{
 const h=editorHarness({imageError:new Error('Não foi possível salvar a imagem.')});let tree=h.render();
 const file=new File(['pending'],'pending.png',{type:'image/png'});let resets=0;const element={values:{file},reset(){resets++;}};
 const form=h.find(tree,n=>n.type==='form'&&n.props?.onSubmit?.name==='saveImage');form.props.onChangeCapture({currentTarget:element});
 form.props.onSubmit({preventDefault(){},currentTarget:element});await h.flush();tree=h.render();
 assert.equal(resets,0);assert.equal(element.values.file,file);assert.equal(h.pending.at(-1),true);assert.ok(h.button(tree,'Revisar Imagem do produto'));assert.doesNotMatch(JSON.stringify(tree),/Dados salvos\./);
});
