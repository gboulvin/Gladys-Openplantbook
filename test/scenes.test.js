import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { createService } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);

function assertDeclaredOutputs(key, outputs) {
  const declared = keysOf(declarationOf('scene_actions', key).outputs);
  for (const [name, value] of Object.entries(outputs)) {
    assert.ok(declared.includes(name), `output "${name}" of ${key} is not declared`);
    assert.ok(value === null || typeof value !== 'object', `output "${name}" must be a scalar`);
  }
}

async function readyService(rawConfig) {
  const context = await createService(rawConfig);
  await context.service.refresh();
  const plant = context.gladys.externalIds('plant', 'monstera-deliciosa').device;
  return { ...context, plant };
}

test('check_plant_conditions returns the declared outputs, in the configured language', async () => {
  const { service, config, plant } = await readyService({ language: 'fr' });
  const outputs = await SCENE_ACTIONS.check_plant_conditions(service, {
    fields: { plant, soil_moisture: '8', temperature: '', light_lux: '{{x}}', humidity: '50' },
    config,
  });
  assert.deepEqual(outputs, {
    in_range: false,
    status: 'too_dry',
    issues_count: 1,
    message: 'Swiss cheese plant : sol trop sec (8 %, min 15 %).',
  });
  assertDeclaredOutputs('check_plant_conditions', outputs);
});

test('check_plant_conditions says in_range when every measurement fits', async () => {
  const { service, config, plant } = await readyService();
  const outputs = await SCENE_ACTIONS.check_plant_conditions(service, {
    fields: { plant, soil_moisture: '30', temperature: '22' },
    config,
  });
  assert.equal(outputs.in_range, true);
  assert.equal(outputs.status, 'ok');
});

test('get_plant_thresholds exposes every range', async () => {
  const { service, config, plant } = await readyService();
  const outputs = await SCENE_ACTIONS.get_plant_thresholds(service, { fields: { plant }, config });
  assert.equal(outputs.plant_name, 'Swiss cheese plant');
  assert.equal(outputs.scientific_name, 'Monstera deliciosa');
  assert.equal(outputs.min_soil_moisture, 15);
  assert.equal(outputs.max_light_lux, 35000);
  assertDeclaredOutputs('get_plant_thresholds', outputs);
});

test('refresh_plants reads every plant again', async () => {
  const { service, config } = await readyService();
  const outputs = await SCENE_ACTIONS.refresh_plants(service, { fields: {}, config });
  assert.deepEqual(outputs, { refreshed: 2, failed: 0 });
  assertDeclaredOutputs('refresh_plants', outputs);
});

test('an unknown plant fails the action with a clear error', async () => {
  const { service, config } = await readyService();
  await assert.rejects(
    SCENE_ACTIONS.get_plant_thresholds(service, { fields: { plant: 'ext:x:plant:nope' }, config }),
    /not followed/,
  );
});

test('a plant without data yet fails the action', async () => {
  const { service, config, gladys } = await createService();
  const plant = gladys.externalIds('plant', 'ficus-lyrata').device;
  await assert.rejects(
    SCENE_ACTIONS.check_plant_conditions(service, { fields: { plant }, config }),
    /No OpenPlantBook data yet/,
  );
});

test('the trigger events only carry declared keys', async () => {
  const { gladys } = await readyService();
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = declarationOf('scene_triggers', key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `data.${name} of ${key} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `data.${name} must be a primitive`);
    }
  }
});

test('the sync_failed error codes match the filter options', async () => {
  const options = declarationOf('scene_triggers', 'sync_failed')
    .fields.find((field) => field.key === 'error')
    .options.map((option) => option.value);
  assert.deepEqual(options.sort(), ['auth', 'http', 'network', 'not_found', 'rate_limited']);
});
