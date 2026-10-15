// -----------------------------------------------------------------------------
// Test helpers: an in-memory OpenPlantBook API (the tests never touch the
// network) and a temporary /data directory.
// -----------------------------------------------------------------------------

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { PlantService } from '../src/plants.js';

export const MONSTERA = {
  pid: 'monstera deliciosa',
  display_pid: 'Monstera deliciosa',
  alias: 'Swiss cheese plant',
  category: 'Araceae',
  max_light_mmol: 2500,
  min_light_mmol: 1200,
  max_light_lux: 35000,
  min_light_lux: 1500,
  max_temp: 32,
  min_temp: 12,
  min_temp_survival: 5,
  max_env_humid: 85,
  min_env_humid: 30,
  max_soil_moist: 60,
  min_soil_moist: 15,
  max_soil_ec: 2000,
  min_soil_ec: 350,
  image_url: 'https://opb-img.plantbook.io/monstera%20deliciosa.jpg',
  image_source: null,
  image_license: null,
  common_names: [],
};

export const FICUS = {
  pid: 'ficus lyrata',
  display_pid: 'Ficus lyrata',
  alias: 'Fiddle-leaf fig',
  category: 'Moraceae',
  max_light_lux: 50000,
  min_light_lux: 3000,
  max_temp: 30,
  min_temp: 15,
  max_env_humid: 80,
  min_env_humid: 30,
  max_soil_moist: 55,
  min_soil_moist: 20,
  max_soil_ec: null,
  min_soil_ec: null,
  image_url: '',
  common_names: [],
};

/** A valid 1×1 PNG, the kind of bytes the Gladys core accepts as widget image. */
export function tinyPng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 0x2e, 0x8b, 0x57]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * In-memory OpenPlantBook. `api.plants` maps pid → detail; set `api.failWith`
 * to an HTTP status (or 'network') to make every API call fail.
 */
export function createFakeApi({ plants = [MONSTERA, FICUS], clientSecret = 'secret' } = {}) {
  const api = {
    plants: new Map(plants.map((plant) => [plant.pid, structuredClone(plant)])),
    requests: [],
    tokensIssued: 0,
    failWith: null,
    image: tinyPng(),
  };
  api.fetch = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    api.requests.push({ method: init.method ?? 'GET', pathname, searchParams, init });
    if (api.failWith === 'network') {
      throw new TypeError('fetch failed');
    }
    if (pathname === '/api/v1/token/') {
      const form = new URLSearchParams(init.body);
      if (form.get('client_secret') !== clientSecret) {
        return json(400, { error: 'invalid_client' });
      }
      api.tokensIssued += 1;
      return json(200, {
        access_token: `token-${api.tokensIssued}`,
        expires_in: 86400,
        token_type: 'Bearer',
        scope: 'read write',
      });
    }
    if (url.startsWith('https://opb-img.plantbook.io/')) {
      return new Response(api.image, { status: 200, headers: { 'Content-Type': 'image/png' } });
    }
    if (api.failWith) {
      return json(api.failWith, { type: 'client_error' });
    }
    if (!init.headers?.Authorization?.startsWith('Bearer token-')) {
      return json(401, { type: 'client_error' });
    }
    if (pathname === '/api/v1/plant/search') {
      const query = searchParams.get('alias').toLowerCase();
      const results = [...api.plants.values()]
        .filter((p) => p.pid.includes(query) || p.alias?.toLowerCase().includes(query))
        .map(({ pid, display_pid, alias, category }) => ({ pid, display_pid, alias, category }));
      return json(200, { count: results.length, next: null, previous: null, results });
    }
    const detail = pathname.match(/^\/api\/v1\/plant\/detail\/(.+)\/$/);
    if (detail) {
      const plant = api.plants.get(decodeURIComponent(detail[1]));
      return plant ? json(200, plant) : json(404, { type: 'client_error' });
    }
    return json(404, {});
  };
  return api;
}

export async function tempDataDir() {
  return mkdtemp(join(tmpdir(), 'openplantbook-test-'));
}

/** A fake Gladys + a plant service configured with the given config. */
export async function createService(rawConfig = {}, { api = createFakeApi(), now } = {}) {
  const gladys = createFakeGladys();
  const config = normalizeConfig({
    client_id: 'client',
    client_secret: 'secret',
    plants: 'monstera deliciosa, ficus lyrata',
    ...rawConfig,
  });
  const service = new PlantService(gladys, {
    dataDir: await tempDataDir(),
    fetchImpl: api.fetch,
    ...(now ? { now } : {}),
  });
  service.setConfig(config);
  return { gladys, service, config, api };
}
