const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_FOTOS_SUBIR_URL = process.env.FLOW_FOTOS_SUBIR_URL;
const FLOW_FOTOS_LISTAR_URL = process.env.FLOW_FOTOS_LISTAR_URL;
const MAX_FILE_SIZE_MB = 10;

/**
 * Llamar a Power Automate Flow
 */
async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000, // 60s — subir archivos toma más
      maxBodyLength: 15 * 1024 * 1024, // 15 MB para axios
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling fotos flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

/**
 * POST /api/fotos/upload
 * Subir una foto de inspección
 *
 * Body esperado:
 * {
 *   solicitudId: number,
 *   codigoSolicitud: string,
 *   inspeccionId: string,
 *   fileName: string,           // ej: "foto_001.jpg"
 *   fileContentBase64: string,   // base64 sin prefijo data:image/...
 *   description: string
 * }
 */
router.post('/upload', verifyToken, async (req, res) => {
  try {
    const {
      solicitudId,
      codigoSolicitud,
      inspeccionId,
      fileName,
      fileContentBase64,
      description,
    } = req.body;

    const userEmail = req.user?.email;
    const userNombre = req.user?.nombre;

    console.log(
      `📸 POST /api/fotos/upload - Solicitud ${solicitudId}, Inspección ${inspeccionId} - Usuario: ${userEmail}`
    );

    // ── Validaciones ──────────────────────────────────────────
    if (!solicitudId || !inspeccionId || !fileContentBase64) {
      return res.status(400).json({
        success: false,
        error: 'Campos obligatorios faltantes',
        message: 'solicitudId, inspeccionId y fileContentBase64 son requeridos',
      });
    }

    // Validar tamaño aproximado del base64 (ratio ≈ 1.37)
    const approxSizeBytes = (fileContentBase64.length * 3) / 4;
    const approxSizeMB = approxSizeBytes / (1024 * 1024);
    if (approxSizeMB > MAX_FILE_SIZE_MB) {
      return res.status(400).json({
        success: false,
        error: 'Archivo demasiado grande',
        message: `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB (≈${approxSizeMB.toFixed(1)} MB)`,
      });
    }

    if (!FLOW_FOTOS_SUBIR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_FOTOS_SUBIR_URL is missing in .env',
      });
    }

    // ── Construir nombre de archivo si no viene ───────────────
    const safeFileName =
      fileName || `foto_${Date.now()}.jpg`;

    // ── Payload para el Flow ──────────────────────────────────
    const payload = {
      solicitudId: parseInt(solicitudId, 10),
      codigoSolicitud: codigoSolicitud || `SOL-${solicitudId}`,
      inspeccionId: String(inspeccionId),
      fileName: safeFileName,
      fileContentBase64,
      description: description || '',
      inspectorEmail: userEmail || '',
      inspectorNombre: userNombre || '',
      fechaCaptura: new Date().toISOString(),
    };

    const result = await callFlow(FLOW_FOTOS_SUBIR_URL, payload);

    console.log(`✅ Foto subida: ${safeFileName} → Inspección ${inspeccionId}`);

    res.status(201).json({
      success: true,
      data: result.data || result,
    });
  } catch (error) {
    console.error('❌ Error subiendo foto:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload photo',
      message: error.message,
    });
  }
});

/**
 * GET /api/fotos/inspeccion/:inspeccionId
 * Obtener fotos de una inspección
 */
router.get('/inspeccion/:inspeccionId', verifyToken, async (req, res) => {
  try {
    const { inspeccionId } = req.params;

    console.log(`📸 GET /api/fotos/inspeccion/${inspeccionId}`);

    if (!FLOW_FOTOS_LISTAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_FOTOS_LISTAR_URL is missing in .env',
      });
    }

    const result = await callFlow(FLOW_FOTOS_LISTAR_URL, {
      inspeccionId: String(inspeccionId),
    });

    const fotos = Array.isArray(result.data) ? result.data : [];

    console.log(`✅ ${fotos.length} fotos obtenidas para inspección ${inspeccionId}`);

    res.json({
      success: true,
      inspeccionId,
      count: fotos.length,
      data: fotos,
    });
  } catch (error) {
    console.error(`❌ Error fetching fotos for inspección ${req.params.inspeccionId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch photos',
      message: error.message,
    });
  }
});

module.exports = router;
