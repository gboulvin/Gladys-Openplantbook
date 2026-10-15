// -----------------------------------------------------------------------------
// Buttons of the Configuration screen, declared in the manifest `actions`
// field and registered by index.js with `gladys.onAction(key, ...)`. The
// resolved multi-language message is displayed under the button; a thrown
// error is displayed too.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { hasCredentials } from './config.js';
import { t } from './i18n.js';

const logger = createLogger({ name: 'actions' });

// Keep the message under the button readable.
const MAX_SEARCH_RESULTS = 8;

/** Human message of an OpenPlantBook failure, never a secret. */
export function errorMessage(err) {
  if (err.code === 'auth') {
    return t('auth_failed');
  }
  return t('service_unreachable', { reason: err.message });
}

export const ACTIONS = {
  async test_connection(service, { config }) {
    logger.info('Action test_connection');
    if (!hasCredentials(config)) {
      return t('missing_credentials');
    }
    try {
      await service.client.getToken({ force: true });
    } catch (err) {
      return errorMessage(err);
    }
    return t('connection_ok', { count: config.plantIds.length });
  },

  async search_plant(service, { fields, config }) {
    const query = String(fields.query ?? '').trim();
    logger.info(`Action search_plant <- "${query}"`);
    if (!hasCredentials(config)) {
      return t('missing_credentials');
    }
    if (query.length < 3) {
      return t('search_too_short');
    }
    let results;
    try {
      results = await service.client.search(query, MAX_SEARCH_RESULTS);
    } catch (err) {
      return errorMessage(err);
    }
    if (results.length === 0) {
      return t('search_none', { query });
    }
    const list = results
      .map((plant) => (plant.alias ? `${plant.pid} (${plant.alias})` : plant.pid))
      .join(' · ');
    return t('search_results', { count: results.length, list });
  },

  async refresh_now(service, { config }) {
    logger.info('Action refresh_now');
    if (!hasCredentials(config)) {
      return t('missing_credentials');
    }
    if (config.plantIds.length === 0) {
      return t('no_plants');
    }
    const result = await service.refresh({ force: true });
    if (result.errors[0]?.code === 'auth') {
      return t('auth_failed');
    }
    return t('refresh_done', { refreshed: result.refreshed, failed: result.failed });
  },
};
