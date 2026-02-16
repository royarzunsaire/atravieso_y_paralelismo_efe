const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_INSPECCIONES_CREAR_URL = process.env.FLOW_INSPECCIONES_CREAR_URL;

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

    if (solicitarParalizacion && (!motivoParalizacion || motivoParalizacion.trim().length < 20)) {
      return res.status(400).json({
        success: false,
        error: 'Motivo de paralización requerido',
        message: 'El motivo de paralización debe tener al menos 20 caracteres',
      });
    }
    
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