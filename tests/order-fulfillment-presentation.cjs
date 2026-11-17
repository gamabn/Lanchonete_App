const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Context = React.createContext({});
const overrides = {
  '@/app/Context': { Context },
  'next/navigation': { useRouter: () => ({refresh(){}}) },
  '@/app/util/chatApi': {}, '@/app/util/ordersAdminApi': {},
  '@/app/util/ordersSocket': { subscribeOrders: () => () => {} },
  'react-toastify': { toast: {success(){},error(){}} },
};
const cache = new Map();
function load(file) {
  file=path.resolve(file);
  if(cache.has(file)) return cache.get(file);
  const exports={}; cache.set(file,exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{exports,console,Date,Intl,Map,Set,setTimeout,clearTimeout,require(name){
    if(name in overrides) return overrides[name];
    if(name==='../../Delete') return {Delete:()=>null};
    if(name==='../shareButton') return {ShareButton:()=>null};
    if(!name.startsWith('.')&&!name.startsWith('@/')) return require(name);
    const base=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);
    const target=[base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(fs.existsSync);
    assert.ok(target,`Missing module ${name}`);return load(target);
  }},{filename:file});
  return exports;
}
const {orderPresentation,formatOrderMoney}=load('src/app/util/orderPresentation.ts');
const {formatSales}=load('src/app/util/orderReceipt.ts');
const {OrderDestination,OrderAmounts}=load('src/app/components/OrderFulfillment/index.tsx');
const {ModalItem}=load('src/app/components/ModalItem/index.tsx');
const {Home}=load('src/app/dashboard/Components/Home/index.tsx');
const order = (extra={}) => ({
  restaurant_id:'A',order_id:'order-A',status:'pending',total_price:35,created_at:'2026-11-15T12:00:00Z',payment_method:'Dinheiro',change_for:50,
  customer:{id:'customer-A',name:'Maria',phone:'telefone',street:'Rua Cliente Privada',number:'11',neighborhood:'Bairro Cliente Privado',city:'Cidade Cliente Privada',complement:'Complemento Cliente Privado'},
  items:[{id:'item-A',product_id:'pizza',product_name:'Pizza',quantity:2,item_price:15,variant_id:'v',variant_name:'Grande',options:[{id:'extra',option_id:'extra',option_name:'Queijo',group_name:'Extras',additional_price:2}]}],
  ...extra,
});
const pickup = (extra={}) => order({fulfillment_type:'PICKUP',subtotal:30,delivery_fee:0,total_price:30,pickup_address:{name:'Loja Snapshot',street:'Rua Restaurante Snapshot',number:'99',neighborhood:'Bairro Restaurante Snapshot',city:'Cidade Restaurante Snapshot'},...extra});
const profile={id:'A',name:'Loja Atual',street:'Rua Perfil Atual',number:'999',city:'Cidade Perfil Atual'};
function html(Component,props={},sales=[]) {
  return renderToStaticMarkup(React.createElement(Context.Provider,{value:{sales,lanchoneteProfile:profile,messages:[],handleModalVisible(){}}},React.createElement(Component,props)));
}
const withoutCustomerAddress = text => {
  for(const value of ['Rua Cliente Privada','Bairro Cliente Privado','Cidade Cliente Privada','Complemento Cliente Privado']) assert.ok(!text.includes(value),`Leaked ${value}`);
};

test('DELIVERY legacy keeps address and total without inventing historical components',()=>{
  for(const extra of [{},{fulfillment_type:'DELIVERY',subtotal:null,delivery_fee:null}]) {
    const data=order(extra), view=orderPresentation(data);
    assert.equal(view.label,'ENTREGA');assert.ok(view.addressLines.includes('Rua Cliente Privada, 11'));
    assert.equal(view.subtotal,'Não informado');assert.equal(view.fee,'Não informado');assert.equal(view.total,formatOrderMoney(35));
    assert.equal(data.subtotal,extra.subtotal);
  }
});
test('new DELIVERY uses persisted snapshot and amounts, including free delivery',()=>{
  const data=order({fulfillment_type:'DELIVERY',subtotal:'30.00',delivery_fee:'5.00',delivery_address:{street:'Rua Snapshot Entrega',number:'1',neighborhood:'Centro',city:'Cidade Entrega'}});
  const view=orderPresentation(data);assert.equal(view.fee,formatOrderMoney(5));assert.equal(view.subtotal,formatOrderMoney(30));
  assert.ok(view.addressLines[0].includes('Rua Snapshot Entrega'));withoutCustomerAddress(view.addressLines.join(''));
  assert.equal(orderPresentation({...data,delivery_fee:0}).fee,formatOrderMoney(0));
});
test('PICKUP uses only restaurant snapshot and zero fee, never customer destination',()=>{
  const data=pickup(), before=JSON.stringify(data), view=orderPresentation(data);
  assert.equal(view.label,'RETIRADA');assert.equal(view.restaurantName,'Loja Snapshot');assert.equal(view.addressLines[0],'Rua Restaurante Snapshot, 99');
  assert.equal(view.subtotal,formatOrderMoney(30));assert.equal(view.fee,formatOrderMoney(0));assert.equal(view.total,formatOrderMoney(30));
  withoutCustomerAddress(JSON.stringify(view));assert.equal(JSON.stringify(data),before);
});
for(const snapshot of [null,undefined,{}, {street:null,number:undefined,neighborhood:{},city:'null'}]) {
  test(`missing/partial PICKUP snapshot ${JSON.stringify(snapshot)} has safe fallback`,()=>{
    const data=pickup({pickup_address:snapshot});
    const text=html(OrderDestination,{order:data})+formatSales(data,profile);
    assert.match(text,/Endereço de retirada indisponível/);withoutCustomerAddress(text);
    assert.doesNotMatch(text,/Rua Perfil Atual|Cidade Perfil Atual|undefined|\[object Object\]|\bnull\b/);
  });
}
test('address formatting omits only missing fields and dangling separators',()=>{
  const view=orderPresentation(pickup({pickup_address:{name:'Loja',number:0,city:'Cidade'}}));
  assert.deepEqual(Array.from(view.addressLines),['0','Cidade: Cidade']);
});
for(const Component of [OrderDestination,ModalItem,Home]) {
  test(`${Component.name} renders PICKUP destination, including in history and live dashboard`,()=>{
    const data=pickup({status:Component===ModalItem?'completed':'pending'}), text=html(Component,Component===Home?{data:[data]}:{order:data},[data]);
    assert.match(text,/RETIRADA/);assert.match(text,/Rua Restaurante Snapshot/);withoutCustomerAddress(text);
    if(Component!==OrderDestination) {
      assert.ok(text.includes('Subtotal dos produtos'));assert.ok(text.includes('Taxa de entrega'));assert.ok(text.includes(formatOrderMoney(0)));
      assert.match(text,/Maria/);assert.match(text,/Pizza/);assert.match(text,/Grande/);assert.match(text,/Queijo/);
    }
  });
}
for(const Component of [ModalItem,Home]) {
  test(`${Component.name} renders old and new DELIVERY totals`,()=>{
    for(const data of [order(),order({fulfillment_type:'DELIVERY',subtotal:30,delivery_fee:5})]) {
      const text=html(Component,Component===Home?{data:[data]}:{},[data]);
      assert.match(text,/ENTREGA/);assert.match(text,/Rua Cliente Privada/);assert.ok(text.includes(formatOrderMoney(35)));
      if(data.subtotal===undefined) assert.match(text,/Não informado/);else assert.ok(text.includes(formatOrderMoney(5)));
    }
  });
}
test('dashboard labels pickup ready state without changing stored status',()=>{
  assert.match(html(Home,{data:[pickup({status:'enviado'})]}),/Pronto para retirada/);
  assert.match(html(Home,{data:[pickup()]}),/Marcar pronto para retirada/);
  assert.match(html(Home,{data:[order()]}),/Enviar pedido/);
});
for(const data of [order(),order({fulfillment_type:'DELIVERY',subtotal:30,delivery_fee:5}),pickup()]) {
  test(`TXT receipt distinguishes ${data.fulfillment_type||'legacy DELIVERY'} and preserves details`,()=>{
    const text=formatSales(data,profile), view=orderPresentation(data);
    assert.ok(text.includes(`Modalidade: ${view.label}`));assert.ok(text.includes(`Subtotal dos produtos: ${view.subtotal}`));assert.ok(text.includes(`Taxa de entrega: ${view.fee}`));assert.ok(text.includes(`TOTAL: ${view.total}`));
    for(const value of ['Pizza','Grande','Queijo','Qtd: 2','Pagamento: Dinheiro','Troco para:']) assert.ok(text.includes(value));
    if(view.pickup) {withoutCustomerAddress(text);assert.match(text,/Loja Snapshot/);assert.doesNotMatch(text,/Loja Atual/);}else assert.match(text,/Rua Cliente Privada/);
    assert.doesNotMatch(text,/undefined|\[object Object\]|\bnull\b/);
  });
}
test('receipt ignores profile from another restaurant and does not mutate orders',()=>{
  const data=order(),before=JSON.stringify(data);
  assert.doesNotMatch(formatSales(data,{id:'B',name:'Another restaurant'}),/Another restaurant/);
  assert.equal(JSON.stringify(data),before);
});
test('invalid or unknown money never silently becomes zero',()=>{
  for(const amount of [null,undefined,'',{},'NaN',NaN,Infinity,-1,' ']) assert.equal(formatOrderMoney(amount),'Não informado');
  assert.equal(formatOrderMoney(0),formatOrderMoney('0.00'));
});

test('Socket.IO drives real Home handlers, keeps snapshots on status updates and filters other restaurants',()=>{
  const events=new Map(), slots=[],effects=[];
  let cursor=0,first=true;
  const socket={on:(name,fn)=>events.set(name,fn),off:(name)=>events.delete(name),connect(){},disconnect(){}};
  const socketExports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/util/ordersSocket.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
    exports:socketExports,console:{log(){}},AbortController,AbortSignal,setTimeout,clearTimeout,
    require(name){if(name==='socket.io-client')return {io:()=>socket};if(name==='./backend')return {backendUrl:'https://backend.example'};throw Error(name);},
  });
  const hooks={...React,
    useContext:()=>({lanchoneteProfile:profile,messages:[],ChatId(){}}),
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:fn=>{if(first)effects.push(fn);},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/Components/Home/index.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
    exports,console:{log(){},warn(){},error(){}},Date,Intl,Map,Set,setTimeout,clearTimeout,
    require(name){
      if(name==='react')return hooks;
      if(name==='@/app/util/ordersSocket')return socketExports;
      if(name in overrides)return overrides[name];
      if(name==='../../Delete')return {Delete:()=>null};if(name==='../shareButton')return {ShareButton:()=>null};
      if(name.startsWith('@/')){
        const base=path.resolve('src',name.slice(2));const file=[base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(fs.existsSync);return load(file);
      }
      return require(name);
    },
  });
  function render(){cursor=0;const tree=exports.Home({data:[]});first=false;return renderToStaticMarkup(tree);}
  render();
  const subscribe=effects.find(fn=>fn.toString().includes('subscribeOrders'));
  assert.ok(subscribe,'Home must subscribe through the existing tenant-scoped adapter');
  const cleanup=subscribe();
  try {
    events.get('newOrder')(pickup({restaurant_id:'B'}));assert.doesNotMatch(render(),/Rua Restaurante Snapshot/);
    const data=pickup();events.get('newOrder')(data);
    let text=render();assert.match(text,/RETIRADA/);assert.match(text,/Rua Restaurante Snapshot/);withoutCustomerAddress(text);
    events.get('orderUpdated')({order_id:data.order_id,status:'enviado'});
    text=render();assert.match(text,/Pronto para retirada/);assert.match(text,/Rua Restaurante Snapshot/);assert.ok(text.includes(formatOrderMoney(0)));withoutCustomerAddress(text);
    assert.equal(data.status,'pending','The received payload must not be mutated');
    events.get('orderUpdated')({order_id:data.order_id,status:'unknown'});assert.match(render(),/Pronto para retirada/);
    const delivery=order({fulfillment_type:'DELIVERY',subtotal:30,delivery_fee:5});events.get('newOrder')(delivery);
    text=render();assert.match(text,/ENTREGA/);assert.match(text,/Rua Cliente Privada/);assert.doesNotMatch(text,/Rua Restaurante Snapshot/);
    events.get('orderUpdated')({order_id:data.order_id,status:'completed'});assert.doesNotMatch(render(),/Rua Cliente Privada/);
  } finally {cleanup();}
});
