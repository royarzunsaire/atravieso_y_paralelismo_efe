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
