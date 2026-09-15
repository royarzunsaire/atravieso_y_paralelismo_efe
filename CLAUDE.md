# Sistema de Atravieso y Paralelismo (AyP) — EFE

## ¿Qué es este sistema?
PWA complementaria a la aplicación web de Atravieso y Paralelismo (AyP) de EFE,
diseñada para uso en terreno por inspectores de obra.

Permite gestionar las solicitudes que se encuentran en la fase "Realización de Obra":
registrar avance con porcentaje de progreso, adjuntar documentos y fotografías,
solicitar el cierre de obra y notificar a los involucrados.

Diseñada para funcionar en modo offline, garantizando que los inspectores puedan
operar con normalidad en terrenos o lugares sin conexión a internet, sincronizando
automáticamente cuando se restablece la conexión.

---

## Stack
- Frontend: React + TypeScript + Vite (PWA)
- Backend: Node.js + Express
- Auth: JWT propio (bcrypt) contra Oracle Autonomous Database vía ORDS REST — Azure AD deshabilitado temporalmente (código comentado, ver spec 02-azure-ad-login.md)
- Base de datos: Oracle Autonomous Database (ORDS 26.2.2) — ver `references/oracle-ords.md`
- Integración: Power Automate + SharePoint
- Deploy: Render (backend) + Vercel (frontend)

---

## Estructura de carpetas del proyecto

```
Atravieso y Paralelismo/
├── CLAUDE.md
├── .claude/
│   └── skills/
│       └── pwa-inspecciones-obra/
│           ├── SKILL.md
│           └── references/
│               ├── arquitectura.md
│               ├── reglas-negocio.md
│               ├── convenciones.md
│               ├── oracle-ords.md
│               └── specs/
│                   ├── 01-contador-dias.md
│                   ├── 02-azure-ad-login.md
│                   ├── 03-perfiles-usuario.md
│                   ├── 04-offline-mode.md
│                   ├── 05-cambio-contrasena.md
│                   └── 06-documentos-inspecciones.md
├── pwa-frontend/
│   └── src/
│       ├── app/components/ ← componentes React (pantallas y UI)
│       ├── context/        ← providers de estado global
│       ├── services/       ← llamadas a API y lógica de datos
│       └── types/           ← interfaces y tipos TypeScript
└── pwa-backend/
    ├── config/       ← passport (auth local)
    ├── routes/       ← endpoints REST
    ├── database.js   ← acceso a datos (Oracle vía ORDS)
    └── oracle.js     ← cliente HTTP hacia ORDS
```

---

## Skills de este proyecto
Antes de cualquier tarea, leer en este orden:
1. `~/.claude/skills/user/rodrigo-protocolo-tecnico/SKILL.md`
2. `.claude/skills/pwa-inspecciones-obra/SKILL.md`
3. La referencia correspondiente a la tarea

---

## ⚠️ Reglas irrompibles

### 1. Nunca asumir — siempre preguntar
Ante cualquier duda, ambigüedad o información faltante,
Claude DEBE preguntar antes de continuar. Sin excepciones.
No existe la "suposición razonable" — si no está confirmado, se pregunta.

### 2. Mostrar planning completo y esperar autorización
Antes de CUALQUIER acción (crear archivo, editar código, instalar
dependencia, modificar configuración), Claude debe:
  a) Mostrar el plan completo detallando qué hará y por qué
  b) Esperar respuesta explícita del usuario ("sí", "procede", "ok")
  c) Solo entonces ejecutar — nunca antes

### 3. Un paso a la vez
Nunca ejecutar múltiples acciones sin checkpoint intermedio.
Cada acción sigue el ciclo: mostrar → esperar aprobación → ejecutar.

### 4. Happy Path y Sad Path siempre definidos
Toda spec y todo código debe contemplar ambos caminos:
- Happy Path: qué pasa cuando todo funciona correctamente
- Sad Path: qué pasa cuando algo falla o el usuario hace algo inesperado
Si el Sad Path no está definido en la spec, Claude debe preguntar
antes de asumir un comportamiento de error.

---

## Features pendientes (en orden de prioridad)
1. [ ] Contador de días desde fecha de boleta
2. [ ] Login Azure AD para usuarios internos EFE — código comentado en esta fase (ver spec 02-azure-ad-login.md), se retoma en una fase futura, no en el corto plazo
3. [ ] Perfiles de usuario según rol SharePoint
4. [ ] Modo offline (lectura + escritura + sync)
5. [x] Subida de documentos a carpeta separada (`DocumentosInspecciones`, separada de `FotosInspecciones`) — completado
6. [x] Transactional Outbox para inspecciones (Oracle → SharePoint asíncrono), incluyendo fotos e informes — ver `.claude/skills/pwa-inspecciones-obra/references/specs/07-outbox-archivos.md`. Inspecciones/fotos/documentos se guardan primero en Oracle y sincronizan a SharePoint vía job interno cada 30s, con reintentos automáticos y manuales — completado y desplegado en producción
7. [x] Forzar cambio de contraseña en el primer login — ver `.claude/skills/pwa-inspecciones-obra/references/specs/08-forzar-cambio-password.md`. Flag `debe_cambiar_password` en Oracle (retroactivo a usuarios existentes); login bloquea el acceso a la app hasta completar el cambio — completado y desplegado en producción
8. [ ] Dockerización para OCI Container Instances — ver spec `09-dockerizacion-oci.md` y la guía de handoff `oci-deploy.md`. Empaquetar la app (backend + frontend) para desplegar en el ambiente Oracle Cloud del cliente, reemplazando Render/Vercel. **Código completo y VERIFICADO EN SERVIDOR (15-09-2026); solo falta la entrega de los `.tar` y el deploy real (lado del colega).** 2 imágenes separadas: backend (`node:20-alpine`, puerto 3001, interno) y frontend (`nginx:alpine`, puerto 8080, público), ambas en la misma Container Instance (se hablan por `localhost`). nginx sirve la SPA y hace de reverse proxy (`/api/*` y `/auth/*` → backend), con el host del backend resuelto en runtime vía el mecanismo de templates integrado de nginx (`NGINX_ENVSUBST_FILTER="^BACKEND_"`). El frontend llama con rutas relativas (`||`→`??` en los 11 servicios + fix de `sync.js`) → imagen inmutable entre ambientes. **Verificación end-to-end en el servidor `concerto`** (Docker 28.3.2, amd64): `docker compose build/up` + **login real contra Oracle a través del reverse proxy, OK**. `concerto` es servidor COMPARTIDO (concerto-app en 8080, mariadb 3306, 2×minio 9000/9090/9100/9101) → la prueba publicó el frontend en un puerto libre y **solo en localhost** (`docker-compose.override.yml` con `127.0.0.1:8090:8080`) + túnel SSH, sin tocar nada público; `firewalld` inactivo; se usó un dead-man's switch de seguridad. **Hallazgo clave (CORS)**: el backend valida el header `Origin` contra una whitelist, así que `FRONTEND_URL` DEBE ser el origen público exacto (con `https://`, sin `/` final) o el login falla con 403 — es env de runtime, no va en la imagen. Imágenes generadas: `ayp-backend.tar` (167M) + `ayp-frontend.tar` (69M). Flujo: Rodrigo construye/verifica en `concerto` y entrega los 2 `.tar`; su colega de arquitectura hace `docker load`, sube a OCIR y monta la Container Instance + Load Balancer (Rodrigo NO toca OCIR). **Pendiente**: entregar los `.tar` al colega, y que el colega configure `FRONTEND_URL` (dominio público), `BACKEND_HOST=localhost`/`BACKEND_PORT=3001` en el frontend, todas las env del backend, y confirme shape x86 (E-series).
9. [ ] Migración a la API de eventos unificada del cliente (event-driven + server-driven UI) — ver spec `10-migracion-api-eventos.md`. Reemplaza los ~8 flows sueltos de Power Automate por 2-3 APIs unificadas. **En curso** (detrás del flag `VITE_USE_API_V2`, producción intacta): Etapas A/B/C completas y verificadas con la obra 136 — botones dinámicos, guardado v2 (deducción de evento + registro con idempotencia), pestaña "Ctrl. Obra" (estado/detención/acciones OBRA_*) y validación de seguridad server-side, todo funcionando end-to-end. Además una ronda de pulido de UX sobre `SolicitudDetail`/`PhotosModal` (pestañas parejas y reordenadas, filtros apilados y con texto uniforme, barra de avance corregida en dashboard/Ctrl. Obra, precarga en cola del visor de fotos). El patrón outbox se conserva; solo cambia el destino del sync (API en vez de flows). Pendiente: Etapa D (expandir más allá de obra 136), env vars en Render/Vercel para llevarlo a producción, y `API_Detalle` (aún no la entrega el cliente). Leer la spec 10 completa antes de retomar — tiene todas las decisiones, mapeo de campos, seguridad y estado por etapas.
10. [x] Todas las fechas se guardan en UTC — ver spec `11-fechas-utc.md`. El frontend convierte el reloj de pared chileno a UTC con Luxon (`utils/fechas.ts`, zona `America/Santiago` explícita) antes de enviar; `fechaCierre` (fecha sin hora) se ancla a mediodía CL. El backend valida y normaliza a UTC (`utils/fechas.js`, `parseFechaInspeccion` → `400` si falta o no trae zona) y **ya no emite hora local** (se quitó el campo `date` pre-formateado). El display se formatea a hora de Chile en el frontend con helpers, correcto en cualquier dispositivo. Motivo: el cambio de horario del 05-09-2026 rompió/pisó datos en un sistema externo que guardaba hora local. Sin cambios en Oracle (fechas son strings en `payload_json`). Verificado end-to-end (`201` con conversión `-03:00`→`Z`, `400` sin zona). **Pendiente**: borrar 2 inspecciones de prueba en la obra 136 (SharePoint IDs 67 y 68) y verificación visual en sesión v2 real + Render.
11. [x] API de lectura de usuarios (ORDS, consumo externo del jefe) — ver spec `12-lectura-usuarios.md`. Tres handlers GET en el módulo `api_usuarios_actions` (`sql/13_lectura_usuarios.sql`): `listar` y `{id}` (sin hash) y `por-email/{email}` (con `password_hash`, para la doble verificación que el jefe hace con `bcrypt.compare` en su backend — su plataforma envía el password ya hasheado al crear). Reutiliza el privilegio `ayp.usuarios.actions` (sin roles nuevos). Fechas en UTC con `Z` (ORDS inserta en UTC — ver hallazgo #11 en `oracle-ords.md`). Guía de integración en `documentacion/integracion-externa.md`. Verificado end-to-end (`200`, hash solo en `por-email`, fechas UTC correctas). **Pendiente opcional**: prueba explícita con el token del client externo `AYP_INTEGRACION_EXTERNA`.
