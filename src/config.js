// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined`, strings instead of numbers, or a raw list of plant ids.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './i18n.js';

// Upper bound of the followed plants: each one costs an API call per refresh,
// the OpenPlantBook free tier is rate limited, and 8 states per plant must
// stay under the 300 states/minute Gladys accepts.
export const MAX_PLANTS = 30;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  client_id: '',
  client_secret: '',
  plants: '',
  language: 'en',
  temperature_unit: 'celsius',
  // Hours between two reads of the thresholds of a plant: they are reference
  // data, they rarely change.
  refresh_hours: 24,
};

/**
 * Split the "Plants" field into OpenPlantBook plant ids (pid). Ids are the
 * lowercase scientific names ("monstera deliciosa"): separators are commas,
 * semicolons and new lines; case and surrounding spaces are ignored,
 * duplicates removed.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parsePlantIds(raw) {
  if (typeof raw !== 'string') {
    return [];
  }
  const ids = raw
    .split(/[,;\n]+/)
    .map((id) => id.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((id) => id.length > 0);
  return [...new Set(ids)].slice(0, MAX_PLANTS);
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    client_id: typeof raw.client_id === 'string' ? raw.client_id.trim() : '',
    client_secret: typeof raw.client_secret === 'string' ? raw.client_secret.trim() : '',
    language,
    temperature_unit: raw.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    refresh_hours: clamp(raw.refresh_hours, 6, 168, DEFAULT_CONFIG.refresh_hours),
    plantIds: parsePlantIds(raw.plants),
  };
}

/** True when both OpenPlantBook credentials are filled in. */
export function hasCredentials(config) {
  return config.client_id.length > 0 && config.client_secret.length > 0;
}
