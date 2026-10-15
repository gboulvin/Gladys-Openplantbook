// -----------------------------------------------------------------------------
// Compare measurements (from any sensor of the house) with the ideal ranges
// of a plant. Pure functions: no I/O, used by the `check_plant_conditions`
// scene action.
// -----------------------------------------------------------------------------

import { t, join } from './i18n.js';

/** Celsius → the configured unit, rounded to the unit. */
export function convertTemperature(celsius, unit) {
  if (celsius === null || celsius === undefined) {
    return null;
  }
  return unit === 'fahrenheit' ? Math.round((celsius * 9) / 5 + 32) : celsius;
}

export function temperatureSymbol(unit) {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

/**
 * Parse a measurement typed (or substituted from a scene variable) in a scene
 * action field. Empty, missing or unresolved values are skipped (null): the
 * scene author only fills in the sensors they have.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseMeasurement(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const text = String(raw).trim().replace(',', '.');
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

// Checked in this order: the first issue found is the `status` of the plant,
// so the most urgent need (water) comes first.
const CHECKS = [
  { measure: 'soil_moisture', threshold: 'soil_moisture', low: 'too_dry', high: 'too_wet' },
  { measure: 'temperature', threshold: 'temperature', low: 'too_cold', high: 'too_hot' },
  { measure: 'light_lux', threshold: 'light_lux', low: 'too_dark', high: 'too_bright' },
  { measure: 'humidity', threshold: 'humidity', low: 'air_too_dry', high: 'air_too_humid' },
];

/**
 * Evaluate measurements against the thresholds of a plant.
 * @param {object} plant normalized plant (see normalizePlant)
 * @param {{ soil_moisture?: number|null, temperature?: number|null, light_lux?: number|null, humidity?: number|null }} measurements
 *   the temperature is in the configured unit
 * @param {{ temperature_unit: string }} config
 * @returns {{ status: string, inRange: boolean, issues: string[], compared: number, message: Record<string,string> }}
 */
export function evaluateConditions(plant, measurements, config) {
  const unit = temperatureSymbol(config.temperature_unit);
  const name = plant.alias ?? plant.display_pid;
  const issues = [];
  const texts = [];
  let compared = 0;

  for (const check of CHECKS) {
    const value = measurements[check.measure];
    let { min, max } = plant.thresholds[check.threshold];
    if (check.measure === 'temperature') {
      min = convertTemperature(min, config.temperature_unit);
      max = convertTemperature(max, config.temperature_unit);
    }
    if (value === null || value === undefined || (min === null && max === null)) {
      continue;
    }
    compared += 1;
    if (min !== null && value < min) {
      issues.push(check.low);
      texts.push(t(check.low, { value, min, max, unit }));
    } else if (max !== null && value > max) {
      issues.push(check.high);
      texts.push(t(check.high, { value, min, max, unit }));
    }
  }

  let status = 'ok';
  let message = t('condition_ok', { plant: name });
  if (compared === 0) {
    status = 'no_data';
    message = t('condition_no_data', { plant: name });
  } else if (issues.length > 0) {
    status = issues[0];
    message = t('condition_issues', { plant: name, issues: join(texts, ', ') });
  }
  return { status, inRange: compared > 0 && issues.length === 0, issues, compared, message };
}
