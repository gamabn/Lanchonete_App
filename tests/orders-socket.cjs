const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('dashboard filters tenants, renews tickets and cleans up listeners', async () => {
  const events = new Map();
  let options, url, connects = 0, disconnects = 0, requests = 0;
  const socket = {
    on: (event, handler) => events.set(event, handler),
    off: (event, handler) => { if (events.get(event) === handler) events.delete(event); },
    connect: () => { connects++; }, disconnect: () => { disconnects++; },
  };
  const mocks = {
    'socket.io-client': { io: (address, config) => { url = address; options = config; return socket; } },
    './backend': { backendUrl: 'https://backend.example.com/' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/util/ordersSocket.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, require: name => { assert.ok(name in mocks); return mocks[name]; },
    AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: async (path, config) => {
      requests++;
      assert.equal(path, '/api/orders/socket-ticket');
      assert.equal(config.method, 'POST');
      return { ok: true, json: async () => ({ ticket: `ticket-${requests}` }) };
    },
  });
  const received = [];
  const cleanup = exports.subscribeOrders('A', order => received.push(order));
  assert.equal(url, 'https://backend.example.com/orders');
  assert.equal(connects, 1);
  for (const id of ['A', 'B', undefined]) events.get('newOrder')({ restaurant_id: id });
  assert.equal(received.length, 1);
  const auth = () => new Promise(resolve => options.auth(resolve));
  assert.equal((await auth()).ticket, 'ticket-1');
  assert.equal((await auth()).ticket, 'ticket-2');
  events.get('disconnect')();
  cleanup();
  assert.equal(events.size, 0);
  assert.equal(disconnects, 1);
});
