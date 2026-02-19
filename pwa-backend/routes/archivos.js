const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

// URL del flow desde variables de entorno
const FLOW_ARCHIVOS_LISTAR_URL = process.env.FLOW_ARCHIVOS_LISTAR_URL;
const ARCHIVOS_CACHE_TTL_MS = parseInt(process.env.ARCHIVOS_CACHE_TTL_MS || '20000', 10);
const archivosCache = new Map();
/**
 * Función para llamar a Power Automate Flow
 */
async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 segundos
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling archivos flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

function getCacheEntry(cacheKey) {
  const entry = archivosCache.get(cacheKey);
  if (!entry) return null;

  if (entry.data && Date.now() < entry.expiresAt) {
    return entry.data;
  }

  return null;
}

function setCacheEntry(cacheKey, data) {
  archivosCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ARCHIVOS_CACHE_TTL_MS,
  });
}

/**
 * GET /api/archivos/solicitud/:solicitudId
 * Obtener archivos de una solicitud
 */
router.get('/solicitud/:solicitudId', verifyToken, async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const userEmail = req.user?.email;
    
    console.log(`📂 GET /api/archivos/solicitud/${solicitudId} - Usuario: ${userEmail}`);
    
    // Validar que ID sea un número
    if (isNaN(solicitudId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid solicitudId',
        message: 'solicitudId must be a number',
      });
    }
    
    // Verificar que la URL del flow está configurada
    if (!FLOW_ARCHIVOS_LISTAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_ARCHIVOS_LISTAR_URL is missing in .env',
      });
    }
    
    // Llamar al flow
    const cacheKey = String(parseInt(solicitudId, 10));
    const cachedResult = getCacheEntry(cacheKey);

    if (cachedResult) {
      return res.json(cachedResult);
    }
    const result = await callFlow(FLOW_ARCHIVOS_LISTAR_URL, {
      solicitudId: parseInt(solicitudId),
    });

    setCacheEntry(cacheKey, result);
    
    // El flow ya retorna el formato correcto: { success, solicitudId, count, data }
    console.log(`✅ ${result.count || 0} archivos obtenidos para solicitud ${solicitudId}`);
    
    res.json(result);
    
  } catch (error) {
    console.error(`❌ Error fetching archivos for solicitud ${req.params.solicitudId}:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch archivos',
      message: error.message,
    });
  }
});

module.exports = router;