import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../src/actions.js';
import { createFakeApi, createService } from './helpers.js';

test('test_connection confirms the credentials', async () => {
  const { service, config } = await createService();
  const message = await ACTIONS.test_connection(service, { fields: {}, config });
  assert.match(message.en, /Connected to OpenPlantBook\. 2 plant/);
});

test('test_connection explains refused credentials, without the secret', async () => {
  const { service, config } = await createService(
    {},
    { api: createFakeApi({ clientSecret: 'x' }) },
  );
  const message = await ACTIONS.test_connection(service, { fields: {}, config });
  assert.match(message.fr, /refusé les identifiants/);
  assert.ok(!JSON.stringify(message).includes('secret"'));
});

test('missing credentials are reported by every action', async () => {
  const { service, config } = await createService({ client_id: '' });
  for (const action of Object.values(ACTIONS)) {
    const message = await action(service, { fields: { query: 'monstera' }, config });
    assert.match(message.en, /client ID and client secret/);
  }
});

test('search_plant lists the ids to copy into the Plants field', async () => {
  const { service, config } = await createService();
  const message = await ACTIONS.search_plant(service, { fields: { query: 'fig' }, config });
  assert.match(message.en, /1 result\(s\).*ficus lyrata \(Fiddle-leaf fig\)/);
  const none = await ACTIONS.search_plant(service, { fields: { query: 'cactus' }, config });
  assert.match(none.es, /No se encontró/);
  const short = await ACTIONS.search_plant(service, { fields: { query: 'fi' }, config });
  assert.match(short.de, /mindestens 3 Zeichen/);
});

test('refresh_now reports what was read', async () => {
  const { service, config } = await createService();
  const message = await ACTIONS.refresh_now(service, { fields: {}, config });
  assert.equal(message.en, '2 plant(s) refreshed, 0 failed.');
  const { service: empty, config: emptyConfig } = await createService({ plants: '' });
  assert.match(
    (await ACTIONS.refresh_now(empty, { fields: {}, config: emptyConfig })).en,
    /No plant/,
  );
});

test('an unreachable service is explained under the button', async () => {
  const api = createFakeApi();
  api.failWith = 'network';
  const { service, config } = await createService({}, { api });
  const message = await ACTIONS.search_plant(service, { fields: { query: 'monstera' }, config });
  assert.match(message.en, /unreachable/);
});
