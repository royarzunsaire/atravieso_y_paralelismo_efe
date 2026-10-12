# Reporte para el cliente / jefe — hallazgos y datos de prueba (BORRADOR)

> Preparado el 01-10-2026 (ampliado el 12-10-2026 con los hallazgos 15 a 21 y la sección de seguridad) a partir de las pruebas reales de la integración directa a SharePoint
> (spec 13). **No está enviado.** Rodrigo lo entrega cuando termine sus pruebas. Las listas de
> datos de prueba salen de las sesiones de trabajo: **verificar contra la API antes de borrar**.

## 1. Hallazgos de la API del cliente (no son bugs de la PWA)

| # | Hallazgo | Impacto | Qué se pide |
|---|---|---|---|
| 1 | El informe `.docx` de la **inspección 73** ya no aparece en ningún endpoint (`/inspecciones/73`, `/solicitudes/{id}`). | Se pierde un informe ya subido. | Revisar si se borró o cambió de carpeta. |
| 2 | Algunas **fotos llegaban vacías** (contenido 0 bytes) al descargarlas. | Fotos inutilizables. | Revisar la ingesta de `Fotos[].Contenido` (base64). |
| 3 | **`CatalogosVersion` no cambia cuando cambia el contenido** del catálogo (ej. `RequiereAdjunto` de un tipo). | Las apps con catálogo en caché validan con reglas viejas. La PWA ya se defiende (usa `AccionesDef` de la obra y valida en el backend), pero otras apps no. | Cambiar la versión cada vez que cambie cualquier bandera. |
| 4 | `TiposDocumento` no tenía el tipo 76 «Acta de Finalización de Obra» (hoy sí está definido). | Resuelto; dejar constancia. | — |
| 5 | `GET /v1/mobile/inicio` responde **404 `USUARIO_NO_ENCONTRADO`** para `rodrigo.oyarzun@efe.cl` (02-10-2026). Diagnóstico: el login contra Oracle SÍ funciona (hash y contraseña correctos, token emitido); el rechazo viene de la API del cliente con el mensaje «El correo no corresponde a un usuario con obras asignadas en este sitio». Probado con mayúsculas, sin acentos en el nombre y variantes de dominio (`@grupoefe.onmicrosoft.com`, `@grupoefe.cl`): todas 404, igual que un correo inexistente; los usuarios de control (`alan.sepulveda@efe.cl`, `gateway@grupoefe.onmicrosoft.com`) responden 200. El correo tampoco figura en la lista de usuarios de SharePoint (368 usuarios). | El usuario no puede ver ninguna obra en la PWA. No es un error de la PWA ni del hash. | Dar de alta el correo en el sitio de SharePoint y asignarle al menos una obra. Nota: la API usa el mismo 404 para «no existe» y «no tiene obras asignadas». **Inconsistencia detectada (02-10-2026):** con ese mismo correo, `GET /v1/solicitudes/155` (#999) responde **200** con rol «Supervisor Obra Atravieso y Paralelismo» y la acción `ACTA_INICIO`, mientras `/mobile/inicio` dice que no tiene obras; y `GET /v1/solicitudes/136` (#235) responde 403 `SIN_ACCESO_SOLICITUD` («No eres ITO ni Supervisor de esta obra»). O el inicio no lista todas las obras donde el usuario es Supervisor, o la asignación se hizo después y `/mobile/inicio` la tiene en caché. |
| 6 | **Alan Sepúlveda perdió el acceso a la #999 (403)** en un momento de las pruebas. | Bloqueó una prueba. | Confirmar si fue un reseteo del ambiente. |
| 7 | **Banderas de fecha ausentes** en la acción `ACTA_INICIO` (la PWA pide la fecha de inicio igual, y la API la acepta como `FechaEvento`). | Hay que adivinar qué campo guarda la fecha de inicio. | Documentar/agregar la bandera `RequiereFecha`. |
| 8 | Las **inspecciones generadas por acciones de control** (detener, reactivar, finalizar) quedan con **avance 0 %** si no se manda `AvancePct`. | Ensucia el historial. La PWA ya reenvía el avance actual. | Heredar el último avance cuando no venga. |
| 9 | `AvanceObraPct` a nivel de **obra** puede venir en `0` aunque la inspección más reciente tenga el porcentaje correcto. | Avance mostrado incorrecto. | Calcularlo desde la última inspección. |
| 10 | **Latencia alta y variable** (6–13 s+; la API atiende de a una petición). | Esperas largas en terreno. | Revisar rendimiento; la PWA ya comparte pedidos y precarga en segundo plano. |
| 11 | El detalle de una obra **tarda en reflejar** un documento recién subido (acta de inicio, etc.). | La PWA lo espera en segundo plano (CU-25). | Si es posible, reflejarlo de inmediato. |
| 12 | **Las obras finalizadas desaparecen de `/v1/mobile/inicio`** (ej. la #999 al pasar a «Obra finalizada»), y no hay forma de listarlas. `GET /v1/solicitudes/{id}` sí responde (SubEstado «Obra finalizada»), incluso para un usuario que nunca participó. | La PWA no puede mostrar un historial de obras finalizadas en las que participó el usuario. | Un parámetro en `/mobile/inicio` (ej. `incluirFinalizadas=true`) o un endpoint de historial, que indique en cuáles participó el usuario. **Rodrigo lo consulta con el jefe.** |
| 13 | **`/mobile/inicio` lista obras donde el usuario no tiene rol.** `alan.sepulveda@efe.cl` ve la #235 con rol «SIN_ROL» (y sin acciones), pero `GET /v1/solicitudes/136` le responde **403 `SIN_ACCESO_SOLICITUD`** («No eres ITO ni Supervisor de esta obra»). Observado el 02-10-2026, mientras el jefe cambiaba permisos. | El usuario ve una tarjeta que no puede abrir (Documentos e Inspecciones vacíos). | Que `/mobile/inicio` solo liste obras donde el usuario sea ITO o Supervisor, o que el detalle permita lectura. |
| 14 | `TiposDocumento[].Requerido` contradice a la acción: «Documento Con ITO 2» (id 67) viene con `Requerido: false`, pero la acción `DOCUMENTACION_ITO` pide ambos documentos con `RequiereAdjunto`. Además el sub-estado nuevo `EnRecepcionSinITO` (id 12) tiene el mismo label que `EnRecepcion` («En recepción de obra»). | Ambigüedad: la PWA exige ambos documentos (decisión del jefe de Rodrigo) y no puede distinguir los dos sub-estados por su texto. | Aclarar cuál campo manda y dar labels distintos a los sub-estados. |
| 15 | **El swagger no documenta `TiposDocumentoOpcional`** en `AccionHabilitada`, aunque la API lo devuelve (la PWA ya lo usa para los documentos opcionales). Tampoco documenta `GET /v1/inspecciones/{id}`, que la PWA consume. | Quien integre solo con el swagger no verá esos campos ni ese endpoint. | Agregarlos al swagger (`http://146.181.52.2:3000/v1/docs/`). |
| 16 | **`POST /v1/solicitudes/{id}/documentos` no es idempotente**: repetir la llamada crea el archivo otra vez. | La PWA NO reintenta (sin cola ni reintentos automáticos): si la respuesta se pierde, el usuario no sabe si se subió. | Aceptar una clave de idempotencia o rechazar un duplicado, y devolver el id del documento creado. |
| 17 | **La API se consume por HTTP sin cifrar** (`http://146.181.52.2:3000`). Ahí viajan el JWT de acceso, los correos de los usuarios, los comentarios y los archivos. | Cualquiera en el camino de red puede leer o alterar el tráfico. Ciberseguridad de EFE lo marcará. | **Exponer la API por HTTPS**, o confirmar que solo es accesible por red privada o VPN (y entonces indicar el origen para la política de seguridad del frontend). |
| 18 | **Las descargas de archivos llevan el token en la URL** (`/v1/documentos/{id}/descargar?token=…`, válido ~1 h). | El token queda en historiales, registros de servidores y proxies. | Aceptar el token en la cabecera `Authorization` o usar URLs firmadas de un solo uso y de vida más corta. |
| 19 | **El swagger describe la cabecera `X-Usuario-Prueba`**, que permitiría simular a cualquier usuario si la variable `AUTH_DESACTIVADA` estuviera activa. | Si llegara activa a producción, cualquiera podría suplantar a cualquier usuario. | **Confirmar por escrito que `AUTH_DESACTIVADA=false` en producción** (y de preferencia quitar la cabecera de la documentación pública). |
| 20 | **El mismo `404 USUARIO_NO_ENCONTRADO` para «el correo no existe» y «existe pero no tiene obras»** (ver también el hallazgo 5). | Imposible diagnosticar por qué un usuario no ve obras; además no permite distinguir un error de alta de un usuario sin asignación. | Códigos distintos (por ejemplo `USUARIO_SIN_OBRAS`). |
| 21 | **Límite de peticiones (429) sin cabecera `Retry-After`** y con un umbral que no está documentado. | La PWA tuvo que inventar esperas (botón «Actualizar» bloqueado 5 s). | Documentar el límite y enviar `Retry-After`. |

## 2. Datos de prueba a borrar (ambiente dev del cliente)

> **Estado al 12-10-2026:** el cliente ya había vaciado las inspecciones de las obras 136 y 999, pero hoy la **#999 (Id 155)** muestra de nuevo una «Inspección General» del 09-10-2026 con 1 foto y 2 documentos (`Areas.csv` y un acta de inicio de prueba), y la **#1000 (Id 156, de Alan)** tiene unas 6 inspecciones de prueba.

**Verificar cada ID antes de borrar.**

### Obra #235 (Id interno 136)
- Eventos 143, 144, 147, 149, 161 (y sus inspecciones 114, 115, 118, 120, 121 y la de finalización).
- Ítems de SharePoint 67, 68, 87, 88.
- Acta de recepción de prueba y documentos asociados.
- Avance de la obra quedó en 35 % por las pruebas.

### Obra #999 (Id interno 155)
- Inspecciones 129–132 y 137–143 (y otras de las pruebas).
- Actas de prueba (inicio, recepción, acta corregida), informe final de prueba, evento 167.
- La ficha técnica `…Ficha_Tecnica_Indicadores_Pasajeros_EFE_Central.docx` subida como acta/informe de prueba.

### Obra #1000 (Id interno 156, «Solicitud AYP Sin ITO»)
- Unas 6 inspecciones de prueba hechas por `alan.sepulveda@efe.cl` (verificar los ids antes de borrar).

### Oracle (cola outbox de la PWA)
- Evento huérfano `5CC9F1840F758060E0634E14000A1F84`: `INSPECCION_GENERAL` de la #999, sin adjunto, estado `error` (la API lo rechazó). Se puede borrar sin consecuencias.
- Eventos de prueba `ACTA_INICIO` de la #999 (ej. `5CC9E7A1E7F3810EE0634E14000A5239`).
- Revisar la tabla `inspecciones_outbox` por filas de prueba en estado `error`.

### Oracle (usuarios de prueba — IMPORTANTE para producción)
- `alan.sepulveda@efe.cl`, `gateway@grupoefe.onmicrosoft.com` y `rodrigo.oyarzun@efe.cl` son cuentas de prueba con contraseñas simples. **No deben existir (o deben estar dadas de baja: `activo = 0`) en el Oracle de producción.** Confirmarlo antes de poner la app en uso real.

## 3. Pendientes ligados al cliente
- Retirar `COMENTARIO_OBRA` del código cuando el cliente confirme que no se vuelve a habilitar.
- URL de producción de la API (la entrega el jefe de Rodrigo) y variables de entorno del deploy real.
- Etapa D de la spec 10: habilitar v2 para todas las obras (solo configuración).
- **HTTPS para su API** y **confirmar `AUTH_DESACTIVADA=false`** (hallazgos 17 y 19).
- Probar con una obra real el flujo `OBRA_FINALIZADA` y el rechazo del informe final (necesita una obra al 100 %).
- Decir cómo listar las obras finalizadas (hallazgo 12) para habilitar el filtro «Finalizadas» del dashboard.

## 4. Seguridad de la PWA (para conocimiento del cliente)
La PWA pasó una auditoría de seguridad (OWASP ASVS L2, Top 10, API Top 10, CIS Docker): los hallazgos propios están corregidos y las imágenes Docker dan **0 vulnerabilidades y 0 secretos** en `trivy`. El detalle está en `documentacion/seguridad/`. Lo que queda abierto **no depende de la PWA**: HTTPS hacia su API (hallazgo 17), TLS/WAF/MFA en el despliegue de OCI y la duración de la sesión (decisión pendiente).
