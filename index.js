// -----------------------------------------------------------------------------
// Entry point of the OpenPlantBook integration for Gladys Assistant.
//
// Role of this file: wire the SDK to the plant service (src/plants.js). It
// only registers the handlers BEFORE connect(), then connects. The SDK reads
// the GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR variables injected by the Gladys supervisor.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { ACTIONS, errorMessage } from './src/actions.js';
import { hasCredentials, normalizeConfig } from './src/config.js';
import { t } from './src/i18n.js';
import { PlantService } from './src/plants.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
const service = new PlantService(gladys);
service.onRefreshed = () => {
  refreshWidgets(gladys);
  reportConnectionStatus().catch((err) => logger.error('Cannot report the status', err));
};

let config = normalizeConfig();
service.setConfig(config);

// The thresholds are reference data: a stale plant is read again at the
// refresh interval of the configuration, checked every hour.
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;
let scheduler = null;

// --- Discovery ---------------------------------------------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing the followed plants');
  await service.publishDevices();
});

// A created device forgets the states remembered by publishChangedStates:
// publish its thresholds right away instead of waiting for the next refresh.
gladys.onDeviceCreated(async (device) => {
  const found = service.findByExternalId(device.external_id);
  if (found) {
    await service.publishStates([found.pid]);
  }
});

// --- Configuration screen actions --------------------------------------------
for (const [key, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(key, (fields) => handler(service, { fields, config }));
}

// --- Scene actions -------------------------------------------------------------
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(service, { fields, config }));
}

// --- Dashboard widgets ---------------------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(service, { ...request, config }));
  gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
    widget.action(service, { actionKey, params, settings, config }),
  );
}
gladys.onWidgetGetImage((key) => service.readImage(key));

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  const mustReload = service.setConfig(config);
  await service.publishDevices();
  await service.publishStates();
  refreshWidgets(gladys);
  // New plants are stale by definition; new credentials or another language
  // for the names re-read everything.
  await service.refresh({ force: mustReload });
  await reportConnectionStatus();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    service.setConfig(config);
    // Cached data first: the devices and their thresholds are available even
    // when OpenPlantBook is not.
    await service.publishDevices();
    await service.publishStates();
    refreshWidgets(gladys);
    startScheduler();
    await service.refresh();
    await reportConnectionStatus();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys.setConnectionStatus(false, t('init_failed')).catch(() => {});
  }
});

gladys.on('disconnected', () => {
  stopScheduler();
});

/** Connection status shown in the Configuration screen. */
async function reportConnectionStatus() {
  if (!hasCredentials(config)) {
    await gladys.setConnectionStatus(false, t('missing_credentials'));
  } else if (service.lastSyncOk === false && service.lastError) {
    await gladys.setConnectionStatus(false, errorMessage(service.lastError));
  } else {
    await gladys.setConnectionStatus(true);
  }
}

function startScheduler() {
  stopScheduler();
  scheduler = setInterval(() => {
    service.refresh().catch((err) => logger.error('Scheduled refresh failed', err));
  }, SCHEDULER_INTERVAL_MS);
}

function stopScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  stopScheduler();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the OpenPlantBook integration...');
await service.load();
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
