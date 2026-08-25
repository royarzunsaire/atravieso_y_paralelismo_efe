const { ordsGet, ordsPost } = require('./oracle');

function mapUsuarioRow(row) {
  if (!row) return null;
  // ORDS devuelve id (RAW) como Base64 en el JSON, pero espera hex en la URL del path.
  // Normalizamos siempre a hex para poder usarlo en GET/PUT/DELETE /usuarios/{id}.
  const idHex = row.id ? Buffer.from(row.id, 'base64').toString('hex').toUpperCase() : row.id;
  return {
    id: idHex,
    email: row.email,
    password: row.password,
    nombre: row.nombre,
    rol: row.rol,
    auth_type: row.auth_type,
    activo: row.activo === 1 || row.activo === true,
    created_at: row.created_at,
    last_login: row.last_login,
  };
}

async function findOneByQuery(query) {
  const q = encodeURIComponent(JSON.stringify(query));
  const data = await ordsGet(`/usuarios/?q=${q}`);
  const row = data?.items?.[0];
  return mapUsuarioRow(row || null);
}

async function getUserByEmail(email) {
  return findOneByQuery({ email: { $eq: email } });
}

async function getUserById(id) {
  const row = await ordsGet(`/usuarios/${id}`);
  return mapUsuarioRow(row);
}

async function getLocalActiveUserByEmail(email) {
  return findOneByQuery({
    email: { $eq: email },
    auth_type: { $eq: 'local' },
    activo: { $eq: 1 },
  });
}

async function updateUserLastLogin(id) {
  // No se envía la fecha por JSON: ORDS rompe (bug interno) el parseo de TIMESTAMP
  // con timezone en PUT/POST. El endpoint fija last_login = CURRENT_TIMESTAMP en Oracle.
  await ordsPost(`/usuarios-actions/${id}/last-login`);
  return getUserById(id);
}

async function updateUserPassword(id, hashedPassword) {
  await ordsPost(`/usuarios-actions/${id}/change-password`, {
    password: hashedPassword,
  });
  return getUserById(id);
}

async function createLocalUser({ email, password, nombre, rol = 'usuario' }) {
  // INSERT vía PL/SQL manual: AutoREST POST inserta bien pero ORDS truena (500)
  // al serializar la respuesta con el created_at que pone el trigger.
  const result = await ordsPost('/usuarios-actions/register', {
    email,
    password,
    nombre,
    rol,
  });
  return getUserById(result.id_out);
}

// ============================================================
// Inspecciones — outbox (Oracle → SharePoint asíncrono)
// ============================================================

async function createInspeccionOutbox({ solicitudId, payload, archivos = [] }) {
  const result = await ordsPost('/inspecciones-actions/guardar', {
    solicitud_id: solicitudId,
    payload_json: JSON.stringify(payload),
    archivos_json: archivos.length > 0 ? JSON.stringify(archivos) : null,
  });
  return result.id_out;
}

function mapInspeccionOutboxRow(item) {
  if (!item) return null;
  return {
    id: item.id,
    solicitudId: item.solicitud_id,
    payload: JSON.parse(item.payload_json),
    estado: item.estado,
    intentos: item.intentos,
    archivos: item.archivos ? JSON.parse(item.archivos) : [],
  };
}

async function getInspeccionesPendientes() {
  const data = await ordsGet('/inspecciones-actions/pendientes');
  const items = data?.items || [];
  return items.map(mapInspeccionOutboxRow);
}

async function getInspeccionOutboxById(id) {
  const data = await ordsGet(`/inspecciones-actions/${id}`);
  const item = data?.items?.[0];
  return mapInspeccionOutboxRow(item || null);
}

async function getInspeccionesOutboxBySolicitud(solicitudId) {
  // No reutiliza getInspeccionesPendientes(): esa acción filtra intentos<3
  // porque es para que el sync job sepa qué reintentar. Una inspección con
  // 3 intentos (error terminal) debe seguir siendo visible para el usuario
  // (badge de error + botón reintentar), aunque el job ya no la reintente sola.
  const data = await ordsGet(`/inspecciones-actions/por-solicitud/${solicitudId}`);
  const items = data?.items || [];
  return items.map(mapInspeccionOutboxRow);
}

async function marcarResultadoInspeccion(id, { resultado, sharepointId = null, mensaje = '' }) {
  await ordsPost(`/inspecciones-actions/${id}/marcar-resultado`, {
    resultado,
    sharepoint_id: sharepointId,
    mensaje: mensaje.slice(0, 4000),
  });
}

module.exports = {
  getUserByEmail,
  getUserById,
  getLocalActiveUserByEmail,
  updateUserLastLogin,
  updateUserPassword,
  createLocalUser,
  createInspeccionOutbox,
  getInspeccionesPendientes,
  getInspeccionOutboxById,
  getInspeccionesOutboxBySolicitud,
  marcarResultadoInspeccion,
};
