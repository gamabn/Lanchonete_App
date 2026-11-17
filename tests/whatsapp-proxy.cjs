const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
const A='729cfbae-a56c-4432-9128-65b97205c701',B='00000000-0000-4000-8000-000000000002';
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];},Date,Set,console:{log(){assert.fail('No public logs');},error(){assert.fail('No public logs');}}});return exports;}
const types=load('src/app/util/whatsappTypes.ts',{});
function fixture(){
 const f={token:'JWT_A',calls:[],snapshot:{restaurant_id:A,status:'disconnected',qr_available:false,error:null},qr:{qr:'QR_A',expires_at:new Date(Date.now()+60000).toISOString()},failure:null};
 const api={request:async config=>{f.calls.push(config);if(f.failure)throw f.failure;return{data:config.url==='/whatsapp/qr'?f.qr:f.snapshot};}};
 const proxy=load('src/app/api/whatsapp/proxy.ts',{'server-only':{},'next/headers':{cookies:async()=>{const token=f.token;return{get:()=>token?{value:token}:undefined};}},'next/server':{NextResponse},axios:{isAxiosError:e=>!!e?.isAxiosError},'@/app/util/api':{default:api,__esModule:true},'@/app/util/whatsappTypes':types});
 f.request=(action,method='GET',origin='https://app.test',extra={})=>proxy.whatsappProxy(new NextRequest('https://app.test/api/whatsapp/'+action+'?restaurant_id='+B,{method,headers:{...(origin?{origin}:{}),authorization:'Bearer BROWSER_TOKEN',...extra}}),action,method);
 return f;
}
for(const [action,method]of [['connect','POST'],['disconnect','POST'],['status','GET']])test(`${method} ${action} uses only HttpOnly cookie and fixed backend route`,async()=>{
 const f=fixture();f.snapshot={...f.snapshot,token:'PRIVATE',creds:{secret:true},keys:{private:true}};
 const response=await f.request(action,method),data=await response.json();assert.equal(response.status,action==='connect'?202:200);
 assert.equal(f.calls[0].headers.Authorization,'Bearer JWT_A');assert.equal(f.calls[0].url,'/whatsapp/'+action);
 assert.doesNotMatch(JSON.stringify(f.calls),/BROWSER_TOKEN|restaurant_id/);if(method==='POST')assert.deepEqual(Object.keys(f.calls[0].data),[]);
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE|creds|keys|JWT/);assert.equal(response.headers.get('cache-control'),'no-store, private');assert.equal(response.headers.get('vary'),'Cookie');
});
test('QR proxy binds owner and QR to the same server-held token even if browser cookie changes',async()=>{
 const f=fixture();f.snapshot={...f.snapshot,status:'qr_required',qr_available:true};
 // Cookie read is captured before asynchronous upstream operations.
 const pending=f.request('qr');await Promise.resolve();f.token='JWT_B';const response=await pending,data=await response.json();
 assert.equal(data.restaurant_id,A);assert.equal(data.qr,'QR_A');assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.headers.Authorization==='Bearer JWT_A'));
 assert.doesNotMatch(JSON.stringify(data),/JWT/);
});
test('connected or expired/missing QR never returns a stale payload',async()=>{
 const f=fixture();let data=await(await f.request('qr')).json();assert.equal(data.qr,null);assert.equal(f.calls.length,1);
 f.snapshot={...f.snapshot,status:'qr_required',qr_available:true};f.qr={qr:null,expires_at:null};data=await(await f.request('qr')).json();assert.equal(data.qr,null);assert.equal(data.restaurant_id,A);
});
test('anonymous calls and cross-origin or missing-origin POSTs never reach backend',async()=>{
 const f=fixture();f.token=null;assert.equal((await f.request('status')).status,401);assert.equal(f.calls.length,0);
 f.token='JWT_A';assert.equal((await f.request('connect','POST','https://evil.test')).status,403);assert.equal((await f.request('disconnect','POST',null)).status,403);assert.equal(f.calls.length,0);
});
test('route allowlist prevents arbitrary paths and method changes',async()=>{
 const f=fixture();for(const [a,m]of [['status','POST'],['connect','GET'],['../me','GET'],['anything','POST']])assert.equal((await f.request(a,m)).status,404);assert.equal(f.calls.length,0);
});
for(const status of [401,403,409,503])test(`backend ${status} is handled without leaking errors or deleting a newer cookie`,async()=>{
 const f=fixture();f.failure={isAxiosError:true,message:'PRIVATE_JWT',response:{status,data:{error:status===409?'LEGACY_WORKER_ACTIVE':'PRIVATE_SECRET',token:'PRIVATE'}}};
 const response=await f.request('status'),data=await response.json();assert.equal(response.status,status);assert.doesNotMatch(JSON.stringify(data),/PRIVATE/);assert.equal(response.headers.get('set-cookie'),null);
 if(status===409)assert.equal(data.error,'LEGACY_WORKER_ACTIVE');
});
test('timeouts and malformed successful responses become sanitized 503s',async()=>{
 const f=fixture();f.failure=Error('PRIVATE_TIMEOUT');let response=await f.request('status');assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE/);
 f.failure=null;f.snapshot={token:'PRIVATE'};response=await f.request('status');assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE/);
});
test('independent authenticated owners produce independent backend requests and QR responses',async()=>{
 const a=fixture(),b=fixture();a.snapshot={...a.snapshot,status:'qr_required',qr_available:true};b.token='JWT_B';b.snapshot={restaurant_id:B,status:'qr_required',qr_available:true,error:null};b.qr={...b.qr,qr:'QR_B'};
 const [ra,rb]=await Promise.all([a.request('qr'),b.request('qr')]);assert.equal((await ra.json()).qr,'QR_A');assert.equal((await rb.json()).qr,'QR_B');assert.ok(a.calls.every(c=>c.headers.Authorization==='Bearer JWT_A'));assert.ok(b.calls.every(c=>c.headers.Authorization==='Bearer JWT_B'));
});
test('Next route delegates only its literal action and verb',async()=>{
 const calls=[];const route=load('src/app/api/whatsapp/[action]/route.ts',{'next/server':{},'../proxy':{whatsappProxy:async(...args)=>calls.push(args)}});
 const request={};await route.POST(request,{params:Promise.resolve({action:'connect'})});assert.equal(calls[0][0],request);assert.equal(calls[0][1],'connect');assert.equal(calls[0][2],'POST');assert.equal(route.dynamic,'force-dynamic');
});

test('proxy distinguishes backend availability, timeout, missing route and invalid contract',async()=>{
 const f=fixture();
 for(const [failure,expected] of [
  [{isAxiosError:true,code:'ECONNREFUSED'},'WHATSAPP_BACKEND_UNREACHABLE'],
  [{isAxiosError:true,code:'ECONNABORTED'},'WHATSAPP_TIMEOUT'],
  [{isAxiosError:true,response:{status:404}},'WHATSAPP_ROUTE_UNAVAILABLE'],
 ]){f.failure=failure;const response=await f.request('status');assert.equal(response.status,503);assert.equal((await response.json()).error,expected);}
 f.failure=null;f.snapshot={};assert.equal((await(await f.request('status')).json()).error,'INVALID_WHATSAPP_RESPONSE');
});
