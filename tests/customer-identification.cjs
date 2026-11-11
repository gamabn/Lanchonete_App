const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, Error, AbortSignal, require: name => {
    assert.ok(name in mocks, `Unexpected dependency ${name}`);
    return mocks[name];
  }, ...globals });
  return exports;
}
const customer = {
  id: 'alice', restaurant_id: 'A', name: 'Alice', phone: '11999999999',
  city: 'City', street: 'Street', number: '1', neighborhood: 'Area',
};
const address = { name: customer.name, phone: customer.phone, cidade: 'City', rua: 'Street', numero: '1', bairro: 'Area' };
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const identificationPath = 'src/app/util/customerIdentification.ts';

test('a valid session updates delivery only after rechecking the confirmed identity', async () => {
  const calls = [];
  const identity = load(identificationPath, {}, { fetch: async (url, init) => {
    calls.push([url, init]);
    return reply(200, init.method ? customer : [customer]);
  } });
  const saved = await identity.saveCustomerIdentification('A', address, customer);
  assert.equal(saved.id, 'alice');
  assert.equal(calls[1][1].method, 'PUT');
  assert.equal(calls[1][1].headers['X-Customer-Id'], 'alice');
  assert.equal('id' in JSON.parse(calls[1][1].body), false);
});

test('only an explicitly absent session permits new registration; other errors never POST', async () => {
  for (const code of ['SESSION_MISSING', 'SESSION_EXPIRED', 'SESSION_INVALID', 'CUSTOMER_NOT_FOUND', 'CUSTOMER_FORBIDDEN', 'CUSTOMER_UNAVAILABLE']) {
    const writes = [];
    const identity = load(identificationPath, {}, { fetch: async (_url, init) => {
      if (init.method) { writes.push(init.method); return reply(201, customer); }
      return reply(code === 'CUSTOMER_FORBIDDEN' ? 403 : code === 'CUSTOMER_UNAVAILABLE' ? 503 : 401, { code, error: code });
    } });
    const attempt = identity.saveCustomerIdentification('A', address, null);
    if (code === 'SESSION_MISSING') {
      assert.equal((await attempt).id, 'alice');
      assert.deepEqual(writes, ['POST']);
    } else {
      await assert.rejects(attempt, error => error.code === code);
      assert.equal(writes.length, 0);
    }
  }
});

test('network failure or changed session interrupts identification without rewriting another person', async () => {
  for (const mode of ['network', 'changed', 'different-person']) {
    let writes = 0;
    const identity = load(identificationPath, {}, { fetch: async (_url, init) => {
      if (init.method) writes++;
      if (mode === 'network') throw new Error('offline');
      return reply(200, [{ ...customer, id: mode === 'changed' ? 'bob' : 'alice' }]);
    } });
    await assert.rejects(identity.saveCustomerIdentification('A', {
      ...address, name: mode === 'different-person' ? 'Bob' : 'Alice',
    }, customer));
    assert.equal(writes, 0);
  }
});

test('another restaurant profile and registration conflicts never establish an identified customer', async () => {
  const foreign = load(identificationPath, {}, { fetch: async () => reply(200, [customer]) });
  await assert.rejects(foreign.currentCustomer('B'), error => error.code === 'SESSION_INVALID');
  const conflict = load(identificationPath, {}, { fetch: async (_url, init) =>
    init.method ? reply(409, { code: 'CUSTOMER_CONFLICT', error: 'Recuperação verificada necessária.' })
      : reply(401, { code: 'SESSION_MISSING' }),
  });
  await assert.rejects(conflict.saveCustomerIdentification('A', address, null), error => error.code === 'CUSTOMER_CONFLICT');
});

test('logout clears only current-store tracking and legacy ambiguous PII while preserving cart, pending orders and another store', () => {
  const storage = new Map([
    ['product', 'cart'], ['product_quantities', 'quantities'], ['pending_order:A', 'pending'],
    ['customerInfo', 'private'], ['order', 'legacy'],
    ['chat_credential:A', 'a-token'], ['customer_order:A', 'a-order'],
    ['chat_credential:B', 'b-token'], ['customer_order:B', 'b-order'],
  ]);
  const handlers = new Map();
  const utility = load('src/app/util/customerStorage.ts', {}, {
    localStorage: { removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value) },
    window: { addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: name => handlers.delete(name) },
  });
  let notifications = 0;
  const unsubscribe = utility.watchCustomerSessionChanges('A', () => notifications++);
  utility.clearCustomerBrowserData('A');
  assert.equal(storage.get('product'), 'cart');
  assert.equal(storage.get('product_quantities'), 'quantities');
  assert.equal(storage.get('pending_order:A'), 'pending');
  assert.equal(storage.get('chat_credential:B'), 'b-token');
  assert.equal(storage.get('customer_order:B'), 'b-order');
  assert.equal(storage.has('chat_credential:A'), false);
  assert.equal(storage.has('customer_order:A'), false);
  assert.equal(storage.has('customerInfo'), false);
  handlers.get('storage')({ key: 'customer_session_changed:B' });
  assert.equal(notifications, 0);
  handlers.get('storage')({ key: 'customer_session_changed:A' });
  assert.equal(notifications, 1);
  unsubscribe();
  assert.equal(handlers.size, 0);
});

function componentHarness() {
  const states = [], refs = [], previousEffects = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  let effects = [];
  const confirmed = [], cleanups = [];
  let logouts = 0, writes = 0;
  const identity = load(identificationPath);
  const FormClient = Symbol('FormClient');
  const jsx = (type, props) => ({ type, props });
  const module = load('src/app/clients/[idClient]/pedidos/component/CustomerIdentification.tsx', {
    react: {
      useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
      useRef(initial) { const index = refIndex++; if (!refs[index]) refs[index] = { current: initial }; return refs[index]; },
      useMemo: fn => fn(),
      useEffect(fn, deps) { const index = effectIndex++;
        if (!previousEffects[index] || deps.some((item, i) => item !== previousEffects[index][i])) {
          previousEffects[index] = deps;
          effects.push(fn);
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    './index': { FormClient },
    '@/app/util/customerIdentification': {
      ...identity,
      currentCustomer: async () => customer,
      endCustomerSession: async () => { logouts++; },
      saveCustomerIdentification: async (_restaurant, _address, expected) => { writes++; assert.equal(expected.id, customer.id); return customer; },
    },
    '@/app/util/customerStorage': { clearCustomerBrowserData: id => cleanups.push(id) },
  });
  function render() {
    stateIndex = 0; refIndex = 0; effectIndex = 0; effects = [];
    const tree = module.default({
      restaurantId: 'A', bairros: [], loadingBairros: false,
      initialData: { ...address, name: 'Another person', rua: 'Other street' }, initialCustomerId: 'another-id',
      onClose() {}, onLogout() {}, onIdentified: (...args) => confirmed.push(args),
    });
    effects.forEach(effect => effect());
    return tree;
  }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of Object.values(node)) { const found = find(child, predicate); if (found) return found; }
  }
  return { render, find, FormClient, confirmed, cleanups, counts: () => ({ logouts, writes }) };
}

test('identification shows authenticated identity, requires confirmation and clears the form when switching person', async () => {
  const h = componentHarness();
  h.render();
  await new Promise(setImmediate);
  let tree = h.render();
  assert.equal(h.find(tree, node => node.type === h.FormClient), undefined);
  const continueButton = h.find(tree, node => node.type === 'button' && node.props?.children?.[0] === 'Continuar como ');
  assert.ok(continueButton);
  continueButton.props.onClick();
  tree = h.render();
  const form = h.find(tree, node => node.type === h.FormClient);
  assert.equal(form.props.identityReadOnly, true);
  assert.equal(form.props.initialData.name, 'Alice');
  assert.equal(form.props.initialData.rua, 'Street');
  const firstSubmission = form.props.onSubmitAddress(address);
  await form.props.onSubmitAddress(address);
  await firstSubmission;
  assert.equal(h.counts().writes, 1);
  assert.equal(h.confirmed[0][1].id, 'alice');
  const switchButton = h.find(tree, node => node.type === 'button' && node.props?.children === 'Não sou eu / Trocar cliente');
  switchButton.props.onClick();
  await new Promise(setImmediate);
  tree = h.render();
  const newForm = h.find(tree, node => node.type === h.FormClient);
  assert.equal(newForm.props.initialData, null);
  assert.equal(newForm.props.identityReadOnly, false);
  assert.deepEqual(h.cleanups, ['A']);
  assert.equal(h.counts().logouts, 1);
});
