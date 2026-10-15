# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

The **OpenPlantBook** external integration of Gladys Assistant: a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template
(`GladysAssistant/integration-template-js`).

It reads the [Open Plantbook](https://open.plantbook.io/api/docs/) API (OAuth2
client credentials) and publishes one Gladys device per followed plant, whose
read-only features are the ideal min/max of soil moisture, temperature, light
and air humidity of the species. It is a cloud integration
(`"transports": ["cloud"]`).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/plants.test.js           # one file
node --test --test-name-pattern "widget"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/openplantbook.js              API client: token cache, search, detail, image download
src/plants.js                     PlantService: devices, states, /data cache, refresh, scene triggers
src/conditions.js                 pure comparison of measurements with the ideal ranges
src/actions.js                    Configuration screen buttons (manifest `actions`)
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widget handlers (manifest `widgets`)
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                       every runtime text, in en / fr / de / es
gladys-assistant-integration.json manifest: config_schema, actions, triggers, widgets...
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en + fr mandatory)
test/                             node --test, against the SDK's fake Gladys and a fake API
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** A plant device is
  `gladys.externalIds('plant', plantSlug(pid))`, its features
  `<threshold>_<min|max>` (`soil_moisture_min`, `light_lux_max`...). Changing
  the slug function or a feature key creates new devices and orphans the old
  ones. The same goes for every key users store: `config_schema`, `actions`,
  scene trigger / action keys and their fields / variables / outputs, widget
  keys and settings.
- **Tests never touch the network.** Use `createFakeApi()` / `createService()`
  from `test/helpers.js`; the OpenPlantBook client takes an injectable
  `fetchImpl`.
- **The container rootfs is read-only.** Write only under `/data` (the cache
  file `plants.json` and `images/`). Never log the client secret nor tokens.
- **Rate limits.** OpenPlantBook is rate limited and Gladys accepts 300 states
  per minute: keep `MAX_PLANTS` (30 × 8 features) and the cache-first refresh
  (stale plants only, `refresh_hours` interval) unless both limits allow more.
- **Scene events fire on transitions only**: `thresholds_updated` when the
  ranges change, `sync_failed` when reading starts failing. Event `data` keys
  must be declared in the trigger `fields` / `variables` (tested).
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the README's hand-pushed tag path, which bumps all three
  together before tagging. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Four languages.** Every user-facing text exists in English, French, German
  and Spanish: manifest `label` / `description` / `placeholder` (tested by
  `test/i18n.test.js`), runtime messages in `src/i18n.js`, and the four
  `docs/*.md`, kept in sync. The catalog `description` holds 10 to 100
  characters per language.
- **Manifest coupling.** `scene_triggers`, `scene_actions` and `widgets`
  require `gladys_version` `>=5.1.0`; `test/manifest.test.js` ties the
  manifest to the handlers: change both sides together.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
