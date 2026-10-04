# Reporte para el cliente / jefe — hallazgos y datos de prueba (BORRADOR)

> Preparado el 01-10-2026 a partir de las pruebas reales de la integración directa a SharePoint
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

## 2. Datos de prueba a borrar (ambiente dev del cliente)

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

### Oracle (cola outbox de la PWA)
- Evento huérfano `5CC9F1840F758060E0634E14000A1F84`: `INSPECCION_GENERAL` de la #999, sin adjunto, estado `error` (la API lo rechazó). Se puede borrar sin consecuencias.
- Eventos de prueba `ACTA_INICIO` de la #999 (ej. `5CC9E7A1E7F3810EE0634E14000A5239`).
- Revisar la tabla `inspecciones_outbox` por filas de prueba en estado `error`.

## 3. Pendientes ligados al cliente
- Retirar `COMENTARIO_OBRA` del código cuando el cliente confirme que no se vuelve a habilitar.
- URL de producción de la API (la entrega el jefe de Rodrigo) y variables de entorno del deploy real.
- Etapa D de la spec 10: habilitar v2 para todas las obras (solo configuración).
