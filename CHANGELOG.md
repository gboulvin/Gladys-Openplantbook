# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- Requires Gladys 5.3.0 or later: the manifest declares search keywords for
  the new catalog of Gladys 5.3.
- Integration SDK 0.16.

## [1.0.1] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.0] - 2026-10-15

### Added

- First release of the OpenPlantBook integration: one Gladys device per plant,
  with the ideal minimum and maximum of soil moisture, temperature, light and
  air humidity of its species, read from the Open Plantbook API.
- Configuration screen: OpenPlantBook client ID and secret, the list of plants,
  the language of the plant names (English, French, German, Spanish), the
  temperature unit (Celsius or Fahrenheit) and the refresh interval. Buttons to
  test the connection, search a plant id and refresh every plant.
- Scene triggers: "Plant thresholds updated" and "OpenPlantBook sync failed".
- Scene actions: "Check a plant's conditions" (compares your measurements with
  the ideal ranges and returns a status and a message ready to send), "Get a
  plant's ideal ranges" and "Refresh OpenPlantBook data".
- Dashboard widgets: "Plant card" (photo and ideal ranges of one plant) and
  "My plants" (every followed plant).
- Local cache under `/data`: the devices keep their thresholds across restarts
  and while OpenPlantBook is unreachable, and a restart costs no API call.
- User documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/gboulvin/Gladys-Openplantbook/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/gboulvin/Gladys-Openplantbook/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-Openplantbook/releases/tag/v1.0.0
