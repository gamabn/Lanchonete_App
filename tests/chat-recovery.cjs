const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,Error,AbortController,require(name){assert.ok(name in mocks,name);return mocks[name];},...globals});return exports;
}
const checkout=load('src/app/util/checkout.ts');
const categories=load('src/app/clients/[idClient]/menuCategories.ts');
const flush=()=>new Promise(setImmediate);
function harness(entries=[]){
 let tenant='A',index=0,effectIndex=0,pending=[];const states=[],deps=[],cleanups=[],calls=[],logs=[],joins=[],storage=new Map(entries),writes=[];
 const jsx=(type,props)=>({type,props});
 const react={useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(fn,next){const i=effectIndex++;if(!deps[i]||next.some((value,j)=>value!==deps[i][j])){deps[i]=next;pending.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}};
 const Component=load('src/app/clients/[idClient]/page.tsx',{
  react,axios:require('axios'),'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useParams:()=>({idClient:tenant})},'next/link':{},
  'react-toastify':{toast:{error(){assert.fail('Menu must remain usable');},success(){},info(){}}},
  'lucide-react':new Proxy({}, {get:()=>()=>null}), '@/app/components/money':{formatarPreco:String},
  '@/app/components/Socket':{on(){},off(){},disconnect(){}},
  '@/app/util/customerStorage':{customerOrderKey:id=>'customer_order:'+id,watchCustomerSessionChanges:()=>()=>{}},
  '@/app/util/chatRooms':{joinChat:(_socket,id)=>joins.push(id),leaveChat(){}},
  '@/app/util/chatApi':{__esModule:true,chatCredentialKey:id=>'chat_credential:'+id,default:{get(url,config){
    if(url.startsWith('/message/')){calls.push({url,config});return Promise.resolve({data:[]});}
    return new Promise((resolve,reject)=>calls.push({url,config,resolve,reject}));
  }}},'./ProductConfigurationDialog':{},'@/app/util/checkout':checkout,'./menuCategories':categories,
 },{console:{error:(...args)=>logs.push(args)},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes.push(key);storage.set(key,value);}},
 fetch:async url=>({ok:true,json:async()=>url.includes('/store/')?{id:tenant,name:'Store',status:true}:[]}),
 });
 function render(){index=0;effectIndex=0;pending=[];const tree=Component.default();pending.forEach(fn=>fn());return tree;}
 return {calls,logs,joins,storage,writes,render,async mount(){render();await flush();return render();},async switchTenant(id){tenant=id;return this.mount();},unmount(){cleanups.forEach(fn=>fn?.());}};
}
const context=(tenant='A',order='order-A',credential='credential-A')=>[[`customer_order:${tenant}`,JSON.stringify(order)],[`chat_credential:${tenant}`,credential]];
for(const [name,entries] of [ ['no order',[]],['order without credential',context().slice(0,1)],['credential without order',context().slice(1)],['other restaurant only',context('B')],['malformed saved order', [['customer_order:A','{}'],['chat_credential:A','credential-A']]] ]){
 test(`${name}: no chat request and no storage removal`,async()=>{const h=harness(entries);await h.mount();h.render();assert.equal(h.calls.length,0);assert.equal(h.joins.length,0);assert.equal(h.writes.length,0);assert.equal(h.storage.size,entries.length);});
}
test('authorized previous order is restored with captured credential and no repeated lookup',async()=>{
 const h=harness(context());await h.mount();assert.equal(h.calls.length,1);const request=h.calls[0];
 assert.equal(request.url,'/chat/order-A');assert.equal(request.config.headers['x-chat-credential'],'credential-A');assert.equal(request.config.signal.aborted,false);
 request.resolve({data:{chat_id:'chat-A'}});await flush();h.render();await flush();h.render();
 assert.deepEqual(h.joins,['chat-A']);assert.equal(h.calls.filter(c=>c.url.startsWith('/chat/')).length,1);
 const messages=h.calls.find(c=>c.url==='/message/chat-A');assert.equal(messages.config.headers['x-chat-credential'],'credential-A');assert.equal(h.storage.get('chat_credential:A'),'credential-A');
});
for(const status of [401,403])test(`${status} is handled without logging tokens, retry or deleting previous-order data`,async()=>{
 const h=harness(context());await h.mount();h.calls[0].reject({isAxiosError:true,response:{status},config:{headers:{'x-chat-credential':'SECRET'}}});await flush();h.render();h.render();
 assert.equal(h.calls.length,1);assert.equal(h.joins.length,0);assert.equal(h.logs.length,0);assert.equal(h.writes.length,0);assert.equal(h.storage.size,2);
});
test('network/unexpected errors have safe diagnostics and no automatic retry',async()=>{
 const h=harness(context());await h.mount();h.calls[0].reject({isAxiosError:true,message:'SECRET',config:{headers:{Authorization:'SECRET'}}});await flush();h.render();
 assert.equal(h.logs.length,1);assert.equal(JSON.stringify(h.logs).includes('SECRET'),false);assert.equal(h.calls.length,1);
});
test('restaurant change aborts old lookup and ignores stale success even when transport resolves',async()=>{
 const h=harness([...context(),...context('B','order-B','credential-B')]);await h.mount();const old=h.calls[0];
 await h.switchTenant('B');assert.equal(old.config.signal.aborted,true);assert.equal(h.calls.length,2);
 assert.equal(h.calls[1].config.headers['x-chat-credential'],'credential-B');assert.equal(old.config.headers['x-chat-credential'],'credential-A');
 old.resolve({data:{chat_id:'stale-A'}});await flush();h.render();assert.equal(h.joins.length,0);
 h.calls[1].resolve({data:{chat_id:'chat-B'}});await flush();h.render();assert.deepEqual(h.joins,['chat-B']);
});
test('unmount cancels request and suppresses stale errors',async()=>{
 const h=harness(context());await h.mount();h.unmount();assert.equal(h.calls[0].config.signal.aborted,true);
 h.calls[0].reject({isAxiosError:true,response:{status:500},config:{headers:{Authorization:'SECRET'}}});await flush();assert.equal(h.logs.length,0);
});
test('switching to incomplete context clears previous chat and cancels message fetch',async()=>{
 const h=harness(context());await h.mount();h.calls[0].resolve({data:{chat_id:'chat-A'}});await flush();h.render();
 const messages=h.calls.find(c=>c.url==='/message/chat-A');await h.switchTenant('B');
 assert.equal(messages.config.signal.aborted,true);assert.equal(h.calls.filter(c=>c.url.startsWith('/chat/')).length,1);assert.deepEqual(h.joins,['chat-A']);
});

test('Axios cancellation is ignored even if transport rejects before effect cleanup',async()=>{
 const h=harness(context());await h.mount();h.calls[0].reject({__CANCEL__:true,message:'SECRET'});await flush();h.render();assert.equal(h.logs.length,0);assert.equal(h.calls.length,1);
});
test('legacy raw order IDs remain recoverable',async()=>{
 const h=harness([['customer_order:A','order-A'],['chat_credential:A','credential-A']]);await h.mount();assert.equal(h.calls[0].url,'/chat/order-A');
});
