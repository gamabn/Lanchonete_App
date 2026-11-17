const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://dashboard.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,self:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const React=require('react'),{act}=React,{hydrateRoot,createRoot}=require('react-dom/client'),{renderToString}=require('react-dom/server');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 vm.runInThisContext('(function(exports,require){'+ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText+'\n})',{filename:file})(exports,name=>{
  if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');
  if(name.startsWith('./'))return load(path.join(path.dirname(file),name+'.ts'));
  return require(name);
 });return exports;
}
let trace=[];let activeController;
const {WhatsAppConnectionController}=load('src/app/dashboard/whatsapp/connectionController.ts');
// Temporary diagnostic trace: wrap real methods without changing their behavior or recording payloads.
for(const name of ['refresh','act','dispose','setVisible']){const original=WhatsAppConnectionController.prototype[name];
 WhatsAppConnectionController.prototype[name]=function(...args){activeController=this;trace.push({event:name,disposed:this.disposed,visible:this.visible,inFlight:Boolean(this.request),loading:this.state.loading,busy:this.state.busy});return original.apply(this,args);};
}
const {WhatsAppPanel}=load('src/app/dashboard/whatsapp/WhatsAppPanel.tsx');
const A='00000000-0000-4000-8000-000000000001';
const snapshot=(status='disconnected')=>({restaurant_id:A,status,qr_available:status==='qr_required',error:null});
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
async function mount(hydrate=true){
 trace=[];const requests=[],errors=[];global.fetch=(url,options)=>new Promise((resolve,reject)=>{
  const request={url,options,resolve:(data,status)=>resolve(response(data,status))};requests.push(request);
  options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
 });
 const container=document.createElement('div');document.body.append(container);
 const element=callback=>React.createElement(React.StrictMode,null,React.createElement(WhatsAppPanel,{ownerId:A,onExpired:callback||(()=>{})}));
 if(hydrate)container.innerHTML=renderToString(element());let root;
 await act(async()=>{if(hydrate)root=hydrateRoot(container,element(),{onRecoverableError:error=>errors.push(error)});else{root=createRoot(container);root.render(element());}});
 const button=text=>[...container.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')||button.textContent).includes(text));
 const answer=async(data,status=200)=>act(async()=>requests.at(-1).resolve(data,status));
 const click=async text=>act(async()=>{const target=button(text);trace.push({event:'click',button:text,disabled:target.disabled,ready:container.querySelector('section').dataset.controllerReady});target.click();});
 return {container,requests,errors,button,answer,click,get controller(){return activeController;},rerender:async()=>act(async()=>root.render(element(()=>{}))),close:async()=>{await act(async()=>root.unmount());container.remove();}};
}
test('hydrated StrictMode panel sends real clicks and shows manual refresh feedback',async()=>{
 const f=await mount();try{
  assert.equal(f.requests.length,1);assert.equal(f.button('Conectar WhatsApp').disabled,true);
  await f.answer(snapshot());assert.equal(f.button('Conectar WhatsApp').disabled,false);assert.equal(f.button('Atualizar status').disabled,false);
  const before=f.requests.length;await f.rerender();assert.equal(f.requests.length,before,'callback change keeps controller');
  await f.click('Atualizar status');assert.equal(f.requests.at(-1).url,'/api/whatsapp/status');
  assert.match(f.container.textContent,/Consultando conexão/);assert.equal(f.button('Atualizar status').disabled,true);
  await f.answer(snapshot());assert.equal(f.button('Atualizar status').disabled,false);
  await f.click('Conectar WhatsApp');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');assert.equal(f.requests.at(-1).options.method,'POST');assert.match(f.container.textContent,/Conectando…/);
  await f.answer({error:'START_FAILED'},503);assert.ok(f.container.querySelector('[role=alert]'));assert.equal(f.button('Conectar WhatsApp').disabled,false);
  await f.click('Conectar WhatsApp');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');await f.answer(snapshot('connected'));assert.match(f.container.textContent,/WhatsApp conectado/);
  assert.deepEqual(f.errors,[]);assert.ok(trace.filter(e=>e.event==='click').every(e=>e.ready==='true'&&!e.disabled));
 }finally{await f.close();}
});
test('manual refresh during background polling must send a fresh request with visible feedback',async()=>{
 const f=await mount();try{
  await f.answer(snapshot());
  // Returning to a visible tab starts a background status request.
  Object.defineProperty(document,'hidden',{configurable:true,value:true});await act(async()=>document.dispatchEvent(new window.Event('visibilitychange')));
  Object.defineProperty(document,'hidden',{configurable:true,value:false});await act(async()=>document.dispatchEvent(new window.Event('visibilitychange')));
  const inFlight=f.requests.at(-1),count=f.requests.length;
  assert.equal(f.button('Atualizar status').disabled,false);await f.click('Atualizar status');
  assert.ok(trace.some(e=>e.event==='refresh'&&e.inFlight),'diagnostic trace confirms the click reached the live controller during a GET');
  assert.equal(f.requests.length,count+1);assert.equal(inFlight.options.signal.aborted,true);assert.match(f.container.textContent,/Consultando conexão/);
  await f.answer(snapshot());
 }finally{await f.close();Object.defineProperty(document,'hidden',{configurable:true,value:false});}
});

test('StrictMode effect replay keeps a live controller for clicks',async()=>{
 const f=await mount(false);try{
  assert.equal(f.requests.length,2);assert.equal(f.requests[0].options.signal.aborted,true);
  await f.answer(snapshot());await f.click('Conectar WhatsApp');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');assert.match(f.container.textContent,/Conectando…/);
  await f.answer(snapshot('connected'));assert.equal(f.button('Desconectar WhatsApp').disabled,false);
 }finally{await f.close();}
});

test('mounting a hidden page does not leave buttons disabled indefinitely; explicit click resumes',async()=>{
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 const f=await mount();try{
  assert.equal(f.requests.length,0);assert.match(f.container.textContent,/Atualização pausada/);
  assert.equal(f.button('Conectar WhatsApp').disabled,false);assert.equal(f.button('Atualizar status').disabled,false);
  await f.click('Conectar WhatsApp');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');assert.match(f.container.textContent,/Conectando…/);
  await f.answer(snapshot('connected'));
 }finally{await f.close();Object.defineProperty(document,'hidden',{configurable:true,value:false});}
});
test('QR and disconnect confirmation work through hydrated React buttons',async()=>{
 const f=await mount();const oldConfirm=window.confirm;let confirms=0;
 try{
  await f.answer(snapshot());await f.click('Conectar WhatsApp');await f.answer(snapshot('qr_required'));
  await f.click('Atualizar status');
  await f.answer(snapshot('qr_required'));assert.equal(f.requests.at(-1).url,'/api/whatsapp/qr');
  await f.answer({restaurant_id:A,qr:'synthetic-test-qr',expires_at:new Date(Date.now()+60000).toISOString()});
  assert.ok(f.container.querySelector('svg[role=img]'));
  const count=f.requests.length;window.confirm=()=>{confirms++;return false;};await f.click('Desconectar WhatsApp');assert.equal(f.requests.length,count);
  window.confirm=()=>{confirms++;return true;};await f.click('Desconectar WhatsApp');assert.equal(confirms,2);assert.equal(f.requests.at(-1).url,'/api/whatsapp/disconnect');assert.match(f.container.textContent,/Desconectando…/);
  await f.answer(snapshot());assert.equal(f.container.querySelector('svg[role=img]'),null);assert.equal(f.button('Conectar WhatsApp').disabled,false);assert.deepEqual(f.errors,[]);
 }finally{window.confirm=oldConfirm;await f.close();}
});

for(const [flag,value,message] of [
 ['disposed',true,/controlador deste painel foi encerrado/],
 ['expired',true,/sessão expirou/],
 ['busy','disconnect',/operação em andamento/],
])test(`enabled React button reconciles stale controller ${flag} and reports the blocked click`,async()=>{
 const f=await mount();try{
  await f.answer(snapshot());assert.equal(f.button('Conectar WhatsApp').disabled,false);
  // Deliberately create UI/controller divergence; this is not evidence about the user's browser.
  if(flag==='expired')f.controller.state.expired=value;else if(flag==='busy')f.controller.state.busy=value;else f.controller.disposed=value;
  const count=f.requests.length;await f.click('Conectar WhatsApp');
  assert.equal(f.requests.length,count);assert.match(f.container.querySelector('[role=alert]').textContent,message);
  if(flag!=='disposed')assert.equal(f.button('Conectar WhatsApp').disabled,true);
 }finally{await f.close();}
});
test('stale hidden controller resumes on explicit click when document is visible',async()=>{
 const f=await mount();try{
  await f.answer(snapshot());f.controller.visible=false;
  assert.equal(document.hidden,false);assert.equal(f.button('Conectar WhatsApp').disabled,false);
  await f.click('Conectar WhatsApp');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');await f.answer(snapshot('connected'));
 }finally{await f.close();}
});

test('default fetch keeps the global receiver and preserves request options',async()=>{
 const previousFetch=global.fetch,requests=[];
 global.fetch=function(url,options){
  // Browser-style receiver check: Node fetch and the prior arrow mocks do not enforce this.
  if(this!==globalThis)throw new TypeError('Illegal invocation');
  requests.push({url,options});return Promise.resolve(response(snapshot()));
 };
 const controller=new WhatsAppConnectionController(A,()=>{},()=>{},{schedule:()=>1,cancel(){}});
 try{
  await controller.refresh();await controller.act('connect');
  assert.deepEqual(requests.map(r=>r.url),['/api/whatsapp/status','/api/whatsapp/connect']);
  assert.equal(requests[1].options.method,'POST');assert.equal(requests[1].options.credentials,'same-origin');
  assert.equal(requests[1].options.cache,'no-store');assert.ok(requests[1].options.signal instanceof AbortSignal);
 }finally{controller.dispose();global.fetch=previousFetch;}
});

test('act.failed reports message, stack and the precise failing request operation',async()=>{
 const previousLog=console.log,previousTimeout=AbortSignal.timeout,logs=[];
 console.log=(event,detail)=>logs.push({event,detail});
 let controller;
 try{
  const failure=new TypeError('synthetic fetch failure');
  controller=new WhatsAppConnectionController(A,()=>{},()=>{},{fetch:()=>{throw failure;},schedule:()=>1,cancel(){}});
  await controller.act('connect');
  let entry=logs.find(l=>l.event==='[whatsapp:H12.1] act.failed').detail;
  assert.equal(entry.operation,'fetch(url, options)');assert.equal(entry.errorMessage,failure.message);assert.equal(entry.errorStack,failure.stack);
  controller.dispose();logs.length=0;
  AbortSignal.timeout=()=>{throw new TypeError('synthetic timeout construction failure');};
  controller=new WhatsAppConnectionController(A,()=>{},()=>{},{fetch:()=>assert.fail('fetch must not run'),schedule:()=>1,cancel(){}});
  await controller.act('connect');entry=logs.find(l=>l.event==='[whatsapp:H12.1] act.failed').detail;
  assert.equal(entry.operation,'AbortSignal.timeout(15000)');assert.equal(entry.errorName,'TypeError');assert.match(entry.errorStack,/synthetic timeout construction failure/);
 }finally{controller?.dispose();AbortSignal.timeout=previousTimeout;console.log=previousLog;}
});
