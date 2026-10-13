const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Límite de intentos FALLIDOS de inicio de sesión (hallazgo de seguridad H-03).
 *
 * Regla acordada con Rodrigo (08-10-2026): máximo 5 intentos fallidos cada 10 minutos por combinación
 * correo + IP. Pasado el límite se responde 429 y se pide reintentar el inicio de sesión cuando termine la ventana.
 *  - Solo cuentan los intentos fallidos (los que responden 401); un login correcto no suma.
 *  - Mientras dura el bloqueo también se rechaza la contraseña correcta (es lo esperado: quien adivina no debe poder
 *    seguir probando); al terminar la ventana puede volver a intentar.
 *  - La IP real depende de `trust proxy` (variable TRUST_PROXY en server.js): detrás de nginx/balanceador debe indicar
 *    cuántos proxies hay, o todos los usuarios parecerían compartir una IP.
 *
 * Configurable por entorno: LOGIN_MAX_INTENTOS (por defecto 5) y LOGIN_VENTANA_MIN (por defecto 10).
 */
function crearLimitadorLogin({ max, ventanaMs } = {}) {
  const limite = max ?? Math.max(1, parseInt(process.env.LOGIN_MAX_INTENTOS ?? '5', 10) || 5);
  const ventana = ventanaMs ?? Math.max(1, parseInt(process.env.LOGIN_VENTANA_MIN ?? '10', 10) || 10) * 60 * 1000;

  return rateLimit({
    windowMs: ventana,
    limit: limite,
    skipSuccessfulRequests: true, // solo los 401 cuentan
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
      return `${ipKeyGenerator(req.ip)}|${email}`;
    },
    handler: (req, res) => {
      const restanteMs = Math.max(0, (req.rateLimit?.resetTime?.getTime?.() ?? Date.now()) - Date.now());
      const segundos = Math.max(1, Math.ceil(restanteMs / 1000));
      const minutos = Math.max(1, Math.ceil(segundos / 60));
      res.set('Retry-After', String(segundos));
      console.warn('⚠️  Login bloqueado por demasiados intentos fallidos');
      res.status(429).json({
        success: false,
        error: 'DEMASIADOS_INTENTOS',
        message: `Demasiados intentos fallidos. Por seguridad, vuelve a intentar iniciar sesión en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
        reintentarEnSegundos: segundos,
      });
    },
  });
}

module.exports = { crearLimitadorLogin, limitarLogin: crearLimitadorLogin() };
