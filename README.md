# OpenPlantBook for Gladys Assistant

External integration bringing the [Open Plantbook](https://open.plantbook.io/)
plant database into [Gladys Assistant](https://gladysassistant.com): the
**ideal soil moisture, light, temperature and air humidity** of each of your
plants' species, as Gladys devices, scene cards and dashboard widgets.

- **Type**: device · **Transport**: cloud · **Gladys**: 5.3.0 or later
- **Languages**: English, Français, Deutsch, Español
- Built from the official
  [integration template](https://github.com/GladysAssistant/integration-template-js)
  with the [JavaScript SDK](https://github.com/GladysAssistant/integration-sdk-js).

## Features

| Surface               | What it does                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Devices               | One device per plant, 8 read-only features: min / max of soil moisture (%), temperature (°C/°F), light (lux) and air humidity (%)              |
| Configuration actions | Test the connection · Search a plant (lists the OpenPlantBook ids) · Refresh all plants now                                                    |
| Scene triggers        | `thresholds_updated` (ranges first read or changed) · `sync_failed` (OpenPlantBook starts failing, filterable by error)                        |
| Scene actions         | `check_plant_conditions` (your measurements vs the ideal ranges → `in_range`, `status`, `message`) · `get_plant_thresholds` · `refresh_plants` |
| Dashboard widgets     | `plant_card` (photo + 4 ideal ranges of one plant) · `plants_overview` (every followed plant)                                                  |

The thresholds are cached under `/data`: the devices keep their values across
restarts and while the API is unreachable, and a restart costs no API call. A
plant is read again every `refresh_hours` (24 h by default).

## Install

1. In Gladys, open **Integrations**, search **OpenPlantBook** and install it.
2. Create a free account on [open.plantbook.io](https://open.plantbook.io/)
   and generate an API key (client ID + client secret) on the
   [API keys](https://open.plantbook.io/apikey/show/) page.
3. Fill in the configuration and the plant ids (the **Search a plant** button
   finds them).

The full user guide: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Develop

```bash
npm install
npm test               # node --test, never touches the network
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="openplantbook" \
OPENPLANTBOOK_DATA_DIR=./data \
LOG_LEVEL=debug \
npm start
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the project rules.

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then run **Actions → Release → Run workflow** (`patch`, `minor` or `major`):
the workflow bumps `package.json` and the manifest, rolls the changelog, tags,
builds the `linux/amd64` + `linux/arm64` image to
`ghcr.io/gboulvin/gladys-openplantbook` and publishes the GitHub Release. The
Gladys store indexer picks up the new version (the repository carries the
`gladys-assistant-integration` topic).

## Security

See [`SECURITY.md`](SECURITY.md) to report a vulnerability privately.

## Credits

Plant data and photos: [Open Plantbook](https://open.plantbook.io/), a
community project. This integration is not affiliated with it.

## License

Apache-2.0
