# Checklist de seguridad — Sistema AyP

**Fecha:** 07-10-2026 · **Detalle de cada hallazgo:** `03-informe-hallazgos.md` · **Plan:** `01-planner.md`
**Leyenda:** ✅ Cumple · ❌ No cumple · ⚠️ Cumple parcialmente / atención · ➖ No aplica · ⏳ Fuera de alcance de este equipo (infraestructura / ciberseguridad)
**Resumen:** ver el recuento al final. Al corregir un hallazgo, cambiar el estado aquí y volver a correr `pruebas-dinamicas.mjs`.

## A. Secretos y datos hardcodeados
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| A1 | Los `.env` no están versionados | ASVS 2.10, A05 | ✅ | `.gitignore`; `git ls-files` sin `.env` |
| A2 | Sin secretos en el historial de git | ASVS 2.10 | ✅ | `git log --all` sin `.env`, wallet ni claves; búsqueda de `SECRET=` sin resultados |
| A3 | Secretos de entorno con longitud y entropía suficientes | ASVS 2.9 | ✅ | `JWT_SECRET` 59 caracteres (local); no está en listas de secretos comunes |
| A4 | Sin secretos ni claves en el bundle del frontend | ASVS 14.3 | ✅ | `dist/` sin `SECRET`, `Bearer`, `client_secret` |
| A5 | Sin URLs/IP de infraestructura fijas en el código de producción | CWE-798 | ⚠️ | Solo en `scripts/` (H-20) y como respaldo de desarrollo `localhost:3001` en 5 servicios (la imagen usa rutas relativas) |
| A6 | Sin contraseñas literales en el repositorio | CWE-798 | ✅ | Scripts parametrizados por entorno y bloque comentado de `Login.tsx` borrado (H-20 corregido 08-10-2026) |
| A7 | Sin archivos de datos o binarios sensibles versionados | A05 | ⚠️ | Los `.db` y `sqllite.py` ya no están en el árbol (H-13, 08-10-2026) pero siguen en el historial de git; `.claude.7z` sigue versionado |
| A8 | La documentación versionada no expone datos de infraestructura | A05 | ⚠️ | URL base de ORDS, `client_id` parciales, correos (H-13) |
| A9 | La imagen Docker no incluye `.env`, bases locales ni scripts | CIS 4.10 | ⚠️ | `.dockerignore` excluye `.env*`, `scripts/`, `*.db`, `sqllite.py` (H-12, 08-10-2026); falta confirmarlo en la próxima reconstrucción de la imagen |
| A10 | Secretos distintos por ambiente y rotación definida | ASVS 2.10 | ⏳ | Sin evidencia; definir con ciberseguridad |
| A11 | Gestión de secretos del despliegue (variables en OCI, no en la imagen) | CIS 4.10 | ⏳ | La imagen no los trae; verificar la configuración de OCI |

## B. Frontend (XSS, DOM y almacenamiento)
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| B1 | Sin sinks XSS (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`) | ASVS 5.3, CWE-79 | ✅ | Búsqueda sin resultados (H-24) |
| B2 | Los datos de la API se muestran escapados (React) | ASVS 5.3.3 | ✅ | Sin HTML insertado |
| B3 | Sanitización con DOMPurify | ASVS 5.2.1 | ➖ | No hay HTML que sanitizar; se justifica solo si se muestra HTML de la API (H-24) |
| B4 | Content-Security-Policy | ASVS 14.4.3 | ✅ | Verificada en la imagen real (`curl -I` en `concerto`, 08-10-2026) y con la app real bajo la política (0 violaciones; bloquea conexiones, scripts e imágenes ajenos) (H-07) |
| B5 | Dependencias externas en tiempo de ejecución controladas | CWE-829 | ⚠️ | Google Fonts y mosaicos OSM (H-21) |
| B6 | Enlaces `target="_blank"` con `rel="noopener noreferrer"` | CWE-1022 | ✅ | `PhotosModal.tsx`, `UbicacionModal.tsx` |
| B7 | Token de sesión no expuesto a scripts | ASVS 3.2 | ⚠️ | JWT en `localStorage` (H-08) |
| B8 | No se acepta un token recibido por URL | ASVS 3.2.1, CWE-384 | ✅ | `AuthCallback` y `/auth/callback` eliminados (H-09 corregido 08-10-2026) |
| B9 | Al cerrar sesión se limpia todo el almacenamiento de la sesión | ASVS 3.3 | ⚠️ | `localStorage` y cachés sí; `sessionStorage` no (H-14) |
| B10 | Sin *source maps* en producción | ASVS 14.3.2 | ✅ | `dist/assets/*.map`: 0 |
| B11 | Sin datos sensibles en consola del navegador | ASVS 7.1 | ✅ | Sin `console.log` de token, usuario o payload |
| B12 | El service worker no cachea respuestas autenticadas | ASVS 8.2 | ✅ | Solo precachea estáticos; `runtimeCaching` apunta a un dominio inexistente (H-23) |
| B13 | URLs de descarga con token temporal | ASVS 8.3.1 | ⚠️ | SharePoint entrega URLs con `?token=` válidas ~1 h; informar a ciberseguridad (viajan en la URL) |
| B14 | Sin código muerto con credenciales o claves heredadas | A05 | ⚠️ | `supabase_session`, `connection_token` (H-23) |
| B15 | Geolocalización solo con permiso del usuario | Privacidad | ✅ | `navigator.geolocation` (el navegador pide permiso) |
| B16 | Validación de entradas en el cliente (no sustituye al servidor) | ASVS 5.1 | ✅ | Validación por banderas de la API; el servidor revalida |

## C. Backend y API
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| C1 | Todo endpoint protegido exige autenticación | API2:2023 | ✅ | D3 (7 de 7 → 401) |
| C2 | JWT: firma verificada, rechaza `alg:none` y firmas ajenas | ASVS 3.5 | ✅ | D4 (4 de 4 → 401); algoritmo fijado a HS256 al emitir y al verificar (H-08) |
| C3 | Vida del token corta y revocación posible | ASVS 3.3 | ⚠️ | Revocación posible (cerrar sesión y baja de usuario en menos de 60 s, H-08 corregido 08-10-2026); la vida sigue siendo de 7 días (pendiente, depende del modo offline) |
| C4 | Autorización por objeto (BOLA) | API1:2023 | ✅ | D12–D14: obras ajenas y acciones no permitidas → 403 |
| C5 | Autorización por función (admin) | API5:2023 | ✅ | D16 → 403 |
| C6 | La acción se revalida en el servidor contra la fuente de verdad | ASVS 4.1 | ✅ | `routes/eventos.js:163-200` |
| C7 | Validación de esquema del cuerpo (tipos, claves permitidas) | API3:2023 | ⚠️ | El `Payload` se reenvía sin esquema (H-11); no cae por tipos inesperados (D15) |
| C8 | Límite de tamaño de cuerpo por ruta | API4:2023 | ❌ | 15 MB global antes de autenticar (H-10) |
| C9 | Límite de tasa (rate limiting) | API4:2023 | ⚠️ | Login limitado a 5 fallos / 10 min por correo + IP (H-03 corregido 08-10-2026); el resto de la API y nginx sin límite (E13) |
| C10 | Registro de cuentas restringido | ASVS 2.1 | ✅ | `POST /auth/register` eliminado (H-01 corregido 08-10-2026); las cuentas se crean solo por ORDS |
| C11 | Sin enumeración de usuarios | ASVS 2.2 | ✅ | Mensaje único y tiempos parejos con hash falso (H-06 corregido 08-10-2026) |
| C12 | Errores sin detalles internos y con el código HTTP correcto | ASVS 7.4 | ⚠️ | D10: JSON malformado → 500; `error.message` al cliente (H-10, H-18) |
| C13 | Cabeceras de seguridad (`helmet`) y sin `X-Powered-By` | ASVS 14.4 | ✅ | `helmet` en el backend; D1 en OK (H-07 corregido 08-10-2026) |
| C14 | CORS restrictivo | API8:2023 | ⚠️ | Rechaza orígenes ajenos (D9); permite `localhost` en producción (H-16) |
| C15 | Validación de archivos subidos (tipo, firma, tamaño, cantidad) | ASVS 12.1 | ❌ | Solo en el cliente (H-11) |
| C16 | Sin inyección (SQL/ORDS/NoSQL/ruta) | A03:2021 | ✅ | D17; las consultas usan JSON codificado |
| C17 | Sin SSRF | API7:2023 | ✅ | URL base fija; el aviso de `axios` se corrige con H-02 |
| C18 | Logs sin datos sensibles | ASVS 7.1 | ⚠️ | El hash y el objeto de usuario ya no se registran (H-04 corregido 08-10-2026); los logs de petición aún llevan el correo (pendiente, bajo) |
| C19 | Endpoints de diagnóstico sin información interna | A05 | ⚠️ | `/` y `/health` (H-15) |
| C20 | Sin componentes innecesarios (sesiones, estrategias sin uso) | A05 | ⚠️ | `express-session` / `passport.session` (H-17) |
| C21 | Manejo seguro de excepciones no controladas | CWE-248 | ⚠️ | `uncaughtException` solo registra (H-22) |
| C22 | Idempotencia de eventos (evita duplicados / repetición) | API6:2023 | ✅ | `eventoIdExterno` único; formato UUID no se valida (menor) |
| C23 | Protección CSRF | ASVS 4.2 | ➖ | La sesión va en cabecera `Authorization`, no en cookie |
| C24 | Tiempo máximo en llamadas externas | CWE-400 | ✅ | `timeout` 90 s hacia la API del cliente |
| C25 | Cifrado hacia la API del cliente | ASVS 9.1 | ❌ | HTTP (H-05) |
| C26 | Cifrado hacia Oracle ORDS | ASVS 9.1 | ✅ | HTTPS, OAuth2 `client_credentials` |
| C27 | Dependencias del backend sin vulnerabilidades conocidas | A06:2021 | ✅ | `npm audit --omit=dev`: 0 (H-02 corregido 08-10-2026); quedan 3 avisos solo de desarrollo en `nodemon`, fuera de la imagen |
| C28 | Dependencias del frontend sin vulnerabilidades conocidas | A06:2021 | ✅ | `npm audit`: 0 |

## D. Autenticación y contraseñas
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| D1 | Contraseñas con hash adaptativo (bcrypt) | ASVS 2.4 | ✅ | `bcryptjs`, costo 10 (subir a 12: H-19) |
| D2 | Política de contraseñas | ASVS 2.1 | ⚠️ | Solo mínimo de 8 caracteres (H-19) |
| D3 | Cambio forzado de contraseña en el primer inicio de sesión | ASVS 2.1 | ✅ | `debe_cambiar_password` (spec 08) |
| D4 | Bloqueo o retardo tras intentos fallidos | ASVS 2.2.1 | ✅ | 5 fallos cada 10 min por correo + IP, luego 429 (H-03 corregido 08-10-2026) |
| D5 | Autenticación multifactor | ASVS 2.8 | ⏳ | No existe (Azure AD deshabilitado); decisión de ciberseguridad |
| D6 | Recuperación de contraseña segura | ASVS 2.5 | ➖ | No existe; la restablece un administrador |
| D7 | Cerrar sesión invalida el token en el servidor | ASVS 3.3.1 | ✅ | Prueba D18: el mismo token después del logout da 401 (H-08 corregido 08-10-2026) |
| D8 | La baja de un usuario corta su acceso | ASVS 3.3 | ⚠️ | Implementado: `verifyToken` consulta `activo` con caché de 60 s (probado de forma aislada); falta probarlo con una baja real cuando se ejecute el script SQL 14 |
| D9 | Sin cuentas ni contraseñas de prueba en producción | ASVS 2.10 | ⏳ | Usuarios de prueba con contraseñas predecibles en desarrollo; verificar que no existan en producción |

## E. Contenedores y despliegue
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| E1 | El contenedor del backend no corre como `root` | CIS 4.1 | ❌ | H-12 |
| E2 | El contenedor de nginx no corre como `root` | CIS 4.1 | ⚠️ | Puerto 8080 sí; proceso maestro como `root` (H-12) |
| E3 | Imagen base con soporte vigente | CIS 4.2 | ❌ | `node:20-alpine` fuera de soporte desde abril de 2026 (H-12) |
| E4 | Imágenes con versión o digest fijo | CIS 4.2 | ⚠️ | `node:20-alpine`, `nginx:alpine` flotantes (H-12) |
| E5 | Build multi-etapa y sin dependencias de desarrollo | CIS 4.x | ✅ | Frontend en 2 etapas; backend `npm ci --omit=dev` |
| E6 | `.dockerignore` completo | CIS 4.10 | ⚠️ | Falta `scripts/`, `*.db`, `sqllite.py` (H-12) |
| E7 | `HEALTHCHECK` definido | CIS 4.6 | ⚠️ | No hay (H-12) |
| E8 | Sin secretos dentro de las capas de la imagen | CIS 4.10 | ✅ | Variables en tiempo de ejecución |
| E9 | Escaneo de vulnerabilidades de las imágenes | CIS 5 | ⏳ | Sin Docker local; ejecutar `trivy image` en `concerto` |
| E10 | Sistema de archivos de solo lectura y capacidades mínimas | CIS 5.x | ⏳ | Se define en la Container Instance |
| E11 | Cabeceras de seguridad en nginx | ASVS 14.4 | ✅ | Verificadas en la imagen real: CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy; HSTS solo con X-Forwarded-Proto https (H-07, 08-10-2026) |
| E12 | `server_tokens off` | ASVS 14.3 | ✅ | Verificado en la imagen real: `Server: nginx` sin versión (H-07, 08-10-2026) |
| E13 | Límite de peticiones y conexiones en nginx | API4:2023 | ❌ | H-03 / H-07 |
| E14 | TLS y HSTS en el balanceador | ASVS 9.1 | ⏳ | Infraestructura OCI |
| E15 | El backend no es accesible directamente desde Internet | A05 | ⚠️ | Escucha en `0.0.0.0:3001`; el diseño solo expone nginx (8080). Confirmar reglas de red de OCI |
| E16 | Registro, monitoreo y alertas | ASVS 7.2 | ⏳ | Infraestructura OCI |
| E17 | Respaldos de la base y plan de recuperación | A04 | ⏳ | Infraestructura OCI / Oracle |
| E18 | `trust proxy` configurado para ver la IP real | ASVS 14.4 | ⚠️ | Variable `TRUST_PROXY` (0 por defecto; compose = 1); el valor en OCI lo confirma quien arma la infraestructura (H-03) |

## F. Datos y privacidad
| ID | Control | Ref. | Estado | Evidencia / hallazgo |
|---|---|---|---|---|
| F1 | Inventario de datos personales | Ley 19.628 | ✅ | Nombre, correo, GPS, fotos, comentarios (ver informe §5) |
| F2 | Minimización de datos personales en logs | ASVS 7.1 | ⚠️ | Login sin correo ni hash (H-04); quedan correos en los logs de petición |
| F3 | Datos personales cifrados en tránsito | ASVS 9.1 | ⚠️ | Tramo hacia la API del cliente en HTTP (H-05) |
| F4 | Política de retención y borrado | Ley 19.628 | ⏳ | Definir con el área responsable |
| F5 | Consentimiento para la geolocalización | Privacidad | ✅ | Permiso del navegador |

## Recuento
| Estado | Cantidad |
|---|---|
| ✅ Cumple | 40 |
| ⚠️ Parcial / atención | 28 |
| ❌ No cumple | 6 |
| ➖ No aplica | 3 |
| ⏳ Fuera de alcance | 10 |
| **Total de controles** | **87** |
