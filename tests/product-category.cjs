const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,Error,Array,FormData,File,AbortController,URL,URLSearchParams,console,require(name){assert.ok(name in mocks,name);return mocks[name];},...globals});return exports;
}
const helpers=load('src/app/dashboard/product/productCategory.ts');
const jsx=(type,props)=>({type,props});
function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of Object.values(node)){const match=find(child,predicate);if(match)return match;}}
function hooks(context){
 const states=[],effects=[],refs=[];let i=0,j=0;
 return {react:{useContext:()=>context,useState(initial){const n=i++;if(!(n in states))states[n]=initial;return [states[n],value=>states[n]=typeof value==='function'?value(states[n]):value];},useEffect(fn){effects.push(fn);},useRef(initial){const n=j++;return refs[n]??(refs[n]={current:initial});},useId:()=> 'unique'},reset(){i=0;j=0;effects.length=0;},effects};
}
const flush=()=>new Promise(setImmediate);
const Field=()=>null;
test('category suggestions include draft/simple/configured own products, deduplicate and exclude other tenants',()=>{
 const values=helpers.categorySuggestions([
  {restaurant_id:'A',category:' Bebidas  Frias ',published:false},
  {restaurant_id:'A',category:'bebidas frias',has_variants:true},
  {restaurant_id:'A',category:'A\u0301guas'},
  {restaurant_id:'A',category:null}, {restaurant_id:'A'},
  {restaurant_id:'B',category:'Segredo'},
 ],'A');
 assert.deepEqual(Array.from(values),['Águas','Bebidas Frias']);
 assert.equal(helpers.categorySuggestions([{restaurant_id:'B',category:'Segredo'}],undefined).length,0);
 assert.equal(helpers.categoryValue('🍔'.repeat(80)),'🍔'.repeat(80));
 assert.throws(()=>helpers.categoryValue('🍔'.repeat(81)),/80/);
 assert.equal(helpers.categoryValue(null),null);assert.equal(helpers.categoryValue(' '),null);
});
test('accessible free text field validates Unicode length without UTF-16 maxlength',()=>{
 const h=hooks({});
 const Component=load('src/app/dashboard/product/CategoryField.tsx',{react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/app/Context':{Context:{}},'./productCategory':helpers}).default;
 const tree=Component({suggestions:['Bebidas'],defaultValue:'Águas'});
 const input=find(tree,n=>n.type==='input'),label=find(tree,n=>n.type==='label');
 assert.equal(label.props.children,'Categoria do produto (opcional)');assert.equal(label.props.htmlFor,input.props.id);
 assert.equal(input.props.defaultValue,'Águas');assert.equal(input.props.required,undefined);assert.equal(input.props.maxLength,undefined);
 let validity;
 for(const [value,expected] of [['🍔'.repeat(80),''],['🍔'.repeat(81),'Categoria deve ter até 80 caracteres.'],['','']]){
  input.props.onInput({currentTarget:{value,setCustomValidity:message=>validity=message}});assert.equal(validity,expected);
 }
});
test('suggestions hook uses authenticated administrative endpoint and hides old tenant responses',async()=>{
 let context={lanchoneteProfile:{id:'A'}},resolve;const h=hooks(context),calls=[];
 const m=load('src/app/dashboard/product/CategoryField.tsx',{react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/app/Context':{Context:{}},'./productCategory':helpers},{fetch:(url,init)=>{calls.push({url,init});return new Promise(r=>resolve=r);}});
 h.reset();assert.equal(m.useProductCategories().length,0);const cleanup=h.effects[0]();
 assert.equal(calls[0].url,'/api/product');assert.equal(calls[0].init.cache,'no-store');
 resolve({ok:true,json:async()=>[{restaurant_id:'A',category:'Rascunhos'},{restaurant_id:'B',category:'Privada'}]});await flush();
 h.reset();assert.equal(m.useProductCategories()[0],'Rascunhos');
 cleanup();context.lanchoneteProfile.id='B';h.reset();assert.equal(m.useProductCategories().length,0);
});
function simpleHarness(mode,products=[],search="",guard={}){
 const context={user:{id:'A'},lanchoneteProfile:{id:'A'}},h=hooks(context),calls=[];
 const guardModule={useUnsavedChanges:(pending,scope)=>{guard.pending=pending;guard.scope=scope;return {dialog:null,requestLeave:action=>pending&&guard.intercept?guard.intercept(action):action()};}};
 const mocks={react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/image':{},'next/link':{},'lucide-react':new Proxy({}, {get:()=>()=>null}),'@/app/Context':{Context:{}},'react-toastify':{toast:{success(){},error(message){calls.push({error:message});}}}};
 if(mode==='create')Object.assign(mocks,{
  '@hookform/resolvers/zod':{zodResolver:()=>null},zod:require('zod'),
  'react-hook-form':{Controller:()=>null,useForm:()=>({register:name=>({name}),handleSubmit:fn=>fn,control:{},formState:{errors:{}},reset(){},setValue(){}})},
  './CategoryField':{__esModule:true,default:Field,useProductCategories:()=>['Bebidas']},'./productCategory':helpers,'./useUnsavedChanges':guardModule,'./ConfiguredProductForm':{default:()=>null},'./ProductNavigation':{__esModule:true,default:()=>null},
 });else Object.assign(mocks,{'../product/useUnsavedChanges':guardModule,'../product/ProductNavigation':{__esModule:true,default:()=>null},'../product/CategoryField':{__esModule:true,default:Field},'../product/productCategory':helpers});
 const Component=load(mode==='create'?'src/app/dashboard/product/page.tsx':'src/app/dashboard/editProduct/page.tsx',mocks,{
  window:{location:{search,href:'http://localhost/dashboard/product'+search},history:{replaceState(){}}},fetch:async(url,init={})=>{calls.push({url,init});return {ok:true,json:async()=>init.method?{}:products};}
 }).default;
 return {calls,h,render(){h.reset();return Component();},async mount(){this.render();h.effects.forEach(fn=>fn());await flush();return this.render();}};
}
test('simple create sends optional normalized category and preserves price/image payload',async()=>{
 const h=simpleHarness('create');const tree=await h.mount();const form=find(tree,n=>n.type==='form');
 for(const [category,expected] of [[undefined,''],[' A\u0301guas  Minerais ','Águas Minerais']]){
  const image=new File(['png'],'image.png',{type:'image/png'});
  await form.props.onSubmit({name:'Água',description:'Gelada',price:'4,00',image,category});
  const body=h.calls.at(-1).init.body;assert.equal(body.get('category'),expected);assert.equal(body.get('price'),'4.00');assert.equal(body.get('file').name,'image.png');
 }
});
test('simple edit shows saved category, supports removal and legacy NULL without changing price',async()=>{
 const product={id:'p',restaurant_id:'A',name:'Água',description:'Gelada',price:'4.00',image_url:'url',category:'Águas'};
 for(const saved of ['Águas',null]){
  const h=simpleHarness('edit',[{...product,category:saved}]);let tree=await h.mount();
  const field=find(tree,n=>n.type===Field);assert.equal(field.props.value,saved??'');
  field.props.onChange({target:{value:''}});tree=h.render();
  const button=find(tree,n=>n.type==='button'&&n.props?.onClick?.toString().includes('handleEditProduct'));
  await button.props.onClick();
  const call=h.calls.find(c=>c.init.method==='PUT');assert.equal(call.init.body.get('category'),'');assert.equal(call.init.body.get('price'),'4');assert.equal(call.init.body.get('file'),null);
 }
});

test('product page identifies new products and existing drafts, updates name and never leaks a previous name',async()=>{
 const newProduct=simpleHarness('create');let tree=await newProduct.mount();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Novo produto');
 const h=simpleHarness('create',[],'?draft=existing');tree=await h.mount();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Editar produto');
 let form=find(tree,n=>typeof n.props?.onProductLoaded==='function');
 assert.equal(form.props.draftId,'existing');
 form.props.onProductLoaded({id:'existing',name:'Pizza'});tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Editar produto — Pizza');
 form=find(tree,n=>typeof n.props?.onProductLoaded==='function');
 form.props.onProductLoaded({id:'existing',name:'Pizza especial'});tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Editar produto — Pizza especial');
 find(tree,n=>typeof n.props?.onDraftChange==='function').props.onDraftChange('another');tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Editar produto');
 find(tree,n=>typeof n.props?.onDraftChange==='function').props.onDraftChange('');tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Novo produto');
});

test('new product choices and model management preserve mounted simple forms',async()=>{
 const h=simpleHarness('create');let tree=await h.mount();
 const simpleForm=find(tree,n=>n.type==='form');assert.equal(simpleForm.props.hidden,false);
 find(tree,n=>n.type==='input'&&n.props?.name==='product-origin'&&n.props?.value==='template').props.onChange();tree=h.render();
 assert.equal(find(tree,n=>n.type==='form').props.hidden,true);
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.view,'templates');
 let nav=find(tree,n=>typeof n.props?.onSelect==='function');nav.props.onSelect('models');tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Meus modelos');
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.view,'models');
 assert.ok(find(tree,n=>n.type==='form'));
 find(tree,n=>typeof n.props?.onSelect==='function').props.onSelect('new');tree=h.render();
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.view,'templates');
 find(tree,n=>n.type==='input'&&n.props?.name==='product-origin'&&n.props?.value==='scratch').props.onChange();tree=h.render();
 assert.equal(find(tree,n=>n.type==='form').props.hidden,false);
 assert.equal(h.calls.filter(c=>c.init.method).length,0);
});

test('direct model management URL uses the existing product route',async()=>{
 const h=simpleHarness('create',[],'?view=models');const tree=await h.mount();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Meus modelos');
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.view,'models');
});

test('models panel keeps the draft context and offers an explicit return to editing',async()=>{
 const h=simpleHarness('create',[],'?draft=existing');let tree=await h.mount();
 find(tree,n=>typeof n.props?.onProductLoaded==='function').props.onProductLoaded({id:'existing',name:'Pizza'});tree=h.render();
 find(tree,n=>typeof n.props?.onSelect==='function').props.onSelect('models');tree=h.render();
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.draftId,'existing');
 assert.equal(find(tree,n=>typeof n.props?.onProductLoaded==='function').props.view,'models');
 const resume=find(tree,n=>n.type==='button'&&Array.isArray(n.props?.children)&&n.props.children[0]==='Continuar edição');
 assert.ok(resume);resume.props.onClick();tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Editar produto — Pizza');
 find(tree,n=>typeof n.props?.onSelect==='function').props.onSelect('new');tree=h.render();
 assert.equal(find(tree,n=>n.type==='h1').props.children,'Novo produto');
});

test('changing an existing product defers loader/state reset until discard is confirmed',async()=>{
 const queued=[],guard={intercept:action=>queued.push(action)};const h=simpleHarness('create',[],'?draft=old',guard);let tree=await h.mount();
 find(tree,n=>typeof n.props?.onPendingChange==='function').props.onPendingChange(true);tree=h.render();assert.equal(guard.pending,true);
 let changed=0;find(tree,n=>typeof n.props?.onDraftChange==='function').props.onDraftChange('next',()=>changed++);
 tree=h.render();assert.equal(changed,0);assert.equal(find(tree,n=>typeof n.props?.onDraftChange==='function').props.draftId,'old');
 // Continuing editing does not execute the queued action.
 assert.equal(queued.length,1);queued[0]();tree=h.render();
 assert.equal(changed,1);assert.equal(find(tree,n=>typeof n.props?.onDraftChange==='function').props.draftId,'next');assert.equal(guard.pending,false);
});
