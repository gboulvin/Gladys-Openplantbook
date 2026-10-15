import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  MAX_PLANTS,
  hasCredentials,
  normalizeConfig,
  parsePlantIds,
} from '../src/config.js';

test('plant ids are split, trimmed, lowercased and deduplicated', () => {
  assert.deepEqual(parsePlantIds(' Monstera  Deliciosa, ficus lyrata;\nmonstera deliciosa,, '), [
    'monstera deliciosa',
    'ficus lyrata',
  ]);
  assert.deepEqual(parsePlantIds(undefined), []);
});

test(`at most ${MAX_PLANTS} plants are followed`, () => {
  const many = Array.from({ length: MAX_PLANTS + 5 }, (_, i) => `plant ${i}`).join(',');
  assert.equal(parsePlantIds(many).length, MAX_PLANTS);
});

test('the defaults apply to an empty config', () => {
  const config = normalizeConfig();
  assert.equal(config.language, DEFAULT_CONFIG.language);
  assert.equal(config.temperature_unit, 'celsius');
  assert.equal(config.refresh_hours, 24);
  assert.deepEqual(config.plantIds, []);
  assert.equal(hasCredentials(config), false);
});

test('values from the form are coerced and bounded', () => {
  const config = normalizeConfig({
    client_id: ' id ',
    client_secret: ' secret ',
    language: 'it',
    temperature_unit: 'fahrenheit',
    refresh_hours: '1',
  });
  assert.equal(config.client_id, 'id');
  assert.equal(config.language, 'en', 'an unsupported language falls back to English');
  assert.equal(config.temperature_unit, 'fahrenheit');
  assert.equal(config.refresh_hours, 6);
  assert.equal(hasCredentials(config), true);
});
