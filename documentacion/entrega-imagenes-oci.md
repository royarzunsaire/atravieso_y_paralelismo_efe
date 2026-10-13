# Entrega de las imágenes Docker — Sistema de Atravieso y Paralelismo (PWA)

> **Borrador de correo para el colega de arquitectura (OCI) y para Ciberseguridad de EFE.** Preparado el 12-10-2026.
> Rodrigo lo revisa, completa los datos entre `<…>` y lo envía junto con los adjuntos indicados.

**Asunto:** Entrega de imágenes Docker de la PWA AyP (backend + frontend) — escaneadas, 0 vulnerabilidades

**Para:** `<colega de arquitectura OCI>`, `<Ciberseguridad EFE>`  **Cc:** `<jefe de Rodrigo>`

---

Hola:

Adjunto las dos imágenes Docker de la PWA del Sistema de Atravieso y Paralelismo, listas para subir a OCIR y desplegar en una OCI Container Instance, junto con la documentación de la auditoría de seguridad que se les hizo.

## 1. Qué se entrega

| Archivo | Tamaño (bytes) | sha256 |
|---|---|---|
| `ayp-backend.tar` | 187 312 640 | `5a43e5a7c29233d8dec679f66f4be84ad874b0de1c337f0d37ca824f36ceefe8` |
| `ayp-frontend.tar` | 63 648 256 | `d676cb008db78e44b6e57b265235359cffb7a3231619834f380f0d905de8d780` |

Verificar la copia antes de cargar: `sha256sum ayp-backend.tar ayp-frontend.tar` (Linux) o `Get-FileHash -Algorithm SHA256 ayp-*.tar` (PowerShell).

Además, la carpeta **`documentacion/seguridad/`** (planner, checklist de 87 controles, informe de hallazgos, pruebas repetibles e informes de `trivy`) y la guía **`oci-deploy.md`**.

- **Plataforma:** `linux/amd64` → la Container Instance debe ser **shape x86 (E-series)**, no Ampere/Arm.
- **Base:** backend `node:24-alpine` (usuario `node`, sin `npm`); frontend `nginxinc/nginx-unprivileged:stable-alpine` (usuario 101). Ambas fijadas por digest.

## 2. Cómo cargarlas

```bash
docker load -i ayp-backend.tar     # queda como ayp-backend:local
docker load -i ayp-frontend.tar    # queda como ayp-frontend:local
docker tag ayp-backend:local  scl.ocir.io/<NAMESPACE>/ayp-backend:1.0.0
docker tag ayp-frontend:local scl.ocir.io/<NAMESPACE>/ayp-frontend:1.0.0
docker push scl.ocir.io/<NAMESPACE>/ayp-backend:1.0.0
docker push scl.ocir.io/<NAMESPACE>/ayp-frontend:1.0.0
```

## 3. Cómo desplegarlas

**Una sola Container Instance con los dos contenedores** (comparten red, se hablan por `localhost`). Solo el frontend (nginx, puerto **8080**) se expone, detrás de un Load Balancer con TLS. El backend (puerto 3001) **no debe tener acceso desde fuera**.

### Variables de entorno del contenedor **backend**

| Variable | Valor | Notas |
|---|---|---|
| `FRONTEND_URL` | `https://<dominio-publico>` | **Crítica.** Origen público EXACTO: con `https://` y **sin `/` final**. Si no coincide, el login falla con 403 (CORS). En producción ya no se acepta `localhost`. |
| `ORACLE_ORDS_URL`, `ORACLE_ORDS_CLIENT_ID`, `ORACLE_ORDS_CLIENT_SECRET` | los de producción | Acceso a Oracle por ORDS (OAuth2). |
| `JWT_SECRET` | secreto nuevo, aleatorio, ≥ 48 caracteres | Generarlo para producción (ej. `openssl rand -hex 32`). No reutilizar el de desarrollo. |
| `SHAREPOINT_API_URL`, `SHAREPOINT_API_SECRET` | los de la API del cliente | El secreto firma el JWT hacia la API del cliente. |
| `TRUST_PROXY` | `2` (nginx + balanceador) — **confirmar** | Cuántos proxies hay delante del backend. Mal puesto, todos los usuarios parecerían compartir una IP y se bloquearían entre sí (límite de 5 intentos fallidos de login cada 10 min por correo + IP). |
| `NODE_ENV`, `PORT` | `production`, `3001` | Ya vienen en la imagen. |
| `LOGIN_MAX_INTENTOS`, `LOGIN_VENTANA_MIN`, `SESION_CACHE_SEG` | opcionales (5, 10, 60) | Intentos de login, ventana y caché de «cuenta activa». |

### Variables del contenedor **frontend**

| Variable | Valor | Notas |
|---|---|---|
| `BACKEND_HOST` | `localhost` | Mismo namespace de red de la instancia. |
| `BACKEND_PORT` | `3001` | |
| `CSP_CONNECT_EXTRA` | origen de la API del cliente, ej. `https://api.cliente.cl` | Sin ruta. El navegador baja las fotos de ahí; sin esto no cargan. **Hoy la API del cliente es `http://146.181.52.2:3000` (HTTP): ver punto 6.** |

### Requisitos de la instancia y del balanceador
- **Política de reinicio ante fallo** en ambos contenedores: el backend **termina a propósito** (código 1) ante un error sin capturar. Sin reinicio automático, el servicio quedaría caído.
- Endurecimiento recomendado (igual que `docker-compose.yml`): sin privilegios extra (`no-new-privileges`), sin capacidades de Linux (`cap_drop ALL`) y, para el backend, **sistema de archivos de solo lectura** con `/tmp` temporal.
- **Salida a internet** hacia Oracle ORDS y la API del cliente (subnet pública o NAT).
- El balanceador debe enviar **`X-Forwarded-Proto: https`** (sin eso nginx no emite HSTS; alternativa: HSTS en el balanceador) y debe estar en una **red privada** de la VCN (10.x / 172.16–31.x / 192.168.x): el límite de peticiones de nginx toma la IP real del cliente de `X-Forwarded-For` solo si la petición llega de una red privada.
- Health checks: backend `GET /health` → `200 {"status":"ok"}`; frontend `GET /` → `200`.

## 4. Resultado del escaneo de vulnerabilidades

`trivy` 0.75, sobre los `.tar` exactos que se entregan, con la base de vulnerabilidades del 12-10-2026:

| Imagen | Vulnerabilidades | Secretos |
|---|---|---|
| `ayp-backend.tar` (Alpine 3.24.2 + Node 24.21.0) | **0** | **0** |
| `ayp-frontend.tar` (Alpine 3.24.2 + nginx) | **0** | **0** |

Informes completos: `documentacion/seguridad/trivy-backend.txt` y `trivy-frontend.txt`. Para repetirlo:
`docker run --rm -v <carpeta>:/imgs:ro aquasec/trivy:latest image --input /imgs/ayp-backend.tar --scanners vuln,secret`.

Se quitó `npm` de la imagen del backend (no se usa en ejecución y traía 21 hallazgos) y se actualizaron `zlib` y `tiff` con parches de Alpine que la imagen base fijada aún no incluye (`apk upgrade` puntual, anotado en los `Dockerfile`; quitarlo cuando se actualice la base). **Las imágenes base no reciben parches solas: repetir el escaneo cada cierto tiempo.**

## 5. Auditoría de seguridad realizada

Contra OWASP ASVS 4.0 L2, OWASP Top 10 2021, OWASP API Top 10 2023, CWE y CIS Docker; 87 controles revisados (checklist en `02-checklist.md`) y 25 hallazgos (`03-informe-hallazgos.md`), todos los propios corregidos salvo dos parciales (H-08, duración del token, y H-13, historial de git) y dos informativos sin efecto (H-23, código muerto sin credenciales; H-24, no hace falta DOMPurify porque no hay HTML que sanitizar). Resumen de lo aplicado:

- **Autenticación:** sin registro público (los usuarios solo se crean por ORDS); límite de 5 intentos fallidos cada 10 min por correo + IP; mensaje único de error y hash falso (anti-enumeración); contraseñas nuevas de 10+ caracteres con letras y números, sin contraseñas comunes, bcrypt costo 12; el login no acepta tokens por URL.
- **Sesión:** JWT HS256; la baja de un usuario (`usuarios.activo = 0`, por ORDS) **corta su sesión en ~1 minuto** (probado: 61–64 s); «Cerrar sesión» invalida el token en el servidor y limpia el navegador.
- **API:** cuerpos limitados por zona (`/auth` 20 KB, `/api` 15 MB); validación de tipos y de **archivos subidos en el servidor** (extensión, firma real del archivo, peso, cantidad, esquema); autorización por obra revalidada contra la API del cliente; errores genéricos hacia el cliente; CORS solo `FRONTEND_URL`; `/` y `/health` mínimos.
- **nginx / navegador:** CSP estricta (sin scripts en línea ni orígenes de Google; solo mosaicos de OpenStreetMap), cabeceras de seguridad, `server_tokens off`, **límite de peticiones** (`/auth/` 20 por minuto y `/api/` 50 por segundo por cliente → 429), tope de 64 KB en `/auth/`.
- **Contenedores:** usuarios sin privilegios (`node` y 101), `HEALTHCHECK`, sin `scripts/`, bases de datos ni `.env` dentro de la imagen, bases fijadas por digest.
- **Dependencias:** `npm audit` de producción en 0 en backend y frontend.

## 6. Lo que NO está cubierto o queda abierto (honestidad por delante)

1. **La API del cliente se consume hoy por HTTP sin cifrar** (JWT, correos, comentarios y archivos viajan en claro). Es del cliente: se les pidió HTTPS o confirmar red privada/VPN. Cuando exista, actualizar `CSP_CONNECT_EXTRA` con el origen `https://`.
2. **Duración del token de sesión: 7 días** (decisión pendiente con la jefatura; propuesta de 24 h con renovación deslizante).
3. **Una sola réplica:** la lista de sesiones cerradas y la caché de «cuenta activa» viven en la memoria del proceso; se pierden al reiniciar el contenedor y no se comparten entre réplicas.
4. **Fuera del alcance de la PWA** (corresponde a la infraestructura): TLS y HSTS en el balanceador, WAF, MFA, retención de datos, respaldos de Oracle, monitoreo y alertas, rotación de secretos, reglas de red.
5. **Cuentas de prueba:** en Oracle de desarrollo existen cuentas con contraseñas simples. **No deben existir (o deben estar con `activo = 0`) en producción.**
6. El historial de git del repositorio conserva dos bases SQLite antiguas (con contraseñas ya cambiadas). Se decidió no reescribir el historial salvo que Ciberseguridad lo exija. El repositorio debe ser **privado**.
7. Mapa de las inspecciones: usa mosaicos de **OpenStreetMap** (único origen externo permitido en la CSP).

## 7. Verificación sugerida después de desplegar

```bash
curl -sI https://<dominio-publico>/ | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type"   # cabeceras
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio-publico>/api/v2/inicio                                   # 401 sin sesión
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}\n" https://<dominio-publico>/auth/me; done | sort | uniq -c   # ~11×401 y el resto 429
```

Y desde un navegador: login real, dashboard con obras, detalle de una obra, descarga de una foto, «Cerrar sesión».

Quedo atento a cualquier consulta.

Saludos,
`<Rodrigo>`

---
*Adjuntos: `ayp-backend.tar`, `ayp-frontend.tar`, carpeta `documentacion/seguridad/`, `oci-deploy.md`.*
