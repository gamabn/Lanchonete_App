const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const backend=require('node:module').createRequire(path.resolve('../BackEnd-lanchonete/package.json'));
backend('ts-node').register({project:path.resolve('../BackEnd-lanchonete/tsconfig.json')});
const db=backend.resolve('./src/database');require.cache[db]={id:db,filename:db,loaded:true,exports:{pool:{}}};
const {TenantWhatsAppSessionManager}=backend('./src/messaging/worker/tenantSessionManager');
const {createWhatsAppRouter}=backend('./src/messaging/http/whatsappRoutes');
const {NextRequest,NextResponse}=require('next/server'),axios=require('axios'),ts=require('typescript');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];},Date,Map,Set,AbortController,AbortSignal});return exports;}
test('Express JWT auth and real manager contract through Next proxy and controller, without database or Baileys',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'gama-h121-')),before=process.env.JWT_SECRET,beforeWorker=process.env.WHATSAPP_WORKER_ENABLED,starts=[];
 process.env.JWT_SECRET='isolated-h121-test-secret';process.env.WHATSAPP_WORKER_ENABLED='true';let enabled=false;
 const manager=new TenantWhatsAppSessionManager({}, {root,enabled:()=>enabled,realCheckoutEnabled:false,allowSimulation:true,ready:async()=>assert.fail('No checkout preflight during simulation'),ownerExists:async id=>[A,B].includes(id),hostFactory:(qr,observe)=>({start:async config=>{assert.equal(config.realCheckoutEnabled,false);starts.push(config.context.restaurant_id);qr('test-only-qr');},stop:async()=>observe({state:'disconnected'})})});
 const app=backend('express')();app.use('/whatsapp',createWhatsAppRouter(manager));
 let controller;
 try{
  // Dispatch through real Express routing/auth without opening a listening socket.
  const api={request:config=>new Promise((resolve,reject)=>{
   const {IncomingMessage,ServerResponse}=require('node:http');
   const req=new IncomingMessage(new (require('node:stream').Duplex)({read(){},write(c,e,cb){cb();}}));
   req.method=config.method;req.url=config.url;req.headers={authorization:config.headers.Authorization};
   const res=new ServerResponse(req);
   res.end=body=>{const data=JSON.parse(String(body));const response={status:res.statusCode,data};
    if(res.statusCode>=400)reject({isAxiosError:true,response});else resolve(response);return res;};
   app.handle(req,res);
  })};
  let token=backend('jsonwebtoken').sign({},process.env.JWT_SECRET,{subject:A,expiresIn:'5m'});
  const types=load('src/app/util/whatsappTypes.ts',{});
  const proxy=load('src/app/api/whatsapp/proxy.ts',{'server-only':{},'next/headers':{cookies:async()=>({get:()=>({value:token})})},'next/server':{NextResponse},axios,'@/app/util/api':{default:api,__esModule:true},'@/app/util/whatsappTypes':types});
  const model=load('src/app/dashboard/whatsapp/connectionController.ts',{'@/app/util/whatsappTypes':types});let view,expired=0;
  const fetcher=(url,options)=>proxy.whatsappProxy(new NextRequest(`http://dashboard.test${url}?restaurant_id=${B}`,{method:options.method,headers:{origin:'http://dashboard.test',authorization:'Bearer ignored-browser-token'}}),url.split('/').pop(),options.method);
  controller=new model.WhatsAppConnectionController('context-user-id',v=>view=v,()=>expired++,{fetch:fetcher,schedule:()=>1,cancel(){}});
  await controller.refresh();assert.equal(view.connection.status,'disconnected');assert.equal(view.loading,false);assert.equal(expired,0);assert.deepEqual(starts,[]);
  await controller.act('connect');assert.match(view.error,/ainda não está habilitada/);assert.equal(view.busy,null);assert.equal(view.loading,false);assert.equal(view.expired,false);assert.deepEqual(starts,[]);
  enabled=true;await controller.act('connect');assert.equal(view.connection.restaurant_id,A);assert.deepEqual(starts,[A]);
  await controller.refresh();assert.equal(view.connection.status,'qr_required');assert.equal(view.qr.qr,'test-only-qr');assert.equal(view.qr.restaurant_id,A);
  assert.equal((await manager.status(B)).status,'disconnected');assert.equal((await manager.qr(B)).qr,null);
  await controller.act('disconnect');assert.equal(view.connection.status,'disconnected');assert.equal(view.qr,null);
  token='invalid';await controller.refresh();assert.equal(view.expired,true);assert.equal(expired,1);
 }finally{controller?.dispose();await manager.stopAll();fs.rmSync(root,{recursive:true,force:true});if(before===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=before;if(beforeWorker===undefined)delete process.env.WHATSAPP_WORKER_ENABLED;else process.env.WHATSAPP_WORKER_ENABLED=beforeWorker;}
});
