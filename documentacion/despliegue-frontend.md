# Despliegue del FRONTEND de la PWA AyP — guía corta para montarlo

> Preparada el 13-10-2026. Misma forma que el backend: una imagen Docker que se sube al Container Registry de OCI y se ejecuta como contenedor.
> **Una sola imagen sirve para desarrollo y para producción**: lo que cambia entre ambientes son las variables de entorno, no la imagen.

## 1. Qué se entrega
| Archivo | Para qué sirve |
|---|---|
| `ayp-frontend.tar` (63 648 256 bytes, sha256 `d676cb008db78e44b6e57b265235359cffb7a3231619834f380f0d905de8d780`) | Imagen Docker ya construida y escaneada (0 vulnerabilidades, 0 secretos): nginx sin privilegios, puerto 8080, usuario 101. |
| `Dockerfile`, `nginx.conf.template`, `seguridad.inc.template`, `40-ayp-config.sh` | Receta y configuración tal cual están en el repositorio (`pwa-frontend/`). |
| `SHA256SUMS.txt` | Para verificar la copia: `sha256sum -c SHA256SUMS.txt`. |

## 2. Cargarla y ejecutarla
```bash
docker load -i ayp-frontend.tar        # queda como ayp-frontend:local
docker run -d --name ayp-frontend --restart unless-stopped -p 8080:8080 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -e API_URL="https://<host-del-gateway>/<prefijo-del-backend>" \
  -e CSP_CONNECT_EXTRA="https://<host-del-gateway>" \
  ayp-frontend:local
```

## 3. Variables de entorno
| Variable | Valor | Notas |
|---|---|---|
| **`API_URL`** | Dirección del backend **que usará el navegador**, sin barra final. Ej.: `https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com/mobileayp-api` | **Obligatoria con el backend detrás de un API Gateway.** Vacía = mismo origen (nginx reenvía a `BACKEND_HOST`:`BACKEND_PORT`, como en `docker-compose.yml`). Se aplica al arrancar el contenedor: para pasar a producción basta cambiarla y reiniciar, **sin reconstruir la imagen**. |
| **`CSP_CONNECT_EXTRA`** | **Origen(es)** (esquema + host, SIN ruta) a los que el navegador puede conectarse además del propio, separados por espacio. Ej.: `https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com` | **Obligatoria si el backend o la API de SharePoint están en otro origen.** La política de seguridad bloquea cualquier otro destino. Con el backend y la API de SharePoint en el mismo gateway que el front es el mismo origen; igual conviene definirla. |
| `BACKEND_HOST`, `BACKEND_PORT` | por defecto `127.0.0.1` y `3001` | Solo se usan si `API_URL` está vacío (proxy de nginx). Pueden dejarse como están. |

## 4. Si el front queda detrás de un API Gateway con un prefijo
- La app usa rutas **relativas**: funciona colgada de cualquier prefijo (por ejemplo `/mobileayp-web/`). **Se abre con la barra final** (`https://<gateway>/mobileayp-web/`). Configurar la ruta del gateway con `/mobileayp-web/{path*}` apuntando al contenedor (puerto 8080) **quitando el prefijo** al reenviar, igual que en el backend, y un redirect de `/mobileayp-web` a `/mobileayp-web/`.
- **Mismo límite de 10 s del gateway:** el contenedor del front solo sirve archivos estáticos, no lo afecta, pero las rutas del backend y de la API de SharePoint necesitan un *Read timeout* de 90–120 s (ver guía del backend).
- El **backend** debe tener `FRONTEND_URL` = **origen** donde se sirve el front (esquema + host, sin ruta ni barra final), p. ej. `https://gtibyxnoeyzrfkb5a26vg53vfi.apigateway.sa-santiago-1.oci.customer-oci.com`, y recrearse. Sin eso el login falla con 403 (CORS).
- `TRUST_PROXY` del backend: 1 en desarrollo (solo el gateway) y probablemente 2 en producción (balanceador + gateway); confirmar.

## 5. Cómo comprobar que quedó bien
```bash
docker ps --filter name=ayp-frontend                     # (healthy) a los ~30 s
curl -s http://127.0.0.1:8080/config.js                  # → window.__AYP_CONFIG__ = { API_URL: "https://…" };
curl -sI http://127.0.0.1:8080/ | grep -i content-security-policy   # incluye tu CSP_CONNECT_EXTRA en connect-src
```
Y desde un navegador, con la URL pública: iniciar sesión, ver las obras, abrir una foto y cerrar sesión. Si el login falla con 403 es `FRONTEND_URL` del backend; si las fotos no cargan, es `CSP_CONNECT_EXTRA`.

## 6. Qué exige HTTPS
La página debe servirse por **HTTPS**: sin él el navegador no permite usar la cámara, el GPS ni instalar la app en el celular.
