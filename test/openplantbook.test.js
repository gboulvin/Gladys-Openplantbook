import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenPlantBookClient, normalizePlant } from '../src/openplantbook.js';
import { createFakeApi, MONSTERA } from './helpers.js';

const clientFor = (api, secret = 'secret', now) =>
  new OpenPlantBookClient({
    clientId: 'client',
    clientSecret: secret,
    fetchImpl: api.fetch,
    ...(now ? { now } : {}),
  });

test('the access token is fetched once, then reused until it nearly expires', async () => {
  const api = createFakeApi();
  let clock = 0;
  const client = clientFor(api, 'secret', () => clock);
  await client.detail('monstera deliciosa');
  await client.detail('ficus lyrata');
  assert.equal(api.tokensIssued, 1);
  clock = 86400 * 1000 - 30_000; // inside the renewal margin
  await client.detail('ficus lyrata');
  assert.equal(api.tokensIssued, 2);
});

test('the token request uses the client_credentials grant, form-encoded', async () => {
  const api = createFakeApi();
  await clientFor(api).getToken();
  const [request] = api.requests;
  assert.equal(request.method, 'POST');
  assert.equal(request.pathname, '/api/v1/token/');
  const form = new URLSearchParams(request.init.body);
  assert.equal(form.get('grant_type'), 'client_credentials');
  assert.equal(form.get('client_id'), 'client');
});

test('wrong credentials are an auth error', async () => {
  const api = createFakeApi();
  await assert.rejects(clientFor(api, 'wrong').detail('monstera deliciosa'), { code: 'auth' });
});

test('a revoked token is renewed once on 401', async () => {
  const api = createFakeApi();
  const client = clientFor(api);
  await client.getToken();
  client.token = 'revoked';
  const plant = await client.detail('monstera deliciosa');
  assert.equal(plant.pid, 'monstera deliciosa');
  assert.equal(api.tokensIssued, 2);
});

test('HTTP failures map to stable error codes', async () => {
  const api = createFakeApi();
  const client = clientFor(api);
  await assert.rejects(client.detail('unknown plant'), { code: 'not_found' });
  api.failWith = 429;
  await assert.rejects(client.detail('monstera deliciosa'), { code: 'rate_limited' });
  api.failWith = 500;
  await assert.rejects(client.detail('monstera deliciosa'), { code: 'http', status: 500 });
  api.failWith = 'network';
  await assert.rejects(client.detail('monstera deliciosa'), { code: 'network' });
});

test('the detail asks for the common name in the configured language', async () => {
  const api = createFakeApi();
  await clientFor(api).detail('monstera deliciosa', 'fr');
  const detail = api.requests.find((r) => r.pathname.startsWith('/api/v1/plant/detail/'));
  assert.equal(detail.pathname, '/api/v1/plant/detail/monstera%20deliciosa/');
  assert.equal(detail.searchParams.get('lang'), 'fr');
});

test('search returns pid, name and category', async () => {
  const api = createFakeApi();
  const results = await clientFor(api).search('monstera');
  assert.deepEqual(results, [
    {
      pid: 'monstera deliciosa',
      display_pid: 'Monstera deliciosa',
      alias: 'Swiss cheese plant',
      category: 'Araceae',
    },
  ]);
});

test('normalizePlant keeps the thresholds as numbers or null', () => {
  const plant = normalizePlant({ ...MONSTERA, min_soil_ec: null, max_temp: '32', image_url: 'x' });
  assert.deepEqual(plant.thresholds.soil_moisture, { min: 15, max: 60 });
  assert.deepEqual(plant.thresholds.temperature, { min: 12, max: 32 });
  assert.deepEqual(plant.thresholds.light_lux, { min: 1500, max: 35000 });
  assert.deepEqual(plant.thresholds.humidity, { min: 30, max: 85 });
  assert.deepEqual(plant.thresholds.soil_ec, { min: null, max: 2000 });
  assert.equal(plant.image_url, null, 'only https images are kept');
});
