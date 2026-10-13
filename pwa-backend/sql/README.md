# SQL / PL-SQL ejecutado en Oracle Autonomous Database

Cada archivo de esta carpeta es un script ejecutado manualmente por Rodrigo en
**SQL Developer Web** contra la instancia `GF0C968A5244B47_DEVTRANS`
(`ATRAVIESO_PARALELISMO`). Node.js no tiene driver directo a Oracle — todo el
acceso es vía ORDS REST (ver `.claude/skills/pwa-inspecciones-obra/references/oracle-ords.md`
para el detalle de bugs/comportamientos descubiertos).

**Regla a partir de ahora:** cualquier DDL o `ORDS.DEFINE_*` nuevo se escribe
primero aquí como archivo `.sql`, se le pasa a Rodrigo para ejecutar, y solo
después de confirmar que corrió bien se actualiza el código Node que lo
consume. Así queda trackeado en git en vez de vivir solo como prosa en
`oracle-ords.md`.

Los archivos están numerados en el orden en que se ejecutaron. Reconstruidos
a partir de `oracle-ords.md` y el historial de la conversación — si alguno no
coincide exactamente con lo corrido en producción, `oracle-ords.md` es la
fuente de verdad sobre el comportamiento observado, pero el DDL real vive acá
de ahora en adelante.

| Archivo | Qué hace |
|---------|----------|
| `01_tabla_usuarios.sql` | Tabla `usuarios` + trigger `trg_usuarios_bi` + módulo `api_usuarios_actions` (register, last-login, change-password) |
| `02_oauth2_clients_roles.sql` | Roles ORDS, privilegios, clients OAuth2 (`AYP_BACKEND_NODEJS`, `AYP_INTEGRACION_EXTERNA`) |
| `03_tablas_outbox.sql` | Tablas `inspecciones_outbox` / `archivos_outbox` / `sync_log` + triggers |
| `04_modulo_inspecciones_actions.sql` | Módulo `api_inspecciones_actions` — acciones `guardar`, `pendientes`, `marcar-resultado`, `{id}` |
| `05_inspecciones_por_solicitud.sql` | Acción nueva `por-solicitud/{solicitud_id}` — corrige bug de inspecciones en error terminal invisibles en el listado |
| `06_archivos_outbox_estado.sql` | Amplía `archivos_outbox` con ciclo de sync propio (archivos que se suben en su propio POST, separados de la inspección) |
| `07_archivos_outbox_inspector.sql` | Agrega `inspector_email`/`inspector_nombre` a `archivos_outbox` (metadata que el sync job necesita para el flow de subida) |
| `08_exponer_sharepoint_id_inspeccion.sql` | Expone `sharepoint_id` en los GET de `inspecciones_outbox` — corrige bug de inspección duplicada al reintentar |
| `09_debe_cambiar_password.sql` | Flag `debe_cambiar_password` (retroactivo) — fuerza cambio de contraseña en el primer login (spec 08) |
| `10_outbox_eventos.sql` | Migración del outbox a la API de eventos unificada (Etapa A): `payload_version` + `evento_id_externo` para idempotencia (spec 10) |
| `11_tipos_inspeccion.sql` | Tabla `tipos_inspeccion` + AutoREST + carga inicial — reemplaza el flow de SharePoint (el jefe sincroniza la tabla; lectura para el backend) |
| `12_grant_tipos_inspeccion.sql` | Otorga a `AYP_BACKEND_NODEJS` el rol interno de AutoREST de `tipos_inspeccion` (sin él, todo GET da 401) |
| `13_lectura_usuarios.sql` | API de lectura de usuarios (consumo externo): GET `listar`/`{id}` (sin hash) y `por-email/{email}` (con `password_hash`) (spec 12) |
| `14_activar_desactivar_usuario.sql` | Activar/dar de baja usuarios (consumo externo): POST `{id}/activo` y `por-email/{email}/activo` con `{ "activo": 0|1 }` — solo toca la columna `activo` |
