const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const categoryModule = {exports:{}};
new Function('exports', ts.transpileModule(fs.readFileSync('src/app/dashboard/product/productCategory.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(categoryModule.exports);
const categoryHelpers = categoryModule.exports;
function harness(options = {}) {
  const states = [], refs = [], effects = [], previous = [], calls = [], opened = [], headings = [];
  const onProductLoaded=product=>headings.push(product);
  let stateIndex=0,refIndex=0,effectIndex=0, release;
  const pending = options.defer ? new Promise(resolve => { release=resolve; }) : Promise.resolve();
  const jsx=(type,props)=>({type,props});
  const mocks = {
    react: {
      useState(initial) { const index=stateIndex++;if(!(index in states))states[index]=initial;
        return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}]; },
      useRef(initial) {const index=refIndex++;if(!refs[index])refs[index]={current:initial};return refs[index];},
      useEffect(fn,deps) {const index=effectIndex++;if(!previous[index]||deps.some((v,i)=>v!==previous[index][i])){previous[index]=deps;effects.push(fn);}},
    },
    'react/jsx-runtime':{jsx,jsxs:jsx},
    './CategoryField':{__esModule:true,default:()=>null,useProductCategories:()=>['Bebidas']},
    './productCategory':categoryHelpers,
    './ConfiguredProductEditor':{default:()=>null},
    './PrivateTemplateControls': { PrivateTemplateManager: () => null },
    './configuredProductClient':{async requestProduct(url,_fallback,init={}) {
      calls.push({url,init});
      if(url===`/api/product/${options.draftId}/configuration`) return {product:{id:options.draftId,name:'Pizza existente'},variants:[],groups:[]};
      if(url==='/api/product/templates') {
        if(options.templateFailure)throw new Error('Modelos indisponíveis');
        return [{slug:'pizza',name:'Pizza',version:1}];
      }
      if(url==='/api/product?configured=true')return [];
      if(url==='/api/product/templates/private') {
        if(options.privateFailure)throw new Error('Modelos privados indisponíveis');
        return options.privateModels || [];
      }
      assert.ok(['/api/product/configured','/api/product/from-template','/api/product/from-private-template'].includes(url));
      assert.equal(init.method,'POST');
      await pending;
      if(options.fail)throw new Error('Falha de criação');
      return {product:{id:'created-draft',published:false}};
    }},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/ConfiguredProductForm.tsx','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{exports,AbortController,Error,FormData:class {
    constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}
  },require(name){assert.ok(name in mocks,name);return mocks[name];}});
  function render() {
    stateIndex=0;refIndex=0;effectIndex=0;effects.length=0;
    const tree=exports.default({draftId:options.draftId||'',onDraftChange:id=>opened.push(id),onProductLoaded,view:options.view||"scratch"});
    effects.forEach(effect=>effect());return tree;
  }
  function find(node,predicate) {
    if(!node||typeof node!=='object')return;
    if(predicate(node))return node;
    for(const child of Object.values(node)){const value=find(child,predicate);if(value)return value;}
  }
  return {render,find,calls,opened,headings,release:()=>release?.(),flush:()=>new Promise(setImmediate)};
}
const event=()=>({preventDefault(){},currentTarget:{values:{name:'Açaí próprio',description:'Livre',variantName:'300 ml',price:'12,90'}}});
test('dashboard creates from scratch without depending on available templates and opens existing editor',async()=>{
  const h=harness({templateFailure:true,defer:true});
  h.render();await h.flush();
  const tree=h.render();
  const form=h.find(tree,node=>node.type==='form'&&node.props?.['aria-label']==='Criar produto do zero');
  assert.ok(form);
  const pending=form.props.onSubmit(event());
  await form.props.onSubmit(event());
  assert.equal(h.calls.filter(call=>call.init.method==='POST').length,1);
  h.release();await pending;
  assert.deepEqual(h.opened,['created-draft']);
  const body=JSON.parse(h.calls.at(-1).init.body);
  assert.deepEqual(body,{name:'Açaí próprio',description:'Livre',variantName:'300 ml',price:'12,90',category:null});
  assert.equal('restaurantId' in body,false);
});
test('creation failures show an error and do not open or publish a product',async()=>{
  const h=harness({fail:true});h.render();await h.flush();
  const form=h.find(h.render(),node=>node.type==='form'&&node.props?.['aria-label']==='Criar produto do zero');
  await form.props.onSubmit(event());await h.flush();
  assert.equal(h.opened.length,0);
  assert.match(JSON.stringify(h.render()),/Falha de criação/);
  assert.equal(h.calls.some(call=>call.url.includes('publish')),false);
});

test('model picker shows global and owned models separately and copies the selected private version',async()=>{
  const id='00000000-0000-4000-8000-000000000099';
  const h=harness({privateModels:[{id,name:'Minha pizza',description:'Pessoal',active:true,version:3,source:'private'}]});
  h.render();await h.flush();let tree=h.render();
  assert.match(JSON.stringify(tree),/Modelos da plataforma/);assert.match(JSON.stringify(tree),/Meus modelos/);assert.match(JSON.stringify(tree),/Minha pizza/);
  h.find(tree,node=>node.type==='select'&&node.props?.id==='product-template').props.onChange({target:{value:`private:${id}`}});
  tree=h.render();
  await h.find(tree,node=>node.type==='button'&&node.props?.children==='Criar rascunho').props.onClick();
  const call=h.calls.find(call=>call.url==='/api/product/from-private-template');
  assert.deepEqual(JSON.parse(call.init.body),{templateId:id,expectedVersion:3});
  assert.deepEqual(h.opened,['created-draft']);
});

test('global templates remain usable when private schema or RLS is unavailable',async()=>{
  const h=harness({privateFailure:true});h.render();await h.flush();let tree=h.render();
  assert.match(JSON.stringify(tree),/Modelos privados indisponíveis/);
  h.find(tree,node=>node.type==='select'&&node.props?.id==='product-template').props.onChange({target:{value:'global:pizza'}});
  tree=h.render();await h.find(tree,node=>node.type==='button'&&node.props?.children==='Criar rascunho').props.onClick();
  const call=h.calls.find(call=>call.url==='/api/product/from-template');
  assert.deepEqual(JSON.parse(call.init.body),{templateSlug:'pizza',category:null});
});

test('configured creation and global copy send category only on the new restaurant product',async()=>{
  const h=harness();h.render();await h.flush();let tree=h.render();
  const form=h.find(tree,n=>n.type==='form'&&n.props?.['aria-label']==='Criar produto do zero');
  const e=event();e.currentTarget.values.category='  Bebidas   Frias ';
  await form.props.onSubmit(e);
  assert.equal(JSON.parse(h.calls.find(c=>c.url==='/api/product/configured').init.body).category,'Bebidas Frias');
  const other=harness();other.render();await other.flush();tree=other.render();
  other.find(tree,n=>n.type==='select'&&n.props?.id==='product-template').props.onChange({target:{value:'global:pizza'}});
  tree=other.render();
  other.find(tree,n=>n.props?.suggestions&&n.props?.onChange).props.onChange({target:{value:'  Combos  '}});
  tree=other.render();await other.find(tree,n=>n.type==='button'&&n.props?.children==='Criar rascunho').props.onClick();
  const body=JSON.parse(other.calls.find(c=>c.url==='/api/product/from-template').init.body);
  assert.deepEqual(body,{templateSlug:'pizza',category:'Combos'});
});

test('existing product loads through the same endpoint and supplies its name to the heading',async()=>{
 const h=harness({draftId:'existing'});h.render();await h.flush();const tree=h.render();
 assert.equal(h.calls.length,2);assert.equal(h.calls[0].url,'/api/product/existing/configuration');
 assert.equal(h.headings[0].id,'existing');assert.equal(h.headings[0].name,'Pizza existente');
 assert.ok(h.find(tree,n=>n.type==='section'&&n.props?.hidden===true&&h.find(n,c=>c.type==='h2'&&c.props?.children==='Usar modelo pronto')));
});

test('creation separates ready models from the administrative product list',async()=>{
 const h=harness();h.render();await h.flush();const tree=h.render();
 assert.ok(h.find(tree,n=>n.type==='h2'&&n.props?.children==='Usar modelo pronto'));
 assert.equal(h.find(tree,n=>n.type==='h2'&&n.props?.children==='Editar produto'),undefined);
 assert.match(JSON.stringify(tree),/O modelo original permanece independente/);
});

test('creation panels are separate and model selection survives switching to management and back',async()=>{
 const options={view:'templates',privateModels:[{id:'mine',name:'Meu modelo',active:true,version:1}]};
 const h=harness(options);h.render();await h.flush();let tree=h.render();
 const scratch=h.find(tree,n=>n.type==='section'&&h.find(n,c=>c.type==='form'&&c.props?.['aria-label']==='Criar produto do zero'));
 assert.equal(scratch.props.hidden,true);
 h.find(tree,n=>n.type==='select'&&n.props?.id==='product-template').props.onChange({target:{value:'global:pizza'}});
 options.view='models';tree=h.render();
 assert.ok(h.find(tree,n=>n.type==='section'&&n.props?.hidden===false&&h.find(n,c=>c.props?.templates)));
 assert.ok(h.find(tree,n=>n.type==='section'&&n.props?.hidden===true&&h.find(n,c=>c.type==='select'&&c.props?.id==='product-template')));
 options.view='templates';tree=h.render();
 assert.equal(h.find(tree,n=>n.type==='select'&&n.props?.id==='product-template').props.value,'global:pizza');
 assert.equal(h.calls.some(c=>c.init.method==='POST'),false);
});

test('model management hides rather than unmounts the existing editor',async()=>{
 const options={draftId:'existing',view:'scratch'};const h=harness(options);h.render();await h.flush();let tree=h.render();
 const editor=h.find(tree,n=>n.props?.configuration);assert.ok(editor);
 options.view='models';tree=h.render();
 assert.ok(h.find(tree,n=>n.type==='section'&&n.props?.hidden===true&&h.find(n,c=>c.props?.configuration)));
 options.view='scratch';tree=h.render();assert.ok(h.find(tree,n=>n.props?.configuration));
 assert.equal(h.calls.filter(c=>c.url.includes('/configuration')).length,1);
});
