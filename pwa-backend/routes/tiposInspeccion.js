const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { ordsGet } = require('../oracle');

const TIPOS_CACHE_TTL_MS = parseInt(process.env.TIPOS_INSPECCION_CACHE_TTL_MS || '300000', 10); // 5 min

// Caché en memoria — los tipos cambian muy rara vez
let tiposCache = {
    data: null,
    expiresAt: 0,
};

// Tipos de fallback — solo si Oracle no responde (la fuente de verdad es
// la tabla tipos_inspeccion, sincronizada por el jefe de Rodrigo desde
// SharePoint — ver sql/11_tipos_inspeccion.sql).
const TIPOS_FALLBACK = [
    { id: 1, titulo: 'Inspección General' },
    { id: 2, titulo: 'Control de Calidad' },
    { id: 3, titulo: 'Seguridad' },
    { id: 4, titulo: 'Avance de Obra' },
    { id: 5, titulo: 'Recepción de Materiales' },
    { id: 6, titulo: 'Verificación Técnica' },
];

/**
 * Mapea una fila de tipos_inspeccion (Oracle) al contrato que ya espera
 * el frontend: { id, titulo }. Se expone el id_sharepoint como "id" (es
 * el identificador estable y el que ya usaba el frontend cuando venía
 * del flow) — el id interno de Oracle queda solo como PK de la tabla.
 */
function mapTipoInspeccionRow(row) {
    return {
        id: row.id_sharepoint,
        titulo: row.titulo,
    };
}

/**
 * GET /api/tipos-inspeccion
 * Retorna la lista de tipos de inspección desde Oracle (tabla
 * tipos_inspeccion, sincronizada por el cliente desde SharePoint), con
 * caché de 5 min. Antes venía de un flow de Power Automate — ver
 * sql/11_tipos_inspeccion.sql para la migración.
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const now = Date.now();

        // Servir desde caché si está vigente
        if (tiposCache.data && now < tiposCache.expiresAt) {
            return res.json({ success: true, data: tiposCache.data, source: 'cache' });
        }

        console.log('📋 GET /api/tipos-inspeccion - consultando Oracle');

        const q = encodeURIComponent(JSON.stringify({ activo: { $eq: 1 } }));
        const data = await ordsGet(`/tipos_inspeccion/?q=${q}&limit=100`);
        const filas = Array.isArray(data?.items) ? data.items : [];

        // Orden en Node (no en la query) para no depender de que ORDS
        // soporte $orderby vía AutoREST: por "orden" si está seteado,
        // si no alfabético por título — nulls al final.
        filas.sort((a, b) => {
            if (a.orden != null && b.orden != null) return a.orden - b.orden;
            if (a.orden != null) return -1;
            if (b.orden != null) return 1;
            return String(a.titulo).localeCompare(String(b.titulo), 'es');
        });

        const tipos = filas.map(mapTipoInspeccionRow);

        // Guardar en caché
        tiposCache = { data: tipos, expiresAt: now + TIPOS_CACHE_TTL_MS };

        console.log(`✅ ${tipos.length} tipos de inspección obtenidos desde Oracle`);
        res.json({ success: true, data: tipos });

    } catch (error) {
        console.error('❌ Error consultando tipos_inspeccion en Oracle:', {
            message: error.message,
            status: error.status,
        });
        // Sad Path: Oracle no responde — servir caché vencida si existe,
        // si no el fallback fijo. Nunca dejar la pantalla sin tipos.
        if (tiposCache.data) {
            return res.json({ success: true, data: tiposCache.data, source: 'stale-cache' });
        }
        res.json({ success: true, data: TIPOS_FALLBACK, source: 'fallback' });
    }
});

module.exports = router;
