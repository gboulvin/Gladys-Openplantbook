// -----------------------------------------------------------------------------
// Translations of every runtime text the integration sends to Gladys: action
// messages, connection status, widget texts, device names.
//
// Gladys picks the user's language from a multi-language object
// (`{ en, fr, de, es }`), English being the fallback: every message here is
// built in the four languages of the Gladys UI, and `t()` returns such an
// object. `pick()` is for the few places that need ONE string (scene outputs,
// device names), in the language chosen in the configuration.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const MESSAGES = {
  // --- Connection status ---------------------------------------------------
  missing_credentials: {
    en: 'Enter your OpenPlantBook client ID and client secret.',
    fr: 'Saisissez votre client ID et votre client secret OpenPlantBook.',
    de: 'Geben Sie Ihre OpenPlantBook Client-ID und Ihr Client-Secret ein.',
    es: 'Introduzca su client ID y su client secret de OpenPlantBook.',
  },
  auth_failed: {
    en: 'OpenPlantBook refused the credentials: check the client ID and secret.',
    fr: 'OpenPlantBook a refusé les identifiants : vérifiez le client ID et le secret.',
    de: 'OpenPlantBook hat die Zugangsdaten abgelehnt: prüfen Sie Client-ID und Secret.',
    es: 'OpenPlantBook rechazó las credenciales: compruebe el client ID y el secret.',
  },
  service_unreachable: {
    en: 'OpenPlantBook is unreachable right now ({reason}). Retrying later.',
    fr: 'OpenPlantBook est injoignable pour le moment ({reason}). Nouvel essai plus tard.',
    de: 'OpenPlantBook ist derzeit nicht erreichbar ({reason}). Neuer Versuch später.',
    es: 'OpenPlantBook no está disponible ahora ({reason}). Se reintentará más tarde.',
  },
  init_failed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Logs der Integration.',
    es: 'La inicialización falló, consulte los registros de la integración.',
  },

  // --- Configuration screen actions ----------------------------------------
  connection_ok: {
    en: 'Connected to OpenPlantBook. {count} plant(s) followed.',
    fr: 'Connecté à OpenPlantBook. {count} plante(s) suivie(s).',
    de: 'Mit OpenPlantBook verbunden. {count} Pflanze(n) verfolgt.',
    es: 'Conectado a OpenPlantBook. {count} planta(s) seguida(s).',
  },
  search_too_short: {
    en: 'Type at least 3 characters to search.',
    fr: 'Saisissez au moins 3 caractères pour lancer la recherche.',
    de: 'Geben Sie mindestens 3 Zeichen für die Suche ein.',
    es: 'Escriba al menos 3 caracteres para buscar.',
  },
  search_none: {
    en: 'No plant found for "{query}". Try the scientific name.',
    fr: 'Aucune plante trouvée pour « {query} ». Essayez le nom scientifique.',
    de: 'Keine Pflanze für „{query}“ gefunden. Versuchen Sie den wissenschaftlichen Namen.',
    es: 'No se encontró ninguna planta para «{query}». Pruebe el nombre científico.',
  },
  search_results: {
    en: '{count} result(s), copy an id into the "Plants" field: {list}',
    fr: '{count} résultat(s), copiez un identifiant dans le champ « Plantes » : {list}',
    de: '{count} Ergebnis(se), kopieren Sie eine ID in das Feld „Pflanzen“: {list}',
    es: '{count} resultado(s), copie un identificador en el campo «Plantas»: {list}',
  },
  refresh_done: {
    en: '{refreshed} plant(s) refreshed, {failed} failed.',
    fr: '{refreshed} plante(s) actualisée(s), {failed} en échec.',
    de: '{refreshed} Pflanze(n) aktualisiert, {failed} fehlgeschlagen.',
    es: '{refreshed} planta(s) actualizada(s), {failed} con error.',
  },
  no_plants: {
    en: 'No plant configured yet: fill in the "Plants" field.',
    fr: 'Aucune plante configurée : remplissez le champ « Plantes ».',
    de: 'Noch keine Pflanze konfiguriert: füllen Sie das Feld „Pflanzen“ aus.',
    es: 'Aún no hay plantas configuradas: rellene el campo «Plantas».',
  },
  unknown_plant: {
    en: 'This plant is not followed by the integration (anymore).',
    fr: "Cette plante n'est pas (ou plus) suivie par l'intégration.",
    de: 'Diese Pflanze wird von der Integration nicht (mehr) verfolgt.',
    es: 'Esta planta ya no está (o nunca estuvo) seguida por la integración.',
  },

  // --- Plant conditions (scene action) -------------------------------------
  condition_ok: {
    en: '{plant}: all conditions are in the ideal range.',
    fr: '{plant} : toutes les conditions sont dans la plage idéale.',
    de: '{plant}: alle Bedingungen liegen im idealen Bereich.',
    es: '{plant}: todas las condiciones están en el rango ideal.',
  },
  condition_no_data: {
    en: '{plant}: no measurement to compare with the ideal ranges.',
    fr: '{plant} : aucune mesure à comparer aux plages idéales.',
    de: '{plant}: kein Messwert zum Vergleich mit den idealen Bereichen.',
    es: '{plant}: ninguna medición que comparar con los rangos ideales.',
  },
  condition_issues: {
    en: '{plant}: {issues}.',
    fr: '{plant} : {issues}.',
    de: '{plant}: {issues}.',
    es: '{plant}: {issues}.',
  },
  too_dry: {
    en: 'soil too dry ({value} %, min {min} %)',
    fr: 'sol trop sec ({value} %, min {min} %)',
    de: 'Boden zu trocken ({value} %, min. {min} %)',
    es: 'suelo demasiado seco ({value} %, mín. {min} %)',
  },
  too_wet: {
    en: 'soil too wet ({value} %, max {max} %)',
    fr: 'sol trop humide ({value} %, max {max} %)',
    de: 'Boden zu nass ({value} %, max. {max} %)',
    es: 'suelo demasiado húmedo ({value} %, máx. {max} %)',
  },
  too_cold: {
    en: 'too cold ({value}{unit}, min {min}{unit})',
    fr: 'trop froid ({value}{unit}, min {min}{unit})',
    de: 'zu kalt ({value}{unit}, min. {min}{unit})',
    es: 'demasiado frío ({value}{unit}, mín. {min}{unit})',
  },
  too_hot: {
    en: 'too hot ({value}{unit}, max {max}{unit})',
    fr: 'trop chaud ({value}{unit}, max {max}{unit})',
    de: 'zu warm ({value}{unit}, max. {max}{unit})',
    es: 'demasiado calor ({value}{unit}, máx. {max}{unit})',
  },
  too_dark: {
    en: 'not enough light ({value} lx, min {min} lx)',
    fr: 'pas assez de lumière ({value} lx, min {min} lx)',
    de: 'zu wenig Licht ({value} lx, min. {min} lx)',
    es: 'poca luz ({value} lx, mín. {min} lx)',
  },
  too_bright: {
    en: 'too much light ({value} lx, max {max} lx)',
    fr: 'trop de lumière ({value} lx, max {max} lx)',
    de: 'zu viel Licht ({value} lx, max. {max} lx)',
    es: 'demasiada luz ({value} lx, máx. {max} lx)',
  },
  air_too_dry: {
    en: 'air too dry ({value} %, min {min} %)',
    fr: 'air trop sec ({value} %, min {min} %)',
    de: 'Luft zu trocken ({value} %, min. {min} %)',
    es: 'aire demasiado seco ({value} %, mín. {min} %)',
  },
  air_too_humid: {
    en: 'air too humid ({value} %, max {max} %)',
    fr: 'air trop humide ({value} %, max {max} %)',
    de: 'Luft zu feucht ({value} %, max. {max} %)',
    es: 'aire demasiado húmedo ({value} %, máx. {max} %)',
  },

  // --- Labels (widgets, device features) -----------------------------------
  soil_moisture: {
    en: 'Soil moisture',
    fr: 'Humidité du sol',
    de: 'Bodenfeuchte',
    es: 'Humedad suelo',
  },
  temperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
  light: { en: 'Light', fr: 'Lumière', de: 'Licht', es: 'Luz' },
  humidity: { en: 'Air humidity', fr: "Humidité de l'air", de: 'Luftfeuchte', es: 'Humedad aire' },
  ideal_min: {
    en: '{label} (ideal min)',
    fr: '{label} (min idéal)',
    de: '{label} (ideal min.)',
    es: '{label} (mín. ideal)',
  },
  ideal_max: {
    en: '{label} (ideal max)',
    fr: '{label} (max idéal)',
    de: '{label} (ideal max.)',
    es: '{label} (máx. ideal)',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refresh_all: {
    en: 'Refresh all',
    fr: 'Tout actualiser',
    de: 'Alle aktualisieren',
    es: 'Actualizar todo',
  },
  widget_pick_plant: {
    en: 'Pick a plant in the widget settings.',
    fr: 'Choisissez une plante dans les réglages du widget.',
    de: 'Wählen Sie eine Pflanze in den Widget-Einstellungen.',
    es: 'Elija una planta en los ajustes del widget.',
  },
  widget_no_data: {
    en: 'No data from OpenPlantBook yet for this plant.',
    fr: 'Pas encore de données OpenPlantBook pour cette plante.',
    de: 'Noch keine OpenPlantBook-Daten für diese Pflanze.',
    es: 'Aún no hay datos de OpenPlantBook para esta planta.',
  },
  widget_no_plants: {
    en: 'No plant followed yet: add some in the integration configuration.',
    fr: "Aucune plante suivie : ajoutez-en dans la configuration de l'intégration.",
    de: 'Noch keine Pflanze verfolgt: fügen Sie welche in der Konfiguration hinzu.',
    es: 'Aún no hay plantas: añádalas en la configuración de la integración.',
  },
  widget_ranges: {
    en: 'Soil moisture: {soil}\nTemperature: {temp}\nLight: {light}\nAir humidity: {humid}',
    fr: "Humidité du sol : {soil}\nTempérature : {temp}\nLumière : {light}\nHumidité de l'air : {humid}",
    de: 'Bodenfeuchte: {soil}\nTemperatur: {temp}\nLicht: {light}\nLuftfeuchte: {humid}',
    es: 'Humedad del suelo: {soil}\nTemperatura: {temp}\nLuz: {light}\nHumedad del aire: {humid}',
  },
  unknown_value: { en: 'unknown', fr: 'inconnue', de: 'unbekannt', es: 'desconocida' },
};

function format(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/**
 * Multi-language object of a message, in every language of the Gladys UI.
 * `params` values are either plain values or multi-language objects
 * themselves (their text in the same language is used).
 * @param {keyof MESSAGES} key
 * @param {Record<string, unknown>} [params]
 * @returns {{ en: string, fr: string, de: string, es: string }}
 */
export function t(key, params = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message key: ${key}`);
  }
  const result = {};
  for (const lang of LANGUAGES) {
    const localized = {};
    for (const [name, value] of Object.entries(params)) {
      localized[name] =
        value !== null && typeof value === 'object' ? (value[lang] ?? value.en) : value;
    }
    result[lang] = format(message[lang] ?? message.en, localized);
  }
  return result;
}

/**
 * One string out of a multi-language object, English as the fallback.
 * @param {Record<string, string>} text
 * @param {string} language
 */
export function pick(text, language) {
  return text[language] ?? text.en;
}

/**
 * Join several multi-language objects with a separator, language by language.
 * @param {Record<string, string>[]} texts
 * @param {string} separator
 */
export function join(texts, separator) {
  const result = {};
  for (const lang of LANGUAGES) {
    result[lang] = texts.map((text) => pick(text, lang)).join(separator);
  }
  return result;
}
