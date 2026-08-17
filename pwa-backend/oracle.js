require('dotenv').config();

const ORDS_BASE = process.env.ORACLE_ORDS_URL;
const ORDS_USER = process.env.ORACLE_USER;
const ORDS_PASS = process.env.ORACLE_PASSWORD;

if (!ORDS_BASE || !ORDS_USER || !ORDS_PASS) {
  throw new Error('Faltan ORACLE_ORDS_URL, ORACLE_USER o ORACLE_PASSWORD en .env');
}

const authHeader = 'Basic ' + Buffer.from(`${ORDS_USER}:${ORDS_PASS}`).toString('base64');

function buildUrl(path) {
  return `${ORDS_BASE.replace(/\/$/, '')}${path}`;
}

async function ordsRequest(method, path, body) {
  const headers = {
    Authorization: authHeader,
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
