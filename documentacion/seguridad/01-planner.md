# Planner de seguridad — Sistema AyP (PWA + backend)

**Fecha de la auditoría:** 07-10-2026 · **Versión auditada:** rama `chore/retirar-v1` (commit `7078256` + cambios locales sin commitear) · **Tipo:** auditoría de solo lectura + pruebas dinámicas en `localhost`
**Documentos relacionados:** `02-checklist.md` (controles marcables) · `03-informe-hallazgos.md` (hallazgos, evidencia e impacto de corregir) · `pruebas-dinamicas.mjs` (pruebas repetibles)

## 1. Objetivo y alcance
Entregar al área de ciberseguridad un diagnóstico verificable del backend (Node/Express) y del frontend (React/Vite PWA) **antes** de que ellos apliquen sus reglas sobre las imágenes Docker, y saber qué impacto tendrá corregir cada hallazgo.

| Dentro del alcance | Fuera del alcance (se declara, no se prueba) |
|---|---|
| Código fuente del frontend y del backend | La API del cliente (SharePoint, `146.181.52.2:3000`) y su seguridad interna |
| Dependencias npm (`npm audit`) | Oracle Autonomous DB / ORDS más allá de cómo los consumimos |
| Dockerfiles, `.dockerignore`, `nginx.conf.template` | Infraestructura OCI: balanceador, TLS, WAF, red, backups, monitoreo |
| Historial de git y archivos versionados | Escaneo de las imágenes ya construidas (no hay Docker local; ver §5) |
| Bundle compilado, almacenamiento del navegador | Pruebas contra producción o contra sistemas de terceros |
| Pruebas dinámicas contra `http://localhost:3001` | Pruebas de ingeniería social o físicas |

## 2. Estándares de referencia
- **OWASP ASVS 4.0 (nivel 2)** — control principal de verificación.
- **OWASP Top 10 (2021)** y **OWASP API Security Top 10 (2023)** — clasificación de riesgos.
- **CWE** — identificación de la debilidad de cada hallazgo.
- **CIS Docker Benchmark** — contenedores y despliegue.
- Marco normativo chileno que puede aplicar (a validar por ciberseguridad/legal): Ley 21.663 (Marco de Ciberseguridad) y Ley 19.628 (datos personales).

## 3. Fases y estado
| # | Fase | Qué se revisa | Método | Estado |
|---|---|---|---|---|
| 1 | Secretos y datos hardcodeados | `.env` versionados, secretos en código, historial de git, bundle, documentación, IPs/URLs/contraseñas literales | `git ls-files`, `git log -S`, búsqueda por patrones, entropía/longitud de secretos (sin imprimirlos) | ✅ Hecha |
| 2 | Dependencias y cadena de suministro | `npm audit` (prod), paquetes sin uso, versión de Node e imágenes base | `npm audit`, `npm ls`, simulación de `npm audit fix` | ✅ Hecha |
| 3 | Frontend | Sinks XSS, almacenamiento del navegador, CSP, service worker, enlaces externos, bundle, librerías expuestas, `?token=` en URL | Lectura de código, búsqueda de patrones, inspección de `dist` | ✅ Hecha |
| 4 | Backend y API | Autenticación y JWT, autorización por objeto/función, validación de entradas, tamaños, CORS, cabeceras, errores, logs, subida de archivos | Lectura de código + pruebas dinámicas D1–D17 | ✅ Hecha |
| 5 | Autenticación y contraseñas | Hash, política, bloqueo, enumeración, cambio forzado, baja de usuarios | Código + pruebas D5–D7 | ✅ Hecha |
| 6 | Datos y privacidad | Datos personales en logs, respuestas y almacenamiento; geolocalización | Lectura de código y logs | ✅ Hecha |
| 7 | Contenedores y despliegue | Usuario no root, imagen base, `.dockerignore`, nginx, cabeceras | Lectura de Dockerfiles y nginx (CIS Docker) | ✅ Hecha (estática) |
| 8 | Pruebas dinámicas en `localhost` | Acceso sin token, tokens manipulados, BOLA, fuerza bruta, CORS, tamaño de cuerpo, errores | `pruebas-dinamicas.mjs` (sin crear ni modificar datos) | ✅ Hecha |
| 9 | Informe y checklist | Consolidar, priorizar, estimar impacto de corregir | Este paquete de documentos | ✅ Hecha |
| 10 | Corrección punto por punto | Críticos y altos primero; cada uno con aprobación previa | Cambios pequeños + `check:ui` + `tsc` + pruebas dinámicas + prueba en pantalla | ⏳ Pendiente de aprobación |
| 11 | Re-auditoría | Repetir pruebas dinámicas y actualizar el checklist | `node pruebas-dinamicas.mjs` | ⏳ Después de las correcciones |

## 4. Reglas con que se ejecutó
1. **Solo lectura:** la auditoría no cambió código ni datos.
2. **Pruebas dinámicas solo en `localhost`:** sin registrar usuarios reales, sin guardar eventos; las escrituras se probaron únicamente con casos que el servidor rechaza antes de guardar.
3. **Sin ataques a sistemas de terceros** (API del cliente, Oracle). Las llamadas a la API del cliente fueron las mínimas (consultas de lectura).
4. **Los secretos no se imprimen:** solo se verificó longitud y entropía.
5. **Cada hallazgo lleva evidencia reproducible** (archivo y línea, o la prueba dinámica que lo demuestra).

## 5. Pendientes que no puede cubrir este equipo (para ciberseguridad / infraestructura)
- Escanear las imágenes `ayp-backend` y `ayp-frontend` (por ejemplo con `trivy image` o `grype`) en el servidor `concerto`, que tiene Docker.
- Confirmar que el tráfico hacia la API del cliente viaja por red privada o VPN, o que ellos habiliten HTTPS (H-05).
- TLS y HSTS en el balanceador de OCI, WAF, límites de tasa a nivel de borde, monitoreo, retención de logs y backups.
- Revisión de permisos y roles ORDS en la base (clients OAuth2) y rotación de secretos.
- Prueba de penetración externa antes del paso a producción, si la política de EFE lo exige.

## 6. Cómo repetir las pruebas dinámicas
```bash
# con el backend corriendo en localhost:3001 y un usuario de prueba (no de producción)
SEC_EMAIL=usuario.prueba@dominio SEC_PASSWORD='...' SEC_OBRA_PROPIA=155 SEC_OBRA_AJENA=156 node documentacion/seguridad/pruebas-dinamicas.mjs
```
Sin credenciales corre solo las pruebas que no requieren sesión. El script se niega a apuntar a un host que no sea `localhost`.

Para el límite de intentos de login (H-03) existe además una prueba aislada, sin Oracle ni API del cliente: `node documentacion/seguridad/prueba-limite-login.cjs`.
Para el control de sesiones (H-08) hay otra prueba aislada con reloj simulado: `node documentacion/seguridad/prueba-sesion.cjs`.
