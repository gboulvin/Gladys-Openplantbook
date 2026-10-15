import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import {
  PlantService,
  SYNC_FAILED_TRIGGER,
  THRESHOLDS_UPDATED_TRIGGER,
  plantSlug,
} from '../src/plants.js';
import { createFakeApi, createService } from './helpers.js';

const HOUR = 3600 * 1000;

test('plant slugs are stable, url-safe platform ids', () => {
  assert.equal(plantSlug('monstera deliciosa'), 'monstera-deliciosa');
  assert.equal(plantSlug("Rosa 'Peace'"), 'rosa-peace');
  assert.equal(plantSlug('aloë vera'), 'aloe-vera');
});

test('one device per followed plant, accepted by Gladys', async () => {
  const { gladys, service } = await createService();
  // The fake Gladys refuses what the host API refuses (categories, units...).
  await service.publishDevices();
  const devices = gladys.fake.discoveredDevices;
  assert.equal(devices.length, 2);
  assert.equal(devices[0].external_id, gladys.externalIds('plant', 'monstera-deliciosa').device);
  assert.equal(devices[0].features.length, 8);
  assert.ok(devices[0].features.every((feature) => feature.read_only));
  assert.deepEqual(devices[0].params, [{ name: 'OPENPLANTBOOK_PID', value: 'monstera deliciosa' }]);
});

test('a refresh names the devices and publishes their thresholds', async () => {
  const { gladys, service } = await createService();
  const result = await service.refresh();
  assert.deepEqual(
    { refreshed: result.refreshed, failed: result.failed },
    { refreshed: 2, failed: 0 },
  );
  const [monstera] = gladys.fake.discoveredDevices;
  assert.equal(monstera.name, 'Swiss cheese plant');
  const ids = gladys.externalIds('plant', 'monstera-deliciosa');
  assert.equal(gladys.fake.lastState(ids.feature('soil_moisture_min')), 15);
  assert.equal(gladys.fake.lastState(ids.feature('soil_moisture_max')), 60);
  assert.equal(gladys.fake.lastState(ids.feature('temperature_min')), 12);
  assert.equal(gladys.fake.lastState(ids.feature('light_lux_max')), 35000);
  assert.equal(gladys.fake.lastState(ids.feature('humidity_min')), 30);
});

test('feature names follow the configured language', async () => {
  const { service } = await createService({ language: 'de' });
  const names = service.buildDevice('ficus lyrata').features.map((feature) => feature.name);
  assert.ok(names.includes('Bodenfeuchte (ideal min.)'), names.join(', '));
});

test('fahrenheit converts the temperature thresholds and their unit', async () => {
  const { gladys, service } = await createService({ temperature_unit: 'fahrenheit' });
  await service.refresh();
  const feature = service
    .buildDevice('monstera deliciosa')
    .features.find((f) => f.external_id.endsWith(':temperature_max'));
  assert.equal(feature.unit, 'fahrenheit');
  assert.equal(gladys.fake.lastState(feature.external_id), 90);
});

test('a fresh plant is not read again before the refresh interval', async () => {
  let clock = 1_000_000;
  const api = createFakeApi();
  const { service } = await createService({}, { api, now: () => clock });
  await service.refresh();
  const detailCalls = () => api.requests.filter((r) => r.pathname.includes('/detail/')).length;
  assert.equal(detailCalls(), 2);
  clock += 23 * HOUR;
  assert.equal((await service.refresh()).refreshed, 0);
  clock += 2 * HOUR;
  assert.equal((await service.refresh()).refreshed, 2);
  await service.refresh({ force: true });
  assert.equal(detailCalls(), 6);
});

test('the cache survives a restart, image included', async () => {
  const { service } = await createService();
  await service.refresh();
  const imageKey = service.entries.get('monstera deliciosa').imageKey;
  assert.match(imageKey, /^plant-[a-f0-9]{20}$/);
  assert.ok((await readdir(`${service.dataDir}/images`)).includes(imageKey));

  const restarted = new PlantService(createFakeGladys(), { dataDir: service.dataDir });
  restarted.setConfig(service.config);
  await restarted.load();
  assert.equal(restarted.entries.size, 2);
  assert.equal(restarted.isStale('monstera deliciosa'), false);
  assert.ok((await restarted.readImage(imageKey)).length > 0);
});

test('only stored image keys can be read', async () => {
  const { service } = await createService();
  await assert.rejects(service.readImage('../plants.json'), /Unknown image/);
});

test('an image too big for the widgets is skipped, the plant is still read', async () => {
  const api = createFakeApi();
  api.image = Buffer.alloc(400 * 1024, 1);
  const { service } = await createService({}, { api });
  await service.refresh();
  assert.equal(service.entries.get('monstera deliciosa').imageKey, null);
  assert.ok(service.entries.get('monstera deliciosa').plant);
});

test('thresholds_updated fires on the first read and on a change only', async () => {
  const api = createFakeApi();
  const { gladys, service } = await createService({}, { api });
  await service.refresh();
  const events = () => gladys.fake.sceneEvents.filter((e) => e.key === THRESHOLDS_UPDATED_TRIGGER);
  assert.equal(events().length, 2);
  assert.deepEqual(events()[0].data, {
    plant: gladys.externalIds('plant', 'monstera-deliciosa').device,
    plant_name: 'Swiss cheese plant',
    min_soil_moisture: 15,
    max_soil_moisture: 60,
    min_temperature: 12,
    max_temperature: 32,
    min_light_lux: 1500,
    max_light_lux: 35000,
    min_humidity: 30,
    max_humidity: 85,
  });

  await service.refresh({ force: true });
  assert.equal(events().length, 2, 'unchanged thresholds fire nothing');

  api.plants.get('ficus lyrata').min_soil_moist = 25;
  await service.refresh({ force: true });
  assert.equal(events().length, 3);
  assert.equal(events()[2].data.min_soil_moisture, 25);
});

test('sync_failed fires once when reading starts failing, again after a recovery', async () => {
  const api = createFakeApi();
  const { gladys, service } = await createService({}, { api });
  const failures = () => gladys.fake.sceneEvents.filter((e) => e.key === SYNC_FAILED_TRIGGER);

  api.failWith = 429;
  await service.refresh({ force: true });
  await service.refresh({ force: true });
  assert.equal(failures().length, 1, 'one event per transition');
  assert.equal(failures()[0].data.error, 'rate_limited');
  assert.equal(service.lastSyncOk, false);

  api.failWith = null;
  await service.refresh({ force: true });
  assert.equal(service.lastSyncOk, true);
  api.failWith = 'network';
  await service.refresh({ force: true });
  assert.equal(failures().length, 2);
  assert.equal(failures()[1].data.error, 'network');
});

test('wrong credentials stop the refresh at the first plant', async () => {
  const api = createFakeApi({ clientSecret: 'other' });
  const { service } = await createService({}, { api });
  const result = await service.refresh();
  assert.equal(result.failed, 1);
  assert.equal(result.errors[0].code, 'auth');
});

test('without credentials, nothing is requested', async () => {
  const api = createFakeApi();
  const { service } = await createService({ client_secret: '' }, { api });
  assert.equal(service.client, null);
  assert.deepEqual(await service.refresh(), { refreshed: 0, failed: 0, errors: [] });
  assert.equal(api.requests.length, 0);
});

test('a new language reloads the plants, the same config does not', async () => {
  const { service, config } = await createService();
  assert.equal(service.setConfig(normalizeConfig({ ...config, plants: config.plants })), false);
  assert.equal(service.setConfig(normalizeConfig({ ...config, language: 'fr' })), true);
});

test('onRefreshed is called after a refresh that read something', async () => {
  const { service } = await createService();
  let calls = 0;
  service.onRefreshed = () => {
    calls += 1;
  };
  await service.refresh();
  await service.refresh();
  assert.equal(calls, 1, 'nothing stale the second time');
});
