const { crearGestorSesion } = require('./gestorSesion');
const usersDb = require('../database');

// Gestor de sesiones de esta instancia del backend (hallazgo H-08). SESION_CACHE_SEG: cuánto se recuerda que una cuenta
// está activa antes de volver a preguntarle a Oracle (60 s por defecto = una baja corta la sesión en menos de un minuto).
const ttlSeg = Math.max(5, parseInt(process.env.SESION_CACHE_SEG ?? '60', 10) || 60);
const sesion = crearGestorSesion({
  buscarUsuario: (id) => usersDb.getUserById(id),
  ttlMs: ttlSeg * 1000,
});

// Limpieza periódica de lo vencido; no mantiene vivo el proceso.
setInterval(() => sesion.limpiar(), 10 * 60 * 1000).unref();

module.exports = { sesion };
