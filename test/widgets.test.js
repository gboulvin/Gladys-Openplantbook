import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  PLANT_CARD_WIDGET,
  PLANTS_OVERVIEW_WIDGET,
  WIDGETS,
  refreshWidgets,
} from '../src/widgets.js';
import { createService } from './helpers.js';

const get = (key, service, config, settings = {}) =>
  WIDGETS[key].get(service, { settings, language: 'en', units: 'metric', config });

async function readyService(rawConfig) {
  const context = await createService(rawConfig);
  await context.service.refresh();
  const plant = context.gladys.externalIds('plant', 'monstera-deliciosa').device;
  return { ...context, plant };
}

test('the plant card is rendered exactly as sent', async () => {
  const { service, config, plant } = await readyService();
  const content = await get(PLANT_CARD_WIDGET, service, config, { plant });
  assert.deepEqual(validateWidgetContent(content), []);
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => `${tile.value} ${tile.unit}`),
    ['15–60 %', '12–32 °C', '1500–35k lx', '30–85 %'],
  );
  assert.ok(
    content.components.some((c) => c.type === 'image'),
    'the plant photo is shown',
  );
});

test('the plant card of a plant without photo nor data stays valid', async () => {
  const { service, config, gladys } = await readyService();
  const ficus = gladys.externalIds('plant', 'ficus-lyrata').device;
  const content = await get(PLANT_CARD_WIDGET, service, config, { plant: ficus });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(!content.components.some((c) => c.type === 'image'));

  const { service: empty, config: emptyConfig } = await createService();
  for (const settings of [{}, { plant: ficus }, { plant: 'ext:x:plant:unknown' }]) {
    const placeholder = await get(PLANT_CARD_WIDGET, empty, emptyConfig, settings);
    assert.deepEqual(validateWidgetContent(placeholder), []);
    assert.equal(placeholder.components[0].type, 'text');
  }
});

test('the overview lists every plant, in every state', async () => {
  const { service, config } = await readyService();
  const content = await get(PLANTS_OVERVIEW_WIDGET, service, config);
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components.find((c) => c.type === 'card-list');
  assert.equal(list.items.length, 2);
  assert.match(list.items[0].description.fr, /Humidité du sol : 15–60 %/);

  const { service: empty, config: emptyConfig } = await createService({ plants: '' });
  assert.deepEqual(
    validateWidgetContent(await get(PLANTS_OVERVIEW_WIDGET, empty, emptyConfig)),
    [],
  );
});

test('the overview shows how many plants do not fit the list', async () => {
  const plants = Array.from({ length: 10 }, (_, i) => `plant number ${i}`).join(',');
  const { service, config } = await createService({ plants });
  const content = await get(PLANTS_OVERVIEW_WIDGET, service, config);
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(content.components.some((c) => c.type === 'text' && c.text === '+2'));
});

test('every widget button is handled and answers a short toast', async () => {
  const { service, config, plant } = await readyService();
  for (const [key, settings] of [
    [PLANT_CARD_WIDGET, { plant }],
    [PLANTS_OVERVIEW_WIDGET, {}],
  ]) {
    const buttons = (await get(key, service, config, settings)).components.filter(
      (c) => c.type === 'button' && c.action,
    );
    assert.ok(buttons.length > 0);
    for (const { action } of buttons) {
      const toast = await WIDGETS[key].action(service, {
        actionKey: action.key,
        params: action.params ?? {},
        settings,
        config,
      });
      for (const lang of ['en', 'fr', 'de', 'es']) {
        assert.ok(toast[lang].length > 0 && toast[lang].length <= 200, `${key} ${lang}`);
      }
    }
  }
});

test('an unknown widget action fails, so the user sees the error', async () => {
  const { service, config } = await readyService();
  for (const widget of Object.values(WIDGETS)) {
    await assert.rejects(
      widget.action(service, { actionKey: 'nope', params: {}, settings: {}, config }),
      /Unknown widget action/,
    );
  }
});

test('the stored plant images are served as the core expects', async () => {
  const { service } = await readyService();
  const { imageKey } = service.entries.get('monstera deliciosa');
  assert.deepEqual(validateWidgetImage(await service.readImage(imageKey)), []);
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
