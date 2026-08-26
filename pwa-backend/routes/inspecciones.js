const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');
const {
  createInspeccionOutbox,
  getInspeccionesOutboxBySolicitud,
  getInspeccionOutboxById,
  getArchivosPendientes,
  getArchivosConErrorBySolicitud,
} = require('../database');
const { procesarInspeccion, procesarArchivo } = require('../syncJob');

const ORACLE_ID_REGEX = /^[0-9A-F]{32}$/i;

const FLOW_INSPECCIONES_CREAR_URL = process.env.FLOW_INSPECCIONES_CREAR_URL;
const FLOW_INSPECCIONES_LISTAR_URL = process.env.FLOW_INSPECCIONES_LISTAR_URL;
const INSPECCIONES_CACHE_TTL_MS = parseInt(process.env.INSPECCIONES_CACHE_TTL_MS || '10000', 10);
const inspeccionesCache = new Map();

async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling inspecciones flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

function getCacheEntry(cacheKey) {
  const entry = inspeccionesCache.get(cacheKey);
  if (!entry) return null;
  if (entry.data && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCacheEntry(cacheKey, data) {
  inspeccionesCache.set(cacheKey, { data, expiresAt: Date.now() + INSPECCIONES_CACHE_TTL_MS });
}

function invalidateInspeccionesCache(solicitudId) {
  if (solicitudId) { inspeccionesCache.delete(String(solicitudId)); return; }
  inspeccionesCache.clear();
}

function mapInspeccionItem(item) {
  const extractValue = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return field;
    if (field.Value !== undefined) return field.Value;
    return String(field);
  };
  const extractUser = (userField) => {
    if (!userField) return null;
    if (typeof userField === 'string') return userField;
    if (userField.DisplayName) return userField.DisplayName;
    if (userField.Title) return userField.Title;
    return null;
  };
  const extractUserEmail = (userField) => {
    if (!userField) return null;
    if (typeof userField === 'string') return userField;
    if (userField.Email) return userField.Email;
    return null;
  };

  let fecha;
  try { fecha = new Date(item.FechaInspeccion || item.Created); }
  catch (e) { fecha = new Date(); }

  const dateStr = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  let status = 'conforme';
  const estadoInspeccion = extractValue(item.EstadoInspeccion) || '';
  if (estadoInspeccion === 'No Conforme') status = 'no-conforme';
  else if (estadoInspeccion.includes('Observacion')) status = 'observaciones';

  const desfaseRaw = item.Desfase;
  let desfase = null;
  if (desfaseRaw != null) {
    const val = String(desfaseRaw).trim();
    if (val === '1' || val === 'true') desfase = '1';
    else if (val === '0' || val === 'false') desfase = '0';
  }

  return {
    id: String(item.ID || item.Id || Date.now()),
    date: `${dateStr} - ${timeStr}`,
    type: extractValue(item.TipoInspeccion) || 'Sin tipo',
    progress: Number(item.PorcentajeAvance) || 0,
    status,
    observations: String(item.ObservacionesInspeccion || ''),
    solicitudId: Number(item.SolicitudId),
    codigoSolicitud: String(item.CodigoSolicitud || ''),
    inspector: extractUser(item.Inspector) || String(item.InspectorNombre || item.Inspector || ''),
    inspectorEmail: extractUserEmail(item.Inspector) || String(item.InspectorEmail || ''),
    cantidadFotos: Number(item.CantidadFotos) || 0,
    solicitaParalizacion: Boolean(item.SolicitaParalizacion),
    estadoParalizacion: extractValue(item.EstadoParalizacion),
    observacionesAvance: String(item.ObservacionesAvance || ''),
    motivoParalizacion: String(item.MotivoParalizacion || ''),
    latitud: String(item.Latitud || ''),
    longitud: String(item.Longitud || ''),
    desfase,
    fechaCreacion: item.Created || null,
    fechaInspeccion: item.FechaInspeccion || null,
  };
}

/**
 * Mapea una fila de Oracle (inspecciones_outbox) al mismo shape que
 * mapInspeccionItem produce para SharePoint — el frontend consume ambas
 * indistintamente. El payload ya está en camelCase (lo armamos nosotros
 * al crear), a diferencia del PascalCase que devuelve SharePoint.
 */
function mapInspeccionOutboxToItem(inspeccionOutbox) {
  const { id, payload, estado, intentos } = inspeccionOutbox;
  const fecha = payload.fechaInspeccion ? new Date(payload.fechaInspeccion) : new Date();
  const dateStr = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  let status = 'conforme';
  if (payload.estadoInspeccion === 'No Conforme') status = 'no-conforme';
  else if (String(payload.estadoInspeccion || '').includes('Observacion')) status = 'observaciones';

  return {
    id: `outbox-${id}`, // prefijo para no chocar con ids reales de SharePoint
    date: `${dateStr} - ${timeStr}`,
    type: payload.tipoInspeccion || 'Sin tipo',
    progress: Number(payload.porcentajeAvance) || 0,
    status,
    observations: String(payload.observacionesInspeccion || ''),
    solicitudId: Number(payload.solicitudId),
    codigoSolicitud: String(payload.codigoSolicitud || ''),
    inspector: payload.inspectorNombre || '',
    inspectorEmail: payload.inspectorEmail || '',
    cantidadFotos: Number(payload.cantidadFotos) || 0,
    solicitaParalizacion: Boolean(payload.solicitaParalizacion),
    estadoParalizacion: null,
    observacionesAvance: String(payload.observacionesAvance || ''),
    motivoParalizacion: String(payload.motivoParalizacion || ''),
    latitud: String(payload.latitud || ''),
    longitud: String(payload.longitud || ''),
    desfase: null,
    fechaCreacion: null,
    fechaInspeccion: payload.fechaInspeccion || null,
    // ── Campos exclusivos del outbox — no existen en inspecciones de SharePoint ──
    estadoSync: estado, // 'pendiente' | 'error'
    intentosSync: intentos,
    oracleId: id,
  };
}

/**
 * GET /api/inspecciones/solicitud/:solicitudId
 */
router.get('/solicitud/:solicitudId', verifyToken, async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const userEmail = req.user?.email;

    console.log(`📋 GET /api/inspecciones/solicitud/${solicitudId} - Usuario: ${userEmail}`);

    if (isNaN(solicitudId)) {
      return res.status(400).json({ success: false, error: 'Invalid solicitudId' });
    }
    if (!FLOW_INSPECCIONES_LISTAR_URL) {
      return res.status(500).json({ success: false, error: 'Flow URL not configured' });
    }

    const normalizedId = parseInt(solicitudId, 10);
    const cacheKey = String(normalizedId);
    const cached = getCacheEntry(cacheKey);
    if (cached) return res.json(cached);

    const result = await callFlow(FLOW_INSPECCIONES_LISTAR_URL, { solicitudId: normalizedId });
    const inspeccionesSharePoint = Array.isArray(result.data) ? result.data.map(mapInspeccionItem) : [];

    // Fusionar con las que aún no llegan a SharePoint (pendiente/error) — evita duplicados
    // porque getInspeccionesOutboxBySolicitud solo trae lo que NO está 'enviado'.
    let inspeccionesOutbox = [];
    try {
      const outbox = await getInspeccionesOutboxBySolicitud(normalizedId);
      inspeccionesOutbox = outbox.map(mapInspeccionOutboxToItem);
    } catch (outboxError) {
      console.error('⚠️  No se pudieron obtener inspecciones pendientes de Oracle:', outboxError.message);
      // No bloquea el listado principal — el usuario igual ve las de SharePoint.
    }

    let inspecciones = [...inspeccionesOutbox, ...inspeccionesSharePoint];

    // Marcar inspecciones con archivos (fotos/informes) que fallaron al
    // subir por separado — para que el badge de error y el botón de
    // reintentar cubran también este caso, no solo la inspección misma.
    try {
      const archivosConError = await getArchivosConErrorBySolicitud(normalizedId);
      if (archivosConError.length > 0) {
        const sharepointIdsConError = new Set(archivosConError.map((a) => a.sharepointInspeccionId));
        inspecciones = inspecciones.map((insp) => {
          const tieneArchivoConError = sharepointIdsConError.has(String(insp.id));
          if (!tieneArchivoConError) return insp;
          return { ...insp, estadoSync: insp.estadoSync || 'error' };
        });
      }
    } catch (archivosError) {
      console.error('⚠️  No se pudieron obtener archivos con error:', archivosError.message);
    }

    console.log(`✅ ${inspeccionesSharePoint.length} inspecciones de SharePoint + ${inspeccionesOutbox.length} pendientes de Oracle para solicitud ${solicitudId}`);

    const payload = { success: true, solicitudId: normalizedId, count: inspecciones.length, data: inspecciones };
    setCacheEntry(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error(`❌ Error fetching inspecciones:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch inspecciones', message: error.message });
  }
});

/**
 * POST /api/inspecciones
 *
 * Acepta usuariosNotificar: [{ id, nombre, correo }]
 * Se envía al flow junto con el resto del payload.
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      solicitudId,
      codigoSolicitud,
      tipoInspeccion,
      fechaInspeccion,
      porcentajeAvance,
      estadoInspeccion,
      observacionesAvance,
      observacionesInspeccion,
      solicitarParalizacion,
      motivoParalizacion,
      cantidadFotos,
      latitud,
      longitud,
      usuariosNotificar,  // [{ id, nombre, correo }] — opcional
    } = req.body;

    const userEmail = req.user?.email;
    const userNombre = req.user?.nombre;

    console.log(`📝 POST /api/inspecciones - Solicitud ${solicitudId} - Usuario: ${userEmail}`);

    if (!solicitudId || !tipoInspeccion || !estadoInspeccion || typeof porcentajeAvance !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios',
        message: 'solicitudId, tipoInspeccion, estadoInspeccion y porcentajeAvance son requeridos',
      });
    }

    if (porcentajeAvance < 0 || porcentajeAvance > 100) {
      return res.status(400).json({ success: false, error: 'Porcentaje inválido' });
    }

    if (estadoInspeccion === 'No Conforme' && (!observacionesInspeccion || observacionesInspeccion.trim().length < 10)) {
      return res.status(400).json({ success: false, error: 'Observaciones requeridas' });
    }

    let fechaFinal;
    if (fechaInspeccion) {
      const parsed = new Date(fechaInspeccion);
      fechaFinal = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } else {
      fechaFinal = new Date().toISOString();
    }

    // Normalizar array de usuarios — tolera undefined o null
    const notificar = Array.isArray(usuariosNotificar)
        ? usuariosNotificar
            .filter(u => u && u.correo)
            .map(u => ({
              id: u.id ?? null,
              nombre: String(u.nombre || '').trim(),
              correo: String(u.correo).trim(),
            }))
        : [];

    if (notificar.length > 0) {
      console.log(`📧 Notificando a ${notificar.length} usuario(s): ${notificar.map(u => u.correo).join(', ')}`);
    }

    const payload = {
      solicitudId: parseInt(solicitudId),
      codigoSolicitud: codigoSolicitud || '',
      tipoInspeccion,
      fechaInspeccion: fechaFinal,
      inspectorEmail: userEmail || '',
      inspectorNombre: userNombre || '',
      porcentajeAvance: parseInt(porcentajeAvance),
      estadoInspeccion,
      observacionesAvance: observacionesAvance || '',
      observacionesInspeccion: observacionesInspeccion || '',
      solicitaParalizacion: solicitarParalizacion || false,
      motivoParalizacion: motivoParalizacion || '',
      cantidadFotos: parseInt(cantidadFotos) || 0,
      dispositivo: req.headers['user-agent'] || 'Unknown',
      appVersion: req.headers['x-app-version'] || '1.0.0',
      latitud: latitud || '',
      longitud: longitud || '',
      // ── Notificaciones ──────────────────────────────────────
      usuariosNotificar: notificar,
      cantidadNotificados: notificar.length,
    };

    const oracleId = await createInspeccionOutbox({ solicitudId: parseInt(solicitudId), payload });
    invalidateInspeccionesCache(solicitudId);

    console.log(`✅ Inspección guardada en Oracle (pendiente de sync) con ID: ${oracleId}`);
    res.status(201).json({
      success: true,
      data: { id: oracleId, estadoSync: 'pendiente' },
    });

  } catch (error) {
    console.error(`❌ Error creando inspección:`, error);
    res.status(500).json({ success: false, error: 'Failed to create inspection', message: error.message });
  }
});

/**
 * POST /api/inspecciones/:id/reintentar
 *
 * Reintenta manualmente el envío a SharePoint de una inspección y/o sus
 * archivos que hayan quedado en estado 'error'. Un solo botón para todo
 * lo pendiente de esa inspección (no hay reintento granular por archivo).
 * Sincroniza en el mismo request — no espera al próximo ciclo del job.
 *
 * :id puede ser el oracleId (inspección todavía en la cola de Oracle) o
 * el id de SharePoint (inspección vieja que ya sincronizó, pero tiene
 * archivos con error pendientes de reintentar).
 */
router.post('/:id/reintentar', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔁 POST /api/inspecciones/${id}/reintentar - Usuario: ${req.user?.email}`);

    const esOracleId = ORACLE_ID_REGEX.test(id);
    let solicitudId = null;
    let sharepointInspeccionId = esOracleId ? null : id;
    const mensajes = [];
    let huboError = false;

    if (esOracleId) {
      const inspeccion = await getInspeccionOutboxById(id);
      if (!inspeccion) {
        return res.status(404).json({ success: false, error: 'Inspección no encontrada en la cola de sincronización' });
      }
      solicitudId = inspeccion.solicitudId;

      if (inspeccion.estado === 'enviado' && inspeccion.sharepointId) {
        // Ya está en SharePoint — no volver a llamar al flow de creación
        // (eso duplicaría la inspección). Solo quedan archivos por reintentar.
        sharepointInspeccionId = inspeccion.sharepointId;
      } else {
        const resultado = await procesarInspeccion(inspeccion);
        mensajes.push(resultado.mensaje);
        if (!resultado.success) huboError = true;
        else sharepointInspeccionId = resultado.sharepointId;
      }
    }

    // Archivos con error asociados a esta inspección (por oracleId recién
    // sincronizado, o directo por sharepointInspeccionId si ya lo era).
    if (sharepointInspeccionId) {
      const pendientes = await getArchivosPendientes();
      const archivosDeEstaInspeccion = pendientes.filter(
        (a) => a.sharepointInspeccionId === sharepointInspeccionId
      );
      for (const archivo of archivosDeEstaInspeccion) {
        const resultadoArchivo = await procesarArchivo(archivo);
        if (!resultadoArchivo.success) {
          huboError = true;
          mensajes.push(`${archivo.fileName}: ${resultadoArchivo.mensaje}`);
        }
      }
    }

    if (solicitudId) invalidateInspeccionesCache(solicitudId);

    if (huboError) {
      return res.status(502).json({ success: false, error: 'No se pudo sincronizar todo', message: mensajes.filter(Boolean).join(' | ') });
    }
    res.json({ success: true, message: mensajes.filter(Boolean).join(' | ') || 'Sincronizado correctamente.' });
  } catch (error) {
    console.error('❌ Error reintentando inspección:', error);
    res.status(500).json({ success: false, error: 'Failed to retry inspection', message: error.message });
  }
});

module.exports = router;
