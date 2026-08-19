require('dotenv').config();

const ORDS_BASE = process.env.ORACLE_ORDS_URL;
const CLIENT_ID = process.env.ORACLE_ORDS_CLIENT_ID;
const CLIENT_SECRET = process.env.ORACLE_ORDS_CLIENT_SECRET;

if (!ORDS_BASE || !CLIENT_ID || !CLIENT_SECRET) {
  throw new Error('Faltan ORACLE_ORDS_URL, ORACLE_ORDS_CLIENT_ID o ORACLE_ORDS_CLIENT_SECRET en .env');
}

const ORDS_BASE_CLEAN = ORDS_BASE.replace(/\/$/, '');
const TOKEN_URL = `${ORDS_BASE_CLEAN}/oauth/token`;

// Cache del token en memoria — evita pedir uno nuevo en cada request.
// Los tokens de ORDS Client Credentials expiran en 3600s (1h) por defecto.
let cachedToken = null;
let tokenExpiresAt = 0;

async function fetchNewToken() {
  const clientAuth = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: clientAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok || !data?.access_token) {
    const error = new Error(data?.error_description || data?.error || `No se pudo obtener token OAuth2 de ORDS (${response.status})`);
    error.status = response.status;
    throw error;
  }

  cachedToken = data.access_token;
  // Renovamos 60s antes de que expire de verdad, para no arriesgar un 401 por margen de reloj.
  const ttlMs = (data.expires_in || 3600) * 1000;
  tokenExpiresAt = Date.now() + ttlMs - 60_000;

  return cachedToken;
}

async function getValidToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return fetchNewToken();
}

function buildUrl(path) {
  return `${ORDS_BASE_CLEAN}${path}`;
}

async function ordsRequest(method, path, body, isRetry = false) {
  const token = await getValidToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Si el token fue revocado/expiró antes de tiempo, reintentamos una vez con un token fresco.
  if (response.status === 401 && !isRetry) {
    cachedToken = null;
    return ordsRequest(method, path, body, true);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || `Error ORDS ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }

  return data;
}

const ordsGet = (path) => ordsRequest('GET', path);
const ordsPost = (path, body) => ordsRequest('POST', path, body);
const ordsPut = (path, body) => ordsRequest('PUT', path, body);
const ordsDelete = (path) => ordsRequest('DELETE', path);

module.exports = { ordsGet, ordsPost, ordsPut, ordsDelete };
