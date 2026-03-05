const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_TIPOS_INSPECCION_URL = process.env.FLOW_TIPOS_INSPECCION_URL;
const TIPOS_CACHE_TTL_MS = parseInt(process.env.TIPOS_INSPECCION_CACHE_TTL_MS || '300000', 10); // 5 min

// Caché en memoria — los tipos cambian muy rara vez
let tiposCache = {
    data: null,
    expiresAt: 0,
};

// Tipos de fallback si el flow aún no está configurado
const TIPOS_FALLBACK = [
    { id: 1, titulo: 'Inspección General' },
    { id: 2, titulo: 'Control de Calidad' },
    { id: 3, titulo: 'Seguridad' },
    { id: 4, titulo: 'Avance de Obra' },
    { id: 5, titulo: 'Recepción de Materiales' },
    { id: 6, titulo: 'Verificación Técnica' },
];

async function callFlow(flowUrl, data = {}) {
    const response = await axios.post(flowUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });
    return response.data;
}

/**
 * GET /api/tipos-inspeccion
 * Retorna la lista de tipos de inspección desde SharePoint (con caché de 5 min).
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const now = Date.now();

        // Servir desde caché si está vigente
        if (tiposCache.data && now < tiposCache.expiresAt) {
            return res.json({ success: true, data: tiposCache.data, source: 'cache' });
        }

        // Si no hay flow configurado, usar fallback
        if (!FLOW_TIPOS_INSPECCION_URL) {
            console.warn('⚠️  FLOW_TIPOS_INSPECCION_URL no configurado. Usando tipos de fallback.');
            return res.json({ success: true, data: TIPOS_FALLBACK, source: 'fallback' });
        }

        console.log('📋 GET /api/tipos-inspeccion - consultando SharePoint');

        const result = await callFlow(FLOW_TIPOS_INSPECCION_URL);
        const tipos = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];

        // Guardar en caché
        tiposCache = { data: tipos, expiresAt: now + TIPOS_CACHE_TTL_MS };

        console.log(`✅ ${tipos.length} tipos de inspección obtenidos`);
        res.json({ success: true, data: tipos });

    } catch (error) {
        console.error('❌ Error obteniendo tipos de inspección:', error.message);
        // Ante error, devolver fallback para no romper el formulario
        res.json({ success: true, data: TIPOS_FALLBACK, source: 'fallback' });
    }
});

module.exports = router;
