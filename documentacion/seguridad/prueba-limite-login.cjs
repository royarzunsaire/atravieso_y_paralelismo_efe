// Prueba aislada del limitador de intentos de login (H-03): no usa Oracle ni la API del cliente; ventana corta de 3 s, máximo 5 fallos.
// Uso: node documentacion/seguridad/prueba-limite-login.cjs
const path = require('node:path').join(__dirname, '..', '..', 'pwa-backend') + '/';
const express = require(path + 'node_modules/express');
const { crearLimitadorLogin } = require(path + 'middleware/limitarLogin.js');

const app = express();
app.set('trust proxy', 1); // como detrás de nginx
app.use(express.json());
app.post('/login', crearLimitadorLogin({ max: 5, ventanaMs: 3000 }), (req, res) =>
  req.body.password === 'ok' ? res.json({ success: true }) : res.status(401).json({ success: false, error: 'Contraseña incorrecta' }));

const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = async (email, password, ip = '10.0.0.1') => {
    const r = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, retryAfter: r.headers.get('retry-after'), msg: j.message };
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const chk = (nombre, cond, extra = '') => console.log(`${cond ? 'OK   ' : 'FALLA'} ${nombre} ${extra}`);

  // 5 fallos → 401; el 6.º → 429 (aunque la clave sea correcta)
  const fallos = []; for (let i = 0; i < 5; i++) fallos.push((await post('Ana@EFE.cl', 'mala')).status);
  chk('5 intentos fallidos responden 401', fallos.every((s) => s === 401), JSON.stringify(fallos));
  const sexto = await post('ana@efe.cl', 'mala'); // mismo correo con otras mayúsculas
  chk('el 6.º intento fallido responde 429', sexto.status === 429, `Retry-After=${sexto.retryAfter}s · "${sexto.msg}"`);
  const correctaBloqueada = await post('ana@efe.cl', 'ok');
  chk('durante el bloqueo también se rechaza la clave correcta', correctaBloqueada.status === 429);
  // otros no se ven afectados
  chk('otro correo desde la misma IP NO está bloqueado', (await post('luis@efe.cl', 'ok')).status === 200);
  chk('el mismo correo desde OTRA IP NO está bloqueado', (await post('ana@efe.cl', 'ok', '10.0.0.2')).status === 200);
  // los logins correctos no suman
  let ok = true; for (let i = 0; i < 8; i++) ok = ok && (await post('maria@efe.cl', 'ok')).status === 200;
  chk('8 logins correctos seguidos no se bloquean', ok);
  // recuperación al terminar la ventana
  await esperar(3300);
  chk('al terminar la ventana puede volver a entrar', (await post('ana@efe.cl', 'ok')).status === 200);
  srv.close();
});
