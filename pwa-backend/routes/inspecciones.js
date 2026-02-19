const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_INSPECCIONES_CREAR_URL = process.env.FLOW_INSPECCIONES_CREAR_URL;
const FLOW_INSPECCIONES_LISTAR_URL = process.env.FLOW_INSPECCIONES_LISTAR_URL; // ← NUEVA

async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling inspecciones flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

/**
 * Mapear inspección de SharePoint a formato frontend
 * Maneja correctamente los campos de tipo Lookup y User que SharePoint retorna como objetos
 */
function mapInspeccionItem(item) {
  // Helper para extraer valores de campos lookup y choice
  const extractValue = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return field;
    if (field.Value !== undefined) return field.Value;
    return String(field);
  };

  // Helper NUEVO para extraer información de usuarios de SharePoint
  const extractUser = (userField) => {
    if (!userField) return null;
    if (typeof userField === 'string') return userField;
    
    // Si es un objeto de SharePoint User
    if (userField.DisplayName) return userField.DisplayName;
    if (userField.Title) return userField.Title;
    
    return null;
  };

  // Helper para extraer email de usuario
  const extractUserEmail = (userField) => {
    if (!userField) return null;
    if (typeof userField === 'string') return userField;
    
    if (userField.Email) return userField.Email;
    
    return null;
  };

  // Formatear fecha
  let fecha;
  try {
    fecha = new Date(item.FechaInspeccion || item.Created);
  } catch (e) {
    fecha = new Date();
  }

  const dateStr = fecha.toLocaleDateString('es-CL', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const timeStr = fecha.toLocaleTimeString('es-CL', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Determinar status
  let status = 'conforme';
  const estadoInspeccion = extractValue(item.EstadoInspeccion) || '';
  
  if (estadoInspeccion === 'No Conforme') {
    status = 'no-conforme';
  } else if (estadoInspeccion.includes('Observacion')) {
    status = 'observaciones';
  }

  // Extraer información del inspector
  // Primero intentamos con el campo expandido, luego con campos simples
  const inspectorNombre = extractUser(item.Inspector) || 
                         String(item.InspectorNombre || item.Inspector || '');
  
  const inspectorEmail = extractUserEmail(item.Inspector) || 
                        String(item.InspectorEmail || '');

  return {
    id: String(item.ID || item.Id || Date.now()),
    date: `${dateStr} - ${timeStr}`,
    type: extractValue(item.TipoInspeccion) || 'Sin tipo',
    progress: Number(item.PorcentajeAvance) || 0,
    status: status,
    observations: String(item.ObservacionesInspeccion || ''),
    
    // Campos adicionales
    solicitudId: Number(item.SolicitudId),
    codigoSolicitud: String(item.CodigoSolicitud || ''),
    inspector: inspectorNombre, // ← CORREGIDO: ahora extrae el DisplayName
    inspectorEmail: inspectorEmail, // ← CORREGIDO: ahora extrae el Email
    cantidadFotos: Number(item.CantidadFotos) || 0,
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
 * Obtener inspecciones de una solicitud
 */
router.get('/solicitud/:solicitudId', verifyToken, async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const userEmail = req.user?.email;
    
    console.log(`📋 GET /api/inspecciones/solicitud/${solicitudId} - Usuario: ${userEmail}`);
    
    // Validar que ID sea un número
    if (isNaN(solicitudId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid solicitudId',
        message: 'solicitudId must be a number',
      });
    }
    
    // Verificar que la URL del flow está configurada
    if (!FLOW_INSPECCIONES_LISTAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_INSPECCIONES_LISTAR_URL is missing in .env',
      });
    }
    
    // Llamar al flow
    const result = await callFlow(FLOW_INSPECCIONES_LISTAR_URL, {
      solicitudId: parseInt(solicitudId),
    });
    
    // Mapear items
    const inspecciones = Array.isArray(result.data) 
      ? result.data.map(mapInspeccionItem)
      : [];
    
    console.log(`✅ ${inspecciones.length} inspecciones obtenidas para solicitud ${solicitudId}`);
    
    res.json({
      success: true,
      solicitudId: parseInt(solicitudId),
      count: inspecciones.length,
      data: inspecciones,
    });
    
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
 * Crear una nueva inspección
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      solicitudId,
      codigoSolicitud,
      tipoInspeccion,
      porcentajeAvance,
      estadoInspeccion,
      observacionesAvance,
      observacionesInspeccion,
      solicitarParalizacion,
      motivoParalizacion,
      cantidadFotos,
      latitud,
      longitud
    } = req.body;

    const userEmail = req.user?.email;
    const userNombre = req.user?.nombre;
    
    console.log(`📝 POST /api/inspecciones - Solicitud ${solicitudId} - Usuario: ${userEmail}`);
    
    // Validaciones
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

    if (estadoInspeccion === 'No Conforme' && (!observacionesInspeccion || observacionesInspeccion.trim().length < 10)) {
      return res.status(400).json({
        success: false,
        error: 'Observaciones requeridas',
        message: 'Las observaciones son obligatorias para inspecciones "No Conforme"',
      });
    }

    // if (solicitarParalizacion && (!motivoParalizacion || motivoParalizacion.trim().length < 20)) {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'Motivo de paralización requerido',
    //     message: 'El motivo de paralización debe tener al menos 20 caracteres',
    //   });
    // }
    
    if (!FLOW_INSPECCIONES_CREAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
      });
    }
    
    // Preparar payload completo
    const payload = {
      solicitudId: parseInt(solicitudId),
      codigoSolicitud: codigoSolicitud || '',
      tipoInspeccion,
      fechaInspeccion: new Date().toISOString(),
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
      longitud: longitud || ''
    };
    
    const result = await callFlow(FLOW_INSPECCIONES_CREAR_URL, payload);
    
    console.log(`✅ Inspección creada con ID: ${result.data?.id}`);
    
    res.status(201).json(result);
    
  } catch (error) {
    console.error(`❌ Error creando inspección:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create inspection',
      message: error.message,
    });
  }
});

module.exports = router;