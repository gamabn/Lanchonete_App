const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,Error,URL,File,FormData,console:{error(){}},require(name){assert.ok(name in mocks,name);return mocks[name];},...globals});return exports;}
const helpers=load('src/app/dashboard/product/productCategory.ts');
const row=(id,name)=>({id,name,restaurant_id:'A',description:'Descrição',category:null,price:'10.00',image_url:'image',has_variants:false});
const flush=()=>new Promise(setImmediate);
function harness(){
 const states=[],refs=[],deps=[],cleanups=[],calls=[],warnings=[],errors=[];let index=0,refIndex=0,effectIndex=0,effects=[],server=[row('a','A'),row('b','B')],failure=false,deferred=null,readDeferred=null;
 const context={user:{id:'A'},lanchoneteProfile:{id:'A'}};
 const react={useContext:()=>context,useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=refIndex++;return refs[i]??(refs[i]={current:initial});},useEffect(fn,next){const i=effectIndex++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}};
 const jsx=(type,props)=>({type,props}),Field=()=>null;
 const Component=load('src/app/dashboard/editProduct/page.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/image':{},'next/link':{},'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/app/Context':{Context:{}},'react-toastify':{toast:{success(){},error:message=>errors.push(message)}},
  '../product/CategoryField':{__esModule:true,default:Field},'../product/productCategory':helpers,'../product/ProductNavigation':{},
  '../product/useUnsavedChanges':{useUnsavedChanges(pending,scope){warnings.push({pending,scope});return {dialog:null,requestLeave:fn=>fn()};}},
 },{fetch:async(url,init={})=>{
  calls.push({url,init});if(!init.method){const snapshot=structuredClone(server);if(readDeferred)await new Promise(resolve=>readDeferred.resolve=resolve);return {ok:true,json:async()=>snapshot};}
  if(deferred)await new Promise(resolve=>deferred.resolve=resolve);
  if(failure)return {ok:false,json:async()=>({error:'Falha ao salvar'})};
  const form=init.body,id=form.get('product_id');let saved;
  server=server.map(product=>{if(product.id!==id)return product;saved={...product,name:form.get('name'),description:form.get('description'),category:form.get('category')||null,price:form.get('price')};return saved;});
  return {ok:true,json:async()=>({...saved})};
 }}).default;
 function render(){index=refIndex=effectIndex=0;effects=[];const tree=Component();effects.forEach(fn=>fn());return tree;}
 function all(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const value of Object.values(node))all(value,predicate,result);return result;}
 function article(tree,id){return all(tree,n=>n.type==='article').find(node=>all(node,n=>n.type==='input'&&n.props?.value===id).length>0);}
 function cards(tree){return all(tree,n=>n.type==='article');}
 const inputs=card=>all(card,n=>n.type==='input'&&n.props&&'value' in n.props);
 return {calls,warnings,errors,all,inputs,cards,render,context,Field,async mount(){render();await flush();return render();},async refresh(){const tree=render();all(tree,n=>n.type==='button'&&n.props?.onClick?.toString().includes('setRefreshKey'))[0].props.onClick();render();await flush();return render();},fail(value){failure=value;},defer(){deferred={};return ()=>deferred.resolve();},deferRead(){readDeferred={};return ()=>readDeferred.resolve();},server(value){server=value;},save(card){return all(card,n=>n.type==='button'&&n.props?.onClick?.toString().includes('handleEditProduct'))[0].props.onClick();}};
}
test('saving one simple product updates only that row and retains another pending name and price',async()=>{
 const h=harness();let tree=await h.mount();assert.equal(h.warnings.at(-1).pending,false);
 let [a,b]=h.cards(tree);h.inputs(b)[0].props.onChange({target:{value:'B pendente'}});
 h.inputs(b).find(n=>n.props.value==='10,00').props.onChange({target:{value:'27,50'}});
 h.inputs(a)[0].props.onChange({target:{value:'A salvo'}});tree=h.render();await h.save(h.cards(tree)[0]);tree=h.render();
 assert.equal(h.calls.filter(c=>!c.init.method).length,1,'No full-list reload after save');
 assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'A salvo');
 assert.equal(h.inputs(h.cards(tree)[1])[0].props.value,'B pendente');
 assert.ok(h.inputs(h.cards(tree)[1]).some(n=>n.props.value==='27,50'));
 assert.equal(h.warnings.at(-1).pending,true);
 await h.save(h.cards(tree)[1]);h.render();assert.equal(h.warnings.at(-1).pending,false);
});
test('manual refresh retains dirty rows and refreshes only clean rows',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[1])[0].props.onChange({target:{value:'B local'}});h.render();
 h.server([row('a','A remoto'),row('b','B remoto')]);tree=await h.refresh();
 assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'A remoto');assert.equal(h.inputs(h.cards(tree)[1])[0].props.value,'B local');assert.equal(h.warnings.at(-1).pending,true);
});
test('manual refresh retains a dirty product missing remotely rather than losing its draft',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[1])[0].props.onChange({target:{value:'B local'}});h.render();h.server([row('a','A')]);tree=await h.refresh();
 assert.equal(h.cards(tree).length,2);assert.equal(h.inputs(h.cards(tree)[1])[0].props.value,'B local');
});
test('failed save retains pending data; a confirmed save removes only that pending row',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'A pendente'}});tree=h.render();h.fail(true);
 await h.save(h.cards(tree)[0]);tree=h.render();assert.equal(h.warnings.at(-1).pending,true);assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'A pendente');
 assert.deepEqual(h.errors,['Falha ao salvar']);h.fail(false);await h.save(h.cards(tree)[0]);h.render();assert.equal(h.warnings.at(-1).pending,false);
});
test('edits made during an in-flight save are not overwritten by its response',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'Primeira edição'}});tree=h.render();const release=h.defer(),saving=h.save(h.cards(tree)[0]);
 h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'Segunda edição'}});h.render();release();await saving;tree=h.render();
 assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'Segunda edição');assert.equal(h.warnings.at(-1).pending,true);
});
test('tenant changes clear old draft state and reset the guard scope',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[1])[0].props.onChange({target:{value:'Não misturar'}});h.render();
 h.context.user.id='B';h.context.lanchoneteProfile.id='B';h.server([{...row('c','Outro restaurante'),restaurant_id:'B'}]);tree=await h.mount();
 assert.equal(h.cards(tree).length,1);assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'Outro restaurante');assert.equal(h.warnings.at(-1).scope,'B');assert.equal(h.warnings.at(-1).pending,false);
});

test('a list request started before a confirmed save cannot overwrite its response',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'A confirmado'}});tree=h.render();
 const releaseSave=h.defer(),save=h.save(h.cards(tree)[0]);const releaseRead=h.deferRead();await h.refresh();
 releaseSave();await save;h.render();releaseRead();await flush();tree=h.render();
 assert.equal(h.inputs(h.cards(tree)[0])[0].props.value,'A confirmado');assert.equal(h.warnings.at(-1).pending,false);
});
test('saving a different row preserves another row’s selected image and draft warning',async()=>{
 const h=harness();let tree=await h.mount();const file=new File(['pending image'],'photo.png',{type:'image/png'});
 h.all(h.cards(tree)[1],n=>n.type==='input'&&n.props?.type==='file')[0].props.onChange({target:{files:[file]}});tree=h.render();
 await h.save(h.cards(tree)[0]);tree=h.render();assert.equal(h.warnings.at(-1).pending,true);
 await h.save(h.cards(tree)[1]);tree=h.render();
 assert.equal(h.calls.filter(c=>c.init.method==='PUT').at(-1).init.body.get('file'),file);assert.equal(h.warnings.at(-1).pending,false);
});
test('returning fields to their saved values removes the simple-product draft warning',async()=>{
 const h=harness();let tree=await h.mount();h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'Temporary'}});tree=h.render();assert.equal(h.warnings.at(-1).pending,true);
 h.inputs(h.cards(tree)[0])[0].props.onChange({target:{value:'A'}});h.render();assert.equal(h.warnings.at(-1).pending,false);
});
