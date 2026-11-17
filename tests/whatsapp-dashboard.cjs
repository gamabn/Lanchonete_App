const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const A='729cfbae-a56c-4432-9128-65b97205c701',B='00000000-0000-4000-8000-000000000002';
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];},Date,Map,Set,AbortController,AbortSignal,...globals});return exports;}
const types=load('src/app/util/whatsappTypes.ts');
const model=load('src/app/dashboard/whatsapp/connectionController.ts',{'@/app/util/whatsappTypes':types});
const tick=()=>new Promise(r=>setImmediate(r));
const snapshot=(status='disconnected',id=A)=>({restaurant_id:id,status,qr_available:status==='qr_required',error:null});
function harness(owner=A){
 const f={requests:[],timers:new Map(),time:Date.now(),expired:0,changes:0,view:model.initialConnectionView()};let id=0;
 f.controller=new model.WhatsAppConnectionController(owner,value=>{f.view=value;f.changes++;},()=>{f.expired++;},{fetch:(url,options)=>new Promise((resolve,reject)=>f.requests.push({url,options,resolve,reject})),now:()=>f.time,schedule:(callback,delay)=>{const key=++id;f.timers.set(key,{callback,delay});return key;},cancel:key=>f.timers.delete(key)});
 f.respond=(index,status,data)=>f.requests[index].resolve({status,ok:status>=200&&status<300,json:async()=>data});
 f.fire=delay=>{const pair=[...f.timers].find(([,v])=>v.delay===delay);assert.ok(pair,'Expected timer '+delay);f.timers.delete(pair[0]);f.time+=delay;pair[1].callback();};
 f.load=async status=>{const pending=f.controller.refresh();f.respond(f.requests.length-1,200,snapshot(status,owner));await pending;};
 f.loadQR=async payload=>{const pending=f.controller.refresh();f.respond(f.requests.length-1,200,snapshot('qr_required',owner));await tick();f.respond(f.requests.length-1,200,{restaurant_id:owner,qr:payload,expires_at:new Date(f.time+60000).toISOString()});await pending;};
 return f;
}
test('initial load is read-only, idle polling is slower and requests never include a tenant selector or JWT',async()=>{
 const f=harness();await f.load('connected');assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/whatsapp/status');assert.equal(f.requests[0].options.cache,'no-store');assert.equal(f.requests[0].options.credentials,'same-origin');assert.ok([...f.timers.values()].some(t=>t.delay===15000));
 assert.doesNotMatch(JSON.stringify(f.requests.map(r=>({url:r.url,options:r.options}))),/restaurant_id|Authorization|Bearer/);f.controller.dispose();assert.equal(f.timers.size,0);
});
test('QR is loaded only when needed, rotates locally, expires and is cleared on connection',async()=>{
 const f=harness();await f.loadQR('QR_A_1');assert.equal(f.view.qr.qr,'QR_A_1');assert.ok([...f.timers.values()].some(t=>t.delay===3000));
 await f.loadQR('QR_A_2');assert.equal(f.view.qr.qr,'QR_A_2');f.fire(60000);assert.equal(f.view.qr,null);
 await f.load('connected');assert.equal(f.view.qr,null);assert.equal(f.requests.filter(r=>r.url.endsWith('/qr')).length,2);f.controller.dispose();
});
test('hidden page aborts requests, clears QR, pauses polling and refreshes on return',async()=>{
 const f=harness();await f.loadQR('PRIVATE_QR');const pending=f.controller.refresh();const old=f.requests.at(-1);f.controller.setVisible(false);assert.equal(old.options.signal.aborted,true);assert.equal(f.view.qr,null);assert.equal(f.timers.size,0);
 old.resolve({ok:true,status:200,json:async()=>snapshot('qr_required')});await pending;assert.equal(f.requests.filter(r=>r.url.endsWith('/qr')).length,1);
 f.controller.setVisible(true);assert.equal(f.requests.at(-1).url,'/api/whatsapp/status');f.respond(f.requests.length-1,200,snapshot('connected'));await tick();assert.equal(f.view.connection.status,'connected');f.controller.dispose();
});
test('polls never overlap and unmount ignores late responses',async()=>{
 const f=harness();const first=f.controller.refresh();await f.controller.refresh();assert.equal(f.requests.length,1);const changes=f.changes;f.controller.dispose();f.respond(0,200,snapshot('qr_required'));await first;assert.equal(f.changes,changes);assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.signal.aborted,true);
});
test('expired owner session removes QR, stops polling and requests standard auth revalidation',async()=>{
 const f=harness();await f.loadQR('PRIVATE_QR');const pending=f.controller.refresh();f.respond(f.requests.length-1,401,{error:'UNAUTHORIZED'});await pending;
 assert.equal(f.expired,1);assert.equal(f.view.expired,true);assert.equal(f.view.qr,null);assert.equal(f.view.connection,null);assert.equal(f.timers.size,0);await f.controller.act('connect');assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
});
test('wrong owner in QR response is discarded before display',async()=>{
 const f=harness();const pending=f.controller.refresh();f.respond(0,200,snapshot('qr_required'));await tick();f.respond(1,200,{restaurant_id:B,qr:'QR_B',expires_at:new Date(f.time+60000).toISOString()});await pending;assert.equal(f.view.qr,null);assert.equal(f.view.expired,false);assert.equal(f.expired,0);assert.match(f.view.error,/outra sessão/);assert.equal(f.view.loading,false);
});
test('owners A and B have independent controllers and late A responses cannot overwrite B',async()=>{
 const a=harness(A),b=harness(B);const pendingA=a.controller.refresh();a.controller.dispose();await b.loadQR('QR_B');a.respond(0,200,snapshot('qr_required',A));await pendingA;
 assert.equal(b.view.qr.qr,'QR_B');assert.equal(b.view.qr.restaurant_id,B);assert.equal(a.requests.length,1);b.controller.dispose();
});
test('connect/disconnect are explicit actions, concurrent clicks coalesce and uncertain results only retry GET',async()=>{
 const f=harness();await f.load('disconnected');const pending=f.controller.act('connect');await f.controller.act('connect');assert.equal(f.requests.at(-1).url,'/api/whatsapp/connect');assert.equal(f.requests.at(-1).options.body,undefined);
 f.respond(f.requests.length-1,503,{error:'START_FAILED'});await pending;assert.equal(f.requests.filter(r=>r.options.method==='POST').length,1);f.fire(0);assert.equal(f.requests.at(-1).url,'/api/whatsapp/status');f.respond(f.requests.length-1,200,snapshot('connected'));await tick();
 const stopping=f.controller.act('disconnect');f.respond(f.requests.length-1,200,snapshot('disconnected'));await stopping;assert.equal(f.view.qr,null);assert.equal(f.view.connection.status,'disconnected');f.controller.dispose();
});
test('network failure clears sensitive QR and uses bounded polling backoff',async()=>{
 const f=harness();await f.loadQR('PRIVATE_QR');const pending=f.controller.refresh();f.requests.at(-1).reject(Error('PRIVATE_INTERNAL_DETAILS'));await pending;assert.equal(f.view.qr,null);assert.doesNotMatch(f.view.error,/PRIVATE/);assert.ok([...f.timers.values()].some(t=>t.delay===5000));
 f.fire(5000);f.requests.at(-1).reject(Error('network'));await tick();assert.ok([...f.timers.values()].some(t=>t.delay===10000));f.controller.dispose();
});
test('legacy conflict and disabled backend have useful messages without exposing configuration internals',async()=>{
 for(const code of ['LEGACY_WORKER_ACTIVE','REAL_CHECKOUT_DISABLED']){const f=harness();const pending=f.controller.act('connect');f.respond(0,code==='LEGACY_WORKER_ACTIVE'?409:503,{error:code});await pending;assert.ok(f.view.error.length>10);assert.doesNotMatch(f.view.error,/WHATSAPP_REAL|JWT|Bearer/);f.controller.dispose();}
});
test('disabled connection error remains visible while safe GET reconciles the disconnected state',async()=>{
 const f=harness(),pending=f.controller.act('connect');f.respond(0,503,{error:'REAL_CHECKOUT_DISABLED'});await pending;
 f.fire(0);f.respond(1,200,snapshot('disconnected'));await tick();assert.match(f.view.error,/ainda não está habilitada/);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,1);f.controller.dispose();
});
test('QR generation stays local, preserves quiet zone and never interpolates payload as markup',()=>{
 const helper=load('src/app/dashboard/whatsapp/localQR.ts',{qrcode:require('qrcode')});const payload='<script>PRIVATE_PAIRING_DATA</script>';const geometry=helper.localQRGeometry(payload);
 assert.ok(geometry.size>=29);assert.match(geometry.path,/^M4 4h1v1h-1z/);assert.doesNotMatch(geometry.path,/script|PRIVATE_PAIRING_DATA|https?:/);assert.match(geometry.path,/^[Mhvz0-9 -]+$/);assert.throws(()=>helper.localQRGeometry(''));
});
function panelFixture(view){
 const f={view,actions:[],confirm:false,confirmCalls:0},jsx=(type,props,key)=>({type,props,key});
 const react={useState:()=>[f.view,()=>{}],useRef:()=>({current:{act:action=>f.actions.push(action),refresh:()=>f.actions.push('refresh'),setVisible(){},diagnostics:()=>({instanceId:1})}}),useEffect(){},useMemo:fn=>fn()};
 const panel=load('src/app/dashboard/whatsapp/WhatsAppPanel.tsx',{react,'next/link':{default:'link',__esModule:true},'lucide-react':new Proxy({},{get:()=>()=>null}),'./connectionController':model,'./localQR':{localQRGeometry:()=>({size:29,path:'M4 4h1v1h-1z'})},'react/jsx-runtime':{jsx,jsxs:jsx}}, {window:{confirm:()=>{f.confirmCalls++;return f.confirm;}}});
 f.render=()=>panel.WhatsAppPanel({ownerId:A,onExpired(){}});return f;
}
function nodes(tree,result=[]){if(!tree||typeof tree!=='object')return result;if(tree.type&&tree.props)result.push(tree);for(const value of Object.values(tree)){if(Array.isArray(value))value.forEach(v=>nodes(v,result));else if(value&&typeof value==='object')nodes(value,result);}return result;}
test('disconnect button asks confirmation before sending any mutation',()=>{
 const f=panelFixture({...model.initialConnectionView(),loading:false,connection:snapshot('connected')}),tree=f.render();const button=nodes(tree).find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Desconectar WhatsApp'));
 button.props.onClick();assert.equal(f.confirmCalls,1);assert.deepEqual(f.actions,[]);f.confirm=true;button.props.onClick();assert.deepEqual(f.actions,['disconnect']);
});
test('panel presents real states and removes connect controls for legacy/expired sessions',()=>{
 for(const phase of types.whatsappStates){const f=panelFixture({...model.initialConnectionView(),loading:false,connection:snapshot(phase)});const tree=f.render();assert.ok(nodes(tree).some(n=>n.props?.role==='status'));
  const button=nodes(tree).find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Conectar WhatsApp'));if(['connected','connecting','reconnecting','qr_required','legacy_active'].includes(phase))assert.equal(button.props.disabled,true);
 }
});
test('page keys the private panel to the authenticated owner and hides it outside authenticated state',()=>{
 const f={authStatus:'authenticated',user:{id:A}},jsx=(type,props,key)=>({type,props,key}),Panel=()=>{};
 const page=load('src/app/dashboard/whatsapp/page.tsx',{react:{useContext:()=>({...f,revalidateAuth:async()=>{}}),useCallback:fn=>fn},'@/app/Context':{Context:{}},'./WhatsAppPanel':{WhatsAppPanel:Panel},'react/jsx-runtime':{jsx,jsxs:jsx}});
 assert.equal(page.default().key,A);f.user={id:B};assert.equal(page.default().key,B);f.authStatus='unauthenticated';assert.equal(page.default(),null);
});
test('desktop and mobile navigation expose the protected WhatsApp page with accessible labels',()=>{
 let cursor=0;const Link=()=>null,jsx=(type,props)=>({type,props});
 const header=load('src/app/components/HeaderDashboard/index.tsx',{
  'next/link':{default:Link,__esModule:true},react:{useState:initial=>[cursor++===1?true:initial,()=>{}],useEffect(){},useContext:()=>({lanchoneteProfile:{id:A,name:'Loja'},logout(){}})},
  'next/navigation':{useRouter:()=>({})},'@/app/Context':{Context:{}},'react-icons/fi':new Proxy({},{get:()=>()=>null}),'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/app/components/Socket':{on(){},off(){}},'react/jsx-runtime':{jsx,jsxs:jsx},
 });
 const links=nodes(header.HeaderDashboard({children:null})).filter(n=>n.type===Link&&n.props.href==='/dashboard/whatsapp');assert.equal(links.length,2);assert.ok(links.every(n=>n.props['aria-label']==='WhatsApp'&&n.props.title==='WhatsApp'));
});
