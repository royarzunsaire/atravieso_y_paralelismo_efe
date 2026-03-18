const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const FLOW_USUARIOS_URL = process.env.FLOW_USUARIOS_URL;
const USUARIOS_CACHE_TTL_MS = parseInt(process.env.USUARIOS_CACHE_TTL_MS || '300000', 10); // 5 min

let usuariosCache = {
    data: null,
    expiresAt: 0,
};

async function callFlow(flowUrl) {
    const response = await axios.get(flowUrl, { timeout: 30000 });
    return response.data;
}

/**
 * GET /api/usuarios
 * Obtiene la lista de usuarios desde SharePoint via Power Automate.
 * El flow retorna un array de objetos con al menos { nombre, correo }.
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const now = Date.now();

        // Servir desde caché si está vigente
        if (usuariosCache.data && now < usuariosCache.expiresAt) {
            return res.json({ success: true, data: usuariosCache.data, source: 'cache' });
        }

        if (!FLOW_USUARIOS_URL) {
            console.warn('⚠️  FLOW_USUARIOS_URL no configurado.');
            return res.json({ success: true, data: [], source: 'unconfigured' });
        }

        console.log('👥 GET /api/usuarios - consultando SharePoint');

        const result = await callFlow(FLOW_USUARIOS_URL);

        // El flow retorna array directo o { data: [...] }
        const raw = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);

        // Normalizar: garantizar que cada item tenga nombre y correo
        const usuarios = raw
            .filter(u => u.nombre && u.correo)
            .map((u, index) => ({
                id: u.id ?? index + 1,
                nombre: String(u.nombre).trim(),
                correo: String(u.correo).trim(),
            }));

        usuariosCache = { data: usuarios, expiresAt: now + USUARIOS_CACHE_TTL_MS };

        console.log(`✅ ${usuarios.length} usuarios obtenidos`);
        res.json({ success: true, data: usuarios });

    } catch (error) {
        console.error('❌ Error obteniendo usuarios:', error.message);
        // Retornar caché expirada si existe, antes que un error vacío
        if (usuariosCache.data) {
            return res.json({ success: true, data: usuariosCache.data, source: 'stale-cache' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
