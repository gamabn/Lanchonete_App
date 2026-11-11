const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, ...globals });
  return exports;
}
function proxy(cookie) {
  const calls = [];
  const routes = load('src/app/api/chat/[...path]/route.ts', {
    'next/server': { NextResponse }, 'next/headers': { cookies: async () => ({ get: () => cookie && { value: cookie } }) },
    axios: { isAxiosError: () => false }, '@/app/util/api': { request: async config => { calls.push(config); return { status: 200, data: [] }; } },
  });
  return { ...routes, calls };
}
test('chat proxy uses the HttpOnly owner session, denies anonymous and blocks cross-origin writes', async () => {
  const context = { params: Promise.resolve({ path: ['chat'] }) };
  const anonymous = proxy();
  assert.equal((await anonymous.GET(new NextRequest('http://localhost/api/chat/chat'), context)).status, 401);
  const owner = proxy('owner-jwt');
  assert.equal((await owner.GET(new NextRequest('http://localhost/api/chat/chat'), context)).status, 200);
  assert.equal(owner.calls[0].headers.Authorization, 'Bearer owner-jwt');
  const blocked = await owner.POST(new NextRequest('http://localhost/api/chat/message', { method: 'POST', headers: { origin: 'http://evil.example' } }), { params: Promise.resolve({ path: ['message'] }) });
  assert.equal(blocked.status, 403);
  assert.equal(owner.calls.length, 1);
});
test('customer credential takes precedence over an owner cookie and cannot be used as a URL', async () => {
  const p = proxy('owner-jwt');
  const response = await p.GET(new NextRequest('http://localhost/api/chat/message/ca', { headers: { 'x-chat-credential': 'customer-order-token' } }), { params: Promise.resolve({ path: ['message', 'ca'] }) });
  assert.equal(response.status, 200);
  assert.equal(p.calls[0].headers.Authorization, 'Bearer customer-order-token');
  assert.equal(p.calls[0].url, '/message/ca');
  const forbidden = await p.GET(new NextRequest('http://localhost/api/chat/user'), { params: Promise.resolve({ path: ['user'] }) });
  assert.equal(forbidden.status, 404);
});
test('joining renews authorization after reconnection and cancels stale pending joins', async () => {
  const requests = [], emitted = [], timers = new Set();
  const { joinChat, leaveChat } = load('src/app/util/chatRooms.ts', {
    './chatApi': { post: (path, data) => { assert.equal(path, '/chat/socket-ticket'); return new Promise(resolve => requests.push({ data, resolve })); } },
  }, { WeakMap, Map, setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) });
  const socket = { emit: (...args) => emitted.push(args) };
  let ready = 0;
  joinChat(socket, 'ca', () => ready++);
  leaveChat(socket, 'ca');
  requests[0].resolve({ data: { ticket: 'stale' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(emitted.filter(event => event[0] === 'joinRoom').length, 0);
  joinChat(socket, 'ca', () => ready++);
  requests[1].resolve({ data: { ticket: 'fresh' } });
  await new Promise(resolve => setImmediate(resolve));
  const event = emitted.find(event => event[0] === 'joinRoom');
  assert.equal(event[1].ticket, 'fresh'); event[2]({ ok: true }); assert.equal(ready, 1);
  joinChat(socket, 'ca'); // Same operation called by the socket's connect listener.
  requests[2].resolve({ data: { ticket: 'reconnected' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(emitted.at(-1)[1].ticket, 'reconnected');
  leaveChat(socket, 'ca'); assert.equal(timers.size, 0);
});
