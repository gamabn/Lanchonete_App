const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest,NextResponse } = require('next/server');
function load(file,mocks,globals={}) {
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{exports,Error,require(name){assert.ok(name in mocks,name);return mocks[name];},...globals});return exports;
}
const id='00000000-0000-4000-8000-000000000010',productId='00000000-0000-4000-8000-000000000020';
const model={id,name:'Meu modelo',description:'Privado',version:2,active:true,source:'private'};
const plain=x=>JSON.parse(JSON.stringify(x));
test('all private proxies use only admin cookie, fixed paths, safe methods and no-store responses',async()=>{
  let token='admin-token',status=200;const calls=[];
  const proxy=load('src/app/api/product/configuredProxy.ts',{
    'next/server':{NextResponse},'next/headers':{cookies:async()=>({get(name){assert.equal(name,'token');return token?{value:token}:undefined;}})},
    axios:{isAxiosError:e=>Boolean(e.response)},
    '@/app/util/api':{async request(config){calls.push(config);if(status!==200)throw {response:{status,data:{error:'Modelo não encontrado.'}}};return {status,data:{ok:true}};}},
  });
  const routes=[
    ['templates/private/route.ts','../../configuredProxy','GET','/products/templates/private'],
    ['templates/private/route.ts','../../configuredProxy','POST','/products/templates/private'],
    ['templates/private/[templateId]/route.ts','../../../configuredProxy','GET',`/products/templates/private/${id}`],
    ['templates/private/[templateId]/route.ts','../../../configuredProxy','PATCH',`/products/templates/private/${id}`],
    ['templates/private/[templateId]/route.ts','../../../configuredProxy','DELETE',`/products/templates/private/${id}`],
    ['templates/private/[templateId]/versions/route.ts','../../../../configuredProxy','POST',`/products/templates/private/${id}/versions`],
    ['from-private-template/route.ts','../configuredProxy','POST','/products/from-private-template'],
  ];
  for(const [file,dependency,method,path] of routes){
    const route=load('src/app/api/product/'+file,{[dependency]:proxy})[method];
    const context={params:Promise.resolve({templateId:id})};
    const req=origin=>new NextRequest('https://app.example/api/product/templates/private',{
      method,headers:{origin},body:method==='GET'?undefined:JSON.stringify({productId,templateId:id,expectedVersion:2}),
    });
    token=undefined;const before=calls.length;
    assert.equal((await route(req('https://app.example'),context)).status,401);assert.equal(calls.length,before);
    token='admin-token';
    if(method!=='GET'){assert.equal((await route(req('https://evil.example'),context)).status,403);assert.equal(calls.length,before);}
    const response=await route(req('https://app.example'),context);assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(calls.at(-1).url,path);assert.equal(calls.at(-1).method,method);assert.equal(calls.at(-1).headers.Authorization,'Bearer admin-token');
    for(const failure of [404,409,503]){status=failure;assert.equal((await route(req('https://app.example'),context)).status,failure);}status=200;
    if(file.includes('[templateId]'))assert.equal((await route(req('https://app.example'),{params:Promise.resolve({templateId:'invalid'})})).status,400);
  }
});
function controlsHarness(kind,options={}){
  const states=[],refs=[],effects=[],previous=[],calls=[],busy=[],changed=[],pending=[];let si=0,ri=0,ei=0;
  const jsx=(type,props)=>({type,props});
  const component=load('src/app/dashboard/product/PrivateTemplateControls.tsx',{
    react:{
      useState(initial){const i=si++;if(!(i in states))states[i]=initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},
      useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial});},
      useEffect(fn,deps){const i=ei++;if(!previous[i]||deps.some((v,j)=>v!==previous[i][j])){previous[i]=deps;effects.push(fn);}},
    },'react/jsx-runtime':{jsx,jsxs:jsx},
    './configuredProductClient':{async requestProduct(url,_fallback,init={}){
      calls.push({url,init});
      if(options.fail&&init.method)throw new Error('Modelos privados indisponíveis: RLS.');
      if(url==='/api/product/templates/private'&&!init.method)return [model];
      if(!init.method)return {template:model,versions:[{version:2,active:true},{version:1,active:false}]};
      return {template:model,version:3};
    }},
  },{window:{confirm:()=>options.confirm!==false},FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k]??null;}}});
  function render(){si=0;ri=0;ei=0;effects.length=0;
    const tree=kind==='save'?component.SavePrivateTemplate({productId,disabled:Boolean(options.disabled),onBusy:v=>busy.push(v),onPendingChange:v=>pending.push(v)}):component.PrivateTemplateManager({templates:[model],disabled:false,onBusy:v=>busy.push(v),onChanged:()=>changed.push(true)});
    effects.forEach(fn=>fn());return tree;
  }
  function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of Object.values(node)){const got=find(child,predicate);if(got)return got;}}
  return {render,find,calls,busy,changed,pending,flush:()=>new Promise(setImmediate)};
}
const submit=values=>({preventDefault(){},currentTarget:{values}});
test('editor saves product as independent model and updates only an explicitly selected model version',async()=>{
  const h=controlsHarness('save');h.render();await h.flush();let tree=h.render();
  const form=h.find(tree,n=>n.type==='form'&&n.props?.['aria-label']==='Salvar como modelo');
  form.props.onSubmit(submit({name:'Minha quentinha',description:'Pessoal'}));await h.flush();
  const create=h.calls.find(c=>c.init.method==='POST');assert.equal(create.url,'/api/product/templates/private');
  assert.deepEqual(JSON.parse(create.init.body),{productId,name:'Minha quentinha',description:'Pessoal'});
  tree=h.render();h.find(tree,n=>n.type==='select').props.onChange({target:{value:id}});tree=h.render();
  h.find(tree,n=>n.type==='button'&&n.props?.children==='Salvar nova versão do modelo').props.onClick();await h.flush();
  const version=h.calls.find(c=>c.url.endsWith('/versions'));assert.deepEqual(JSON.parse(version.init.body),{productId,expectedVersion:2});
  assert.deepEqual(h.busy,[true,false,true,false]);
});
test('pending product edits block saving and errors show without publishing products',async()=>{
  const disabled=controlsHarness('save',{disabled:true});disabled.render();await disabled.flush();
  disabled.find(disabled.render(),n=>n.type==='form').props.onSubmit(submit({name:'X'}));await disabled.flush();
  assert.equal(disabled.calls.some(c=>c.init.method),false);
  const failed=controlsHarness('save',{fail:true});failed.render();await failed.flush();
  failed.find(failed.render(),n=>n.type==='form').props.onSubmit(submit({name:'X'}));await failed.flush();
  assert.match(JSON.stringify(failed.render()),/RLS/);assert.equal(failed.calls.some(c=>c.url.includes('publish')),false);
});
test('private manager renames, lists version history and requires confirmation to delete',async()=>{
  const h=controlsHarness('manager');let tree=h.render();
  h.find(tree,n=>n.type==='form').props.onSubmit(submit({name:'Novo nome',description:'Nova descrição'}));await h.flush();
  assert.equal(h.calls[0].init.method,'PATCH');assert.deepEqual(JSON.parse(h.calls[0].init.body),{name:'Novo nome',description:'Nova descrição'});
  tree=h.render();h.find(tree,n=>n.type==='button'&&n.props?.children==='Ver versões').props.onClick();await h.flush();
  assert.match(JSON.stringify(h.render()),/Versão /);
  tree=h.render();h.find(tree,n=>n.type==='button'&&n.props?.children==='Excluir modelo').props.onClick();await h.flush();
  assert.equal(h.calls.at(-1).init.method,'DELETE');assert.equal(h.changed.length,2);
  const cancelled=controlsHarness('manager',{confirm:false});
  cancelled.find(cancelled.render(),n=>n.type==='button'&&n.props?.children==='Excluir modelo').props.onClick();await cancelled.flush();
  assert.equal(cancelled.calls.length,0);
});

test('save-as-model tracks its own metadata and clears only confirmed writes',async()=>{
 const h=controlsHarness('save');h.render();await h.flush();let tree=h.render();
 let form=h.find(tree,n=>n.type==='form'&&n.props?.['aria-label']==='Salvar como modelo');
 const event=submit({name:'Novo modelo',description:'Texto'});form.props.onChangeCapture(event);assert.equal(h.pending.at(-1),true);
 form.props.onSubmit(event);await h.flush();assert.equal(h.pending.at(-1),false);
 tree=h.render();form=h.find(tree,n=>n.type==='form');form.props.onChangeCapture(event);assert.equal(h.pending.at(-1),false);
 const failed=controlsHarness('save',{fail:true});failed.render();await failed.flush();form=failed.find(failed.render(),n=>n.type==='form');form.props.onChangeCapture(event);form.props.onSubmit(event);await failed.flush();assert.equal(failed.pending.at(-1),true);
});
