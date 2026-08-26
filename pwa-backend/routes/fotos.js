const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');
const { createArchivoOutbox } = require('../database');

const FLOW_FOTOS_LISTAR_URL = process.env.FLOW_FOTOS_LISTAR_URL;
const FLOW_FOTOS_CONTENIDO_URL = process.env.FLOW_FOTOS_CONTENIDO_URL;
const MAX_FILE_SIZE_MB = 10;

// Los oracleId son RAW(16) de Oracle → 32 caracteres hex. Los ids de
// SharePoint son numéricos incrementales (list items). Nunca coinciden
// en formato, así que basta esta regex para distinguirlos.
const ORACLE_ID_REGEX = /^[0-9A-F]{32}$/i;

/**
 * Llamar a Power Automate Flow
 */
async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000, // 60s — subir archivos toma más
      maxBodyLength: 15 * 1024 * 1024,    // 15 MB límite body de envío
      maxContentLength: 15 * 1024 * 1024, // 15 MB límite respuesta (contenido de fotos)
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
      inspeccionId,
      fileName,
      fileContentBase64,
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

    // ── Construir nombre de archivo si no viene ───────────────
    const safeFileName =
      fileName || `foto_${Date.now()}.jpg`;

    // La foto se guarda en Oracle y responde rápido — el sync job la
    // sube a SharePoint después (cuando la inspección ya tenga
    // sharepoint_id, sea porque ya lo tenía o porque recién sincronizó).
    const esOracleId = ORACLE_ID_REGEX.test(String(inspeccionId));
    const archivoId = await createArchivoOutbox({
      inspeccionOutboxId: esOracleId ? String(inspeccionId) : null,
      sharepointInspeccionId: esOracleId ? null : String(inspeccionId),
      solicitudId: parseInt(solicitudId, 10),
      tipo: 'foto',
      fileName: safeFileName,
      contentType: 'image/jpeg',
      fileBase64: fileContentBase64,
      inspectorEmail: userEmail || '',
      inspectorNombre: userNombre || '',
    });

    console.log(`✅ Foto guardada en Oracle (pendiente de sync): ${safeFileName} → Inspección ${inspeccionId}`);

    res.status(201).json({
      success: true,
      data: { id: archivoId, fileName: safeFileName, estadoSync: 'pendiente' },
    });
  } catch (error) {
    console.error('❌ Error guardando foto:', error);
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

/**
 * GET /api/fotos/content?inspeccionId=...&fileName=...
 * Devuelve el binario del archivo para que el frontend pueda mostrarlo sin
 * depender de URLs directas de SharePoint (que suelen dar 401 en <img>).
 *
 * Requiere un Flow que, dado inspeccionId+fileName, obtenga el contenido del archivo.
 */
router.get('/content', verifyToken, async (req, res) => {
  try {
    const inspeccionId = String(req.query.inspeccionId || '');
    const fileName = String(req.query.fileName || '');

    if (!inspeccionId || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'inspeccionId y fileName son requeridos',
      });
    }

    if (!FLOW_FOTOS_CONTENIDO_URL) {
      return res.status(500).json({
        success: false,
        error: 'Flow URL not configured',
        message: 'FLOW_FOTOS_CONTENIDO_URL is missing in .env',
      });
    }

    const result = await callFlow(FLOW_FOTOS_CONTENIDO_URL, {
      inspeccionId,
      fileName,
    });

    const payload = result.data || result;
    const fileContentBase64 = payload.fileContentBase64 || payload.fileContent || payload.contentBase64;
    const contentType = payload.contentType || 'image/jpeg';

    if (!fileContentBase64) {
      return res.status(502).json({
        success: false,
        error: 'Flow response invalid',
        message: 'El flow no retornó fileContentBase64',
      });
    }

    const buffer = Buffer.from(String(fileContentBase64), 'base64');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('❌ Error obteniendo contenido de foto:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch photo content',
      message: error.message,
    });
  }
});

module.exports = router;
