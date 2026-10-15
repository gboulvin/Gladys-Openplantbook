import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertTemperature, evaluateConditions, parseMeasurement } from '../src/conditions.js';
import { normalizePlant } from '../src/openplantbook.js';
import { MONSTERA } from './helpers.js';

const plant = normalizePlant(MONSTERA);
const celsius = { temperature_unit: 'celsius' };

test('measurements accept numbers, decimal commas and skip what is not a number', () => {
  assert.equal(parseMeasurement('42'), 42);
  assert.equal(parseMeasurement(' 21,5 '), 21.5);
  assert.equal(parseMeasurement(18), 18);
  assert.equal(parseMeasurement(''), null);
  assert.equal(parseMeasurement('{{unresolved}}'), null);
  assert.equal(parseMeasurement(undefined), null);
});

test('everything in range is ok', () => {
  const result = evaluateConditions(
    plant,
    { soil_moisture: 30, temperature: 21, light_lux: 8000, humidity: 50 },
    celsius,
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.inRange, true);
  assert.equal(result.compared, 4);
  assert.match(result.message.en, /ideal range/);
});

test('the most urgent issue is the status, every issue is in the message', () => {
  const result = evaluateConditions(
    plant,
    { soil_moisture: 5, temperature: 35, light_lux: null, humidity: null },
    celsius,
  );
  assert.equal(result.status, 'too_dry');
  assert.deepEqual(result.issues, ['too_dry', 'too_hot']);
  assert.equal(result.inRange, false);
  assert.match(result.message.fr, /sol trop sec \(5 %, min 15 %\), trop chaud \(35°C, max 32°C\)/);
  for (const lang of ['en', 'fr', 'de', 'es']) {
    assert.ok(result.message[lang].startsWith('Swiss cheese plant'), lang);
  }
});

test('every out-of-range direction has its status', () => {
  const cases = [
    [{ soil_moisture: 70 }, 'too_wet'],
    [{ temperature: 5 }, 'too_cold'],
    [{ light_lux: 100 }, 'too_dark'],
    [{ light_lux: 90000 }, 'too_bright'],
    [{ humidity: 10 }, 'air_too_dry'],
    [{ humidity: 95 }, 'air_too_humid'],
  ];
  for (const [measurements, status] of cases) {
    assert.equal(evaluateConditions(plant, measurements, celsius).status, status);
  }
});

test('without any measurement, the status is no_data and not in range', () => {
  const result = evaluateConditions(plant, {}, celsius);
  assert.equal(result.status, 'no_data');
  assert.equal(result.inRange, false);
});

test('temperatures are compared in the configured unit', () => {
  assert.equal(convertTemperature(12, 'fahrenheit'), 54);
  const result = evaluateConditions(plant, { temperature: 70 }, { temperature_unit: 'fahrenheit' });
  assert.equal(result.status, 'ok');
  const cold = evaluateConditions(plant, { temperature: 50 }, { temperature_unit: 'fahrenheit' });
  assert.equal(cold.status, 'too_cold');
  assert.match(cold.message.en, /°F/);
});
