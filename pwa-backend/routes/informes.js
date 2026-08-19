const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_DOCUMENTOS_SUBIR_URL = process.env.FLOW_DOCUMENTOS_SUBIR_URL;
const FLOW_DOCUMENTOS_LISTAR_URL = process.env.FLOW_DOCUMENTOS_LISTAR_URL;
const MAX_FILE_SIZE_MB = 10;

// Tipos MIME aceptados (PDF y Word)
const CONTENT_TYPES_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
      maxBodyLength: 15 * 1024 * 1024,
      maxContentLength: 15 * 1024 * 1024,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling informes flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

/**
 * POST /api/informes/upload
 * Subir un informe (PDF o Word) asociado a una inspección
 *
 * Body esperado:
 * {
 *   solicitudId:      number,
 *   codigoSolicitud:  string,
 *   inspeccionId:     string,
 *   fileName:         string,   // ej: "informe_inspeccion.pdf"
 *   fileContentBase64: string,  // base64 sin prefijo data:...
 *   contentType:      string,   // "application/pdf" | "application/msword" | ...
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
      contentType,
    } = req.body;

    const userEmail = req.user?.email;
    const userNombre = req.user?.nombre;

    console.log(
      `📄 POST /api/informes/upload - Solicitud ${solicitudId}, Inspección ${inspeccionId} - Usuario: ${userEmail}`
    );

    // ── Validaciones ──────────────────────────────────────────
    if (!solicitudId || !inspeccionId || !fileContentBase64 || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Campos obligatorios faltantes',
        message: 'solicitudId, inspeccionId, fileName y fileContentBase64 son requeridos',
      });
    }

    if (contentType && !CONTENT_TYPES_PERMITIDOS.has(contentType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no permitido',
        message: 'Solo se permiten archivos PDF y Word (.pdf, .doc, .docx)',
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

    if (!FLOW_DOCUMENTOS_SUBIR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_DOCUMENTOS_SUBIR_URL is missing in .env',
      });
    }

    const payload = {
      solicitudId:      parseInt(solicitudId, 10),
      codigoSolicitud:  codigoSolicitud || `SOL-${solicitudId}`,
      inspeccionId:     String(inspeccionId),
      fileName,
      fileContentBase64,
      contentType:      contentType || 'application/pdf',
      description:      `Informe de inspección - ${fileName}`,
      inspectorEmail:   userEmail  || '',
      inspectorNombre:  userNombre || '',
      fechaCarga:       new Date().toISOString(),
    };

    const result = await callFlow(FLOW_DOCUMENTOS_SUBIR_URL, payload);

    console.log(`✅ Informe subido: ${fileName} → Inspección ${inspeccionId}`);

    res.status(201).json({
      success: true,
      data: result.data || result,
    });
  } catch (error) {
    console.error('❌ Error subiendo informe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload informe',
      message: error.message,
    });
  }
});

/**
 * GET /api/informes/inspeccion/:inspeccionId
 * Obtener informes (PDF/Word) de una inspección, desde la carpeta
 * DocumentosInspecciones (separada de FotosInspecciones)
 */
router.get('/inspeccion/:inspeccionId', verifyToken, async (req, res) => {
  try {
    const { inspeccionId } = req.params;

    console.log(`📄 GET /api/informes/inspeccion/${inspeccionId}`);

    if (!FLOW_DOCUMENTOS_LISTAR_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_DOCUMENTOS_LISTAR_URL is missing in .env',
      });
    }

    const result = await callFlow(FLOW_DOCUMENTOS_LISTAR_URL, {
      inspeccionId: String(inspeccionId),
    });

    const informes = Array.isArray(result.data) ? result.data : [];

    console.log(`✅ ${informes.length} informes obtenidos para inspección ${inspeccionId}`);

    res.json({
      success: true,
      inspeccionId,
      count: informes.length,
      data: informes,
    });
  } catch (error) {
    console.error(`❌ Error fetching informes for inspección ${req.params.inspeccionId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch informes',
      message: error.message,
    });
  }
});

module.exports = router;
