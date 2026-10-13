// Servidor de PRUEBA local (NO es la arquitectura de producción): sirve pwa-frontend/dist y reenvía /api y /auth al backend
// publicado detrás del API Gateway de OCI (con su prefijo), SIN el header Origin del navegador, porque el backend en producción
// solo acepta el origen de FRONTEND_URL. Las cabeceras de seguridad (CSP, etc.) salen de seguridad.inc.template.
// Uso:  1) cd pwa-frontend && VITE_API_URL="" npm run build     2) node scripts/servidor-prueba-gateway.cjs     3) abrir http://localhost:8081
// Variables opcionales: GW_URL (URL del gateway con su prefijo), CSP_CONNECT_EXTRA (origen de la API de SharePoint, para las fotos), PORT.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..') + path.sep;
const DIST = path.resolve(RAIZ + 'dist');
const GW = new URL(process.env.GW_URL || 'https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com/mobileayp-api');
const EXTRA = process.env.CSP_CONNECT_EXTRA ?? 'https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com';
const plantilla = fs.readFileSync(RAIZ + 'seguridad.inc.template', 'utf8').replace(/\$\{CSP_CONNECT_EXTRA\}/g, EXTRA);
const cabeceras = [...plantilla.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map((m) => [m[1], m[2]]);
const tipos = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/') || url.startsWith('/auth/')) {
    const h = { ...req.headers, host: GW.host }; delete h.origin; delete h.referer; delete h.cookie;
    const p = https.request({ host: GW.hostname, port: 443, path: GW.pathname.replace(/\/$/, '') + req.url, method: req.method, headers: h, servername: GW.hostname }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', (e) => { res.writeHead(502); res.end('proxy: ' + e.message); });
    return req.pipe(p);
  }
  let f = path.resolve(path.join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url)));
  if (!f.startsWith(DIST + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  const h = { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' };
  if (path.extname(f) === '.html' || path.basename(f) === 'sw.js') h['Cache-Control'] = 'no-cache'; // que el navegador no se quede con una versión vieja
  for (const [k, v] of cabeceras) if (k !== 'Strict-Transport-Security') h[k] = v;
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 8081), () => console.log('Servidor de prueba en http://localhost:' + (process.env.PORT || 8081) + ' → ' + GW.href));
