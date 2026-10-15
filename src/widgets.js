// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+), declared in the manifest `widgets` field and
// registered by index.js (`onWidgetGet`, `onWidgetAction`, `onWidgetGetImage`).
//
//   - plant_card:      one plant (chosen in the widget settings): its photo and
//                      its four ideal ranges, plus a refresh button;
//   - plants_overview: every followed plant in a list, with its ranges in the
//                      detail panel.
//
// The content is declarative (no HTML): the core renders it with its theme and
// picks the user's language in the multi-language texts. The plant photos are
// served by key through onWidgetGetImage, from the files stored under /data.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { temperatureSymbol } from './conditions.js';
import { t } from './i18n.js';
import { thresholdValue } from './plants.js';

const logger = createLogger({ name: 'widgets' });

export const PLANT_CARD_WIDGET = 'plant_card';
export const PLANTS_OVERVIEW_WIDGET = 'plants_overview';

const ACTIONS = { REFRESH_PLANT: 'refresh_plant', REFRESH_ALL: 'refresh_all' };

// The ranges change at most once per refresh, and every refresh nudges the
// widgets (see refreshWidgets): the TTL is only a safety net.
const TTL_SECONDS = 3600;
const MAX_LIST_ITEMS = 8;

function compact(value) {
  if (value === null) {
    return '?';
  }
  return Math.abs(value) >= 10000 ? `${Math.round(value / 1000)}k` : String(value);
}

function range(plant, threshold, config) {
  const min = thresholdValue(plant, threshold, 'min', config);
  const max = thresholdValue(plant, threshold, 'max', config);
  if (min === null && max === null) {
    return null;
  }
  return `${compact(min)}–${compact(max)}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function rangeTiles(plant, config) {
  const tiles = [
    ['soil_moisture', 'soil_moisture', '%', 'droplet'],
    ['temperature', 'temperature', temperatureSymbol(config.temperature_unit), 'thermometer'],
    ['light_lux', 'light', 'lx', 'sun'],
    ['humidity', 'humidity', '%', 'cloud'],
  ];
  return tiles.map(([threshold, label, unit, icon]) => {
    const value = range(plant, threshold, config);
    return {
      type: 'value',
      label: t(label),
      icon,
      value: value ?? '—',
      ...(value ? { unit } : {}),
      color: WIDGET_COLORS.SUCCESS,
    };
  });
}

function rangesText(plant, config) {
  const unknown = t('unknown_value');
  const withUnit = (threshold, unit) => {
    const value = range(plant, threshold, config);
    return value ? `${value} ${unit}` : unknown;
  };
  return t('widget_ranges', {
    soil: withUnit('soil_moisture', '%'),
    temp: withUnit('temperature', temperatureSymbol(config.temperature_unit)),
    light: withUnit('light_lux', 'lx'),
    humid: withUnit('humidity', '%'),
  });
}

function emptyContent(messageKey) {
  return {
    ttl_seconds: TTL_SECONDS,
    components: [{ type: 'text', text: t(messageKey), variant: 'body' }],
  };
}

function refreshToast(result) {
  return t('refresh_done', { refreshed: result.refreshed, failed: result.failed });
}

export const WIDGETS = {
  [PLANT_CARD_WIDGET]: {
    async get(service, { settings, config }) {
      logger.debug(`onWidgetGet <- ${PLANT_CARD_WIDGET} ${settings?.plant ?? '(no plant)'}`);
      if (!settings?.plant) {
        return emptyContent('widget_pick_plant');
      }
      const found = service.findByExternalId(settings.plant);
      if (!found) {
        return emptyContent('unknown_plant');
      }
      if (!found.entry) {
        return emptyContent('widget_no_data');
      }
      const { plant, imageKey } = found.entry;
      const name = service.displayName(found.pid, found.entry);
      const caption = [plant.display_pid, plant.category].filter(Boolean).join(' · ');
      return {
        ttl_seconds: TTL_SECONDS,
        components: [
          ...(imageKey ? [{ type: 'image', key: imageKey, alt: name, fit: 'cover' }] : []),
          { type: 'text', text: truncate(name, 40), variant: 'heading' },
          { type: 'text', text: truncate(caption, 80), variant: 'caption' },
          ...rangeTiles(plant, config),
          {
            type: 'button',
            label: t('refresh'),
            icon: 'refresh-cw',
            style: 'secondary',
            action: { key: ACTIONS.REFRESH_PLANT, params: { plant: settings.plant } },
          },
        ],
      };
    },

    async action(service, { actionKey, params }) {
      logger.info(`onWidgetAction <- ${PLANT_CARD_WIDGET}.${actionKey}`);
      if (actionKey !== ACTIONS.REFRESH_PLANT) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      const found = service.findByExternalId(params.plant);
      if (!found) {
        return t('unknown_plant');
      }
      return refreshToast(await service.refresh({ force: true, pids: [found.pid] }));
    },
  },

  [PLANTS_OVERVIEW_WIDGET]: {
    async get(service, { config }) {
      logger.debug(`onWidgetGet <- ${PLANTS_OVERVIEW_WIDGET}`);
      const plants = service.followed();
      if (plants.length === 0) {
        return emptyContent('widget_no_plants');
      }
      const items = plants.slice(0, MAX_LIST_ITEMS).map(({ pid, entry }) => {
        const name = truncate(service.displayName(pid, entry), 60);
        if (!entry) {
          return { title: name, subtitle: t('widget_no_data') };
        }
        const { plant, imageKey } = entry;
        return {
          title: name,
          subtitle: truncate(plant.display_pid, 60),
          ...(imageKey ? { image: imageKey } : {}),
          ...(plant.category
            ? { badge: { text: truncate(plant.category, 16), color: WIDGET_COLORS.SUCCESS } }
            : {}),
          description: rangesText(plant, config),
        };
      });
      const components = [{ type: 'card-list', display: 'list', items }];
      if (plants.length > MAX_LIST_ITEMS) {
        components.push({
          type: 'text',
          text: `+${plants.length - MAX_LIST_ITEMS}`,
          variant: 'caption',
        });
      }
      components.push({
        type: 'button',
        label: t('refresh_all'),
        icon: 'refresh-cw',
        style: 'secondary',
        action: { key: ACTIONS.REFRESH_ALL },
      });
      return { ttl_seconds: TTL_SECONDS, components };
    },

    async action(service, { actionKey }) {
      logger.info(`onWidgetAction <- ${PLANTS_OVERVIEW_WIDGET}.${actionKey}`);
      if (actionKey !== ACTIONS.REFRESH_ALL) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      return refreshToast(await service.refresh({ force: true }));
    },
  },
};

/**
 * Ask the core to re-pull every widget now (fire-and-forget, rate-limited
 * core-side, dropped while disconnected): after each refresh, config update
 * and (re)connection.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
