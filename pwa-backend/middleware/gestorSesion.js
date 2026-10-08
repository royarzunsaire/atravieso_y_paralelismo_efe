const crypto = require('crypto');

/**
 * Control de sesiones del backend (hallazgo de seguridad H-08):
 *
 *  1. CUENTA ACTIVA: el JWT dura 7 días y antes solo se validaba su firma, así que un usuario dado de baja (usuarios.activo = 0)
 *     seguía entrando hasta que el token vencía. Ahora se consulta `activo` en Oracle, con una caché corta
 *     (60 s por defecto) para no llamar a Oracle en cada petición: una baja corta la sesión en menos de un minuto.
 *       - Si el usuario ya no existe (404) o está inactivo → la cuenta no es válida.
 *       - Si Oracle no responde: se usa el último dato conocido; sin dato previo se deja pasar (no se bloquea a todos los
 *         usuarios por una caída de Oracle) y se avisa en el log.
 *  2. TOKENS REVOCADOS: «Cerrar sesión» invalida el token en el servidor (lista en memoria, por huella SHA-256, hasta que el
 *     token venza). Sirve también para tokens emitidos antes de este cambio (no necesita `jti`).
 *
 * Límite conocido: ambas estructuras viven en la memoria del proceso (una réplica hoy). Con varias réplicas habría que moverlas
 * a un almacén compartido; la revocación se pierde al reiniciar el contenedor (el token vuelve a valer hasta su vencimiento).
 *
 * `buscarUsuario(id)` debe devolver { activo: boolean } o lanzar un error con `status` (404 = no existe).
 */
function crearGestorSesion({ buscarUsuario, ttlMs = 60_000, ahora = () => Date.now() }) {
  const revocados = new Map(); // huella del token → vence (ms)
  const cuentas = new Map(); // id de usuario → { activo, hasta }
  const enVuelo = new Map(); // id de usuario → promesa (junta consultas simultáneas)

  const huella = (token) => crypto.createHash('sha256').update(token).digest('hex');

  function revocar(token, expSegundos) {
    const vence = expSegundos ? expSegundos * 1000 : ahora() + 7 * 24 * 3600 * 1000;
    revocados.set(huella(token), vence);
  }

  function estaRevocado(token) {
    const h = huella(token);
    const vence = revocados.get(h);
    if (vence === undefined) return false;
    if (vence <= ahora()) { revocados.delete(h); return false; }
    return true;
  }

  async function cuentaActiva(idUsuario) {
    const guardada = cuentas.get(idUsuario);
    if (guardada && guardada.hasta > ahora()) return guardada.activo;
    if (enVuelo.has(idUsuario)) return enVuelo.get(idUsuario);

    const consulta = (async () => {
      try {
        const usuario = await buscarUsuario(idUsuario);
        const activo = !!usuario && usuario.activo === true;
        cuentas.set(idUsuario, { activo, hasta: ahora() + ttlMs });
        return activo;
      } catch (error) {
        if (error && error.status === 404) {
          cuentas.set(idUsuario, { activo: false, hasta: ahora() + ttlMs });
          return false;
        }
        console.warn('⚠️  No se pudo verificar si la cuenta sigue activa; se usa el último dato conocido');
        return guardada ? guardada.activo : true;
      } finally {
        enVuelo.delete(idUsuario);
      }
    })();
    enVuelo.set(idUsuario, consulta);
    return consulta;
  }

  /** Limpia lo vencido (revocaciones y cuentas) para que la memoria no crezca sin límite. */
  function limpiar() {
    const t = ahora();
    for (const [h, vence] of revocados) if (vence <= t) revocados.delete(h);
    for (const [id, c] of cuentas) if (c.hasta + ttlMs <= t) cuentas.delete(id);
  }

  return { revocar, estaRevocado, cuentaActiva, limpiar };
}

module.exports = { crearGestorSesion };
