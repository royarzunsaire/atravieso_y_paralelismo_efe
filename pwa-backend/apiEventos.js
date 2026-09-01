const axios = require('axios');

// URLs de las APIs unificadas del cliente (Power Automate). Llevan la
// clave de acceso en la URL (parámetro sig), por eso viven SOLO en
// variables de entorno del backend — nunca en el repo ni en el frontend.
const API_INICIO_URL = process.env.API_INICIO_URL;
const API_EVENTO_URL = process.env.API_EVENTO_URL;

// El MD indica 3-4s para un evento sin adjuntos; con archivos, más.
const API_TIMEOUT_MS = parseInt(process.env.API_EVENTO_TIMEOUT_MS || '90000', 10);

async function postApi(url, data) {
  const response = await axios.post(url, data, {
    headers: { 'Content-Type': 'application/json' },
    timeout: API_TIMEOUT_MS,
    maxBodyLength: 20 * 1024 * 1024,
    maxContentLength: 20 * 1024 * 1024,
    // No lanzar por 4xx: el 403 ACCION_NO_PERMITIDA es una respuesta de
    // negocio que hay que leer, no un error de transporte.
    validateStatus: (status) => status < 500,
  });
  return response;
}

/**
 * API_Mobile_Inicio — carga inicial. Devuelve obras del usuario ya
 * filtradas + catálogo + acciones habilitadas por obra.
 */
async function obtenerInicio({ usuario, catalogosVersion = '' }) {
  if (!API_INICIO_URL) {
    throw new Error('API_INICIO_URL no configurada');
  }
  const response = await postApi(API_INICIO_URL, {
    Usuario: usuario,
    CatalogosVersion: catalogosVersion,
  });

  if (response.status === 404) {
    const err = new Error(response.data?.error || 'USUARIO_NO_ENCONTRADO');
    err.status = 404;
    err.code = response.data?.error;
    throw err;
  }
  if (response.status >= 400) {
    const err = new Error(response.data?.error || `Error API Inicio (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return response.data;
}

/**
 * API_Evento_Obra_v2 — registra un evento (escritura). Idempotente por
 * eventoIdExterno: reintentos con el mismo id no duplican.
 *
 * Devuelve un resultado normalizado para el sync job:
 *   { ok, duplicado, accionNoPermitida, data, mensaje }
 */
async function registrarEvento(evento) {
  if (!API_EVENTO_URL) {
    throw new Error('API_EVENTO_URL no configurada');
  }

  const response = await postApi(API_EVENTO_URL, evento);
  const data = response.data || {};

  // 403 ACCION_NO_PERMITIDA: otra persona movió la obra. No es reintentable
  // — el frontend debe recargar. Se distingue del resto para no reintentar.
  if (response.status === 403) {
    return {
      ok: false,
      accionNoPermitida: true,
      data,
      mensaje: data.Mensaje || 'La acción no corresponde al estado actual de la obra.',
    };
  }

  if (response.status >= 400 || data.success === false) {
    return {
      ok: false,
      data,
      mensaje: data.Mensaje || data.error || `Error API Evento (${response.status})`,
    };
  }

  // 200 con duplicado:true → el evento ya estaba registrado. Es éxito.
  return {
    ok: true,
    duplicado: data.duplicado === true,
    data,
    mensaje: data.Mensaje || 'Evento registrado.',
  };
}

module.exports = { obtenerInicio, registrarEvento };
