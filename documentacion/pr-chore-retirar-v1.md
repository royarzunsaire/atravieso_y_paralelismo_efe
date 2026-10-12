# Retirar v1, completar el flujo de documentos y endurecer la seguridad (API directa a SharePoint)

**Base:** `feat/integracion-sharepoint-v2` · **Rama:** `chore/retirar-v1` · 41 commits · 161 archivos (+4.041 / −16.240)

## Resumen
Elimina por completo el modo v1 (Power Automate) y deja la app solo con la API directa del cliente (SharePoint, spec 13). Incorpora el flujo completo de documentos (devolver, espera de corrección, opcionales), el mapa de ubicación de las inspecciones y los formularios de acción dinámicos; limpia el código y las dependencias sin uso; y aplica los resultados de una **auditoría de seguridad** (OWASP ASVS L2, Top 10, API Top 10, CIS Docker) con imágenes Docker nuevas, escaneadas con `trivy` (0 vulnerabilidades, 0 secretos).

## Qué incluye

### 1. Retiro de v1
- **Backend:** se quitan las rutas de flows (`/api/solicitudes`, `/inspecciones`, `/fotos`, `/informes`, `/archivos`, `/tipos-inspeccion`, `/usuarios`, `/datos` → ahora 404), el sync v1 y las variables `FLOW_*`.
- **Frontend:** se quitan las ramas v1, los servicios y contextos de flows y el flag `VITE_USE_API_V2`.
- La cola de Oracle no tenía filas v1; no se tocó ninguna tabla.

### 2. Flujo de documentos y formularios (contrato de UI v67, 256 reglas en `npm run check:ui`)
- **Devolver documentación** (CU-32) y **estado de espera de la corrección** (CU-33).
- **Mapa de ubicación** de cada inspección (CU-34, OpenStreetMap, `leaflet` + `react-leaflet`, carga bajo demanda).
- **Formularios de acción dinámicos** (CU-35): comentario solo si la API lo exige, avance solo en inspecciones, documento según `TiposDocumento`; las banderas salen siempre de la definición fresca de la obra.
- **Documentos opcionales** (CU-36): `POST /api/v2/solicitudes/:id/documentos` con revalidación en el servidor (no avanza el flujo; sin reintentos porque la API no es idempotente).
- **Inspección recién creada** sin contadores en 0 (CU-37), botón **«Actualizar»** en el detalle (CU-38).
- **Limpieza:** 59 archivos y 56 dependencias npm sin uso; en ejecución quedan `react`, `react-dom`, `lucide-react`, `luxon`, `leaflet`, `react-leaflet`, `tw-animate-css` y `@fontsource/inter`.

### 3. Seguridad (informe completo en `documentacion/seguridad/`)
Checklist de 87 controles: **58 ✅ / 17 ⚠️ / 1 ❌** (el ❌ es HTTP hacia la API del cliente, que no depende de la PWA).
- **Autenticación y sesión:** se elimina el registro público (H-01); límite de 5 intentos fallidos cada 10 min por correo + IP (H-03); mensaje único anti-enumeración (H-06); la **baja de un usuario corta su sesión en ~1 min** y «Cerrar sesión» invalida el token en el servidor (H-08, probado con baja real: 61–64 s); se elimina el inicio de sesión por token en la URL (H-09); `sessionStorage` se vacía al cerrar sesión (H-14); contraseñas nuevas de 10+ caracteres con letras y números, sin contraseñas comunes y bcrypt costo 12 (H-19).
- **API:** límites de cuerpo por zona y errores 400/413 (H-10); **validación en el servidor de archivos y del `Payload`** (extensión, firma real, peso, cantidad, esquema; H-11); errores genéricos y logs sin correo ni hash (H-04, H-18); CORS solo `FRONTEND_URL` en producción (H-16); `/` y `/health` mínimos (H-15); errores sin capturar terminan el proceso (H-22).
- **Navegador y nginx:** CSP estricta y cabeceras (H-07); fuente Inter autohospedada, sin Google (H-21); límite de peticiones en nginx (`/auth/` 20/min, `/api/` 50/s; E13, verificado con nginx real); `server_tokens off`.
- **Contenedores:** usuarios sin privilegios, `HEALTHCHECK`, Node 24, bases fijadas por digest, sin `scripts/`/`*.db`/`.env` en la imagen, backend sin `npm` (H-12).
- **Dependencias:** `npm audit` de producción en 0; se quitan `express-session` y `passport-azure-ad` (H-02, H-17).
- **Baja y alta de usuarios por ORDS:** `pwa-backend/sql/14_activar_desactivar_usuario.sql` (ya ejecutado en Oracle).

### 4. Imágenes Docker
Reconstruidas y verificadas en `concerto` (amd64): login real a través del proxy, dashboard, detalle, foto y cierre de sesión, más la baja/alta de usuarios por nginx. `trivy`: **0 vulnerabilidades y 0 secretos**. Las imágenes (`.tar`) no se versionan; el correo de entrega con sus sha256 y la configuración está en `documentacion/entrega-imagenes-oci.md`.

## Verificación
- `npm run check:ui` (256 reglas), `tsc --noEmit`, `eslint` y `npm run build` pasan.
- Batería dinámica de seguridad (`documentacion/seguridad/pruebas-dinamicas.mjs`, solo localhost): 40 OK; la fila D12 depende de la obra «ajena» que se elija (el usuario de prueba tiene acceso a ambas).
- Pruebas aisladas: `prueba-sesion.cjs` (16/16).
- Todas las pruebas en pantalla fueron de solo lectura sobre SharePoint.

## Pendiente / a tener en cuenta
- **Duración del token (hoy 7 días):** decisión de la jefatura; propuesta de 24 h con renovación deslizante.
- **HTTPS hacia la API del cliente** (H-05) y confirmar `AUTH_DESACTIVADA=false` en producción: dependen del cliente.
- **Despliegue (OCI):** `FRONTEND_URL` = origen público exacto (con `https://`, sin `/` final), `TRUST_PROXY` (probablemente 2), `CSP_CONNECT_EXTRA`, política de reinicio ante fallo, shape x86, `X-Forwarded-Proto: https` en el balanceador. Detalle en `.claude/skills/pwa-inspecciones-obra/references/oci-deploy.md`.
- **Sin confirmar con datos reales:** el flujo `OBRA_FINALIZADA`, el rechazo del informe final y la subida real de un documento opcional.
- **Cliente:** quitar `COMENTARIO_OBRA` cuando lo confirme; filtro «Finalizadas» a la espera de cómo listar obras finalizadas; hallazgos y datos de prueba en `documentacion/reporte-cliente-pendientes.md`.
- Los `.db` antiguos siguen en el **historial de git** (contraseñas ya cambiadas); no se reescribió el historial.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
