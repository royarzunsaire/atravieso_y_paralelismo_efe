# Despliegue del BACKEND de la PWA AyP — guía corta para montarlo

> Preparada el 12-10-2026 para que la jefatura monte **solo el backend**. El frontend se entrega después, cuando se conozca la URL del backend.

## 1. Qué se entrega

| Archivo | Para qué sirve |
|---|---|
| `ayp-backend.tar` (187 312 640 bytes, sha256 `5a43e5a7c29233d8dec679f66f4be84ad874b0de1c337f0d37ca824f36ceefe8`) | **Imagen Docker ya construida y escaneada. Es la forma recomendada de montarlo.** |
| `Dockerfile` y `.dockerignore` | Receta tal cual está en el repositorio (para ver cómo se construye o para construirla uno mismo). |
| `pwa-backend-codigo.zip` | Código fuente completo del backend (la carpeta `pwa-backend/`, con su propio `Dockerfile`), necesario solo si se quiere construir la imagen en vez de usar el `.tar`. Incluye los scripts de Oracle (`sql/`). |
| `backend.env.plantilla` | Las variables de entorno a completar (sin valores). |
| `trivy-backend.txt` | Informe del escaneo de vulnerabilidades. |
| `SHA256SUMS.txt` | Huellas para verificar que los archivos llegaron íntegros: `sha256sum -c SHA256SUMS.txt`. |

- La imagen es `linux/amd64` (servidor x86). Node 24 sobre Alpine, usuario `node` (sin root), **sin `npm`**, con `HEALTHCHECK`.
- `trivy`: **0 vulnerabilidades y 0 secretos** (informe en `documentacion/seguridad/trivy-backend.txt`).
- Verificar la copia: `sha256sum ayp-backend.tar`.

## 1b. Oracle: ¿hay que preparar algo?
- **Si usan el mismo Oracle (ORDS) que desarrollo:** no hace falta ejecutar nada; ya están las tablas, los módulos ORDS y los clients OAuth2.
- **Si es otro Oracle distinto:** ejecutar en orden, como script en SQL Developer Web, los archivos `sql/01_…` a `sql/14_…` que vienen en `pwa-backend-codigo.zip` (el `sql/README.md` explica cada uno). El `14` activa las rutas de baja y alta de usuarios. Hay que crear además los clients OAuth2 del `02` con sus propios secretos. Los usuarios se crean solo por ORDS (`POST /usuarios-actions/register`), no desde la app.

## 2. Cómo cargarla (o construirla)

```bash
docker load -i ayp-backend.tar            # queda como ayp-backend:local
```

O, si prefieren construirla desde el código (la base está fijada por digest en el `Dockerfile`):

```bash
cd pwa-backend && docker build -t ayp-backend:local .
```

## 3. Variables de entorno (archivo `backend.env`, NO va al repositorio)

| Variable | Valor | Notas |
|---|---|---|
| `ORACLE_ORDS_URL` | URL base de ORDS de **producción** | |
| `ORACLE_ORDS_CLIENT_ID`, `ORACLE_ORDS_CLIENT_SECRET` | credenciales OAuth2 del client del backend | |
| `SHAREPOINT_API_URL` | URL de la API del cliente (SharePoint) | Sin `/` final. Hoy es HTTP: pedir HTTPS al cliente. |
| `SHAREPOINT_API_SECRET` | secreto con que se firma el JWT hacia la API del cliente | |
| `JWT_SECRET` | secreto **nuevo y aleatorio**, ≥ 48 caracteres (`openssl rand -hex 32`) | No reutilizar el de desarrollo. Con él se firman las sesiones de los usuarios. |
| `FRONTEND_URL` | origen público EXACTO del frontend (`https://dominio`, sin `/` final) | Solo importa para el navegador (CORS). **Mientras no exista el frontend, puede quedar con el valor futuro; las pruebas con `curl` funcionan igual.** |
| `TRUST_PROXY` | `1` si hay un proxy/balanceador delante; `2` si son dos (nginx + balanceador); `0` si nada | Mal puesto, todos los usuarios parecerían compartir una IP y el límite de intentos de login los bloquearía juntos. |
| `NODE_ENV`, `PORT` | `production`, `3001` | Ya vienen en la imagen; no hace falta definirlas. |
| opcionales | `LOGIN_MAX_INTENTOS` (5), `LOGIN_VENTANA_MIN` (10), `SESION_CACHE_SEG` (60) | |

## 4. Cómo ejecutarla

```bash
docker run -d --name ayp-backend \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --env-file backend.env \
  ayp-backend:local
```

- **`--restart unless-stopped` es obligatorio:** el backend **termina a propósito** (código 1) ante un error sin capturar, y necesita que algo lo reinicie.
- **`-p 127.0.0.1:3001:3001`** deja el puerto accesible solo desde el propio servidor. **El backend no debe ser público**: lo alcanzará el frontend (nginx) por la red interna. Si el frontend va en otro servidor, publicar el puerto solo hacia esa red privada.
- **Una sola réplica** (la lista de sesiones cerradas y la caché de «cuenta activa» viven en la memoria del proceso).
- Salida a internet necesaria hacia **Oracle ORDS** y hacia la **API del cliente**.

## 5. Cómo comprobar que quedó bien

```bash
docker ps --filter name=ayp-backend                       # debe decir (healthy) a los ~30 s
docker logs ayp-backend | head -30                        # tabla de variables: todas con ✅
curl -s http://127.0.0.1:3001/health                      # → {"status":"ok"}   (si dice "degraded" falta alguna variable de Oracle o JWT_SECRET)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/v2/inicio    # → 401 (exige sesión)
curl -s -X POST http://127.0.0.1:3001/auth/login/local -H "Content-Type: application/json" \
  -d '{"email":"<usuario real>","password":"<su clave>"}'   # → {"success":true,"token":"…","user":{…}}
```

Si el login responde `429`, se superaron 5 intentos fallidos en 10 minutos para ese correo desde esa IP: esperar 10 minutos.

## 6. Cuando llegue el frontend (después)

- La imagen del frontend **no lleva la URL del backend grabada**: nginx la resuelve al arrancar con dos variables, `BACKEND_HOST` y `BACKEND_PORT` (la dirección y el puerto donde quedó el backend). **Basta con indicar esos dos datos al desplegarla; no hay que reconstruirla.**
- Cuando se conozca el dominio público del frontend, actualizar `FRONTEND_URL` del backend y **recrear el contenedor** (`docker rm -f ayp-backend` y volver a ejecutar el `docker run`), o el login desde el navegador falla con 403 por CORS.
- El frontend también necesita `CSP_CONNECT_EXTRA` = origen de la API del cliente (para descargar fotos).
- Si en cambio el frontend se publicara en un servidor de archivos estáticos **sin nginx** (sin el proxy), sí habría que reconstruirlo con la URL absoluta del backend (`VITE_API_URL`) y habilitar CORS; avisar si es el caso.

## 7. Qué NO cubre esta guía
TLS/HTTPS, balanceador, WAF, respaldos de Oracle, monitoreo y rotación de secretos: son de la infraestructura. La API del cliente se consume hoy por HTTP sin cifrar (pendiente con el cliente). La duración de la sesión es de 7 días (decisión pendiente con la jefatura).
