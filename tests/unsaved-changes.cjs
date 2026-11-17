const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(){
 const states=[],refs=[],deps=[],cleanups=[],windowListeners=new Map(),documentListeners=new Map();
 let i=0,j=0,k=0,effects=[],scope='A:p',pending=false,result;
 const modal={open:false,showModal(){this.open=true;},close(){this.open=false;}};
 const react={useState(initial){const n=i++;if(!(n in states))states[n]=initial;return [states[n],v=>states[n]=typeof v==='function'?v(states[n]):v];},useRef(initial){const n=j++;return refs[n]??(refs[n]={current:initial});},useEffect(fn,next){const n=k++;if(!deps[n]||next.some((v,x)=>v!==deps[n][x])){deps[n]=next;effects.push(()=>{cleanups[n]?.();cleanups[n]=fn();});}}};
 const exports={},jsx=(type,props)=>({type,props});
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/useUnsavedChanges.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports,URL,require:name=>({react,'react/jsx-runtime':{jsx,jsxs:jsx}})[name],
  window:{location:{href:'http://localhost/dashboard/product?draft=p'},addEventListener:(name,fn)=>windowListeners.set(name,fn),removeEventListener:name=>windowListeners.delete(name)},
  document:{addEventListener:(name,fn,capture)=>{assert.equal(capture,true);documentListeners.set(name,fn);},removeEventListener:name=>documentListeners.delete(name)},
 });
 function render(value=pending,newScope=scope){pending=value;scope=newScope;i=j=k=0;effects=[];result=exports.useUnsavedChanges(pending,scope);result.dialog.props.ref.current=modal;effects.forEach(fn=>fn());return result;}
 function find(node,label){if(!node||typeof node!=='object')return;if(node.type==='button'&&node.props?.children===label)return node;for(const value of Object.values(node)){const found=find(value,label);if(found)return found;}}
 render();
 return {render,modal,windowListeners,documentListeners,request:fn=>result.requestLeave(fn),stay(){find(result.dialog,'Continuar editando').props.onClick();render();},discard(){find(result.dialog,'Descartar alterações e sair').props.onClick();render();},unmount(){cleanups.forEach(fn=>fn?.());}};
}
test('clean edits navigate immediately without beforeunload or document listeners',()=>{
 const h=harness();let navigated=0;h.request(()=>navigated++);assert.equal(navigated,1);assert.equal(h.windowListeners.size,0);assert.equal(h.documentListeners.size,0);
});
test('dirty edits retain data on cancellation and run only the confirmed discard action',()=>{
 const h=harness();h.render(true);let navigated=0;h.request(()=>navigated++);h.render();assert.equal(h.modal.open,true);assert.equal(navigated,0);
 h.stay();assert.equal(h.modal.open,false);assert.equal(navigated,0);
 h.request(()=>navigated++);h.render();h.discard();assert.equal(navigated,1);assert.equal(h.modal.open,false);
});
test('beforeunload is conditional and never attempts custom browser text',()=>{
 const h=harness();h.render(true);let prevented=0;const event={preventDefault(){prevented++;},returnValue:undefined};h.windowListeners.get('beforeunload')(event);
 assert.equal(prevented,1);assert.equal(event.returnValue,'');h.render(false);assert.equal(h.windowListeners.has('beforeunload'),false);
});
test('internal product/restaurant links are intercepted and replayed once after confirmation',()=>{
 const h=harness();h.render(true);let clicked=0,prevented=0,stopped=0;
 const anchor={href:'http://localhost/another-restaurant/product?draft=other',target:'',hasAttribute:()=>false,click(){clicked++;}};
 const event={button:0,target:{closest:()=>anchor},preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};
 h.documentListeners.get('click')(event);h.render();assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(clicked,0);
 h.stay();assert.equal(clicked,0);h.documentListeners.get('click')(event);h.render();h.discard();assert.equal(clicked,1);
 let unload=0;h.windowListeners.get('beforeunload')({preventDefault(){unload++;}});assert.equal(unload,0);
 h.render(true,'B:other');h.windowListeners.get('beforeunload')({preventDefault(){unload++;}});assert.equal(unload,1);
});
test('section anchors, retained panels and new tabs do not prompt or discard',()=>{
 const h=harness();h.render(true);
 for(const extra of [{href:'http://localhost/dashboard/product?draft=p#sizes'}, {preserved:true}, {ctrlKey:true}, {target:'_blank'}]){
  const anchor={href:extra.href||'http://localhost/dashboard/product?view=models',target:extra.target||'',hasAttribute:name=>name==='data-preserve-product-form'&&extra.preserved,click(){assert.fail();}};
  h.documentListeners.get('click')({button:0,...extra,target:{closest:()=>anchor},preventDefault(){assert.fail('This navigation preserves the form');}});
 }
 assert.equal(h.modal.open,false);
});
test('successful saves remove listeners while failed saves leave the warning active; unmount cleans up',()=>{
 const h=harness();h.render(true);h.render(true);assert.equal(h.windowListeners.has('beforeunload'),true);
 h.render(false);assert.equal(h.windowListeners.size,0);assert.equal(h.documentListeners.size,0);
 h.render(true);h.unmount();assert.equal(h.windowListeners.size,0);assert.equal(h.documentListeners.size,0);
});
