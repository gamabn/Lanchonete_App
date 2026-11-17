const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => id in mocks ? mocks[id] : require(id),
    AbortSignal, Error, console, ...globals });
  return exports;
}
const helpers = load('src/app/util/checkout.ts');
const product = { id: 'product-1', restaurant_id: 'store-1', name: 'Lanche', price: '12.50' };

test('restore cart accepts API restaurant_id and rejects corrupt entries and other stores', () => {
  const saved = JSON.stringify([null, product, product, { ...product, id: 'other', restaurant_id: 'store-2' },
    { ...product, id: 'bad-price', price: null }]);
  const cart = helpers.restoreCart(saved, '{"product-1":2}', 'store-1');
  assert.equal(cart.products.length, 1);
  assert.equal(cart.products[0].price, 12.5);
  assert.equal(cart.counts['product-1'], 2);
  assert.equal(helpers.restoreCart('{bad', '{}', 'store-1').products.length, 0);
  for (const quantities of ['null', '[]', '{bad', '{"product-1":"Infinity"}', '{"product-1":-2}']) {
    assert.equal(helpers.restoreCart(JSON.stringify([product]), quantities, 'store-1').counts['product-1'], 1);
  }
});

test('money accepts reais formats and rejects invalid delivery fees', () => {
  for (const text of ['50', '50,00', '50.00', 'R$ 50,00']) assert.equal(helpers.lerValorEmReais(text), 50);
  assert.equal(helpers.lerValorEmReais('1.234,56'), 1234.56);
  for (const text of ['-1', '1e3', '1.2,00', 'abc', '1,234']) assert.ok(Number.isNaN(helpers.lerValorEmReais(text)));
  for (const value of [null, undefined, '', ' ', -1, 'abc']) assert.ok(Number.isNaN(helpers.readDeliveryFee(value)));
  assert.equal(helpers.readDeliveryFee('0'), 0);
});

function pageHarness(failItems = false, customerStatus = 200, mutationStatus = 200, confirmedTotal = '30.00', confirmedChange, scenario = {}) {
  const calls = [], navigation = [], errors = [], success = [];
  const storage = new Map([['product', JSON.stringify([product])], ['product_quantities', '{"product-1":2}']]);
  const address = { name: 'Cliente', phone: '11999999999', cidade: 'Cidade', bairro: 'Centro', rua: 'Rua', numero: '1' };
  const cart = scenario.products || [product];
  const quantities = scenario.counts || { 'product-1': 2 };
  const states = [scenario.mode || 'DELIVERY', false, false, cart, quantities, false, 'address' in scenario ? scenario.address : address, scenario.payment ?? 'Dinheiro', scenario.change ?? '50,00',
    scenario.bairros || [{ id: 'bairro-1', bairro: 'Centro', frete: '5.00' }], false, scenario.store || { id:'store-1',status:true,name:'Loja Real',street:'Rua Restaurante',number:'99',neighborhood:'Bairro Restaurante',city:'Cidade Restaurante' }, false, scenario.unidentified ? null : {
      id: 'customer-1', restaurant_id: 'store-1', name: address.name, phone: address.phone,
    }];
  let cursor = 0, refCursor = 0, route = 'store-1';
  const refs = [];
  const jsx = (type, props) => ({ type, props });
  const fakeFetch = async (url, config = {}) => {
      calls.push(['fetch', url, config]);
      if (url.startsWith('/api/products/')) {
        if (scenario.waitRefresh) await scenario.waitRefresh;
        const id = decodeURIComponent(url.split('/')[3]);
        const configuration = scenario.configurations?.[id] || { product, variants: [], groups: [] };
        return { ok: !scenario.unavailable, json: async () => scenario.unavailable
          ? { error: 'Produto indisponível.' } : configuration };
      }
      if (url.startsWith('/api/client/')) {
        if (!config.method) return { ok: customerStatus === 200, status: customerStatus, json: async () => customerStatus === 200 ? [{
          id: scenario.sessionId || 'customer-1', restaurant_id: 'store-1', name: address.name, phone: address.phone,
        }] : { code: scenario.sessionCode || 'SESSION_MISSING', error: 'Confirme sua identificação.' } };
        return { ok: mutationStatus < 400, status: mutationStatus, json: async () => mutationStatus < 400 ? { id: 'customer-1' } : { error: 'Recuperação verificada necessária.' } };
      }
      if (url === '/api/orders/store-1') {
        if (scenario.apiStatus) return {ok:false,status:scenario.apiStatus,json:async()=>({error:'Erro de API',code:scenario.apiCode})};
        if (scenario.networkOrder) throw new Error('Network failed');
        return { ok: !failItems, status: failItems ? 422 : 201, json: async () => failItems
          ? { error: 'Produto indisponível.' }
          : { order: { id: 'order-1', total_price: confirmedTotal }, change_due: confirmedChange, chat_credential: 'chat-token' } };
      }
      throw new Error('Unexpected request');
    };
  const identification = load('src/app/util/customerIdentification.ts', {}, { fetch: fakeFetch });
  const pageHelpers = load('src/app/util/checkout.ts', {}, { fetch: fakeFetch });
  const { default: Page } = load('src/app/clients/[idClient]/pedidos/page.tsx', {
    react: { useState: () => { const index = cursor++; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
      useRef: value => { const i=refCursor++; if (!refs[i]) refs[i]={current:value}; return refs[i]; }, useEffect() {}, useMemo: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': {},
    'next/navigation': { useParams: () => ({ idClient: route }), useRouter: () => ({ push: path => navigation.push(path) }) },
    'react-toastify': { toast: { error: msg => errors.push(msg), success: msg => success.push(msg) } },
    'lucide-react': {}, '@/app/components/money': { formatarPreco: value => String(value) },
    '@/app/util/chatApi': { chatCredentialKey: id => `chat_credential:${id}` }, './component': {}, '@/app/util/checkout': pageHelpers,
    './component/CustomerIdentification': {__esModule:true, default:'CustomerIdentification'},
    './component/CustomerEmailVerification': {},
    '@/app/util/customerIdentification': identification,
    '@/app/util/checkoutFulfillment': load('src/app/util/checkoutFulfillment.ts'),
    '@/app/util/customerStorage': { customerOrderKey: id => `customer_order:${id}`, watchCustomerSessionChanges: () => () => {} },
    '@/app/util/api': {
      put: async (...args) => { calls.push(['put', ...args]); },
      post: async (url, data) => {
        calls.push(['post', url, data]);
        if (url === '/order_item') throw new Error('Legacy item endpoint must not be called');
        return { data: { order: { id: 'order-1' } } };
      },
    },
  }, {
    fetch: fakeFetch,
    localStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    console: { error() {} },
  });
  function findCheckout(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button' && node.props?.onClick?.name === 'handleFinalizar') return node;
    for (const child of Array.isArray(node) ? node : Object.values(node)) {
      const found = findCheckout(child); if (found) return found;
    }
  }
  function render(){cursor=0;refCursor=0;return Page();}
  function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of Object.values(node)){const found=find(child,predicate);if(found)return found;}}
  return { button: findCheckout(render()), calls, navigation, errors, success, storage, render, find, states,
    changeMode(mode){const tree=render();find(tree,node=>node.type==='button'&&node.props?.children===(mode==='PICKUP'?'RETIRADA':'ENTREGA')).props.onClick();},
    setRoute(value){route=value;render();}, getButton(){return findCheckout(render());} };

}

test('checkout submits one atomic order without trusting local prices and clears cart after confirmation', async () => {
  const h = pageHarness();
  assert.equal(h.button.props.disabled, false);
  const first = h.button.props.onClick();
  await h.button.props.onClick();
  await first;
  const orders = h.calls.filter(call => call[1] === '/api/orders/store-1');
  assert.equal(orders.length, 1);
  const body = JSON.parse(orders[0][2].body);
  assert.equal(body.change_for, '50'); assert.equal(body.bairro_id, 'bairro-1');
  assert.equal(body.items[0].quantity, 2);
  assert.equal('total_price' in body, false); assert.equal('customer_id' in body, false);
  assert.equal('item_price' in body.items[0], false);
  assert.equal(h.calls.some(call => call[1] === '/order_item'), false);
  assert.equal(h.storage.get('chat_credential:store-1'), 'chat-token');
  assert.equal(h.storage.has('product'), false);
  assert.equal(h.navigation[0], '/clients/store-1');
});

test('failed checkout preserves cart and displays an error', async () => {
  const h = pageHarness(true);
  await h.button.props.onClick();
  assert.equal(h.errors.length, 1);
  assert.equal(h.success.length, 0);
  assert.equal(h.storage.has('product'), true);
  assert.equal(h.navigation.length, 0);
});


test('checkout uses the confirmed session without rewriting contact or address data', async () => {
  const h = pageHarness(); await h.button.props.onClick();
  assert.equal(h.calls.some(call => call[1].startsWith('/api/client/') && call[2].method), false);
  const order = h.calls.find(call => call[1] === '/api/orders/store-1');
  assert.equal(order[2].headers['X-Customer-Id'], 'customer-1');
  assert.equal(h.storage.has('customerInfo'), false);
});

test('missing or expired sessions interrupt checkout without creating another customer', async () => {
  for (const sessionCode of ['SESSION_MISSING', 'SESSION_EXPIRED']) {
    const h = pageHarness(false, 401, 200, '30.00', undefined, { sessionCode });
    await h.button.props.onClick();
    assert.equal(h.calls.some(call => call[1] === '/api/orders/store-1'), false);
    assert.equal(h.calls.some(call => call[1].startsWith('/api/client/') && call[2].method), false);
    assert.equal(h.storage.has('product'), true);
  }
});

test('a session changed in another tab requires renewed identification before sending an order', async () => {
  const h = pageHarness(false, 200, 200, '30.00', undefined, { sessionId: 'another-person' });
  await h.button.props.onClick();
  assert.equal(h.calls.some(call => call[1] === '/api/orders/store-1'), false);
  assert.equal(h.storage.has('product'), true);
});

test('cross-establishment authorization failures do not silently create another customer', async () => {
  const h = pageHarness(false, 403); await h.button.props.onClick();
  assert.equal(h.calls.filter(call => call[0] === 'fetch' && call[2].method).length, 0);
  assert.equal(h.storage.has('product'), true);
});

test('checkout confirmation displays the authoritative server total rather than the local estimate', async () => {
  const h = pageHarness(false, 200, 200, '39.50'); await h.button.props.onClick();
  assert.equal(h.success[0], 'Pedido confirmado: 39.50.');
  assert.equal(h.calls.some(call => call[1] === '/order_item'), false);
});


test('checkout displays the change calculated by the backend', async () => {
  const h = pageHarness(false, 200, 200, '30.00', '20.00'); await h.button.props.onClick();
  assert.equal(h.success[0], 'Pedido confirmado: 30.00. Troco: 20.00.');
});

function publicConfiguration() {
  return {
    product: { ...product, price: '15.00' },
    variants: [
      { id: 'small', name: 'Pequena', price: '15.00', groupLimits: [{ groupId: 'extras', minSelect: 1, maxSelect: 1 }] },
      { id: 'large', name: 'Grande', price: '20.00', groupLimits: [{ groupId: 'extras', minSelect: 1, maxSelect: 2 }] },
    ],
    groups: [{ id: 'extras', name: 'Extras', required: true, options: [
      { id: 'free', group_id: 'extras', name: 'Farofa', additional_price: '0.00' },
      { id: 'paid', group_id: 'extras', name: 'Bacon', additional_price: '2.50' },
    ] }],
  };
}

test('configured cart estimates free and paid options and enforces size-specific selection limits', () => {
  const configuration = publicConfiguration();
  assert.equal(helpers.configuredCartProduct(configuration, 'store-1', 'small', ['free']).price, 15);
  assert.equal(helpers.configuredCartProduct(configuration, 'store-1', 'large', ['free', 'paid']).price, 22.5);
  for (const [store, size, selected] of [
    ['store-2', 'large', ['free']],
    ['store-1', 'other', ['free']],
    ['store-1', 'large', ['foreign-option']],
    ['store-1', 'small', ['free', 'paid']],
    ['store-1', 'large', []],
    ['store-1', 'large', ['free', 'free']],
  ]) {
    assert.throws(() => helpers.configuredCartProduct(configuration, store, size, selected));
  }
});

test('restoration preserves old simple carts and separates combinations with canonical option order', () => {
  const configuration = publicConfiguration();
  const first = helpers.configuredCartProduct(configuration, 'store-1', 'large', ['paid', 'free']);
  const same = helpers.configuredCartProduct(configuration, 'store-1', 'large', ['free', 'paid']);
  const other = helpers.configuredCartProduct(configuration, 'store-1', 'small', ['free']);
  assert.equal(helpers.cartLineKey(first), helpers.cartLineKey(same));
  assert.notEqual(helpers.cartLineKey(first), helpers.cartLineKey(other));
  const quantities = { [product.id]: 1, [helpers.cartLineKey(first)]: 2, [helpers.cartLineKey(other)]: 3 };
  const restored = helpers.restoreCart(JSON.stringify([product, first, same, other]), JSON.stringify(quantities), 'store-1');
  assert.equal(restored.products.length, 3);
  assert.equal(restored.counts[helpers.cartLineKey(first)], 2);
  assert.equal(restored.counts[helpers.cartLineKey(other)], 3);
  const mixed = helpers.orderItems(restored.products, restored.counts);
  assert.equal('variant_id' in mixed[0], false);
  assert.equal(mixed[1].variant_id, 'large');
  assert.equal(mixed[1].quantity, 2);
  assert.equal('price' in mixed[1], false);
  assert.equal('options' in mixed[1], false);
  assert.throws(() => helpers.orderItems([first], { [helpers.cartLineKey(first)]: 0.5 }));
});

test('configured and mixed checkout sends selections only for configured lines and no browser prices', async () => {
  const configuration = publicConfiguration();
  const configured = helpers.configuredCartProduct(configuration, 'store-1', 'large', ['free', 'paid']);
  const simple = { ...product, id: 'simple' };
  const h = pageHarness(false, 200, 200, '40.00', undefined, {
    products: [configured, simple],
    counts: { [helpers.cartLineKey(configured)]: 1, simple: 1 },
    configurations: {
      [product.id]: configuration,
      simple: { product: simple, variants: [], groups: [] },
    },
  });
  await h.button.props.onClick();
  const order = h.calls.find(call => call[1] === '/api/orders/store-1');
  assert.ok(order);
  const body = JSON.parse(order[2].body);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].variant_id, 'large');
  assert.deepEqual(body.items[0].option_ids, ['free', 'paid']);
  assert.equal('variant_id' in body.items[1], false);
  assert.equal('item_price' in body.items[0], false);
});

test('price changes update the estimate and require a new confirmation before submitting', async () => {
  const h = pageHarness(false, 200, 200, '30.00', undefined, {
    configurations: { [product.id]: { product: { ...product, price: '16.00' }, variants: [], groups: [] } },
  });
  await h.button.props.onClick();
  assert.equal(h.calls.some(call => call[1] === '/api/orders/store-1'), false);
  assert.equal(JSON.parse(h.storage.get('product'))[0].price, 16);
  assert.match(h.errors[0], /preços foram atualizados/);
});

test('unavailable products block checkout while retaining the cart', async () => {
  const h = pageHarness(false, 200, 200, '30.00', undefined, { unavailable: true });
  await h.button.props.onClick();
  assert.equal(h.calls.some(call => call[1] === '/api/orders/store-1'), false);
  assert.equal(h.storage.has('product'), true);
  assert.match(h.errors[0], /indisponível/);
});

test('an ambiguous order network failure retains the pending marker and blocks repeated submission', async () => {
  const h = pageHarness(false, 200, 200, '30.00', undefined, { networkOrder: true });
  await h.button.props.onClick();
  await h.button.props.onClick();
  assert.equal(h.calls.filter(call => call[1] === '/api/orders/store-1').length, 1);
  assert.equal(h.storage.get('pending_order:store-1'), 'pending');
  assert.equal(h.storage.has('product'), true);
  assert.match(h.errors[0], /Confira com o restaurante/);
});


test('cart accepts a variant without groups, preserves empty selections and separates sizes', () => {
  const configuration = publicConfiguration();
  configuration.groups = [];
  configuration.variants = configuration.variants.map(variant => ({ ...variant, groupLimits: [] }));
  const small = helpers.configuredCartProduct(configuration, 'store-1', 'small', []);
  const large = helpers.configuredCartProduct(configuration, 'store-1', 'large', []);
  assert.equal(small.price, 15);
  assert.equal(large.price, 20);
  assert.equal(small.options.length, 0);
  assert.notEqual(helpers.cartLineKey(small), helpers.cartLineKey(large));
  const counts = { [helpers.cartLineKey(small)]: 2, [helpers.cartLineKey(large)]: 1 };
  const restored = helpers.restoreCart(JSON.stringify([small, large]), JSON.stringify(counts), 'store-1');
  assert.equal(restored.products.length, 2);
  assert.deepEqual(Array.from(helpers.orderItems(restored.products, restored.counts)[0].option_ids), []);
  assert.throws(() => helpers.configuredCartProduct(configuration, 'store-2', 'small', []));
  assert.throws(() => helpers.configuredCartProduct(configuration, 'store-1', 'small', ['foreign-option']));
});

test('checkout refreshes and submits a configurable product without groups using existing contracts', async () => {
  const configuration = publicConfiguration();
  configuration.groups = [];
  configuration.variants = [{ ...configuration.variants[0], groupLimits: [] }];
  const configured = helpers.configuredCartProduct(configuration, 'store-1', 'small', []);
  const h = pageHarness(false, 200, 200, '35.00', undefined, {
    products: [configured], counts: { [helpers.cartLineKey(configured)]: 2 },
    configurations: { [product.id]: configuration },
  });
  await h.button.props.onClick();
  const order = h.calls.find(call => call[1] === '/api/orders/store-1');
  assert.ok(order);
  const body = JSON.parse(order[2].body);
  assert.deepEqual(body.items, [{ product_id: product.id, quantity: 2, variant_id: 'small', option_ids: [] }]);
});

const fulfillment = load('src/app/util/checkoutFulfillment.ts');
function treeText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(treeText).join(' ');
  return treeText(node.props?.children);
}
test('checkout DELIVERY explicitly submits mode and region without estimated amounts', async()=>{
  const h=pageHarness();await h.button.props.onClick();
  const body=JSON.parse(h.calls.find(call=>call[1]==='/api/orders/store-1')[2].body);
  assert.equal(body.fulfillment_type,'DELIVERY');assert.equal(body.bairro_id,'bairro-1');
  for(const field of ['subtotal','total_price','delivery_fee','pickup_address','delivery_address'])assert.equal(field in body,false);
});
test('checkout PICKUP without customer address/region uses zero fee and real store, submits no delivery fields', async()=>{
  const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,bairros:[]});
  assert.equal(h.button.props.disabled,false);
  const text=treeText(h.render());
  for(const part of ['Retirada no estabelecimento','Loja Real','Rua Restaurante','99','Bairro Restaurante','Cidade Restaurante'])assert.ok(text.includes(part));
  assert.ok(text.includes('0'));assert.ok(!text.includes('Informe o bairro'));
  await h.button.props.onClick();
  const body=JSON.parse(h.calls.find(call=>call[1]==='/api/orders/store-1')[2].body);
  assert.equal(body.fulfillment_type,'PICKUP');
  for(const field of ['bairro_id','delivery_address','pickup_address','subtotal','delivery_fee','total_price'])assert.equal(field in body,false);
  assert.equal(h.calls.some(call=>call[1].includes('bairros')),false);
  assert.equal(h.calls.some(call=>call[1].startsWith('/api/client/')&&call[2].method),false);
  assert.equal(h.calls.some(call=>call[0]==='put'),false);
});
test('switching modes preserves cart, quantities, variants, additions, observations and payment',()=>{
  const configured=helpers.configuredCartProduct(publicConfiguration(),'store-1','large',['free','paid']);
  configured.observacoes='Sem cortar';
  const h=pageHarness(false,200,200,'30.00',undefined,{products:[configured],counts:{[helpers.cartLineKey(configured)]:2}});
  const before=JSON.stringify({products:h.states[3],counts:h.states[4],address:h.states[6],payment:h.states[7],change:h.states[8]});
  const saved=JSON.stringify(Array.from(h.storage));
  h.changeMode('PICKUP');assert.equal(h.states[0],'PICKUP');h.changeMode('DELIVERY');assert.equal(h.states[0],'DELIVERY');
  assert.equal(JSON.stringify({products:h.states[3],counts:h.states[4],address:h.states[6],payment:h.states[7],change:h.states[8]}),before);
  assert.equal(JSON.stringify(Array.from(h.storage)),saved);
});
test('address and valid region are required only for DELIVERY, including after switching back',async()=>{
  const h=pageHarness(false,200,200,'25.00',undefined,{address:null,bairros:[]});
  assert.equal(h.button.props.disabled,true);await h.button.props.onClick();assert.equal(h.calls.some(c=>c[1]==='/api/orders/store-1'),false);
  h.changeMode('PICKUP');assert.equal(h.getButton().props.disabled,false);
  h.changeMode('DELIVERY');assert.equal(h.getButton().props.disabled,true);
  const partial=pageHarness(false,200,200,'25.00',undefined,{address:{name:'Cliente',phone:'11999999999',cidade:'Cidade',bairro:'Centro',rua:'',numero:''}});
  assert.equal(partial.button.props.disabled,true);
});
for(const change of ['25,00','24,99','inválido']){
  test(`PICKUP cash change validation ${change}`,async()=>{
    const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,change});await h.button.props.onClick();
    assert.equal(h.calls.some(call=>call[1]==='/api/orders/store-1'),change==='25,00');
    if(change!=='25,00')assert.ok(h.storage.has('product'));
  });
}
for(const mode of ['DELIVERY','PICKUP'])for(const payment of ['Pix','Cartao','Dinheiro']){
  test(`${mode} keeps payment ${payment} and zero optional cash change`,async()=>{
    const h=pageHarness(false,200,200,'30.00',undefined,{mode,payment,change:''});await h.button.props.onClick();
    const body=JSON.parse(h.calls.find(call=>call[1]==='/api/orders/store-1')[2].body);
    assert.equal(body.payment_method,payment);assert.equal(body.change_for,'0');
  });
}
for(const store of [{id:'another-store',status:true,name:'Private Store'}, {id:'store-1',status:false}, {id:'store-1',status:true,city:'Cidade'}, {}]){
  test(`PICKUP blocks unavailable/foreign/incomplete store ${JSON.stringify(store)}`,async()=>{
    const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,store});
    assert.equal(h.button.props.disabled,true);await h.button.props.onClick();
    assert.equal(h.calls.some(call=>call[1]==='/api/orders/store-1'),false);assert.ok(h.storage.has('product'));
    assert.ok(!treeText(h.render()).includes('Private Store'));
  });
}
for(const status of [401,403,409,422,503]){
  test(`PICKUP handles API ${status} without losing cart`,async()=>{
    const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,apiStatus:status});await h.button.props.onClick();
    assert.ok(h.storage.has('product'));assert.equal(h.navigation.length,0);assert.equal(h.errors.length,1);
    assert.equal(h.storage.has('pending_order:store-1'),status===503);
  });
}
test('PICKUP ambiguous network response blocks duplicate submission',async()=>{
  const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,networkOrder:true});
  await h.button.props.onClick();await h.button.props.onClick();
  assert.equal(h.calls.filter(call=>call[1]==='/api/orders/store-1').length,1);assert.ok(h.storage.has('product'));
});
test('changing restaurant during product refresh cannot submit or overwrite the next store cart',async()=>{
  let finish;const waitRefresh=new Promise(resolve=>{finish=resolve;});
  const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,waitRefresh});
  const pending=h.button.props.onClick();h.setRoute('store-2');h.storage.set('product','cart-store-2');finish();await pending;
  assert.equal(h.calls.some(call=>call[1].startsWith('/api/orders/')),false);assert.equal(h.storage.get('product'),'cart-store-2');
});
test('pickup helper rejects invalid address values and scopes the restaurant, without manufacturing values',()=>{
  const store={id:'A',status:true,name:'Loja',street:'Rua',number:'1',neighborhood:'Bairro',city:'Cidade'};
  assert.ok(fulfillment.pickupLocation(store,'A'));assert.equal(fulfillment.pickupLocation(store,'B'),null);
  for(const key of ['name','street','number','neighborhood','city'])for(const value of [null,{},'','undefined','null','[object Object]'])assert.equal(fulfillment.pickupLocation({...store,[key]:value},'A'),null);
  assert.deepEqual(JSON.parse(JSON.stringify(fulfillment.fulfillmentSelection('PICKUP','must-not-leak'))),{fulfillment_type:'PICKUP'});
  assert.throws(()=>fulfillment.fulfillmentSelection('DELIVERY'));
});

test('PICKUP still requires authenticated identity and a payment selection',async()=>{
  for(const scenario of [{unidentified:true},{payment:''}]){
    const h=pageHarness(false,200,200,'25.00',undefined,{mode:'PICKUP',address:null,...scenario});
    assert.equal(h.button.props.disabled,true);await h.button.props.onClick();
    assert.equal(h.calls.some(call=>call[1]==='/api/orders/store-1'),false);assert.ok(h.storage.has('product'));
  }
});
