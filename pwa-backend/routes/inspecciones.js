const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

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
  inspeccionesCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + INSPECCIONES_CACHE_TTL_MS,
  });
}

function invalidateInspeccionesCache(solicitudId) {
  if (solicitudId) {
    inspeccionesCache.delete(String(solicitudId));
    return;
  }
  inspeccionesCache.clear();
}

/**
 * Mapear inspección de SharePoint a formato frontend.
 * Incluye el campo "desfase" (booleano) y todos los campos previos.
 */
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
  try {
    fecha = new Date(item.FechaInspeccion || item.Created);
  } catch {
    fecha = new Date();
  }

  const dateStr = fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = fecha.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let status = 'conforme';
  const estadoInspeccion = extractValue(item.EstadoInspeccion) || '';
  if (estadoInspeccion === 'No Conforme') {
    status = 'no-conforme';
  } else if (estadoInspeccion.includes('Observacion')) {
    status = 'observaciones';
  }

  const inspectorNombre =
      extractUser(item.Inspector) || String(item.InspectorNombre || item.Inspector || '');
  const inspectorEmail =
      extractUserEmail(item.Inspector) || String(item.InspectorEmail || '');

  // Campo Desfase: puede venir como booleano directo (Yes/No de SharePoint)
  // o como string 'Sí'/'No'/'Yes'/'No'
  const rawDesfase = item.Desfase;
  const desfase =
      rawDesfase === true ||
      rawDesfase === 'Sí' ||
      rawDesfase === 'Si' ||
      rawDesfase === 'Yes' ||
      rawDesfase === '1' ||
      rawDesfase === 1;

  return {
    id: String(item.ID || item.Id || Date.now()),
    date: `${dateStr} - ${timeStr}`,
    type: extractValue(item.TipoInspeccion) || 'Sin tipo',
    progress: Number(item.PorcentajeAvance) || 0,
    status,
    observations: String(item.ObservacionesInspeccion || ''),

    solicitudId: Number(item.SolicitudId),
    codigoSolicitud: String(item.CodigoSolicitud || ''),
    inspector: inspectorNombre,
    inspectorEmail,
    cantidadFotos: Number(item.CantidadFotos) || 0,
    desfase,                                               // ← NUEVO
    solicitaParalizacion: Boolean(item.SolicitaParalizacion),
    estadoParalizacion: extractValue(item.EstadoParalizacion),
    observacionesAvance: String(item.ObservacionesAvance || ''),
    motivoParalizacion: String(item.MotivoParalizacion || ''),
    latitud: String(item.Latitud || ''),
    longitud: String(item.Longitud || ''),
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
      return res.status(400).json({
        success: false,
        error: 'Invalid solicitudId',
        message: 'solicitudId must be a number',
      });
    }

    if (!FLOW_INSPECCIONES_LISTAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_INSPECCIONES_LISTAR_URL is missing in .env',
      });
    }

    const normalizedSolicitudId = parseInt(solicitudId, 10);
    const cacheKey = String(normalizedSolicitudId);
    const cachedResult = getCacheEntry(cacheKey);

    if (cachedResult) {
      return res.json(cachedResult);
    }

    const result = await callFlow(FLOW_INSPECCIONES_LISTAR_URL, {
      solicitudId: normalizedSolicitudId,
    });

    const inspecciones = Array.isArray(result.data)
        ? result.data.map(mapInspeccionItem)
        : [];

    console.log(`✅ ${inspecciones.length} inspecciones obtenidas para solicitud ${solicitudId}`);

    const responsePayload = {
      success: true,
      solicitudId: normalizedSolicitudId,
      count: inspecciones.length,
      data: inspecciones,
    };

    setCacheEntry(cacheKey, responsePayload);
    res.json(responsePayload);

  } catch (error) {
    console.error(`❌ Error fetching inspecciones for solicitud ${req.params.solicitudId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inspecciones',
      message: error.message,
    });
  }
});

/**
 * POST /api/inspecciones
 * Acepta fechaInspeccion desde el cliente (fecha elegida por el usuario).
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      solicitudId,
      codigoSolicitud,
      tipoInspeccion,
      fechaInspeccion,       // ← ahora viene del cliente
      porcentajeAvance,
      estadoInspeccion,
      observacionesAvance,
      observacionesInspeccion,
      solicitarParalizacion,
      motivoParalizacion,
      cantidadFotos,
      latitud,
      longitud,
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
      return res.status(400).json({
        success: false,
        error: 'Porcentaje inválido',
        message: 'El porcentaje de avance debe estar entre 0 y 100',
      });
    }

    if (
        estadoInspeccion === 'No Conforme' &&
        (!observacionesInspeccion || observacionesInspeccion.trim().length < 10)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Observaciones requeridas',
        message: 'Las observaciones son obligatorias para inspecciones "No Conforme"',
      });
    }

    if (!FLOW_INSPECCIONES_CREAR_URL) {
      return res.status(500).json({ success: false, error: 'Flow URL not configured' });
    }

    // Usar la fecha elegida por el usuario; si no viene, usar ahora
    const fechaFinal =
        fechaInspeccion && !isNaN(new Date(fechaInspeccion).getTime())
            ? new Date(fechaInspeccion).toISOString()
            : new Date().toISOString();

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
    };

    const result = await callFlow(FLOW_INSPECCIONES_CREAR_URL, payload);

    invalidateInspeccionesCache(solicitudId);

    console.log(`✅ Inspección creada con ID: ${result.data?.id}`);
    res.status(201).json(result);

  } catch (error) {
    console.error('❌ Error creando inspección:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create inspection',
      message: error.message,
    });
  }
});

module.exports = router;
