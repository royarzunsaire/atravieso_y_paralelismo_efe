// Prueba aislada del control de sesiones (H-08): no usa Oracle ni la API del cliente. Reloj y base de datos simulados.
// Uso: node documentacion/seguridad/prueba-sesion.cjs
const path = require('node:path');
const { crearGestorSesion } = require(path.join(__dirname, '..', '..', 'pwa-backend', 'middleware', 'gestorSesion.js'));

let ok = 0; let mal = 0;
const chk = (nombre, cond, extra = '') => { cond ? ok++ : mal++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${nombre} ${extra}`); };

(async () => {
  // reloj y «base de datos» controlables
  let t = 1_000_000; const ahora = () => t;
  const bd = { u1: { activo: true } };
  let consultas = 0; let modo = 'normal';
  const buscarUsuario = async (id) => {
    consultas++;
    if (modo === 'caida') throw new Error('Oracle caído');
    if (!(id in bd)) { const e = new Error('no existe'); e.status = 404; throw e; }
    return bd[id];
  };
  const g = crearGestorSesion({ buscarUsuario, ttlMs: 60_000, ahora });
  const silencio = console.warn; console.warn = () => {};

  chk('cuenta activa → true', (await g.cuentaActiva('u1')) === true);
  await g.cuentaActiva('u1'); await g.cuentaActiva('u1');
  chk('dentro de 60 s no vuelve a consultar Oracle (caché)', consultas === 1, `(consultas: ${consultas})`);

  bd.u1.activo = false; // el jefe da de baja al usuario
  t += 30_000;
  chk('a los 30 s aún vale el dato en caché (la baja no es instantánea)', (await g.cuentaActiva('u1')) === true);
  t += 31_000; // 61 s
  chk('pasados 60 s la baja corta la sesión', (await g.cuentaActiva('u1')) === false);

  bd.u1.activo = true; t += 61_000;
  chk('si lo reactivan, vuelve a entrar al renovarse la caché', (await g.cuentaActiva('u1')) === true);

  chk('usuario eliminado (404) → cuenta no válida', (await g.cuentaActiva('fantasma')) === false);

  // Oracle caído
  t += 61_000; modo = 'caida';
  chk('Oracle caído con dato previo → se usa el último dato conocido', (await g.cuentaActiva('u1')) === true);
  chk('Oracle caído sin dato previo → no se bloquea a todos (se deja pasar)', (await g.cuentaActiva('nuevo')) === true);
  modo = 'normal';

  // consultas simultáneas
  t += 61_000; consultas = 0;
  await Promise.all(Array.from({ length: 10 }, () => g.cuentaActiva('u1')));
  chk('10 peticiones simultáneas hacen UNA sola consulta', consultas === 1, `(consultas: ${consultas})`);

  // tokens revocados
  const token = 'header.payload.firma-A';
  chk('un token nuevo no está revocado', g.estaRevocado(token) === false);
  g.revocar(token, Math.floor(t / 1000) + 3600);
  chk('tras «Cerrar sesión» el token queda revocado', g.estaRevocado(token) === true);
  chk('otro token no se ve afectado', g.estaRevocado('header.payload.firma-B') === false);
  t += 3_601_000;
  chk('al vencer el token, deja de ocupar memoria', g.estaRevocado(token) === false);

  console.warn = silencio;
  console.log(`\n${ok} OK · ${mal} FALLA`);
  process.exit(mal ? 1 : 0);
})();
