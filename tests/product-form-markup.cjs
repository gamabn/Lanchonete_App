const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('rendered HTML associates external group rules with the product form and keeps option forms separate', () => {
  const exports = {};
  const mocks = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'next/image': {},
    './CategoryField': { __esModule: true, default: () => null },
    './productCategory': {}, './configuredProductClient': {},
    './productReview': {},
    './PrivateTemplateControls': { SavePrivateTemplate: () => null },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/ConfiguredProductEditor.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require(name) { assert.ok(name in mocks, name); return mocks[name]; } });
  const config = {
    product: { id: 'p', name: 'Produto', price: '10', available: true, published: false },
    variants: [{ id: 'v', name: 'Único', price: '10', available: true, groupLimits: [{ groupId: 'g', minSelect: 0, maxSelect: 2 }] }],
    groups: [{ id: 'g', name: 'Extras', required: false, minSelect: 0, maxSelect: 2, options: [{ id: 'o', name: 'Opção', additionalPrice: 2, available: true }] }],
  };
  const review = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/product/productReview.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: review });
  mocks['./productReview'] = review;
  const html = renderToStaticMarkup(React.createElement(exports.default, { configuration: config, onRefresh() {}, onBusy() {} }));
  const stack = [], controls = [];
  const attr = (text, name) => text.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
  for (const match of html.matchAll(/<(\/?)(form|input|textarea|button)\b([^>]*)>/g)) {
    const [, closing, tag, attributes] = match;
    if (tag === 'form') {
      if (closing) { assert.equal(stack.length, 1); stack.pop(); }
      else { assert.equal(stack.length, 0, 'Native forms cannot be nested'); stack.push({ id: attr(attributes, 'id') }); }
    } else if (!closing) {
      controls.push({ name: attr(attributes, 'name'), owner: attr(attributes, 'form') || stack.at(-1), attributes });
    }
  }
  assert.equal(stack.length, 0);
  for (const name of ['group-g-name', 'g-required', 'g-min', 'g-max']) {
    const control = controls.find(control => control.name === name);
    assert.equal(control.owner, 'product-configuration-p');
    assert.doesNotMatch(control.attributes, /\bdisabled/);
  }
  const names = controls.filter(control => control.name === 'name');
  assert.equal(names.length, 5); // Product, two structural forms, existing option and new option.
  assert.equal(names[0].owner.id, 'product-configuration-p');
  assert.notEqual(names[3].owner, names[4].owner);
  assert.equal(names[3].owner.id, undefined);
  assert.equal(names[4].owner.id, undefined);
});
