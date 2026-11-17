const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,console,Error,AbortSignal,AbortController,require(name){assert.ok(name in mocks,name);return mocks[name];},...globals});
 return exports;
}
const helpers=load('src/app/clients/[idClient]/menuCategories.ts');
const checkout=load('src/app/util/checkout.ts');
const product=(id,category,extra={})=>({id,category,restaurant_id:'A',name:id,description:'',price:6,image_url:'',...extra});
const products=[product('Cola','Refrigerantes'),product('Suco','Sucos',{has_variants:true}),product('Cola zero','refrigerantes'),product('Água',null),product('Legado',undefined),product('Outra loja','Cervejas',{restaurant_id:'B'})];
const ids=items=>Array.from(items,item=>item.id);
test('dynamic categories start with Todos, deduplicate case/NFC and preserve names and source order',()=>{
 const options=helpers.menuCategories([...products,product('água com gás',' A\u0301guas '),product('água mineral','ÁGUAS')],'A');
 assert.deepEqual(Array.from(options,o=>o.label),['Todos','Refrigerantes','Sucos','Águas','Sem categoria']);
 assert.equal(options[0].key,helpers.ALL_CATEGORIES);
 assert.equal(options.at(-1).key,helpers.UNCATEGORIZED);
 assert.deepEqual(ids(helpers.filterMenuProducts(products,'A',options[1].key,'')),['Cola','Cola zero']);
 assert.deepEqual(ids(helpers.filterMenuProducts(products,'A',helpers.ALL_CATEGORIES,'')),['Cola','Suco','Cola zero','Água','Legado']);
});
test('uncategorized supports NULL, omitted and empty historical labels; hidden when absent',()=>{
 const rows=[...products,product('Vazio','   ')];
 assert.deepEqual(ids(helpers.filterMenuProducts(rows,'A',helpers.UNCATEGORIZED,'')),['Água','Legado','Vazio']);
 assert.deepEqual(Array.from(helpers.menuCategories([products[0]],'A'),o=>o.label),['Todos','Refrigerantes']);
 assert.deepEqual(Array.from(helpers.menuCategories([],'A'),o=>o.label),['Todos']);
});
test('category and existing name/description search intersect and never mutate products or pricing',()=>{
 const before=JSON.stringify(products),key=helpers.menuCategories(products,'A')[1].key;
 assert.deepEqual(ids(helpers.filterMenuProducts(products,'A',key,' ZERO ')),['Cola zero']);
 assert.equal(helpers.filterMenuProducts(products,'A',key,'Suco').length,0);
 assert.deepEqual(ids(helpers.filterMenuProducts([product('Laranja','Sucos',{description:'Natural'})],'A','category:sucos','natural')),['Laranja']);
 assert.equal(JSON.stringify(products),before);
 assert.equal(helpers.filterMenuProducts(products,'A','category:sucos','')[0],products[1]);
});
test('special filter keys do not collide with actual categories named Todos or Sem categoria',()=>{
 const rows=[product('um','Todos'),product('dois','Sem categoria'),product('três',null)];
 const options=helpers.menuCategories(rows,'A');assert.equal(new Set(options.map(o=>o.key)).size,4);
 assert.deepEqual(ids(helpers.filterMenuProducts(rows,'A',options[1].key,'')),['um']);
 assert.deepEqual(ids(helpers.filterMenuProducts(rows,'A',options[2].key,'')),['dois']);
});
function harness(){
 const state=[],deps=[],cleanups=[];let stateIndex=0,effectIndex=0,tenant='A',pending=[];
 const calls=[],storage=new Map(),jsx=(type,props)=>({type,props}),Dialog=()=>null;
 const react={useState(initial){const i=stateIndex++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(fn,next){const i=effectIndex++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;pending.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}};
 const Client=load('src/app/clients/[idClient]/page.tsx',{
  axios:require('axios'),
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useParams:()=>({idClient:tenant})},'next/link':{},
  'react-toastify':{toast:{success(){},error(message){assert.fail(message);},info(){}}},
  'lucide-react':new Proxy({}, {get:()=>()=>null}),
  '@/app/components/money':{formatarPreco:value=>`R$ ${value}`},
  '@/app/components/Socket':{on(){},off(){},disconnect(){}},
  '@/app/util/customerStorage':{customerOrderKey:id=>'order-'+id,watchCustomerSessionChanges:()=>()=>{}},
  '@/app/util/chatRooms':{joinChat(){},leaveChat(){}},
  '@/app/util/chatApi':{chatCredentialKey:id=>'chat_credential:'+id},'./ProductConfigurationDialog':{__esModule:true,default:Dialog},
  '@/app/util/checkout':checkout,'./menuCategories':helpers,
 },{localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},fetch:async url=>{
  calls.push(url);return {ok:true,json:async()=>url.includes('/store/')?{id:tenant,name:'Loja '+tenant,status:true}:tenant==='A'?products:[product('Cerveja','Cervejas',{restaurant_id:'B'})]};
 }}).default;
 function render(){stateIndex=0;effectIndex=0;pending=[];const tree=Client();pending.forEach(fn=>fn());return tree;}
 function all(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const value of Object.values(node))all(value,predicate,result);return result;}
 const buttons=tree=>all(tree,n=>n.type==='button'&&n.props&&'aria-pressed' in n.props);
 return {render,all,buttons,calls,storage,Dialog,async mount(){render();await new Promise(setImmediate);return render();},async switchTenant(value){tenant=value;render();await new Promise(setImmediate);return render();}};
}
test('public menu navigation toggles category, search and Todos without requests; keeps horizontal accessible buttons',async()=>{
 const h=harness();let tree=await h.mount();const requests=h.calls.length;
 let buttons=h.buttons(tree);assert.equal(buttons[0].props.children,'Todos');assert.equal(buttons[0].props['aria-pressed'],true);
 const nav=h.all(tree,n=>n.type==='nav')[0];assert.equal(nav.props['aria-label'],'Categorias do cardápio');assert.match(nav.props.className,/overflow-x-auto/);
 buttons.find(b=>b.props.children==='Refrigerantes').props.onClick();tree=h.render();
 assert.equal(h.all(tree,n=>n.type==='article').length,2);
 assert.equal(h.buttons(tree).find(b=>b.props.children==='Refrigerantes').props['aria-pressed'],true);
 const search=h.all(tree,n=>n.type==='input'&&n.props?.type==='search')[0];search.props.onChange({target:{value:'zero'}});tree=h.render();
 assert.equal(h.all(tree,n=>n.type==='article').length,1);
 h.buttons(tree)[0].props.onClick();tree=h.render();assert.equal(h.all(tree,n=>n.type==='article').length,1);
 h.all(tree,n=>n.type==='input'&&n.props?.type==='search')[0].props.onChange({target:{value:''}});tree=h.render();
 assert.equal(h.all(tree,n=>n.type==='article').length,5);
 h.buttons(tree).find(b=>b.props.children==='Sem categoria').props.onClick();tree=h.render();assert.equal(h.all(tree,n=>n.type==='article').length,2);
 assert.equal(h.calls.length,requests);
});
test('restaurant change resets selected filter and never displays other restaurant categories',async()=>{
 const h=harness();let tree=await h.mount();
 h.buttons(tree).find(b=>b.props.children==='Sucos').props.onClick();h.render();
 tree=await h.switchTenant('B');
 assert.deepEqual(h.buttons(tree).map(b=>b.props.children),['Todos','Cervejas']);
 assert.equal(h.buttons(tree)[0].props['aria-pressed'],true);
 assert.equal(h.all(tree,n=>n.type==='article').length,1);
});
test('configured product still opens the dialog; adding it preserves configuration and cart across filters',async()=>{
 const h=harness();let tree=await h.mount();
 h.buttons(tree).find(b=>b.props.children==='Sucos').props.onClick();tree=h.render();
 h.all(tree,n=>n.type==='button'&&n.props?.children==='Escolher tamanho e opções')[0].props.onClick();tree=h.render();
 const dialog=h.all(tree,n=>n.type===h.Dialog)[0];assert.equal(dialog.props.restaurantId,'A');assert.equal(dialog.props.product,products[1]);
 const configured={...products[1],variant_id:'v',option_ids:['o'],variant_name:'300 ml',price:8,options:[{id:'o',name:'Extra',additional_price:2,group_name:'Adicionais'}]};
 dialog.props.onAdd(configured);dialog.props.onClose();tree=h.render();
 const saved=JSON.parse(h.storage.get('product'));assert.equal(saved[0].variant_id,'v');assert.deepEqual(saved[0].option_ids,['o']);assert.equal(saved[0].price,8);
 h.buttons(tree).find(b=>b.props.children==='Refrigerantes').props.onClick();h.render();
 assert.equal(h.storage.get('product'),JSON.stringify(saved));
 assert.equal(JSON.parse(h.storage.get('product_quantities'))[checkout.cartLineKey(configured)],1);
});
