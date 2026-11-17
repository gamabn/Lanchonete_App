const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('desktop and mobile product links use existing routes and accessible task names',()=>{
 let stateIndex=0;
 const exports={},Link=()=>null,jsx=(type,props)=>({type,props});
 const mocks={
  'next/link':{__esModule:true,default:Link},react:{useState:initial=>[stateIndex++===1?true:initial,()=>{}],useEffect(){},useContext:()=>({lanchoneteProfile:{id:'A',name:'Loja'}})},
  'next/navigation':{useRouter:()=>({})},'@/app/Context':{Context:{}},
  'react-icons/fi':new Proxy({},{get:()=>()=>null}),'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/app/components/Socket':{on(){},off(){}},'react/jsx-runtime':{jsx,jsxs:jsx},
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/components/HeaderDashboard/index.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require(name){assert.ok(name in mocks,name);return mocks[name];}});
 const tree=exports.HeaderDashboard({children:'Conteúdo'}),links=[];
 function visit(node){if(!node||typeof node!=='object')return;if(node.type===Link)links.push(node.props);for(const value of Object.values(node))visit(value);}visit(tree);
 for(const [href,label] of [['/dashboard/product','Novo produto'],['/dashboard/editProduct','Editar produto']]){
  const matches=links.filter(link=>link.href===href);assert.equal(matches.length,2);
  assert.ok(matches.every(link=>link['aria-label']===label&&link.title===label));
  assert.ok(fs.existsSync('src/app'+href+'/page.tsx'));
 }
 assert.equal(links.some(link=>link.href==='/dashboard/cadastroProdutos'),false);
});

test('product actions reuse routes and switch local panels without a page navigation',()=>{
 const exports={},Link=()=>null,jsx=(type,props)=>({type,props});
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/ProductNavigation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require(name){return {'next/link':{__esModule:true,default:Link},'react/jsx-runtime':{jsx,jsxs:jsx}}[name];}});
 const selected=[];const tree=exports.default({active:'new',onSelect:view=>selected.push(view)});
 const links=tree.props.children;
 assert.deepEqual(Array.from(links,n=>n.props.children),['Novo produto','Editar produtos','Meus modelos']);
 assert.equal(links[0].props['aria-current'],'page');
 assert.equal(links[1].props.href,'/dashboard/editProduct');
 assert.equal(links[2].props.href,'/dashboard/product?view=models');
 let prevented=0;links[2].props.onClick({preventDefault(){prevented++;}});assert.equal(prevented,1);assert.deepEqual(selected,['models']);
 links[1].props.onClick({preventDefault(){assert.fail('Edit must use existing route');}});
 links[2].props.onClick({ctrlKey:true,preventDefault(){assert.fail('Keep opening in new tab');}});
});
