const axios = require('axios');
const jwt = require('jsonwebtoken');

// Nueva API directa a SharePoint (reemplaza los flows de Power Automate,
// ver spec 13). URL y secreto SOLO en variables de entorno — nunca en el
// repo ni en el frontend. El JWT se genera acá, server-side, por request.
const SHAREPOINT_API_URL = process.env.SHAREPOINT_API_URL;
const SHAREPOINT_API_SECRET = process.env.SHAREPOINT_API_SECRET;

const API_TIMEOUT_MS = parseInt(process.env.API_EVENTO_TIMEOUT_MS || '90000', 10);

// La API nueva manda AccionesHabilitadas como objetos completos en TODOS
// los endpoints (Inicio, Detalle, y la respuesta del evento) — a diferencia
// de la vieja, que en Inicio mandaba solo códigos. El resto del código
// (frontend y la validación de seguridad acá mismo) asume array de
// strings, así que normalizamos acá, en el único punto de entrada.
function normalizarAccionesHabilitadas(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map((a) => (typeof a === 'string' ? a : a?.Codigo)).filter(Boolean);
}

// Cada acción habilitada trae el tipo de inspección que le corresponde
// (TipoInspeccionId/Nombre). Como arriba reducimos las acciones a códigos,
// conservamos ese dato aparte: { CODIGO: { TipoInspeccionId, TipoInspeccionNombre } }.
// El formulario de inspección lo usa para ofrecer solo los tipos permitidos
// y deducir el TipoEvento (ej. obra paralizada → un solo tipo posible).
function mapaTiposAccion(lista) {
  const mapa = {};
  if (!Array.isArray(lista)) return mapa;
  for (const a of lista) {
    if (a && typeof a === 'object' && a.Codigo && a.TipoInspeccionId != null) {
      mapa[a.Codigo] = {
        TipoInspeccionId: Number(a.TipoInspeccionId),
        TipoInspeccionNombre: a.TipoInspeccionNombre ?? '',
      };
    }
  }
  return mapa;
}

// Definición COMPLETA de cada acción habilitada (banderas Requiere* y tipos de
// documento). La API la manda fresca en cada carga de las obras (sin caché),
// a diferencia del catálogo, cuya versión solo cuenta elementos y NO cambia
// cuando cambia su contenido (ej. OBRA_FINALIZADA pasó a exigir adjunto y la
// versión siguió igual). Como reducimos las acciones a códigos, conservamos la
// definición aparte: { CODIGO: { RequiereComentario, RequiereAdjunto, ... } }.
function mapaDefinicionesAccion(lista) {
  const mapa = {};
  if (!Array.isArray(lista)) return mapa;
  for (const a of lista) {
    if (a && typeof a === 'object' && a.Codigo) {
      mapa[a.Codigo] = {
        RequiereComentario: !!a.RequiereComentario,
        RequiereAdjunto: !!a.RequiereAdjunto,
        RequiereAvance: !!a.RequiereAvance,
        TiposDocumento: Array.isArray(a.TiposDocumento) ? a.TiposDocumento : [],
      };
      // Requisitos nuevos (`Requiere…`) que la API agregue: se conservan tal cual para que el frontend los detecte.
      for (const clave of Object.keys(a)) {
        if (clave.startsWith('Requiere') && !(clave in mapa[a.Codigo])) mapa[a.Codigo][clave] = a[clave];
      }
    }
  }
  return mapa;
}

function generarToken(email, nombre) {
  if (!SHAREPOINT_API_SECRET) {
    throw new Error('SHAREPOINT_API_SECRET no configurada');
  }
  return jwt.sign({ email, nombre }, SHAREPOINT_API_SECRET, {
    algorithm: 'HS256',
    expiresIn: '8h',
  });
}

async function callApi(method, path, { usuario, nombre, data, headers = {} }) {
  if (!SHAREPOINT_API_URL) {
    throw new Error('SHAREPOINT_API_URL no configurada');
  }
  const token = generarToken(usuario, nombre);
  return axios.request({
    method,
    url: `${SHAREPOINT_API_URL}${path}`,
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: API_TIMEOUT_MS,
    maxBodyLength: 20 * 1024 * 1024,
    maxContentLength: 20 * 1024 * 1024,
    // No lanzar por 4xx: son respuestas de negocio que hay que leer
    // (403 ACCION_NO_PERMITIDA, 404 USUARIO_NO_ENCONTRADO, etc.).
    validateStatus: (status) => status < 500,
  });
}

/**
 * GET /v1/mobile/inicio — carga inicial. Devuelve obras del usuario ya
 * filtradas + catálogo + acciones habilitadas por obra.
 */
async function obtenerInicio({ usuario, nombre, catalogosVersion = '' }) {
  const headers = catalogosVersion ? { 'X-Catalogos-Version': catalogosVersion } : {};
  const response = await callApi('get', '/v1/mobile/inicio', { usuario, nombre, headers });
  const body = response.data || {};

  if (response.status === 404 || body.error?.code === 'USUARIO_NO_ENCONTRADO') {
    const err = new Error(body.error?.message || 'USUARIO_NO_ENCONTRADO');
    err.status = 404;
    err.code = 'USUARIO_NO_ENCONTRADO';
    throw err;
  }
  if (response.status >= 400 || body.success === false) {
    const err = new Error(body.error?.message || `Error API Inicio (${response.status})`);
    err.status = response.status;
    err.code = body.error?.code;
    throw err;
  }
  // La API envuelve la respuesta en {success, data}; desenvolvemos para
  // mantener el mismo shape que ya consume inicioService.js.
  const data = body.data || {};
  if (Array.isArray(data.Solicitudes)) {
    data.Solicitudes = data.Solicitudes.map((obra) => ({
      ...obra,
      AccionesTipo: mapaTiposAccion(obra.AccionesHabilitadas),
      AccionesDef: mapaDefinicionesAccion(obra.AccionesHabilitadas),
      AccionesHabilitadas: normalizarAccionesHabilitadas(obra.AccionesHabilitadas),
    }));
  }
  return data;
}

/**
 * GET /v1/solicitudes/{id} — detalle de una obra (inspecciones, fotos,
 * documentos). Antes no existía ("API_Detalle"); se usa desde la Etapa B
 * para completar el detalle híbrido.
 */
async function obtenerDetalleSolicitud({ usuario, nombre, solicitudId }) {
  const response = await callApi('get', `/v1/solicitudes/${solicitudId}`, { usuario, nombre });
  const body = response.data || {};

  if (response.status === 404) {
    const err = new Error(body.error?.message || 'SOLICITUD_NO_ENCONTRADA');
    err.status = 404;
    err.code = body.error?.code;
    throw err;
  }
  if (response.status >= 400 || body.success === false) {
    const err = new Error(body.error?.message || `Error API Detalle (${response.status})`);
    err.status = response.status;
    err.code = body.error?.code;
    throw err;
  }
  const data = body.data || {};
  if (data.AccionesHabilitadas) {
    data.AccionesTipo = mapaTiposAccion(data.AccionesHabilitadas);
    data.AccionesDef = mapaDefinicionesAccion(data.AccionesHabilitadas);
    data.AccionesHabilitadas = normalizarAccionesHabilitadas(data.AccionesHabilitadas);
  }
  if (data.Solicitud?.AccionesHabilitadas) {
    data.Solicitud.AccionesHabilitadas = normalizarAccionesHabilitadas(data.Solicitud.AccionesHabilitadas);
  }
  return data;
}

/**
 * GET /v1/inspecciones/{id} — detalle completo de UNA inspección: comentario,
 * lat/lng, SolicitaParalizacion, fotos y documentos. El detalle de obra ya
 * no los trae (solo un resumen + CantidadFotos), se piden aparte y en
 * segundo plano desde el frontend.
 */
async function obtenerInspeccion({ usuario, nombre, inspeccionId }) {
  const response = await callApi('get', `/v1/inspecciones/${inspeccionId}`, { usuario, nombre });
  const body = response.data || {};

  if (response.status === 404) {
    const err = new Error(body.error?.message || 'INSPECCION_NO_ENCONTRADA');
    err.status = 404;
    err.code = body.error?.code;
    throw err;
  }
  if (response.status >= 400 || body.success === false) {
    const err = new Error(body.error?.message || `Error API Inspección (${response.status})`);
    err.status = response.status;
    err.code = body.error?.code;
    throw err;
  }
  return body.data || {};
}

/**
 * Devuelve las AccionesHabilitadas (códigos) de UNA obra para un usuario,
 * consultando la fuente de verdad (API_Inicio) — se usa para RE-VALIDAR en
 * el backend que una acción enviada esté realmente permitida, sin confiar
 * en lo que dice el frontend (que es manipulable). Ver spec 10, seguridad.
 *
 * Devuelve null si la obra no está en la lista del usuario (no tiene
 * acceso a esa obra) — el llamador debe tratar eso como no autorizado.
 */
async function obtenerAccionesHabilitadas({ usuario, nombre, solicitudId }) {
  const data = await obtenerInicio({ usuario, nombre, catalogosVersion: 'x' });
  const obras = Array.isArray(data?.Solicitudes) ? data.Solicitudes : [];
  const obra = obras.find((o) => Number(o.Id) === Number(solicitudId));
  if (!obra) return null;
  return Array.isArray(obra.AccionesHabilitadas) ? obra.AccionesHabilitadas : [];
}

/**
 * Obra tal como la ve este usuario en API_Inicio (avance, estado…), o null si no la ve.
 * Lo usa la validación server-side de «Finalizar obra».
 */
async function obtenerObraInicio({ usuario, nombre, solicitudId }) {
  const data = await obtenerInicio({ usuario, nombre, catalogosVersion: 'x' });
  const obras = Array.isArray(data?.Solicitudes) ? data.Solicitudes : [];
  return obras.find((o) => Number(o.Id) === Number(solicitudId)) || null;
}

/**
 * POST /v1/solicitudes/{id}/eventos — registra un evento (escritura).
 * Idempotente por EventoIdExterno: reintentos con el mismo id no duplican.
 *
 * Devuelve un resultado normalizado para el sync job:
 *   { ok, duplicado, accionNoPermitida, data, mensaje }
 */
async function registrarEvento({ usuario, nombre, solicitudId, evento }) {
  const response = await callApi('post', `/v1/solicitudes/${solicitudId}/eventos`, {
    usuario,
    nombre,
    data: evento,
  });
  const body = response.data || {};

  // 403 ACCION_NO_PERMITIDA: otra persona movió la obra. No es reintentable
  // — el frontend debe recargar. Se distingue del resto para no reintentar.
  if (response.status === 403) {
    return {
      ok: false,
      accionNoPermitida: true,
      data: body.data,
      mensaje: body.error?.message || 'La acción no corresponde al estado actual de la obra.',
    };
  }

  if (response.status >= 400 || body.success === false) {
    return {
      ok: false,
      data: body.data,
      mensaje: body.error?.message || `Error API Evento (${response.status})`,
      code: body.error?.code,
    };
  }

  const data = body.data || {};
  if (data.AccionesHabilitadas) {
    data.AccionesTipo = mapaTiposAccion(data.AccionesHabilitadas);
    data.AccionesDef = mapaDefinicionesAccion(data.AccionesHabilitadas);
    data.AccionesHabilitadas = normalizarAccionesHabilitadas(data.AccionesHabilitadas);
  }
  // 200 con duplicado:true → el evento ya estaba registrado. Es éxito.
  return {
    ok: true,
    duplicado: data.duplicado === true,
    data,
    mensaje: data.Mensaje || 'Evento registrado.',
  };
}

module.exports = {
  obtenerInicio,
  obtenerDetalleSolicitud,
  obtenerInspeccion,
  obtenerAccionesHabilitadas,
  obtenerObraInicio,
  registrarEvento,
};
