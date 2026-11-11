const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: name => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    }, URL,
  });
  return exports;
}

const publicStore = {
  id: 'store-a', name: 'Loja', phone: '11999999999', city: 'Cidade',
  neighborhood: 'Centro', street: 'Rua', number: '10', image_url: 'https://example.com/logo.png', status: false,
};

for (const service of ['GetStoreService', 'GetIdStoreService']) {
  test(`${service} selects only public columns and preserves the ID filter`, async () => {
    const { [service]: Service } = load(`../BackEnd-lanchonete/src/service/user/${service}.ts`, {
      '../../database': { pool: { query: async (sql, parameters) => {
        const columns = sql.match(/^SELECT (.+) FROM restaurants/)[1]
          .split(',').map(column => column.trim().replaceAll('"', ''));
        assert.deepEqual(columns.sort(), Object.keys(publicStore).sort());
        if (service === 'GetIdStoreService') {
          assert.match(sql, /WHERE id = \$1$/);
          assert.deepEqual(Array.from(parameters), ['store-a']);
        } else {
          assert.doesNotMatch(sql, /WHERE/);
        }
        return { rows: [publicStore] };
      } } },
    });
    const result = await new Service().execute('store-a');
    assert.deepEqual(result, service === 'GetStoreService' ? [publicStore] : publicStore);
  });
}

test('public proxy strips credentials and unknown internal fields from upstream', async () => {
  const { GET } = load('src/app/api/store/[id]/route.ts', {
    'next/server': { NextResponse },
    '@/app/util/api': { get: async path => {
      assert.equal(path, '/user/store-a');
      return { data: { ...publicStore, email: 'owner@example.com', password: 'hash',
        password_hash: 'hash', token: 'secret', credentials: 'secret', internal_future_field: 'private' } };
    } },
  });
  const response = await GET({ url: 'http://localhost/api/store/store-a' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), publicStore);
});

test('public proxy does not expose upstream error details', async () => {
  const { GET } = load('src/app/api/store/[id]/route.ts', {
    'next/server': { NextResponse },
    '@/app/util/api': { get: async () => { throw new Error('internal credential'); } },
  });
  const response = await GET({ url: 'http://localhost/api/store/store-a' });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Falha ao consultar o estabelecimento.' });
});

test('registration hashes the password but only returns public columns', async () => {
  let calls = 0;
  const { CreateStoreService } = load('../BackEnd-lanchonete/src/service/user/CreateStoreService.ts', {
    validator: { isEmail: () => true },
    bcryptjs: { hash: async (password, rounds) => {
      assert.equal(password, 'secret');
      assert.equal(rounds, 8);
      return 'hashed-secret';
    } },
    '../../database': { pool: { query: async (sql, parameters) => {
      if (++calls === 1) {
        assert.equal(sql, 'SELECT id FROM restaurants WHERE email = $1');
        return { rows: [] };
      }
      assert.equal(parameters[2], 'hashed-secret');
      const columns = sql.split('RETURNING ')[1].split(',').map(column => column.trim().replaceAll('"', ''));
      assert.deepEqual(columns.sort(), Object.keys(publicStore).sort());
      return { rows: [publicStore] };
    } } },
  });
  assert.deepEqual(await new CreateStoreService().execute({
    ...publicStore, email: 'owner@example.com', password: 'secret',
  }), publicStore);
  assert.equal(calls, 2);
});

test('image update preserves the target and returns only public columns', async () => {
  const { ImageStorageService } = load('../BackEnd-lanchonete/src/service/user/ImageStoreService.ts', {
    '../../database': { pool: { query: async (sql, parameters) => {
      assert.match(sql, /WHERE id = \$2/);
      assert.deepEqual(Array.from(parameters), [publicStore.image_url, publicStore.id]);
      const columns = sql.split('RETURNING ')[1].split(',').map(column => column.trim().replaceAll('"', ''));
      assert.deepEqual(columns.sort(), Object.keys(publicStore).sort());
      return { rows: [publicStore] };
    } } },
  });
  assert.deepEqual(await new ImageStorageService().execute(publicStore.id, publicStore.image_url), publicStore);
});

test('authenticated profile keeps owner fields without returning credentials', async () => {
  const { DetailStoreService } = load('../BackEnd-lanchonete/src/service/user/DetailStoreService.ts', {
    '../../database': { pool: { query: async (sql, parameters) => {
      assert.deepEqual(Array.from(parameters), [publicStore.id]);
      return { rows: [{ ...publicStore, email: 'owner@example.com', public_id: 'image-id', password: 'hash', token: 'secret' }] };
    } } },
  });
  const profile = await new DetailStoreService().execute(publicStore.id);
  assert.equal(profile.email, 'owner@example.com');
  assert.equal(profile.public_id, 'image-id');
  assert.equal(profile.name, publicStore.name);
  assert.equal('password' in profile, false);
  assert.equal('token' in profile, false);
});

test('public product configuration proxy reads only the public endpoint and avoids caching', async () => {
  const id = '00000000-0000-4000-8000-000000000011';
  const { GET } = load('src/app/api/products/[id]/configuration/route.ts', {
    'next/server': { NextResponse },
    axios: { isAxiosError: () => false },
    '@/app/util/api': { get: async (url, config) => {
      assert.equal(url, `/products/${id}/configuration`);
      assert.equal(config.headers, undefined);
      return { data: { product: { id }, variants: [], groups: [] } };
    } },
  });
  const response = await GET(null, { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).product.id, id);
});

test('public product configuration proxy rejects invalid IDs and preserves unavailability without leaking errors', async () => {
  const { GET } = load('src/app/api/products/[id]/configuration/route.ts', {
    'next/server': { NextResponse },
    axios: { isAxiosError: () => true },
    '@/app/util/api': { get: async () => { throw { response: { status: 404, data: { error: 'private query detail' } } }; } },
  });
  assert.equal((await GET(null, { params: Promise.resolve({ id: 'invalid' }) })).status, 400);
  const response = await GET(null, { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000011' }) });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Produto indisponível.' });
});
