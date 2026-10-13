// Servidor de PRUEBA local que imita el contenedor del frontend detrás de un API Gateway: sirve `dist` colgado de un PREFIJO (el gateway lo
// quita antes de reenviar), genera /config.js desde la variable API_URL (como 40-ayp-config.sh) y aplica las cabeceras de seguridad de
// seguridad.inc.template. NO hace de proxy: el navegador llama directo a API_URL (hace falta que ese backend permita este origen por CORS).
// Uso:  cd pwa-frontend && VITE_API_URL="" npm run build
//       API_URL=http://localhost:3001 CSP_CONNECT_EXTRA="http://localhost:3001 https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com" PREFIJO=/mobileayp-web PORT=4173 node scripts/servidor-prueba-prefijo.cjs
//       abrir http://localhost:4173/mobileayp-web/
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..') + path.sep, DIST = path.resolve(RAIZ + 'dist');
const PREFIJO = (process.env.PREFIJO || '').replace(/\/+$/, ''), PORT = Number(process.env.PORT || 4173);
const API_URL = process.env.API_URL || '', EXTRA = process.env.CSP_CONNECT_EXTRA ?? '';
const plantilla = fs.readFileSync(RAIZ + 'seguridad.inc.template', 'utf8').replace(/\$\{CSP_CONNECT_EXTRA\}/g, EXTRA);
const cabeceras = [...plantilla.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map((m) => [m[1], m[2]]);
const tipos = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (PREFIJO) { if (url !== PREFIJO && !url.startsWith(PREFIJO + '/')) { res.writeHead(404); return res.end('fuera del prefijo'); } url = url.slice(PREFIJO.length) || '/'; }
  const h = {}; for (const [k, v] of cabeceras) if (k !== 'Strict-Transport-Security') h[k] = v;
  if (url === '/config.js') { h['Content-Type'] = 'application/javascript'; h['Cache-Control'] = 'no-store'; res.writeHead(200, h); return res.end('window.__AYP_CONFIG__ = { API_URL: ' + JSON.stringify(API_URL) + ' };\n'); }
  let f = path.resolve(path.join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url)));
  if (!f.startsWith(DIST + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  h['Content-Type'] = tipos[path.extname(f)] || 'application/octet-stream';
  if (path.extname(f) === '.html' || path.basename(f) === 'sw.js') h['Cache-Control'] = 'no-cache';
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('Servidor de prueba en http://localhost:' + PORT + (PREFIJO || '') + '/  | API_URL=' + (API_URL || '(mismo origen)') + ' | CSP connect-src extra=' + (EXTRA || '(ninguno)')));
