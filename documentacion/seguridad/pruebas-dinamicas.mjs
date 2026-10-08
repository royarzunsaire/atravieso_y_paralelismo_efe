// Pruebas dinámicas de seguridad — SOLO contra localhost. No crea ni modifica datos:
//  - no registra usuarios reales (solo prueba validaciones que fallan antes de escribir)
//  - POST /eventos solo con casos que el servidor rechaza ANTES de guardar (403/400)
//
// Uso (backend corriendo en localhost:3001):
//   node documentacion/seguridad/pruebas-dinamicas.mjs
//   SEC_EMAIL=usuario.prueba@dominio SEC_PASSWORD='...' SEC_OBRA_PROPIA=155 SEC_OBRA_AJENA=156 node documentacion/seguridad/pruebas-dinamicas.mjs
// Variables: SEC_BASE_URL (solo localhost), SEC_EMAIL, SEC_PASSWORD, SEC_OBRA_PROPIA, SEC_OBRA_AJENA.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../pwa-backend/', import.meta.url));
const jwt = require('jsonwebtoken');

const B = process.env.SEC_BASE_URL || 'http://localhost:3001';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(B)) {
  console.error(`Se niega a probar "${B}": estas pruebas solo se ejecutan contra localhost.`);
  process.exit(1);
}
const EMAIL = process.env.SEC_EMAIL;
const PASSWORD = process.env.SEC_PASSWORD;
const OBRA_PROPIA = Number(process.env.SEC_OBRA_PROPIA || 0);
const OBRA_AJENA = Number(process.env.SEC_OBRA_AJENA || 0);

const out = [];
const log = (id, resultado, detalle = '') => { out.push({ id, resultado, detalle }); console.log(`[${id}] ${resultado}${detalle ? ' — ' + detalle : ''}`); };
const req = async (path, opts = {}) => {
  const t0 = performance.now();
  const r = await fetch(B + path, opts);
  const texto = await r.text();
  let json = null; try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  return { status: r.status, headers: r.headers, texto, json, ms: Math.round(performance.now() - t0) };
};
const J = { 'Content-Type': 'application/json' };

// D1 cabeceras de seguridad
{
  const r = await req('/health');
  const esperadas = ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  const faltan = esperadas.filter((k) => !r.headers.get(k));
  log('D1 cabeceras', faltan.length ? 'FALLA' : 'OK', `faltan: ${faltan.join(', ') || 'ninguna'} | x-powered-by: ${r.headers.get('x-powered-by') || '(oculto)'}`);
}

// D2 información expuesta sin autenticación
{
  const a = await req('/'); const b = await req('/health');
  log('D2 info pública', 'ATENCIÓN', `/ → ${a.status} ${JSON.stringify(a.json)?.slice(0, 90)} | /health → ${b.status} checks=${JSON.stringify(b.json?.checks)}`);
}

// D3 endpoints protegidos sin token
for (const [m, p] of [['GET', '/api/v2/inicio'], ['GET', '/api/v2/solicitudes/1'], ['GET', '/api/v2/inspecciones/1'], ['POST', '/api/v2/eventos'], ['GET', '/auth/me'], ['POST', '/auth/change-password'], ['POST', '/auth/admin/reset-password/ABC']]) {
  const r = await req(p, { method: m, headers: J, body: m === 'POST' ? '{}' : undefined });
  log(`D3 sin token ${m} ${p}`, r.status === 401 ? 'OK' : 'FALLA', `HTTP ${r.status}`);
}

// D4 tokens manipulados
{
  const payload = { id: 'X', email: 'alguien@example.com', nombre: 'x', rol: 'admin', auth_type: 'local' };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const casos = {
    'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })}.`,
    'firmado con secreto incorrecto': jwt.sign(payload, 'secreto-incorrecto', { algorithm: 'HS256', expiresIn: '1h' }),
    'expirado': jwt.sign(payload, 'x', { algorithm: 'HS256', expiresIn: -10 }),
    'basura': 'abc.def.ghi',
  };
  for (const [nombre, t] of Object.entries(casos)) {
    const r = await req('/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    log(`D4 token ${nombre}`, r.status === 401 ? 'OK' : 'FALLA', `HTTP ${r.status}`);
  }
}

// D5 enumeración de usuarios (mensaje y tiempo). Cada intento fallido cuenta para el límite de 5 / 10 min (H-03):
// se usan pocas muestras por correo, así que NO repetir esta batería más de 2 veces dentro de 10 minutos con el mismo usuario.
{
  const intento = (email, password) => req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email, password }) });
  const media = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const inexistentes = [];
  for (let i = 0; i < 4; i++) inexistentes.push(await intento(`noexiste-${crypto.randomUUID().slice(0, 8)}@example.com`, 'Incorrecta123'));
  if (EMAIL) {
    const existentes = [await intento(EMAIL, 'Incorrecta123'), await intento(EMAIL, 'Incorrecta456')];
    if (existentes.some((r) => r.status === 429)) {
      log('D5 enumeración', 'OMITIDO', 'el usuario de prueba está bloqueado por el límite de intentos; espera 10 minutos');
    } else {
      const msgInex = new Set(inexistentes.map((r) => r.json?.error));
      const msgExis = new Set(existentes.map((r) => r.json?.error));
      const mismoMensaje = msgInex.size === 1 && msgExis.size === 1 && [...msgInex][0] === [...msgExis][0];
      const tInex = media(inexistentes.map((r) => r.ms)); const tExis = media(existentes.map((r) => r.ms));
      log('D5 enumeración por mensaje', mismoMensaje ? 'OK' : 'FALLA', `inexistente: "${[...msgInex][0]}" | existente + clave mala: "${[...msgExis][0]}"`);
      // El tiempo incluye la latencia de la red hacia Oracle (varía por sí sola); se informa, no se usa como criterio de falla.
      log('D5 enumeración por tiempo', 'INFO', `promedio inexistente ${tInex} ms (4 muestras) vs existente con clave mala ${tExis} ms (2 muestras)`);
    }
  } else {
    log('D5 enumeración por mensaje', 'OMITIDO', 'requiere SEC_EMAIL');
  }
}

// D6 límite de intentos (fuerza bruta)
{
  const estados = [];
  const email = `noexiste-${crypto.randomUUID().slice(0, 8)}@example.com`;
  for (let i = 0; i < 15; i++) {
    const r = await req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email, password: `Intento${i}xyz` }) });
    estados.push(r.status);
  }
  log('D6 fuerza bruta (15 intentos seguidos)', estados.some((s) => s === 429) ? 'OK' : 'FALLA', `estados: ${[...new Set(estados)].join(',')} (sin 429 = sin límite)`);
}

// D7 registro público (solo validaciones, NO crea usuarios)
{
  const r = await req('/auth/register', { method: 'POST', headers: J, body: '{}' });
  log('D7 /auth/register sin autenticación', r.status === 400 ? 'FALLA (endpoint público)' : `OK (HTTP ${r.status})`, `${r.status}: ${JSON.stringify(r.json)?.slice(0, 100)}`);
}

// D8 tamaño de cuerpo antes de autenticar
{
  const grande = JSON.stringify({ email: 'x@example.com', password: 'A'.repeat(14 * 1024 * 1024) });
  const r = await req('/auth/login/local', { method: 'POST', headers: J, body: grande });
  const mayor = await req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email: 'x', password: 'A'.repeat(16 * 1024 * 1024) }) });
  log('D8 cuerpo de ~14 MB sin autenticar', r.status === 413 ? 'OK' : 'FALLA', `HTTP ${r.status} en ${r.ms} ms (se parsea antes de rechazar) | 16 MB → HTTP ${mayor.status} (esperado 413)`);
}

// D9 CORS
{
  const evil = await req('/api/v2/inicio', { headers: { Origin: 'https://evil.example.com' } });
  const preflight = await fetch(B + '/api/v2/eventos', { method: 'OPTIONS', headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' } });
  const local = await fetch(B + '/health', { headers: { Origin: 'http://localhost:5173' } });
  log('D9 CORS origen ajeno', evil.status === 403 ? 'OK' : 'REVISAR', `GET con Origin ajeno → ${evil.status}; preflight → ${preflight.status}; allow-origin: ${preflight.headers.get('access-control-allow-origin') || '(ninguno)'}`);
  log('D9 CORS localhost permitido', 'ATENCIÓN', `Origin http://localhost:5173 → allow-origin: ${local.headers.get('access-control-allow-origin')} (la lista incluye localhost también en producción)`);
}

// D10 errores: filtrado de información
{
  const mal = await req('/auth/login/local', { method: 'POST', headers: J, body: '{"email": ' });
  const ruta = await req('/ruta/<script>alert(1)</script>');
  log('D10 JSON malformado', mal.status === 400 && !/at |node_modules/.test(mal.texto) ? 'OK' : 'FALLA', `HTTP ${mal.status} (esperado 400): ${mal.texto.slice(0, 140)}`);
  log('D10 reflejo de la ruta en el 404', ruta.headers.get('content-type')?.includes('json') ? 'BAJO' : 'FALLA', `${ruta.status} content-type=${ruta.headers.get('content-type')}`);
}

// Pruebas con sesión (usuario de prueba)
if (EMAIL && PASSWORD) {
  const login = await req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const token = login.json?.token;
  if (!token) {
    log('Con sesión', 'OMITIDO', `no se pudo iniciar sesión (HTTP ${login.status})`);
  } else {
    const A = { Authorization: `Bearer ${token}`, ...J };
    const dec = jwt.decode(token);
    log('D11 JWT', (dec.exp - dec.iat) > 24 * 3600 ? 'ATENCIÓN' : 'OK', `vida ${(dec.exp - dec.iat) / 3600} h; claims: ${Object.keys(dec).join(',')}`);

    if (OBRA_AJENA) {
      const ajena = await req(`/api/v2/solicitudes/${OBRA_AJENA}`, { headers: A });
      log(`D12 obra ajena GET /solicitudes/${OBRA_AJENA}`, ajena.status === 403 ? 'OK' : 'FALLA', `HTTP ${ajena.status} ${ajena.json?.error || ''}`);
      const ev = await req('/api/v2/eventos', { method: 'POST', headers: A, body: JSON.stringify({ solicitudId: OBRA_AJENA, eventoIdExterno: crypto.randomUUID(), tipoEvento: 'OBRA_FINALIZADA', payload: {} }) });
      log('D13 POST /eventos sobre obra ajena', ev.status === 403 ? 'OK' : 'FALLA', `HTTP ${ev.status} ${ev.json?.error || ''}`);
    }
    if (OBRA_PROPIA) {
      const ev2 = await req('/api/v2/eventos', { method: 'POST', headers: A, body: JSON.stringify({ solicitudId: OBRA_PROPIA, eventoIdExterno: crypto.randomUUID(), tipoEvento: 'OBRA_FINALIZADA', payload: {} }) });
      log('D14 acción no permitida en obra propia', ev2.status === 403 ? 'OK' : 'REVISAR', `HTTP ${ev2.status} ${ev2.json?.error || ''}`);
      const ev3 = await req('/api/v2/eventos', { method: 'POST', headers: A, body: JSON.stringify({ solicitudId: OBRA_PROPIA, eventoIdExterno: crypto.randomUUID(), tipoEvento: { $ne: 1 }, payload: 'texto' }) });
      log('D15 tipos inesperados en el cuerpo', ev3.status >= 500 ? 'FALLA' : 'OK', `HTTP ${ev3.status}: ${ev3.texto.slice(0, 120)}`);
    }
    const adm = await req('/auth/admin/reset-password/ABC', { method: 'POST', headers: A, body: JSON.stringify({ newPassword: 'NoSeUsa12345' }) });
    log('D16 endpoint admin con usuario normal', adm.status === 403 ? 'OK' : 'FALLA', `HTTP ${adm.status}`);
    const inj = await req('/api/v2/solicitudes/1%27%20OR%201=1--', { headers: A });
    log('D17 id con intento de inyección', inj.status >= 500 ? 'REVISAR' : 'OK', `HTTP ${inj.status}: ${inj.texto.slice(0, 100)}`);
  }
} else {
  log('Con sesión', 'OMITIDO', 'defina SEC_EMAIL y SEC_PASSWORD para las pruebas D11–D17');
}

// D18 «Cerrar sesión» invalida el token en el servidor (H-08). Usa su propia sesión para no afectar a las anteriores.
if (EMAIL && PASSWORD) {
  const l2 = await req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const t2 = l2.json?.token;
  if (t2) {
    const A2 = { Authorization: `Bearer ${t2}`, ...J };
    const antes = await req('/auth/me', { headers: A2 });
    const salir = await req('/auth/logout', { method: 'POST', headers: A2, body: '{}' });
    const despues = await req('/auth/me', { headers: A2 });
    const nuevo = await req('/auth/login/local', { method: 'POST', headers: J, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    log('D18 cerrar sesión invalida el token en el servidor',
      antes.status === 200 && salir.status === 200 && despues.status === 401 && nuevo.status === 200 ? 'OK' : 'FALLA',
      `antes ${antes.status} · logout ${salir.status} · mismo token después ${despues.status} (esperado 401) · login nuevo ${nuevo.status}`);
  }
}

console.log('\nRESUMEN:', JSON.stringify(out.reduce((a, o) => { const k = o.resultado.split(' ')[0]; a[k] = (a[k] || 0) + 1; return a; }, {})));
