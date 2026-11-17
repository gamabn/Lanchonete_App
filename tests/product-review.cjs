const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/productReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject});
const {safeProductMessage,issueReviewTarget,formReviewTarget}=exportsObject;
const configuration={groups:[{id:'g',name:'Proteínas',options:[{id:'o',name:'Frango'}]}],variants:[]};
test('review messages exclude request objects, credentials, JWTs, database URLs and SQL',()=>{
 for(const message of [undefined,{},'Bearer confidential','token=confidential','Authorization: value','postgres://user:pass@host/db','SELECT secret FROM products','DATABASE_URL=private','eyJhbGci.eyJzdWI.signature','https://user:pass@host/path','api_key=secret','ENOTFOUND internal-host', 'Cannot read properties of undefined', '{"accessToken":"private"}', 'x'.repeat(1001)]){
  assert.equal(safeProductMessage(message,'Mensagem segura'),'Mensagem segura');
 }
 assert.equal(safeProductMessage('Grupo Proteínas: limites gerais inválidos.'),'Grupo Proteínas: limites gerais inválidos.');
});
test('known validation messages route to the corresponding section and uniquely identified group',()=>{
 assert.equal(issueReviewTarget('Informe o nome do produto.',configuration).section,'information');
 assert.equal(issueReviewTarget('O produto precisa ter pelo menos um tamanho ativo.',configuration).section,'sizes');
 assert.equal(issueReviewTarget('Grupo Proteínas: obrigatoriedade ou limites gerais inválidos.',configuration).groupId,'g');
 assert.equal(issueReviewTarget('Opção Frango: preço adicional inválido.',configuration).groupId,'g');
 const available=issueReviewTarget('Tamanho Grande: o grupo Proteínas exige no mínimo 2 ingrediente(s), mas possui apenas 1 disponível(is).',configuration);
 assert.equal(available.section,'customizations');assert.equal(available.groupId,'g');
 assert.equal(issueReviewTarget('Tamanho Grande: limites inválidos no grupo Proteínas.',configuration).section,'sizes');
});
test('ambiguous names do not target the wrong group and foreign option IDs are not resolved',()=>{
 const config={groups:[...configuration.groups,{id:'other',name:'Proteínas',options:[{id:'other-option',name:'Frango'}]}]};
 assert.equal(issueReviewTarget('Grupo Proteínas: limites gerais inválidos.',config).groupId,undefined);
 assert.equal(issueReviewTarget('Opção Frango: preço adicional inválido.',config).groupId,undefined);
 assert.equal(formReviewTarget('option-other-option',configuration).groupId,undefined);
 assert.equal(formReviewTarget('option-o',configuration).groupId,'g');
 assert.equal(formReviewTarget('new-option-g',configuration).groupId,'g');
 assert.equal(formReviewTarget('image',configuration).section,'publication');
});
