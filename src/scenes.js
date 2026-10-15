// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+), declared in the manifest `scene_actions` field
// and registered by index.js with `gladys.onSceneAction(key, ...)`.
//
//   - check_plant_conditions: compare measurements with the ideal ranges of a
//     plant, return a status the following actions can test or send;
//   - get_plant_thresholds:   expose the ideal ranges of a plant as variables;
//   - refresh_plants:         read OpenPlantBook again now.
//
// Fields arrive RESOLVED (scene variables substituted): the measurements are
// `string` fields precisely so the scene author can put
// {{...}} variables there, e.g. the output of a "Get device value" action.
// Throwing fails this action only; a plant out of range is an OUTPUT, never a
// failure: the scene author gates the following actions on it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { evaluateConditions, parseMeasurement } from './conditions.js';
import { pick } from './i18n.js';
import { thresholdValue } from './plants.js';

const logger = createLogger({ name: 'scenes' });

function requirePlant(service, externalId) {
  const found = service.findByExternalId(externalId);
  if (!found) {
    throw new Error(`Plant ${externalId} is not followed by the integration`);
  }
  if (!found.entry) {
    throw new Error(`No OpenPlantBook data yet for "${found.pid}"`);
  }
  return found;
}

export const SCENE_ACTIONS = {
  async check_plant_conditions(service, { fields, config }) {
    logger.info(`Scene action check_plant_conditions <- ${fields.plant}`);
    const { entry } = requirePlant(service, fields.plant);
    const result = evaluateConditions(
      entry.plant,
      {
        soil_moisture: parseMeasurement(fields.soil_moisture),
        temperature: parseMeasurement(fields.temperature),
        light_lux: parseMeasurement(fields.light_lux),
        humidity: parseMeasurement(fields.humidity),
      },
      config,
    );
    return {
      in_range: result.inRange,
      status: result.status,
      issues_count: result.issues.length,
      message: pick(result.message, config.language),
    };
  },

  async get_plant_thresholds(service, { fields, config }) {
    logger.info(`Scene action get_plant_thresholds <- ${fields.plant}`);
    const { pid, entry } = requirePlant(service, fields.plant);
    const value = (threshold, bound) => thresholdValue(entry.plant, threshold, bound, config);
    return {
      plant_name: service.displayName(pid, entry),
      scientific_name: entry.plant.display_pid,
      category: entry.plant.category ?? '',
      min_soil_moisture: value('soil_moisture', 'min'),
      max_soil_moisture: value('soil_moisture', 'max'),
      min_temperature: value('temperature', 'min'),
      max_temperature: value('temperature', 'max'),
      min_light_lux: value('light_lux', 'min'),
      max_light_lux: value('light_lux', 'max'),
      min_humidity: value('humidity', 'min'),
      max_humidity: value('humidity', 'max'),
    };
  },

  // No loop risk with the `thresholds_updated` trigger: it only fires when
  // the ranges CHANGE, so a scene refreshing on it fires nothing the second
  // time.
  async refresh_plants(service) {
    logger.info('Scene action refresh_plants');
    const { refreshed, failed } = await service.refresh({ force: true });
    return { refreshed, failed };
  },
};
