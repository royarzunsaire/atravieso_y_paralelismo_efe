# Informe de hallazgos de seguridad — Sistema AyP

**Fecha:** 07-10-2026 · **Alcance y método:** ver `01-planner.md` · **Checklist:** `02-checklist.md`
**Resultado de las pruebas dinámicas (`localhost`, `pruebas-dinamicas.mjs`):** 18 OK · 6 fallas · 3 de atención · 1 bajo (D1 cabeceras, D5 enumeración, D6 fuerza bruta, D7 registro público, D8 tamaño de cuerpo, D10 JSON malformado).
**Tras las correcciones del 08-10-2026 (H-04 y H-01):** 19 OK · 5 fallas · 3 de atención · 1 bajo (la prueba D7 del registro público ya da OK: responde 404).

## 1. Resumen ejecutivo
La aplicación tiene **buenos cimientos en autorización**: el servidor revalida cada acción contra la API del cliente y rechazó todos los intentos de acceder o escribir sobre obras ajenas, de usar tokens falsos (`alg:none`, firma incorrecta, expirado) y de usar endpoints de administrador con un usuario normal. No hay secretos en el historial de git, en el bundle ni en las imágenes, los `.env` están ignorados, los secretos locales tienen longitud y entropía adecuadas, el frontend no tiene `npm audit` pendientes y no usa sinks de XSS.

Los problemas están en la **capa de autenticación y en el endurecimiento**: el registro es público (con un riesgo de suplantación concreto), no hay límite de intentos de login, el backend registra el hash de contraseña en sus logs, tiene 16 dependencias vulnerables y habla con la API del cliente por HTTP sin cifrar. Faltan cabeceras de seguridad y el contenedor del backend corre como `root`.

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| **Crítica** | 1 (corregida: H-01) | ~~H-01~~ |
| **Alta** | 4 (1 corregida: H-04) | H-02, H-03, ~~H-04~~, H-05 |
| **Media** | 9 | H-06 a H-14 |
| **Baja** | 8 | H-15 a H-22 |
| **Informativa** | 2 | H-23, H-24 |

## 2. Impacto de corregir los hallazgos críticos y altos
Esta tabla responde a «¿qué le pasa a la app si corregimos esto?». Ninguna corrección se aplica sin tu aprobación punto por punto.

| ID | Qué se cambiaría | Impacto en usuarios y en la app | Riesgo de regresión | Esfuerzo | Cómo se verifica |
|---|---|---|---|---|---|
| **H-01** | Eliminar `POST /auth/register` (o exigir rol admin) | **Ninguno visible:** la interfaz no usa el registro (sin referencias en `src`). Los usuarios se crean desde la app de escritorio de tu jefe (por ORDS) o con `scripts/create-admin.js`. Confirmar con tu jefe que su app no llama a `/auth/register` de nuestro backend. | Bajo | Muy bajo | `pruebas-dinamicas.mjs` D7 → 404/403; login de usuarios existentes sigue igual |
| **H-02** | `npm audit fix` (13 de 16, sin cambios de versión mayor) y quitar `passport-azure-ad` (las 3 restantes; el código de Azure está comentado) | **Ninguno funcional:** `express` y `axios` suben de versión menor/parche. Reactivar Azure AD en el futuro exigirá reinstalar el paquete con versión actual. | Bajo–medio (actualiza el servidor web y el cliente HTTP) | Bajo | `npm audit` en 0; flujo completo: login, inicio, detalle, guardar evento con sincronización, mapa |
| **H-03** | Limitador de intentos en `/auth/login/local` (p. ej. 5 fallos / 15 min por correo + IP) y `trust proxy` detrás de nginx/balanceador | Un usuario que se equivoca varias veces **queda bloqueado unos minutos**; hay que avisarlo con un mensaje claro. **Riesgo si se configura mal:** detrás del balanceador todos parecerían tener la misma IP y se bloquearían entre sí; por eso se limita por correo + IP y se fija el número de proxies. | Medio (configuración de red) | Bajo | D6 → 429 tras N intentos; un usuario con la clave correcta puede entrar después de la ventana |
| **H-04** | Quitar el `console.log` del registro completo del usuario (incluye el hash bcrypt) y de los datos personales en `config/auth.js` | **Ninguno:** solo cambia lo que se escribe en los logs. Deja de existir el hash en los logs de OCI. Los hashes que ya quedaron escritos en logs anteriores deben considerarse expuestos (borrar/rotar según política). | Muy bajo | Muy bajo | Iniciar sesión y revisar que el log no muestre hash ni objeto de usuario |
| **H-05** | Exigir HTTPS a la API del cliente (`SHAREPOINT_API_URL=https://…`) | **Ninguno si el cliente habilita TLS:** es solo cambiar la variable. Si usan una CA interna habrá que cargarla (`NODE_EXTRA_CA_CERTS`). Mientras no exista TLS: red privada/VPN y lista de IP permitidas. | Bajo (depende del cliente) | Depende del cliente | Llamada de lectura con `https://` y certificado válido |

## 3. Hallazgos detallados

### Crítica

**H-01 — ✅ CORREGIDO (08-10-2026) — Registro público: cualquiera podía crear una cuenta y obtener un token con el correo que quisiera** · CWE-306, CWE-287 · ASVS 2.1 / API2:2023
- **Evidencia:** `routes/auth.js:94` (`POST /auth/register` sin `verifyToken`); prueba D7: la ruta responde 400 de validación sin autenticar. La respuesta incluye un JWT firmado con el correo informado (`generateToken`).
- **Riesgo concreto:** la API del cliente autoriza **por el correo que viene en el JWT que firmamos nosotros**. Si una persona con obras asignadas en SharePoint todavía no tiene cuenta en nuestra base, un atacante puede registrar *ese* correo con su propia contraseña y obtener acceso a las obras de esa persona (suplantación por pre-registro). No hay verificación de que el correo le pertenezca. Además el mensaje `409 El email ya está registrado` permite averiguar qué correos existen.
- **Mitigación recomendada:** eliminar la ruta (la interfaz no la usa) o exigir rol admin; los usuarios se crean por el canal controlado (ORDS / app de escritorio).
- **Corrección aplicada (opción A):** se eliminó `POST /auth/register` del backend y la función muerta `register()` del frontend. Quien crea usuarios es el jefe de proyecto, solo por ORDS (`POST /usuarios-actions/register`, client `AYP_INTEGRACION_EXTERNA`), confirmado por Rodrigo. Verificado: la ruta responde 404 y el login, `/auth/me` y el cambio de contraseña siguen igual.
- **Observación aparte:** `scripts/create-admin.js` está roto (usa `usersDb.createLocalAuthUser`, que no existe): hoy no sirve para crear administradores.

### Altas

**H-02 — 16 vulnerabilidades en dependencias del backend (1 crítica, 7 altas, 8 moderadas)** · CWE-1395 · A06:2021
- **Evidencia:** `npm audit --omit=dev` en `pwa-backend`. Directas: `axios` (alta, SSRF por `NO_PROXY`), `express` (moderada), `passport-azure-ad` (moderada). Transitivas destacadas: `proxy-addr` (**crítica**, suplantación de IP), `path-to-regexp`, `lodash`, `form-data`, `node-forge`, `minimatch`, `brace-expansion` (altas). 13 se corrigen con `npm audit fix`; 3 (`node-jose`, `uuid`, `passport-azure-ad`) dependen del paquete de Azure, hoy deshabilitado. El frontend tiene 0.
- **Mitigación:** ver tabla de impacto.

**H-03 — Sin límite de intentos de inicio de sesión (fuerza bruta / credential stuffing)** · CWE-307 · ASVS 2.2.1 / API4:2023
- **Evidencia:** prueba D6: 15 intentos seguidos contra el mismo usuario, todos 401 y ninguno 429. No hay `rate-limit` en `package.json` ni en nginx.

**H-04 — ✅ CORREGIDO (08-10-2026) — El backend escribía en sus logs el registro completo del usuario, incluido el hash bcrypt de su contraseña** · CWE-532 · ASVS 7.1.1
- **Evidencia:** `config/auth.js:72` → `console.log('📦 Resultado raw:', JSON.stringify(user))` en cada login. También registra el correo (`:67`) y si la contraseña fue válida (`:77`).
- **Riesgo:** cualquiera con acceso a los logs (OCI Logging, soporte) obtiene hashes para ataques offline.
- **Corrección aplicada** (`config/auth.js`): se eliminó el volcado del usuario, el correo y el «contraseña válida». Ahora el log dice solo «Login correcto (usuario <id interno>)» o «Login rechazado», sin distinguir el motivo. Verificado: un login correcto y dos rechazados (clave mala y usuario inexistente) no dejan hash, objeto de usuario ni correo en el log. La respuesta que ve el usuario no cambió (eso es H-06).
- **Pendiente relacionado (bajo):** los logs de petición todavía escriben el correo del usuario (`GET /api/v2/inicio - Usuario: …` y similares en `routes/eventos.js`). No exponen contraseñas; se resuelve junto con H-18 si ciberseguridad lo exige.
- **Los hashes ya escritos** en logs locales o de `concerto` antes de esta corrección deben considerarse expuestos: borrar esos logs.

**H-05 — Comunicación con la API del cliente por HTTP sin cifrar** · CWE-319 · ASVS 9.1 / A02:2021
- **Evidencia:** `SHAREPOINT_API_URL=http://146.181.52.2:3000`. Por ahí viajan el JWT firmado (válido 8 h, reutilizable por quien lo capture), correos de usuarios, comentarios y archivos de las obras.
- **Nota:** la corrección depende del cliente. Confirmar si el tráfico va por red privada o VPN.

### Medias

**H-06 — Enumeración de usuarios (mensaje y tiempo de respuesta)** · CWE-204 · ASVS 2.2
- **Evidencia:** D5: «Usuario no encontrado» (64 ms) frente a «Contraseña incorrecta» (205 ms, por el cálculo de bcrypt). Un usuario dado de baja también responde «Usuario no encontrado».
- **Mitigación:** un mismo mensaje genérico («Credenciales inválidas») y comparar siempre contra un hash dummy para igualar tiempos.

**H-07 — Sin cabeceras de seguridad ni CSP (backend y nginx)** · CWE-693, CWE-1021 · ASVS 14.4 / A05:2021
- **Evidencia:** D1: faltan `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By: Express` expuesto. `nginx.conf.template` no define ninguna, no oculta `server_tokens` y no limita peticiones.
- **Para la CSP hay que permitir:** `fonts.googleapis.com` y `fonts.gstatic.com` (fuente Inter, ver H-21), `tile.openstreetmap.org` (mapa) y el origen propio. HSTS puede ponerse en el balanceador.

**H-08 — Sesión de 7 días en `localStorage`, sin revocación; dar de baja a un usuario no corta su sesión** · CWE-613, CWE-922 · ASVS 3.3 / 3.5
- **Evidencia:** `routes/auth.js:21` (`expiresIn: '7d'`); `verifyToken` solo valida la firma, no consulta `activo`; token y usuario en `localStorage` (`services/auth.js`). `/auth/logout` no invalida nada en el servidor. El token incluye el `rol`.
- **Mitigación:** vida más corta (p. ej. 1–8 h) con renovación, y consultar `activo` en cada petición o en una lista de revocados. Cookie `HttpOnly` es la alternativa a largo plazo (requiere CSRF).

**H-09 — `AuthCallback` guarda cualquier token recibido por `?token=` en la URL** · CWE-384, CWE-598 · ASVS 3.2
- **Evidencia:** `src/app/App.tsx:65` activa `AuthCallback` en `/auth/callback`, que guarda `token` en `localStorage`. Es código del login con Azure, hoy deshabilitado. Un enlace malicioso `…/auth/callback?token=<token del atacante>` inicia sesión a la víctima en la cuenta del atacante.
- **Mitigación:** eliminar el componente y la ruta mientras Azure esté deshabilitado.

**H-10 — Cuerpos de hasta 15 MB se procesan antes de autenticar; errores de entrada devuelven 500** · CWE-770, CWE-209 · ASVS 13.1 / API4:2023
- **Evidencia:** `server.js:48` (`express.json({ limit: '15mb' })` global). D8: un cuerpo de 14 MB en `/auth/login/local` se parsea completo y recién ahí responde 401; con 16 MB responde **500** (debería ser 413). D10: JSON malformado responde **500** con el mensaje del analizador (debería ser 400).
- **Mitigación:** límite pequeño (p. ej. 20 KB) en las rutas `/auth/*` y 15 MB solo en `/api/v2/eventos`; manejar los errores de `body-parser` como 400/413.

**H-11 — Los archivos subidos no se validan en el servidor (tipo, firma, tamaño por archivo, cantidad)** · CWE-434, CWE-400 · ASVS 12.1 / 12.2
- **Evidencia:** la validación de peso/tipo está solo en el frontend (`validarPesos`). `routes/eventos.js` reenvía `Payload.Fotos/Informes/Documentos` sin decodificar ni revisar firma (magic bytes), extensión ni cantidad. El `Payload` se reenvía completo sin esquema (`mass assignment`).
- **Mitigación:** lista blanca de extensiones/MIME, verificación de firma, tope por archivo y por evento, y un esquema que descarte claves desconocidas.

**H-12 — Contenedor del backend: corre como `root`, la imagen incluye scripts y bases SQLite, imagen base sin soporte y sin versión fija** · CWE-250 · CIS Docker 4.1 / 4.2 / 4.6
- **Evidencia:** `pwa-backend/Dockerfile` sin `USER`; `.dockerignore` no excluye `scripts/` (contiene `create-test-user.js` con la contraseña literal `Admin123456` y `test-api-sharepoint.js` con la IP de la API), `*.db` ni `sqllite.py`; `FROM node:20-alpine` (**Node 20 terminó su soporte en abril de 2026**) y `nginx:alpine` sin versión ni digest; sin `HEALTHCHECK`. nginx corre su proceso maestro como `root` (el puerto 8080 ya es sin privilegios).
- **Mitigación:** `USER node`, imagen Node LTS vigente (22 o 24) con versión fija, excluir `scripts/`, `*.db`, `sqllite.py` y `tests`, agregar `HEALTHCHECK`; considerar `nginxinc/nginx-unprivileged`.

**H-13 — Archivos sensibles o innecesarios versionados en git** · CWE-540 · A05:2021
- **Evidencia:** `git ls-files`: `pwa-backend/datos.db` (SQLite de 20 KB, contenido no inspeccionado), `pwa-backend/database.db` y `datos.db` (vacíos), `.claude.7z` (documentación interna del proyecto). La documentación versionada contiene la URL base de ORDS (`integracion-externa.md`), `client_id` parciales y correos reales de personas (`.claude/…/oracle-ords.md`).
- **Mitigación:** sacar los `.db` del repo y agregarlos a `.gitignore`; revisar si `.claude.7z` debe seguir versionado; confirmar que el repositorio es privado y quién tiene acceso; los `client_id` no son secretos, pero conviene no publicarlos.

**H-14 — Al cerrar sesión no se limpia `sessionStorage` (borradores de inspección con fotos y datos de la obra)** · CWE-922 · ASVS 8.3
- **Evidencia:** `logout()` borra `localStorage` y las cachés en memoria (`reiniciarCachesDeSesion`), pero `sessionStorage` (`currentSolicitud`, `newInspectionDraft:*` con fotos en base64) solo se limpia en casos puntuales.
- **Riesgo:** en un dispositivo compartido, la siguiente persona en la misma pestaña podría ver datos de la sesión anterior.

### Bajas

| ID | Hallazgo | Evidencia | Mitigación |
|---|---|---|---|
| H-15 | `/` y `/health` públicos exponen el entorno y qué variables están configuradas · CWE-200 | D2; `server.js:80-109`. nginx solo enruta `/api/` y `/auth/`, así que no son accesibles desde fuera salvo desde la red interna. | Limitar a red interna o reducir la respuesta |
| H-16 | CORS permite `localhost` también en producción · CWE-942 | `server.js:25-30`; D9 | Incluir `localhost` solo si `NODE_ENV !== 'production'` |
| H-17 | `express-session` y `passport.session` activos sin uso (almacén en memoria, requiere `SESSION_SECRET`) · CWE-1104 | `server.js:51-65`; la autenticación es solo por JWT | Quitarlos (menos superficie y una variable menos) |
| H-18 | Varios endpoints devuelven `error.message` al cliente (500/502) · CWE-209 | `routes/auth.js` (varios `catch`), `routes/eventos.js:331` | Mensajes genéricos al cliente; detalle solo en el log |
| H-19 | Política de contraseñas mínima: 8 caracteres sin complejidad ni lista de contraseñas filtradas; bcrypt con costo 10 · ASVS 2.1 | `routes/auth.js:114,240` | Mínimo 10–12, rechazar contraseñas comunes, costo 12 |
| H-20 | Datos hardcodeados en scripts de apoyo: contraseña `Admin123456`, IP de la API del cliente · CWE-798 | `scripts/create-test-user.js:6`, `scripts/test-api-sharepoint.js:6` | Pedirlos por entorno o argumentos; no incluir `scripts/` en la imagen (H-12) |
| H-21 | Dependencias de terceros en tiempo de ejecución: Google Fonts (`@import` en `fonts.css`) y mosaicos de OpenStreetMap · privacidad y CSP | `src/styles/fonts.css:2`, `UbicacionModal.tsx` | Autohospedar la fuente Inter; declarar OSM en la CSP |
| H-22 | `uncaughtException` solo se registra y el proceso sigue vivo en estado indefinido · CWE-248 | `server.js:11-17` | Registrar y terminar el proceso (el orquestador lo reinicia) |

### Informativos
- **H-23 — Código muerto:** claves `supabase_session`/`connection_token` en `auth.js` del frontend, `runtimeCaching` apuntando a `api.tuservidor.com` en `vite.config.js`, la dependencia `passport-azure-ad` (solo aparece en un comentario). Quitar reduce superficie.
- **H-24 — DOMPurify y XSS:** no se encontró `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` ni `document.write` en el frontend; React escapa el texto. DOMPurify **no es necesario hoy** y tampoco impide que un usuario modifique su propio DOM desde el navegador (eso solo lo contiene la validación del servidor, que sí existe). Solo se justificaría si algún día se muestra HTML proveniente de la API.

## 4. Lo que se verificó como correcto
- Autorización por objeto y por función (D12–D14, D16) y revalidación de la acción en el servidor antes de guardar (`routes/eventos.js:163-200`).
- Tokens falsos rechazados (`alg:none`, firma incorrecta, expirado, basura) (D4).
- Endpoints protegidos exigen token (D3).
- CORS rechaza orígenes ajenos (D9).
- Sin inyección en rutas ni en consultas a ORDS (D17; las consultas se arman con JSON codificado).
- Secretos: `.env` ignorados, ninguno en el historial de git ni en el bundle; el `.dockerignore` excluye `.env*`; `JWT_SECRET` de 59 caracteres.
- Frontend: 0 vulnerabilidades en dependencias, sin *source maps* en producción, enlaces externos con `rel="noopener noreferrer"`, sin datos sensibles en consola, la geolocalización pide permiso del navegador.
- Cambio de contraseña forzado en el primer login y contraseñas con bcrypt.

## 5. Inventario para ciberseguridad
**Almacenamiento del navegador**
- `localStorage`: `token` (JWT, 7 días), `user` (id, correo, nombre, rol), `ayp.catalogo`, `ayp.catalogoVersion`; claves heredadas `connection_token` y `supabase_session` (sin uso).
- `sessionStorage`: `lastSolicitudScreen`, `currentSolicitud` (datos de la obra abierta), `minimoAvance`, `newInspectionDraft:<id>` (borrador con fotos en base64).
- Cachés en memoria: detalles de obras y fotos descargadas (se vacían al iniciar y cerrar sesión).

**Librerías incluidas en el bundle (públicas por naturaleza, visibles en el navegador):** `react` 18.3.1, `react-dom` 18.3.1, `lucide-react` 0.487.0, `luxon` 3.7.2, `leaflet` 1.9.4, `react-leaflet` 4.2.1 (más `tw-animate-css` en CSS). Sin secretos ni claves en el bundle; la URL del backend no se hornea (rutas relativas).

**Datos personales tratados:** nombre y correo del usuario, ubicación GPS de cada inspección, fotos e informes de obras, comentarios.

**Salidas de red del servidor:** Oracle ORDS (HTTPS, OAuth2), API del cliente en SharePoint (**HTTP**, JWT HS256).
