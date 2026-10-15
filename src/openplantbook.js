// -----------------------------------------------------------------------------
// OpenPlantBook API client (https://open.plantbook.io/api/docs/).
//
// Authentication: OAuth2 `client_credentials` grant with the client ID and
// secret the user generates at https://open.plantbook.io/apikey/show/. The
// access token is cached until shortly before it expires, and renewed once
// when the API answers 401 (revoked or expired early).
//
// Node 22+ provides `fetch` natively: no HTTP dependency. `fetchImpl` is
// injectable so the tests never touch the network.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'openplantbook' });

export const API_BASE_URL = 'https://open.plantbook.io/api/v1';

const REQUEST_TIMEOUT_MS = 15_000;
// Renew the token this long before it expires, so a request never races it.
const TOKEN_MARGIN_MS = 60_000;

/** Error of the OpenPlantBook API, with a stable `code` the callers branch on. */
export class OpenPlantBookError extends Error {
  /**
   * @param {'auth'|'not_found'|'rate_limited'|'http'|'network'|'invalid'} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'OpenPlantBookError';
    this.code = code;
    this.status = status;
  }
}

function errorFromStatus(status, what) {
  if (status === 401 || status === 403) {
    return new OpenPlantBookError(
      'auth',
      `${what}: authentication refused (HTTP ${status})`,
      status,
    );
  }
  if (status === 404) {
    return new OpenPlantBookError('not_found', `${what}: not found`, status);
  }
  if (status === 429) {
    return new OpenPlantBookError('rate_limited', `${what}: too many requests`, status);
  }
  return new OpenPlantBookError('http', `${what}: HTTP ${status}`, status);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Keep what the integration uses from a plant detail, with numbers or null.
 * Temperatures are in °C, light in lux, moistures and humidity in %, soil
 * conductivity in µS/cm (OpenPlantBook units).
 * @param {Record<string, unknown>} detail
 */
export function normalizePlant(detail) {
  const range = (min, max) => ({
    min: toNumberOrNull(detail[min]),
    max: toNumberOrNull(detail[max]),
  });
  return {
    pid: String(detail.pid),
    display_pid: String(detail.display_pid ?? detail.pid),
    alias: typeof detail.alias === 'string' && detail.alias.length > 0 ? detail.alias : null,
    category:
      typeof detail.category === 'string' && detail.category.length > 0 ? detail.category : null,
    image_url:
      typeof detail.image_url === 'string' && detail.image_url.startsWith('https://')
        ? detail.image_url
        : null,
    thresholds: {
      soil_moisture: range('min_soil_moist', 'max_soil_moist'),
      temperature: range('min_temp', 'max_temp'),
      light_lux: range('min_light_lux', 'max_light_lux'),
      humidity: range('min_env_humid', 'max_env_humid'),
      soil_ec: range('min_soil_ec', 'max_soil_ec'),
    },
  };
}

export class OpenPlantBookClient {
  /**
   * @param {{ clientId: string, clientSecret: string, fetchImpl?: typeof fetch, now?: () => number }} options
   */
  constructor({ clientId, clientSecret, fetchImpl = globalThis.fetch, now = Date.now }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async #fetch(url, init, what) {
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new OpenPlantBookError('network', `${what}: ${err.message}`);
    }
  }

  /** Fetch (or reuse) an OAuth2 access token. Never logs the secret. */
  async getToken({ force = false } = {}) {
    if (!force && this.token && this.now() < this.tokenExpiresAt - TOKEN_MARGIN_MS) {
      return this.token;
    }
    const response = await this.#fetch(
      `${API_BASE_URL}/token/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      },
      'token',
    );
    // The token endpoint answers 400 `invalid_client` for wrong credentials.
    if (response.status === 400 || response.status === 401) {
      throw new OpenPlantBookError('auth', 'token: invalid client credentials', response.status);
    }
    if (!response.ok) {
      throw errorFromStatus(response.status, 'token');
    }
    const body = await response.json();
    if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
      throw new OpenPlantBookError('invalid', 'token: no access_token in the response');
    }
    this.token = body.access_token;
    const expiresIn = Number(body.expires_in);
    this.tokenExpiresAt = this.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000;
    logger.debug('OpenPlantBook access token obtained');
    return this.token;
  }

  async #get(path, what) {
    let token = await this.getToken();
    let response = await this.#fetch(
      `${API_BASE_URL}${path}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      what,
    );
    if (response.status === 401) {
      // The token may have been revoked or expired early: renew it once.
      token = await this.getToken({ force: true });
      response = await this.#fetch(
        `${API_BASE_URL}${path}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        what,
      );
    }
    if (!response.ok) {
      throw errorFromStatus(response.status, what);
    }
    return response.json();
  }

  /**
   * Search plants by scientific or common name (at least 3 characters).
   * @param {string} query
   * @param {number} [limit]
   * @returns {Promise<{ pid: string, display_pid: string, alias: string|null, category: string|null }[]>}
   */
  async search(query, limit = 10) {
    const params = new URLSearchParams({ alias: query, limit: String(limit) });
    const body = await this.#get(`/plant/search?${params}`, 'search');
    return (body.results ?? []).map((result) => ({
      pid: String(result.pid),
      display_pid: String(result.display_pid ?? result.pid),
      alias: result.alias ?? null,
      category: result.category ?? null,
    }));
  }

  /**
   * Detail of one plant, normalized (see normalizePlant).
   * @param {string} pid
   * @param {string} [language] ISO 639-1 code: the alias becomes the common
   *   name of the plant in this language.
   */
  async detail(pid, language) {
    const params = language ? `?${new URLSearchParams({ lang: language })}` : '';
    const body = await this.#get(
      `/plant/detail/${encodeURIComponent(pid)}/${params}`,
      `detail "${pid}"`,
    );
    return normalizePlant(body);
  }

  /**
   * Download a plant image (raw bytes), at most `maxBytes`.
   * @param {string} url https URL from the plant detail
   * @param {number} maxBytes
   * @returns {Promise<Buffer|null>} null when the image is too big
   */
  async downloadImage(url, maxBytes) {
    const response = await this.#fetch(url, {}, 'image');
    if (!response.ok) {
      throw errorFromStatus(response.status, 'image');
    }
    const declared = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > maxBytes ? null : bytes;
  }
}
