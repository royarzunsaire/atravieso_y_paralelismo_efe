# Borrador del correo para enviar el reporte de hallazgos al cliente

> **Borrador** preparado el 12-10-2026 y **verificado contra la API ese mismo día** (consultas de solo lectura). Rodrigo lo completa y lo envía.
> Adjunto: `documentacion/reporte-cliente-pendientes.md` (mejor en PDF o pegado en el cuerpo, según cómo lo reciba el equipo del cliente).

## Para qué sirve el reporte
Es una lista de **problemas de la API del cliente** (SharePoint) que se fueron encontrando al integrar la PWA. **No son errores de la app.** Sirve para (1) pedirles que los corrijan, porque hay cosas que la PWA no puede resolver sola; (2) dejar constancia de que no son nuestros; y (3) pedirles que limpien los datos de prueba que quedaron en su ambiente.

---

**Asunto:** Integración PWA AyP ↔ API de SharePoint: hallazgos y pedidos al equipo del cliente

**Para:** `<jefe de Rodrigo>` (que lo reenvía al equipo del cliente) · **Cc:** `<…>`

Hola `<nombre>`:

Te adjunto el reporte con lo que encontramos al integrar la app móvil (PWA de AyP) con la API de SharePoint. **Son hallazgos de la API, no de la PWA**, y los dejamos documentados para que el equipo del cliente pueda revisarlos. Hoy volví a verificarlos contra la API: **ya quedaron resueltos** el acceso de `rodrigo.oyarzun@efe.cl` y el de Alan Sepulveda, y las obras sin rol que aparecían en el listado. Gracias por eso.

**Lo que sigue abierto, en tres puntos:**

1. **Seguridad.** Hoy la API se consume por **HTTP sin cifrar** (el JWT, los correos de los usuarios, los comentarios y los archivos viajan en claro), y las descargas de archivos llevan un token en la URL. Pedimos exponerla por **HTTPS** o confirmar que solo es accesible por red privada o VPN, y confirmar por escrito que **`AUTH_DESACTIVADA=false` en producción**. El área de Ciberseguridad de EFE va a revisar esto.
2. **Funcionalidad que hoy nos limita.**
   - Las **obras finalizadas desaparecen** del listado inicial, por lo que la app no puede mostrar el historial. Necesitamos saber cómo listarlas.
   - **`CatalogosVersion` no cambia** cuando cambia el contenido del catálogo, y las acciones de control (detener, reactivar, finalizar) crean inspecciones con avance 0 % si no se envía el avance.
   - **Latencia alta y variable** (de 6 a 13 segundos o más por consulta), que se nota mucho en terreno.
3. **Documentación y mejoras** (hallazgos 7, 11, 14 a 16, 20 y 21 del reporte): el swagger no documenta `TiposDocumentoOpcional` ni `GET /v1/inspecciones/{id}`; el POST de documentos no es idempotente; el mismo 404 para «el correo no existe» y «no tiene obras»; y el límite de peticiones (429) sin `Retry-After`.

**Datos de prueba a borrar** (ya verificados hoy, con sus ids; conviene que los revisen antes de borrar):
- **Obra #999 (Id 155):** inspecciones **206 y 207**, con fotos de prueba (una de 3 MB), `Areas.csv` y un acta de inicio de prueba.
- **Obra #1000 (Id 156):** inspecciones **185, 186, 187, 188, 189 y 190**.
- Obra #136: sus inspecciones ya las vaciaron; quedan las asignaciones de usuarios de prueba.

Del lado nuestro ya corregimos todos los hallazgos de seguridad propios de la PWA y las imágenes Docker dieron **0 vulnerabilidades** en el escaneo. El resumen está en la sección 4 del reporte.

¿Puedes hacérselo llegar al equipo del cliente, o prefieres que lo envíe yo directamente?

Saludos,
`<Rodrigo>`

---

## Antes de enviarlo (checklist de Rodrigo)
- [ ] Completar los `<…>` (nombre, destinatarios, tu firma).
- [ ] Decidir si va como adjunto (PDF) o pegado en el cuerpo.
- [ ] Confirmar con tu jefe a quién del cliente se lo hace llegar.
- [ ] Si pasan varios días, **volver a pedirme la verificación**: la API cambia sin aviso y estos hechos son del 12-10-2026.
