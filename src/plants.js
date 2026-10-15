// -----------------------------------------------------------------------------
// The followed plants: one Gladys device per OpenPlantBook plant id.
//
// Each device carries the ideal ranges of the species as read-only features
// (soil moisture, temperature, light, air humidity: min and max), so they show
// up on the device page, in dashboards and in scene conditions. The data is
// reference data that rarely changes: it is read once per refresh interval
// (24 h by default), cached under /data (the only writable volume) so a restart
// costs no API call, and the plant image is stored next to it for the widgets.
//
// Scene triggers fired from here (declared in the manifest `scene_triggers`):
//   - `thresholds_updated` when the ranges of a plant are first read or change;
//   - `sync_failed` when reading OpenPlantBook starts failing (one event per
//     transition, not one per attempt).
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  validateWidgetImage,
} from '@gladysassistant/integration-sdk';
import { hasCredentials } from './config.js';
import { convertTemperature } from './conditions.js';
import { pick, t } from './i18n.js';
import { OpenPlantBookClient } from './openplantbook.js';

const logger = createLogger({ name: 'plants' });

export const DEVICE_TYPE = 'plant';
export const THRESHOLDS_UPDATED_TRIGGER = 'thresholds_updated';
export const SYNC_FAILED_TRIGGER = 'sync_failed';
export const SCENE_TRIGGER_KEYS = [THRESHOLDS_UPDATED_TRIGGER, SYNC_FAILED_TRIGGER];

export const DEFAULT_DATA_DIR = process.env.OPENPLANTBOOK_DATA_DIR ?? '/data';
const CACHE_FILE = 'plants.json';
const IMAGES_DIR = 'images';
// The Gladys core refuses widget images above 300 KB and never recompresses.
export const MAX_IMAGE_BYTES = 300 * 1024;

// The features of a plant device: key, category, type, unit, bounds, and the
// threshold they carry. Keys are part of the external ids: never rename them.
const FEATURES = [
  ['soil_moisture', 'soil_moisture', DEVICE_FEATURE_CATEGORIES.SOIL_MOISTURE_SENSOR, 'percent'],
  ['temperature', 'temperature', DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR, 'temperature'],
  ['light', 'light_lux', DEVICE_FEATURE_CATEGORIES.LIGHT_SENSOR, 'lux'],
  ['humidity', 'humidity', DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR, 'percent'],
].flatMap(([label, threshold, category, kind]) =>
  ['min', 'max'].map((bound) => ({
    key: `${threshold}_${bound}`,
    label,
    threshold,
    bound,
    category,
    kind,
  })),
);

/**
 * Stable platform id of a plant: the OpenPlantBook pid ("monstera
 * deliciosa") as a slug ("monstera-deliciosa"). External ids are forever.
 */
export function plantSlug(pid) {
  return pid
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function featureType(feature) {
  if (feature.category === DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR) {
    // The dedicated min/max types keep the plant ranges out of the room
    // temperature average.
    return feature.bound === 'min'
      ? DEVICE_FEATURE_TYPES.TEMPERATURE_SENSOR.MIN
      : DEVICE_FEATURE_TYPES.TEMPERATURE_SENSOR.MAX;
  }
  return DEVICE_FEATURE_TYPES.SENSOR.INTEGER;
}

function featureUnitAndBounds(feature, config) {
  if (feature.kind === 'temperature') {
    return config.temperature_unit === 'fahrenheit'
      ? { unit: DEVICE_FEATURE_UNITS.FAHRENHEIT, min: -58, max: 140 }
      : { unit: DEVICE_FEATURE_UNITS.CELSIUS, min: -50, max: 60 };
  }
  if (feature.kind === 'lux') {
    return { unit: DEVICE_FEATURE_UNITS.LUX, min: 0, max: 200000 };
  }
  return { unit: DEVICE_FEATURE_UNITS.PERCENT, min: 0, max: 100 };
}

/** Value of a threshold in the unit the device publishes. */
export function thresholdValue(plant, threshold, bound, config) {
  const value = plant?.thresholds?.[threshold]?.[bound] ?? null;
  return threshold === 'temperature' ? convertTemperature(value, config.temperature_unit) : value;
}

function sameThresholds(a, b) {
  return JSON.stringify(a?.thresholds) === JSON.stringify(b?.thresholds);
}

export class PlantService {
  /**
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
   * @param {{ dataDir?: string, fetchImpl?: typeof fetch, now?: () => number }} [options]
   */
  constructor(
    gladys,
    { dataDir = DEFAULT_DATA_DIR, fetchImpl = globalThis.fetch, now = Date.now } = {},
  ) {
    this.gladys = gladys;
    this.dataDir = dataDir;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.config = null;
    this.client = null;
    // pid -> { plant, fetchedAt, imageKey, imageUrl }
    this.entries = new Map();
    // null: never synced; true/false: outcome of the last refresh.
    this.lastSyncOk = null;
    this.lastError = null;
    this.refreshing = null;
    // Called after every refresh that read something (index.js nudges the
    // dashboard widgets there).
    this.onRefreshed = null;
  }

  // --- Configuration -------------------------------------------------------

  /**
   * Apply a (normalized) configuration. Returns true when the cached data must
   * be read again: new credentials or another language for the plant names.
   */
  setConfig(config) {
    const previous = this.config;
    this.config = config;
    const credentialsChanged =
      !previous ||
      previous.client_id !== config.client_id ||
      previous.client_secret !== config.client_secret;
    if (credentialsChanged) {
      this.client = hasCredentials(config)
        ? new OpenPlantBookClient({
            clientId: config.client_id,
            clientSecret: config.client_secret,
            fetchImpl: this.fetchImpl,
            now: this.now,
          })
        : null;
    }
    return Boolean(previous) && (credentialsChanged || previous.language !== config.language);
  }

  get plantIds() {
    return this.config?.plantIds ?? [];
  }

  // --- Cache ---------------------------------------------------------------

  async load() {
    try {
      const raw = JSON.parse(await readFile(joinPath(this.dataDir, CACHE_FILE), 'utf8'));
      for (const [pid, entry] of Object.entries(raw.plants ?? {})) {
        if (entry?.plant?.thresholds) {
          this.entries.set(pid, entry);
        }
      }
      logger.info(`${this.entries.size} plant(s) loaded from the cache`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn('Cache unreadable, starting from scratch', err.message);
      }
    }
  }

  async save() {
    try {
      await mkdir(this.dataDir, { recursive: true });
      const plants = Object.fromEntries(this.entries);
      await writeFile(joinPath(this.dataDir, CACHE_FILE), JSON.stringify({ version: 1, plants }));
    } catch (err) {
      logger.warn('Cannot write the cache', err.message);
    }
  }

  // --- Lookups ---------------------------------------------------------------

  ids(pid) {
    return this.gladys.externalIds(DEVICE_TYPE, plantSlug(pid));
  }

  /** Plant entry of a device external_id, among the followed plants. */
  findByExternalId(externalId) {
    const pid = this.plantIds.find((id) => this.ids(id).device === externalId);
    return pid ? { pid, entry: this.entries.get(pid) ?? null } : null;
  }

  /** Followed plants with their entry (null before the first read). */
  followed() {
    return this.plantIds.map((pid) => ({ pid, entry: this.entries.get(pid) ?? null }));
  }

  displayName(pid, entry) {
    return entry?.plant?.alias ?? capitalize(entry?.plant?.display_pid ?? pid);
  }

  // --- Devices ---------------------------------------------------------------

  buildDevice(pid) {
    const ids = this.ids(pid);
    const entry = this.entries.get(pid);
    const language = this.config.language;
    const params = [{ name: 'OPENPLANTBOOK_PID', value: pid }];
    if (entry?.plant?.category) {
      params.push({ name: 'OPENPLANTBOOK_CATEGORY', value: entry.plant.category });
    }
    return {
      name: this.displayName(pid, entry),
      external_id: ids.device,
      params,
      features: FEATURES.map((feature) => {
        const label = t(feature.label);
        const name = pick(
          t(feature.bound === 'min' ? 'ideal_min' : 'ideal_max', { label }),
          language,
        );
        return {
          name,
          external_id: ids.feature(feature.key),
          category: feature.category,
          type: featureType(feature),
          ...featureUnitAndBounds(feature, this.config),
          read_only: true,
          has_feedback: false,
          // Reference data: one value a day, nothing worth a history.
          keep_history: false,
        };
      }),
    };
  }

  buildDevices() {
    return this.plantIds.map((pid) => this.buildDevice(pid));
  }

  statesOf(pid) {
    const entry = this.entries.get(pid);
    if (!entry) {
      return [];
    }
    const ids = this.ids(pid);
    return FEATURES.map((feature) => ({
      device_feature_external_id: ids.feature(feature.key),
      state: thresholdValue(entry.plant, feature.threshold, feature.bound, this.config),
    })).filter((state) => state.state !== null);
  }

  /** Publish the thresholds of the given plants (all by default), changes only. */
  async publishStates(pids = this.plantIds) {
    const states = pids.flatMap((pid) => this.statesOf(pid));
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states);
    }
  }

  async publishDevices() {
    await this.gladys.publishDiscoveredDevices(this.buildDevices());
  }

  // --- Refresh ---------------------------------------------------------------

  isStale(pid) {
    const entry = this.entries.get(pid);
    return !entry || this.now() - entry.fetchedAt >= this.config.refresh_hours * 3600 * 1000;
  }

  /**
   * Read the plants from OpenPlantBook: the stale ones, or all of them with
   * `force`. Concurrent calls share the same run.
   * @returns {Promise<{ refreshed: number, failed: number, errors: Error[] }>}
   */
  refresh({ force = false, pids } = {}) {
    if (!this.refreshing) {
      this.refreshing = this.#refresh({ force, pids }).finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async #refresh({ force, pids }) {
    if (!this.client) {
      return { refreshed: 0, failed: 0, errors: [] };
    }
    const targets = (pids ?? this.plantIds).filter((pid) => force || this.isStale(pid));
    const result = { refreshed: 0, failed: 0, errors: [] };
    const changed = [];
    for (const pid of targets) {
      try {
        const previous = this.entries.get(pid);
        const plant = await this.client.detail(pid, this.config.language);
        const entry = {
          plant,
          fetchedAt: this.now(),
          imageKey: previous?.imageKey ?? null,
          imageUrl: previous?.imageUrl ?? null,
        };
        await this.#updateImage(entry);
        this.entries.set(pid, entry);
        result.refreshed += 1;
        if (!sameThresholds(previous?.plant, plant)) {
          changed.push(pid);
        }
      } catch (err) {
        result.failed += 1;
        result.errors.push(err);
        logger.warn(`Cannot read "${pid}" from OpenPlantBook: ${err.message}`);
        // Wrong credentials fail every plant the same way: stop here.
        if (err.code === 'auth') {
          break;
        }
      }
    }
    if (result.refreshed > 0) {
      await this.save();
      // Names (aliases) may have changed with the language: re-publish.
      await this.publishDevices();
      await this.publishStates(targets);
    }
    await this.#reportSyncOutcome(result);
    for (const pid of changed) {
      await this.#fireThresholdsUpdated(pid);
    }
    if (result.refreshed + result.failed > 0) {
      this.onRefreshed?.(result);
    }
    return result;
  }

  async #updateImage(entry) {
    const url = entry.plant.image_url;
    if (!url) {
      entry.imageKey = null;
      entry.imageUrl = null;
      return;
    }
    if (url === entry.imageUrl && entry.imageKey) {
      return;
    }
    try {
      const bytes = await this.client.downloadImage(url, MAX_IMAGE_BYTES);
      const base64 = bytes ? bytes.toString('base64') : null;
      if (!base64 || validateWidgetImage(base64).length > 0) {
        // Too big or a format the core refuses: the widgets go without it.
        entry.imageKey = null;
      } else {
        // When the bytes change, the key must change (the core caches 1 h).
        const key = `plant-${createHash('sha1').update(bytes).digest('hex').slice(0, 20)}`;
        await mkdir(joinPath(this.dataDir, IMAGES_DIR), { recursive: true });
        await writeFile(joinPath(this.dataDir, IMAGES_DIR, key), base64);
        entry.imageKey = key;
      }
      entry.imageUrl = url;
    } catch (err) {
      logger.debug(`No image for "${entry.plant.pid}": ${err.message}`);
    }
  }

  /** Raw base64 of a stored plant image (onWidgetGetImage). */
  async readImage(key) {
    if (!/^plant-[a-f0-9]{20}$/.test(key)) {
      throw new Error(`Unknown image: ${key}`);
    }
    return readFile(joinPath(this.dataDir, IMAGES_DIR, key), 'utf8');
  }

  async #reportSyncOutcome(result) {
    const attempted = result.refreshed + result.failed;
    if (attempted === 0) {
      return;
    }
    const ok = result.failed === 0;
    const wasOk = this.lastSyncOk;
    this.lastSyncOk = ok;
    this.lastError = ok ? null : result.errors[0];
    if (!ok && wasOk !== false) {
      const reason = this.lastError.message.slice(0, 200);
      await this.gladys
        .publishSceneEvent(SYNC_FAILED_TRIGGER, { reason, error: this.lastError.code ?? 'unknown' })
        .catch((err) => logger.error('Cannot fire sync_failed', err));
    }
  }

  async #fireThresholdsUpdated(pid) {
    const { plant } = this.entries.get(pid);
    const value = (threshold, bound) => thresholdValue(plant, threshold, bound, this.config);
    // Flat data (≤ 30 primitive keys): `plant` is the device external_id the
    // trigger's `"source": "devices"` filter stores; the rest are the
    // variables the following actions read as {{triggerEvent.data.<key>}}.
    await this.gladys
      .publishSceneEvent(THRESHOLDS_UPDATED_TRIGGER, {
        plant: this.ids(pid).device,
        plant_name: this.displayName(pid, this.entries.get(pid)),
        min_soil_moisture: value('soil_moisture', 'min'),
        max_soil_moisture: value('soil_moisture', 'max'),
        min_temperature: value('temperature', 'min'),
        max_temperature: value('temperature', 'max'),
        min_light_lux: value('light_lux', 'min'),
        max_light_lux: value('light_lux', 'max'),
        min_humidity: value('humidity', 'min'),
        max_humidity: value('humidity', 'max'),
      })
      .catch((err) => logger.error('Cannot fire thresholds_updated', err));
  }
}
