// Guardia del contrato de UI (references/contrato-ui.md).
// Verifica reglas simples "debe estar / no debe estar" sobre el código para
// que un cambio nuevo no reintroduzca lo que se decidió quitar ni borre lo
// que se decidió mantener. Uso: npm run check:ui
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const leer = (rel) => readFileSync(join(raiz, rel), 'utf8');

// tipo: 'debe' | 'noDebe' | 'noCerca' (anchor + ventana de caracteres)
const REGLAS = [
  // ── Carteles "Pendiente en la API" (CU-01) ──
  { id: 'CU-01a', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'Pendiente en la API',
    msg: 'El cartel debe salir de <PendienteApiBadge/> (utils/apiSupport.ts), no escrito a mano.' },
  { id: 'CU-01b', archivo: 'app/components/NewInspection.tsx', tipo: 'noCerca', ancla: 'ref={refFecha}', ventana: 500, texto: 'PendienteApiBadge',
    msg: 'La fecha/hora ya la soporta la API: no debe llevar cartel "Pendiente".' },
  { id: 'CU-01c', archivo: 'app/components/NewInspection.tsx', tipo: 'noCerca', ancla: 'ref={refTipo}', ventana: 500, texto: 'PendienteApiBadge',
    msg: 'El tipo de inspección ya lo soporta la API: no debe llevar cartel "Pendiente".' },
  { id: 'CU-01d', archivo: 'utils/apiSupport.ts', tipo: 'debe', texto: 'notificarUsuarios: false',
    msg: '"Notificar a" sigue sin campo en la API.' },

  // ── Formulario de inspección v2 (CU-02) ──
  { id: 'CU-02a', archivo: 'app/App.tsx', tipo: 'noDebe', texto: 'ObservacionesAvance',
    msg: 'La API guarda un solo texto (Comentario); no se envía ObservacionesAvance.' },
  { id: 'CU-02d', archivo: 'app/components/NewInspection.tsx', tipo: 'debeAntes', ancla: 'ref={refObservaciones}', ventana: 250, texto: '!esV2',
    msg: 'En v2 no debe existir el segundo campo de texto ("Observaciones de Inspección"): solo v1.' },
  { id: 'CU-02b', archivo: 'app/App.tsx', tipo: 'debe', texto: 'fechaEvento: fechaEventoUTC',
    msg: 'La fecha/hora del formulario debe enviarse como FechaEvento.' },
  { id: 'CU-02c', archivo: 'app/App.tsx', tipo: 'debe', texto: 'payload.TipoInspeccionId',
    msg: 'Debe enviarse TipoInspeccionId.' },

  // ── Detalle de obra v2 (CU-03) ──
  { id: 'CU-03a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'getInspeccion',
    msg: 'El detalle de cada inspección se carga en segundo plano (GET /inspecciones/{id}).' },
  { id: 'CU-03b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'fotosBlobCache',
    msg: 'Las fotos se precargan con fetch()+blob (el gateway bloquea <img> directo).' },
  { id: 'CU-03c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'new Image()',
    msg: 'La precarga con new Image() está bloqueada por CORP: no usar.' },
  { id: 'CU-03d', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'inspeccionesFiltradas',
    msg: 'Las inspecciones se ordenan de la más reciente a la más antigua.' },
  { id: 'CU-03e', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'ArrowUpDown',
    msg: 'El orden de Documentos usa ArrowUp/ArrowDown según la dirección.' },
  { id: 'CU-03f', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: "categoria: 'Categoría'",
    msg: 'Documentos: botones Nombre / Categoría / Tipo (formato); sin "Fecha" en v2.' },
  { id: 'CU-03g', archivo: 'utils/mapDetalle.ts', tipo: 'debe', texto: 'UrlDescarga',
    msg: 'Las URLs de archivos vienen en UrlDescarga.' },

  // ── Frescura de datos tras un evento (CU-05) ──
  { id: 'CU-05a', archivo: 'app/App.tsx', tipo: 'debe', texto: 'refrescarObraTrasEvento(',
    msg: 'Tras registrar una inspección se debe refrescar la obra completa.' },
  { id: 'CU-05b', archivo: 'utils/enviarAccionObra.ts', tipo: 'debe', texto: 'refrescarObraTrasEvento(',
    msg: 'Tras detener/reactivar/acta de inicio se debe refrescar la obra completa (Detencion).' },

  { id: 'CU-05c', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'fechaUltimoEventoPrevia',
    msg: 'El refresco tras un evento reintenta hasta que el detalle refleje el evento.' },
  { id: 'CU-05d', archivo: 'utils/mapInicio.ts', tipo: 'debe', texto: 'Math.floor(base + Math.max(0, corridos))',
    msg: 'Los días de detención se muestran enteros (la API deja DiasAcumulados con decimales).' },

  { id: 'CU-05e', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'tipoInspeccionEsperado',
    msg: 'El refresco espera la inspección nueva del tipo correcto (no la de otro usuario).' },
  { id: 'CU-05f', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'cambios.FechaInicioObra',
    msg: 'El refresco copia FechaInicioObra (la fija el acta de inicio).' },
  { id: 'CU-05g', archivo: 'utils/useMotivoDetencion.ts', tipo: 'debe', texto: 'borrarMotivo(clave)',
    msg: 'Un motivo de detención vacío no se deja cacheado.' },

  { id: 'CU-05h', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'cambiosDesdeDetalle(data)',
    msg: 'Un detalle más reciente que la obra también actualiza la obra (estado, acciones).' },

  // ── Amigabilidad al subir archivos (CU-06) ──
  { id: 'CU-06a', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: '<SubirArchivo',
    msg: 'Subir archivos usa el componente SubirArchivo (botón grande + estado visible).' },
  { id: 'CU-06b', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: 'type="file"',
    msg: 'No usar <input type="file"> pelado en EventoForm.' },

  // ── Obra detenida: color + label (CU-07) ──
  { id: 'CU-07a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '<BannerDetencion',
    msg: 'El detalle debe mostrar el banner «OBRA DETENIDA» cuando la obra está detenida.' },
  { id: 'CU-07b', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: '<EtiquetaDetenida',
    msg: 'La tarjeta del dashboard debe mostrar la etiqueta «OBRA DETENIDA».' },
  { id: 'CU-07c', archivo: 'utils/mapInicio.ts', tipo: 'debe', texto: 'diasDetencion: obra.Detencion?.FechaDetencionActual ? calcularDiasDetencion',
    msg: 'Los días de detención salen SOLO de calcularDiasDetencion (DiasAcumulados no avanza).' },
  { id: 'CU-07d', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'calcularDiasDetencion(obraV2.Detencion)',
    msg: 'El banner usa calcularDiasDetencion, no DiasAcumulados directo.' },

  // ── Tarjeta del dashboard (CU-08) ──
  { id: 'CU-08a', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: 'diasDesdeCL(v2.fechaInicioObra)',
    msg: 'La tarjeta muestra los días corridos desde el inicio de la obra (calendario de Chile).' },
  { id: 'CU-08g', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: 'bg-gray-100 border border-gray-300',
    msg: 'Los días de obra van en una etiqueta gris en su propia línea.' },
  { id: 'CU-08b', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: 'Inició el',
    msg: 'La tarjeta muestra la fecha de inicio de la obra.' },
  { id: 'CU-08c', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: 'v2.subEstado',
    msg: 'El pie de la tarjeta muestra el SubEstado, no la Etapa.' },
  { id: 'CU-08d', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: 'v2.rolEnObra',
    msg: 'La tarjeta muestra el rol del usuario en la obra.' },
  { id: 'CU-08e', archivo: 'app/components/BannerDetencion.tsx', tipo: 'debe', texto: 'text-xs font-bold',
    msg: 'La etiqueta de detención de la tarjeta debe ser pequeña (text-xs).' },
  { id: 'CU-08f', archivo: 'utils/mapInicio.ts', tipo: 'debe', texto: 'fechaInicioObra: obra.FechaInicioObra',
    msg: 'Se mapea FechaInicioObra para la tarjeta.' },

  // ── Inicio y días de obra en Información (CU-09) ──
  { id: 'CU-09a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Inicio de obra</p>',
    msg: 'La pestaña Información muestra la fecha de Inicio de obra.' },
  { id: 'CU-09b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'diasDesdeCL(obraV2.FechaInicioObra)',
    msg: 'Los días de obra salen de diasDesdeCL (calendario de Chile).' },

  // ── Motivo de la detención (CU-10) ──
  { id: 'CU-10a', archivo: 'app/components/BannerDetencion.tsx', tipo: 'noDebe', texto: 'Motivo:',
    msg: 'El banner del encabezado NO muestra el motivo (solo Ctrl. Obra).' },
  { id: 'CU-10b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'motivoDetencion={motivoDetencion}',
    msg: 'Ctrl. Obra recibe el motivo de la detención.' },
  { id: 'CU-10c', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'Motivo de la detención',
    msg: 'Ctrl. Obra muestra el recuadro «Motivo de la detención».' },
  { id: 'CU-10d', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'Acta de detención</p>',
    msg: 'Ctrl. Obra muestra el recuadro diferenciado «Acta de detención».' },
  { id: 'CU-10e', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'descargarActaDetencion(motivoDetencion)',
    msg: 'El acta tiene botón «Descargar».' },

  // ── Carga y precarga sin trabajo doble (CU-11) ──
  { id: 'CU-11a', archivo: 'services/detalleService.js', tipo: 'debe', texto: 'compartir(detalleEnVuelo',
    msg: 'El detalle de obra comparte los pedidos en curso.' },
  { id: 'CU-11b', archivo: 'services/detalleService.js', tipo: 'debe', texto: 'compartir(inspeccionEnVuelo',
    msg: 'El detalle de inspección comparte los pedidos en curso.' },
  { id: 'CU-11c', archivo: 'services/detalleCache.js', tipo: 'debe', texto: 'TTL_MS',
    msg: 'Los cachés del detalle vencen (las URLs de la API duran ~1 h).' },
  { id: 'CU-11d', archivo: 'services/detalleCache.js', tipo: 'noCerca', ancla: 'invalidarObra(solicitudId) {', ventana: 160, texto: 'inspecciones.clear()',
    msg: 'Tras un evento se conservan las inspecciones ya cargadas (ver invalidarObra).' },
  { id: 'CU-11e', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'fresco: true',
    msg: 'El refresco posterior a un evento pide datos frescos (no reutiliza un pedido previo al evento).' },
  { id: 'CU-11f', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'onEventoRegistrado={() => cargarDetalleV2(solicitudId)}',
    msg: 'Tras un evento no se fuerza una recarga completa del detalle (ya lo refrescó refrescarObraTrasEvento).' },
  { id: 'CU-11g', archivo: 'app/components/SolicitudesDashboard.tsx', tipo: 'debe', texto: 'detalleCache.limpiarTodo()',
    msg: '«Actualizar» limpia el caché del detalle.' },
  { id: 'CU-11h', archivo: 'app/components/SolicitudesDashboard.tsx', tipo: 'debe', texto: 'cargarMotivoDetencion(',
    msg: 'El dashboard precarga el motivo de la detención.' },
  { id: 'CU-11i', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'Cargando motivo de la detención',
    msg: 'Ctrl. Obra avisa mientras carga el motivo.' },

  // ── Documentos: botón Descargar, sin ojito (CU-12) ──
  { id: 'CU-12a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '<BotonDescargar url={archivo.link}',
    msg: 'La pestaña Documentos usa el botón «Descargar».' },
  { id: 'CU-12b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'title="Abrir en SharePoint"',
    msg: 'No hay «ojito»/«Abrir en SharePoint» en Documentos.' },
  { id: 'CU-12c', archivo: 'app/components/InformesModal.tsx', tipo: 'debe', texto: '<BotonDescargar',
    msg: 'Los informes de inspección usan el botón «Descargar».' },
  { id: 'CU-12d', archivo: 'app/components/InformesModal.tsx', tipo: 'noDebe', texto: '<Eye',
    msg: 'Los informes no llevan el ícono de ojo.' },

  // ── Acciones de la obra en Ctrl. Obra (CU-04 v13) ──
  { id: 'CU-04b', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: "'VALIDAR_INFORME', 'RECHAZAR_INFORME']",
    msg: 'VALIDAR_INFORME/RECHAZAR_INFORME ya no van en Ctrl. Obra: son la tarjeta «Informe final por validar» (CU-19).' },
  { id: 'CU-04c', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: 'ACTA_INICIO',
    msg: 'ACTA_INICIO y las demás ACTA_* / CORREGIR_ACTA se hacen en escritorio: NO van en la app.' },
  { id: 'CU-04d', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: "'COMENTARIO_OBRA'",
    msg: 'El comentario de obra se registra desde «+ Inspección», no en Ctrl. Obra.' },
  { id: 'CU-04g', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: 'ACTA_RECEPCION_FIRMADA',
    msg: 'ACTA_RECEPCION_FIRMADA es un trámite con aviso en Información (CU-16), no una acción de Ctrl. Obra.' },
  { id: 'CU-04e', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'GRUPOS_CTRL_OBRA',
    msg: 'Ctrl. Obra filtra las acciones con la lista fija de accionesApp.ts.' },
  { id: 'CU-04f', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'AVISO_CONFIRMACION',
    msg: 'Los formularios muestran el aviso de confirmación de las acciones sin vuelta atrás.' },

  // ── El avance no se pierde + finalizar con informe (CU-13) ──
  { id: 'CU-13a', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: 'tipoDocumentoId',
    msg: 'No hardcodear tipos de documento: los define la API (AccionesDef).' },
  { id: 'CU-13b', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: 'conAdjuntoObligatorio',
    msg: 'El formulario usa la acción tal como la define la API, sin parches locales.' },
  { id: 'CU-13c', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'payload.AvancePct = avanceActual',
    msg: 'Los eventos de Ctrl. Obra reenvían el avance actual (la inspección no debe quedar en 0 %).' },
  { id: 'CU-13d', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'avanceActual={',
    msg: 'Ctrl. Obra pasa el avance actual al formulario.' },
  { id: 'CU-13e', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'onNewInspection(solicitud, avanceReferencia)',
    msg: '«+ Inspección» usa el avance de referencia, no el de la última inspección.' },
  { id: 'CU-13f', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'onNewInspection(solicitud, ultimaInspeccion',
    msg: 'La última inspección puede venir con 0 % (reactivación/finalización): no usarla como mínimo.' },

  // ── Banderas de las acciones desde la API fresca (CU-14) ──
  { id: 'CU-14a', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'obra.AccionesDef?.[codigo]',
    msg: 'Ctrl. Obra usa la definición fresca de la acción (AccionesDef) sobre el catálogo cacheado.' },
  { id: 'CU-14b', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'cambios.AccionesDef',
    msg: 'Tras un evento se actualiza también la definición fresca de las acciones.' },
  { id: 'CU-14c', archivo: 'types/eventos.ts', tipo: 'debe', texto: 'AccionesDef?:',
    msg: 'ObraInicio lleva AccionesDef.' },

  // ── Acta de inicio como requisito previo (CU-15) ──
  { id: 'CU-15a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '<TramitePendienteCard',
    msg: 'Información muestra la tarjeta para subir el acta de inicio cuando falta.' },
  { id: 'CU-15b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: "!obraSinActa ? [{ id: 'control'",
    msg: 'Sin acta de inicio NO se muestra la pestaña Ctrl. Obra.' },
  { id: 'CU-15c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'obraSinActa || obraCerrada',
    msg: 'Sin acta de inicio (o sin tipos de inspección habilitados) NO se muestra «+ Inspección».' },
  { id: 'CU-15d', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'Término de Ejecución de Obra',
    msg: 'El botón «Término de Ejecución de Obra» era del flujo v1 (retirado): el cierre es «Finalizar obra» en Ctrl. Obra.' },
  { id: 'CU-15e', archivo: 'app/components/SolicitudCard.tsx', tipo: 'debe', texto: '<EtiquetaTramitePendiente',
    msg: 'La tarjeta del dashboard muestra «FALTA ACTA DE INICIO».' },
  { id: 'CU-15f', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'enviarAccionObra(',
    msg: 'El acta de inicio se envía con la función compartida enviarAccionObra.' },
  { id: 'CU-15g', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'enviarAccionObra(',
    msg: 'Ctrl. Obra envía con la función compartida enviarAccionObra.' },

  // ── Fecha de inicio de obra y Documentos (CU-15 v18) ──
  { id: 'CU-15h', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'pedirFechaInicio={tramite.pedirFechaInicio}',
    msg: 'El acta de inicio pide la fecha de inicio de la obra (→ FechaEvento).' },
  { id: 'CU-15i', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'fechaInicioAEventoUTC(fechaInicio)',
    msg: 'La fecha de inicio elegida se envía como FechaEvento.' },
  { id: 'CU-15j', archivo: 'utils/enviarAccionObra.ts', tipo: 'debe', texto: 'fechaEvento, sync: true',
    msg: 'El envío compartido pasa la FechaEvento a la API.' },
  { id: 'CU-15k', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'payload.Documentos = [documentoB64]',
    msg: 'Los documentos viajan en Payload.Documentos (lista), como prefiere el swagger.' },
  { id: 'CU-15l', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: 'payload.Documento = ',
    msg: 'No usar el campo «Documento» (retrocompatibilidad): usar Documentos.' },

  // ── Acta de recepción firmada como trámite (CU-16) ──
  { id: 'CU-16a', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "codigo: 'ACTA_RECEPCION_FIRMADA'",
    msg: 'El acta de recepción firmada es un trámite con aviso en Información y etiqueta en el dashboard.' },
  { id: 'CU-16b', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "codigo: 'ACTA_INICIO'",
    msg: 'El acta de inicio es un trámite con aviso en Información y etiqueta en el dashboard.' },

  // ── Inspecciones solo mientras la obra se ejecuta (CU-17) ──
  { id: 'CU-17a', archivo: 'utils/obraIniciada.ts', tipo: 'debe', texto: "['EnEjecucion', 'Detenida']",
    msg: 'Solo se aceptan inspecciones en los sub-estados En ejecución y Detenida.' },
  { id: 'CU-17b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'obraSinActa || obraCerrada || !hayTipoInspeccion ? null',
    msg: 'Una obra finalizada (o sin acta de inicio) no muestra «+ Inspección».' },
  { id: 'CU-17c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'no acepta nuevas inspecciones',
    msg: 'La pestaña Inspecciones explica por qué no hay «+ Inspección» en una obra finalizada.' },

  // ── Borrador del formulario y espera del líder (CU-02 / CU-18) ──
  { id: 'CU-02e', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'tipoInspeccionId, fechaInspeccion, progress',
    msg: 'El borrador guarda el tipo de inspección de la API (se perdía al volver de la foto).' },
  { id: 'CU-02f', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'setTipoInspeccionId(draft.tipoInspeccionId)',
    msg: 'El borrador restaura el tipo de inspección de la API.' },
  { id: 'CU-18a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Acta de recepción enviada',
    msg: 'En «Validación de recepción» Información muestra la tarjeta gris de espera del líder.' },
  { id: 'CU-18b', archivo: 'utils/obraIniciada.ts', tipo: 'debe', texto: "'ValidacionRecepcion'",
    msg: 'La espera del líder se detecta por el sub-estado «Validación de recepción».' },

  // ── Acta rechazada por el líder (CU-16) ──
  { id: 'CU-16d', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'ACTA RECHAZADA'",
    msg: 'El dashboard marca «ACTA RECHAZADA» cuando el líder devolvió el acta.' },
  { id: 'CU-16e', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'Comentario rechazo',
    msg: 'La tarjeta muestra el comentario del líder cuando rechazó el documento.' },
  { id: 'CU-16f', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debeAntes', ancla: 'bloquea={obraSinActa}', ventana: 160, texto: 'comentarioDevolucion=',
    msg: 'Información le pasa a la tarjeta del trámite el comentario de devolución.' },

  // ── Informe final y documentación como trámites; etiqueta solo para quien actúa (CU-16 v26) ──
  { id: 'CU-16g', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "codigo: 'INFORME_FINAL'",
    msg: 'El informe final es un trámite con tarjeta en Información y etiqueta en el dashboard.' },
  { id: 'CU-16h', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "codigo: 'DOCUMENTACION_ITO'",
    msg: 'La documentación de obra es un trámite con tarjeta en Información y etiqueta en el dashboard.' },
  { id: 'CU-16i', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: "'INFORME_FINAL'",
    msg: 'INFORME_FINAL ya no es una acción de Ctrl. Obra: es un trámite de Información.' },
  { id: 'CU-16j', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: 'etiquetaEspera',
    msg: 'Quien no puede subir el documento ve una etiqueta gris «ESPERANDO …».' },
  { id: 'CU-16k', archivo: 'app/components/SolicitudesDashboard.tsx', tipo: 'debe', texto: 'etiquetaDashboard(',
    msg: 'El dashboard usa etiquetaDashboard (ámbar solo para quien puede actuar).' },

  // ── Validación del informe final (CU-19) ──
  { id: 'CU-19a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '<ValidarInformeCard',
    msg: 'El Supervisor ve la tarjeta «Informe final por validar» en Información.' },
  { id: 'CU-19b', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "aprobar: 'Aprobar informe final'",
    msg: 'La tarjeta tiene el botón «Aprobar informe final».' },
  { id: 'CU-19c', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "rechazar: 'Rechazar informe final'",
    msg: 'La tarjeta tiene el botón «Rechazar informe final».' },
  { id: 'CU-19d', archivo: 'app/components/ValidarInformeCard.tsx', tipo: 'debe', texto: '<BotonDescargar',
    msg: 'El Supervisor puede descargar el informe antes de decidir.' },
  { id: 'CU-19e', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Informe final enviado',
    msg: 'Quien no puede validar ve la tarjeta gris «Informe final enviado».' },
  { id: 'CU-19f', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "'VALIDAR INFORME FINAL'",
    msg: 'El dashboard marca «VALIDAR INFORME FINAL» al Supervisor.' },

  // ── Cada inicio de sesión parte de cero (CU-20) ──
  { id: 'CU-20a', archivo: 'app/App.tsx', tipo: 'debe', texto: 'reiniciarCachesDeSesion();',
    msg: 'Al iniciar sesión se reinician los cachés (obras, detalles, fotos, catálogo).' },
  { id: 'CU-20b', archivo: 'services/auth.js', tipo: 'debe', texto: 'reiniciarCachesDeSesion();',
    msg: 'Al cerrar sesión se reinician los cachés.' },
  { id: 'CU-20c', archivo: 'context/InicioContext.tsx', tipo: 'debe', texto: 'EVENTO_SESION_REINICIADA',
    msg: 'El InicioContext vacía las obras cuando se reinicia la sesión.' },
  { id: 'CU-20d', archivo: 'context/InicioContext.tsx', tipo: 'debe', texto: 'gen !== generacion.current',
    msg: 'Una carga de la sesión anterior no pisa los datos de la sesión nueva.' },

  // ── Sin flows de Power Automate en v2 (CU-21) ──
  { id: 'CU-21a', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'usuariosService',
    msg: 'No se llama al flow de usuarios al abrir «+ Inspección» (v1 retirado).' },
  { id: 'CU-21b', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: '<PendienteApiBadge',
    msg: 'En v2 «Notificar a» se oculta: no queda ningún cartel «Pendiente en la API».' },
  { id: 'CU-21c', archivo: 'app/components/NewInspection.tsx', tipo: 'debeAntes', ancla: 'Selecciona los usuarios que recibirán notificación', ventana: 1500, texto: '{!esV2 && (',
    msg: 'La sección «Notificar a» solo se dibuja en v1.' },
  { id: 'CU-21d', archivo: 'app/App.tsx', tipo: 'noDebe', texto: 'CatalogsProvider',
    msg: 'No se piden los tipos viejos de Oracle (/api/tipos-inspeccion): v1 retirado.' },
  { id: 'CU-21e', archivo: 'app/App.tsx', tipo: 'noDebe', texto: 'recargarTiposInspeccion',
    msg: 'Al iniciar sesión no se piden los tipos viejos (v1 retirado).' },

  // ── Espera visible y errores explicados (CU-22) ──
  { id: 'CU-22a', archivo: 'app/App.tsx', tipo: 'debe', texto: '<ProgresoProvider>',
    msg: 'La app debe estar envuelta en ProgresoProvider (indicador de espera y popup de errores).' },
  { id: 'CU-22b', archivo: 'context/ProgresoContext.tsx', tipo: 'debe', texto: 'finally {',
    msg: 'El indicador de espera SIEMPRE se apaga (try/catch/finally).' },
  { id: 'CU-22c', archivo: 'context/ProgresoContext.tsx', tipo: 'debe', texto: '<ErrorPopup',
    msg: 'Si una operación falla se abre un popup que explica el motivo.' },
  { id: 'CU-22d', archivo: 'context/ProgresoContext.tsx', tipo: 'debe', texto: '<ProgresoOverlay',
    msg: 'La espera se muestra con un indicador de pantalla completa.' },
  { id: 'CU-22e', archivo: 'app/components/ProgresoOverlay.tsx', tipo: 'debe', texto: 'fixed inset-0',
    msg: 'El indicador de espera cubre toda la pantalla (no solo el botón).' },
  { id: 'CU-22f', archivo: 'utils/mensajesError.ts', tipo: 'debe', texto: 'Sin conexión',
    msg: 'Los errores se traducen a lenguaje simple (sin conexión, sesión vencida, tiempo agotado…).' },
  { id: 'CU-22g', archivo: 'app/components/ErrorPopup.tsx', tipo: 'debe', texto: 'min-h-12',
    msg: 'Los botones del popup de error son grandes (≥ 48 px).' },

  // ── Formulario «+ Inspección»: tipos, avance y adjuntos (CU-23) ──
  { id: 'CU-23a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'inicio.actualizarObraDesdeApi(solicitudId)',
    msg: 'Al abrir «+ Inspección» se consulta a la API qué tipos están habilitados ahora.' },
  { id: 'CU-23b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Continuar con los datos guardados',
    msg: 'Si la consulta falla, el popup ofrece continuar con los datos guardados.' },
  { id: 'CU-23c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'onClick={abrirNuevaInspeccion}',
    msg: 'El botón «+ Inspección» abre el formulario a través de la consulta a la API.' },
  { id: 'CU-23d', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'disabled={avanceBloqueado}',
    msg: 'Con la obra detenida el avance no se puede cambiar.' },
  { id: 'CU-23f', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'Este tipo de inspección exige al menos un adjunto',
    msg: 'Se avisa ANTES de guardar si al tipo elegido le falta el adjunto.' },
  { id: 'CU-23g', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'Para guardar falta:',
    msg: 'Sobre el botón Guardar se dice qué falta (adjunto).' },
  { id: 'CU-23h', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'accept=".pdf,.doc,.docx,image/*"',
    msg: 'El adjunto puede ser una foto o un archivo (PDF, Word o foto).' },
  { id: 'CU-23i', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'definicionTipo?.RequiereAdjunto',
    msg: 'Que el tipo exija adjunto sale de la definición de la API, no de una lista fija.' },
  { id: 'CU-23j', archivo: 'app/components/ErrorPopup.tsx', tipo: 'debe', texto: 'onAlternativa',
    msg: 'El popup de error admite una acción alternativa.' },

  // ── Finalizar obra exige 100 % (CU-24) ──
  { id: 'CU-24a', archivo: 'utils/finalizarObra.ts', tipo: 'debe', texto: 'Falta al menos una inspección registrada con 100 % de avance',
    msg: 'Finalizar obra exige una inspección al 100 % y explica el motivo.' },
  { id: 'CU-24b', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'motivoNoPuedeFinalizar(',
    msg: 'El botón Finalizar obra se desactiva con motivo si no hay 100 % de obra e inspección.' },
  { id: 'CU-24c', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'disabled={!!bloqueo}',
    msg: 'El botón bloqueado queda desactivado.' },
  { id: 'CU-24d', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'avancesInspecciones=',
    msg: 'Ctrl. Obra recibe el avance de las inspecciones.' },
  { id: 'CU-24e', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'FALTA_INSPECCION_100',
    msg: 'El backend también valida la finalización de obra.' },

  // ── Espera y errores conectados (CU-22b) ──
  { id: 'CU-22h', archivo: 'app/App.tsx', tipo: 'debe', texto: 'await conProgreso(',
    msg: 'Guardar la inspección usa el indicador de pantalla completa con popup de error.' },
  { id: 'CU-22i', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'await conProgreso(',
    msg: 'Enviar una acción de la obra usa el indicador de pantalla completa con popup de error.' },
  { id: 'CU-22j', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: "'Enviando…'",
    msg: 'El botón conserva su texto: la espera se muestra en pantalla completa.' },
  { id: 'CU-22k', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'Guardando...',
    msg: 'El botón Guardar Inspección conserva su texto.' },
  { id: 'CU-22l', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'alert(',
    msg: 'Los errores de archivos se muestran en el popup, no con alert().' },
  { id: 'CU-22m', archivo: 'app/components/PhotoCapture.tsx', tipo: 'noDebe', texto: 'alert(',
    msg: 'Los errores de la foto se muestran en el popup, no con alert().' },
  { id: 'CU-22n', archivo: 'utils/enviarAccionObra.ts', tipo: 'debe', texto: 'Actualizando tus datos',
    msg: 'Las acciones de la obra informan la etapa «Actualizando tus datos…».' },

  // ── Documentos que llegan después y rechazos informados (CU-25 / CU-26) ──
  { id: 'CU-25a', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'esperarDocumentoEnSegundoPlano(',
    msg: 'El documento recién subido se espera en segundo plano, sin bloquear la pantalla.' },
  { id: 'CU-25b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'detalleCache.suscribir(',
    msg: 'El detalle se suscribe al caché para completar Documentos cuando llega el archivo.' },
  { id: 'CU-25c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Actualizando documentos',
    msg: 'Mientras llega el documento se avisa «Actualizando documentos…».' },
  { id: 'CU-25d', archivo: 'utils/enviarAccionObra.ts', tipo: 'debe', texto: 'esperaDocumento:',
    msg: 'Las acciones que suben documento piden esperarlo en segundo plano.' },
  { id: 'CU-26a', archivo: 'app/App.tsx', tipo: 'debe', texto: 'exige al menos un adjunto',
    msg: 'Guardar la inspección revisa el adjunto contra lo que realmente se envía.' },
  { id: 'CU-26b', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'ADJUNTO_REQUERIDO',
    msg: 'El backend rechaza una acción sin adjunto obligatorio antes de guardarla.' },
  { id: 'CU-26c', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'EVENTO_RECHAZADO',
    msg: 'El backend informa el rechazo de la API con su causa (no «sin conexión»).' },
  { id: 'CU-26d', archivo: '../../pwa-backend/syncJob.js', tipo: 'debe', texto: 'rechazada: true',
    msg: 'Un rechazo de negocio de la API no se reintenta.' },

  // ── Fecha no futura y adjunto «foto O informe» (CU-02 / CU-23) ──
  { id: 'CU-02j', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'max={ahoraCLParaInput()}',
    msg: 'La fecha de la inspección no puede ser futura (max = ahora en hora de Chile).' },
  { id: 'CU-02g', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'no puede ser futura',
    msg: 'Una fecha futura se marca con su motivo al guardar.' },
  { id: 'CU-02h', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'FECHA_FUTURA',
    msg: 'El backend también rechaza inspecciones con fecha futura.' },
  { id: 'CU-23k', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'Obligatorio: una foto O un informe o archivo',
    msg: 'El adjunto obligatorio se explica como «foto O informe» (con uno basta).' },
  { id: 'CU-23l', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: '* obligatorio</span>',
    msg: 'No hay un «* obligatorio» suelto solo en las fotos: la regla va en la tarjeta de Adjuntos.' },
  { id: 'CU-23m', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: '>O</span>',
    msg: 'Entre foto e informe se muestra el separador «O».' },

  // ── Avance, avisos pastel, informe en borrador y Perfil (CU-23 / CU-02 / CU-27) ──
  { id: 'CU-23n', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'const avanceBloqueado = obraDetenida;',
    msg: 'El avance se bloquea SOLO con la obra detenida (no en Registro de Observación).' },
  { id: 'CU-23o', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'TIPO_REGISTRO_OBSERVACION_ID',
    msg: 'Registro de Observación ya no tiene un tratamiento especial de avance.' },
  { id: 'CU-23p', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'bg-amber-50 border-amber-300 text-amber-900',
    msg: 'Los avisos de adjunto obligatorio van en cajitas de color pastel.' },
  { id: 'CU-02i', archivo: 'app/App.tsx', tipo: 'debe', texto: 'informeInicial={informeBorrador}',
    msg: 'El informe adjunto se conserva al ir a la cámara y volver.' },
  { id: 'CU-27a', archivo: 'app/components/Profile.tsx', tipo: 'debe', texto: 'break-all',
    msg: 'El ID de usuario largo se parte dentro de la tarjeta del perfil.' },

  // ── Acta de entrega de terreno (CU-15 / CU-16) ──
  { id: 'CU-16m', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "codigo: 'ACTA_ENTREGA_TERRENO'",
    msg: 'El acta de entrega de terreno es un trámite documental (tarjeta + etiqueta), como el acta de inicio.' },
  { id: 'CU-16n', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'FALTA ACTA DE ENTREGA'",
    msg: 'La etiqueta del dashboard para el acta de entrega de terreno.' },
  { id: 'CU-15m', archivo: 'utils/obraIniciada.ts', tipo: 'debe', texto: "s.Codigo === 'EnEntregaTerreno'",
    msg: 'Una obra «en entrega de terreno» cuenta como no iniciada (sin Ctrl. Obra ni inspecciones).' },
  { id: 'CU-16o', archivo: 'utils/accionesApp.ts', tipo: 'noDebe', texto: "'ACTA_ENTREGA_TERRENO'",
    msg: 'El acta de entrega de terreno es un trámite en Información, no una acción de Ctrl. Obra.' },

  // ── Acciones nuevas detectadas solas (CU-28) ──
  { id: 'CU-28a', archivo: 'utils/gruposAcciones.ts', tipo: 'debe', texto: "GRUPOS_CTRL = ['Control de obra']",
    msg: 'Ctrl. Obra se arma por el grupo del catálogo.' },
  { id: 'CU-28b', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: 'export function tramitesNuevos(',
    msg: 'Las acciones desconocidas generan una tarjeta de trámite automática.' },
  { id: 'CU-28c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'tramitesNuevosObra.map(',
    msg: 'El detalle dibuja una tarjeta por cada acción nueva.' },
  { id: 'CU-28d', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'banderasDesconocidas(accion)',
    msg: 'Un requisito nuevo desconocido se avisa pero deja enviar.' },
  { id: 'CU-28e', archivo: 'app/components/NewInspection.tsx', tipo: 'debe', texto: 'esAccionInspeccion(codigo, inicio.catalogo)',
    msg: 'Los tipos de «+ Inspección» salen del grupo del catálogo, no del prefijo del código.' },
  { id: 'CU-28f', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: "codigo.startsWith('INSPECCION_')",
    msg: 'No depender del prefijo del código para detectar inspecciones.' },
  { id: 'CU-28g', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'GRUPOS_CTRL_OBRA.includes(def.Grupo)',
    msg: 'Ctrl. Obra muestra toda acción habilitada de su grupo, conocida o nueva.' },
  { id: 'CU-28h', archivo: '../../pwa-backend/apiEventos.js', tipo: 'debe', texto: "clave.startsWith('Requiere')",
    msg: 'El backend conserva los requisitos nuevos de las acciones.' },

  // ── Detalle sin acceso (CU-29) ──
  { id: 'CU-29a', archivo: 'services/detalleService.js', tipo: 'debe', texto: "err.code = 'SIN_ACCESO'",
    msg: 'El 403 del detalle se distingue del resto de errores.' },
  { id: 'CU-29b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '{detalleV2.sinAcceso',
    msg: 'Ante un 403 no se ofrece «Reintentar» (se explica qué hacer).' },
  { id: 'CU-29c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'No se pudo leer el detalle de las inspecciones',
    msg: 'Si el detalle no se leyó, la tarjeta de progreso no inventa «0 % / sin inspecciones».' },
  { id: 'CU-29d', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Math.round(obraV2?.AvanceObraPct ?? 0) : 0',
    msg: 'Sin detalle, el progreso muestra el avance real de la obra.' },

  // ── Varios documentos obligatorios en una acción (CU-30) ──
  { id: 'CU-30a', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'const multiDoc = !inspeccion && tiposDoc.length > 1;',
    msg: 'Una acción con varios tipos de documento ofrece un archivo por cada tipo (todos exigidos si la API pide adjunto).' },
  { id: 'CU-30b', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'else if (documentosB64.length > 0) payload.Documentos = documentosB64;',
    msg: 'Se envía un documento por cada tipo, con su TipoDocumentoId.' },
  { id: 'CU-30c', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'debes subir todos para poder enviarla',
    msg: 'El formulario avisa que hay que subir todos los documentos.' },
  { id: 'CU-30d', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'DOCUMENTOS_INCOMPLETOS',
    msg: 'El backend rechaza el envío si falta algún tipo de documento de la acción.' },

  // ── Retiro de v1 (CU-31): la app es siempre v2, sin flag ni servicios de flows ──
  { id: 'CU-31a', archivo: 'app/App.tsx', tipo: 'noDebe', texto: 'USE_API_V2',
    msg: 'El flag VITE_USE_API_V2 ya no existe: la app es siempre v2.' },
  { id: 'CU-31b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'USE_API_V2',
    msg: 'El detalle no tiene ramas v1.' },
  { id: 'CU-31c', archivo: 'app/components/NewInspection.tsx', tipo: 'noDebe', texto: 'const esV2',
    msg: 'El formulario de inspección no tiene ramas v1.' },
  { id: 'CU-31d', archivo: 'app/components/SolicitudesDashboard.tsx', tipo: 'noDebe', texto: 'solicitudesService',
    msg: 'El dashboard no usa el listado viejo de flows.' },
  { id: 'CU-31e', archivo: 'app/App.tsx', tipo: 'noDebe', texto: 'CierreObra',
    msg: 'La pantalla de cierre de obra v1 fue retirada (el cierre es «Finalizar obra»).' },
  { id: 'CU-31f', archivo: 'app/components/SolicitudCard.tsx', tipo: 'noDebe', texto: 'const esV2',
    msg: 'La tarjeta no distingue v1/v2.' },

  // ── Toda acción lleva el avance vigente (CU-13) ──
  { id: 'CU-13i', archivo: 'utils/avanceVigente.ts', tipo: 'debe', texto: 'export function avanceVigente(',
    msg: 'Existe una única función para el avance vigente de la obra.' },
  { id: 'CU-13j', archivo: 'utils/enviarAccionObra.ts', tipo: 'debe', texto: 'AvancePct: avanceVigente(obra)',
    msg: 'Toda acción sin avance propio se envía con el avance vigente (nunca queda en 0 %).' },
  { id: 'CU-13g', archivo: 'utils/tramitesObra.ts', tipo: 'noDebe', texto: 'enviaAvance',
    msg: 'El avance ya no se decide trámite por trámite: lo completa enviarAccionObra.' },
  { id: 'CU-13h', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'payload.AvancePct = Math.round(Number(obraInicio.AvanceObraPct))',
    msg: 'El backend completa el avance si el cliente no lo mandó.' },

  // ── Documentación del ITO rechazada (CU-16): se ve en la etiqueta y en la tarjeta, NO en el «Estado» ──
  { id: 'CU-16p', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'DOCUMENTACIÓN RECHAZADA'",
    msg: 'La documentación del ITO rechazada por el líder tiene su etiqueta.' },
  { id: 'CU-16q', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: 'La documentación de la obra fue rechazada',
    msg: 'La tarjeta de la documentación rechazada lo dice.' },

  { id: 'CU-16t', archivo: 'app/components/SolicitudCard.tsx', tipo: 'noDebe', texto: 'estadoExtra',
    msg: 'El rechazo NO se agrega al texto «Estado» (decisión de Rodrigo): solo etiqueta y tarjeta.' },
  { id: 'CU-16u', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'noDebe', texto: 'sufijoEstadoRechazo',
    msg: 'El «Estado» de Información no lleva sufijo de rechazo.' },

  // ── Validación de la documentación del ITO (CU-19) ──
  { id: 'CU-19h', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "'ESPERANDO VALIDACIÓN DOCUMENTACIÓN'",
    msg: 'Mientras el líder valida la documentación del ITO, la etiqueta lo dice (no «INFORME FINAL»).' },
  { id: 'CU-19i', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'titulo="Documentación enviada"',
    msg: 'La tarjeta de espera de la documentación se llama «Documentación enviada».' },
  { id: 'CU-19j', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: '/documentaci[oó]n/i.test(obra?.Estado',
    msg: 'La validación de documentación se distingue por el Estado de la obra (el sub-estado es genérico).' },

  // ── Validación de la documentación: mismos botones, otros textos, con los 2 documentos en la tarjeta (CU-19) ──
  { id: 'CU-19k', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "aprobar: 'Aprobar documentación'",
    msg: 'Al validar la documentación los botones dicen «Aprobar/Rechazar documentación», no «informe final».' },
  { id: 'CU-19l', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'VALIDAR DOCUMENTACIÓN'",
    msg: 'La etiqueta del dashboard del Supervisor dice «VALIDAR DOCUMENTACIÓN» en esa etapa.' },
  { id: 'CU-19m', archivo: 'app/components/ValidarInformeCard.tsx', tipo: 'debe', texto: 'TEXTOS_VALIDACION[contexto]',
    msg: 'Todos los textos de la tarjeta salen del contexto (informe final o documentación).' },
  { id: 'CU-19n', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'documentos={documentosAValidar}',
    msg: 'Los documentos a validar se muestran en la misma tarjeta donde se aprueba o rechaza.' },
  { id: 'CU-19o', archivo: 'app/components/ValidarInformeCard.tsx', tipo: 'noDebe', texto: 'Informe final por validar',
    msg: 'El título no está fijo en «informe final»: depende del contexto.' },


  { id: 'CU-19p', archivo: 'app/components/ValidarInformeCard.tsx', tipo: 'noDebe', texto: 'RequiereComentario: false',
    msg: 'La bandera de comentario la manda la API y se respeta: no se fuerza a «sin comentario» (decisión de Rodrigo, 06-10-2026).' },
  { id: 'CU-19q', archivo: 'app/components/ValidarInformeCard.tsx', tipo: 'debe', texto: 'textos.ayudaAprobar : textos.ayudaRechazo',
    msg: 'Aprobar y rechazar tienen cada uno su propio texto de ayuda del comentario.' },

  // ── Devolver documentación = rechazar la entrega de terreno (CU-32) ──
  { id: 'CU-32a', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "ACCION_DEVOLVER_DOCUMENTACION = 'DEVOLVER_DOCUMENTACION'",
    msg: 'La acción DEVOLVER_DOCUMENTACION es conocida (no cae en la tarjeta genérica).' },
  { id: 'CU-32b', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'TEXTOS_DEVOLUCION.devolver',
    msg: 'La tarjeta del acta de inicio ofrece el botón rojo «Devolver documentación».' },
  { id: 'CU-32c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'documentosEntrega : documentosDelTramite',
    msg: 'La tarjeta muestra el acta de entrega a revisar junto a los botones.' },
  { id: 'CU-32d', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'ACTA DE ENTREGA RECHAZADA'",
    msg: 'El ITO ve la etiqueta de rechazo cuando le devuelven el acta de entrega.' },
  { id: 'CU-32e', archivo: 'utils/gruposAcciones.ts', tipo: 'debe', texto: "'RECHAZAR_INFORME', 'DEVOLVER_DOCUMENTACION'",
    msg: 'DEVOLVER_DOCUMENTACION tiene pantalla propia: no cae en la tarjeta genérica de acciones nuevas.' },
  { id: 'CU-32f', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '<DevolverDocumentacionCard',
    msg: 'En cualquier etapa distinta de «Gestión de Obra», devolver documentación tiene su tarjeta con los documentos del ITO.' },
  { id: 'CU-32g', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "'REVISAR DOCUMENTACIÓN'",
    msg: 'El Supervisor ve una etiqueta cuando puede devolver la documentación.' },

  // ── Quien devolvió espera la corrección (CU-33) ──
  { id: 'CU-33a', archivo: 'utils/tramitesObra.ts', tipo: 'debe', texto: "etiqueta: 'ESPERANDO CORRECCIÓN DEL ITO'",
    msg: 'Quien devolvió un documento ve en el dashboard que espera la corrección del ITO.' },
  { id: 'CU-33b', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'TEXTOS_ESPERA_CORRECCION.titulo',
    msg: 'La tarjeta de quien espera la corrección lo dice y muestra comentario y documento.' },

  // ── Ubicación de cada inspección (CU-34) ──
  { id: 'CU-34a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'Ver ubicación',
    msg: 'Cada inspección con coordenadas ofrece el botón «Ver ubicación».' },
  { id: 'CU-34b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: "lazy(() => import('./UbicacionModal'))",
    msg: 'El mapa se carga bajo demanda, no en la carga inicial.' },
  { id: 'CU-34c', archivo: 'app/components/UbicacionModal.tsx', tipo: 'debe', texto: 'tile.openstreetmap.org',
    msg: 'El mapa usa OpenStreetMap.' },
  { id: 'CU-34d', archivo: 'app/components/UbicacionModal.tsx', tipo: 'debe', texto: 'Mapa no disponible sin conexión',
    msg: 'Sin conexión el pop-up avisa y deja las coordenadas.' },

  // ── Campos siempre visibles, banderas siempre frescas (CU-35) ──
  { id: 'CU-35a', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: '{accion.RequiereComentario && (',
    msg: 'El comentario solo se muestra cuando la API lo exige.' },
  { id: 'CU-35b', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'const mostrarAvance = inspeccion || accion.RequiereAvance;',
    msg: 'El avance solo se pide al registrar una inspección (o si la API lo exige): los pasos del flujo no son inspecciones.' },
  { id: 'CU-35c', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: 'Comentario <Marca',
    msg: 'No hay comentario «(opcional)»: solo se muestra cuando es obligatorio.' },
  { id: 'CU-35d', archivo: 'app/components/EventoForm.tsx', tipo: 'noDebe', texto: '{accion.RequiereAvance && (',
    msg: 'El avance no se oculta cuando la API no lo exige.' },
  { id: 'CU-35e', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: 'obligatorio={accion.RequiereAdjunto}',
    msg: 'El adjunto solo se marca obligatorio si la API lo exige.' },
  { id: 'CU-35h', archivo: 'app/components/EventoForm.tsx', tipo: 'debe', texto: '!inspeccion && !multiDoc && tiposDoc.length > 0 && (',
    msg: 'El documento se ofrece según los tipos de documento de la acción: sin tipos (rechazar/aprobar/devolver) no hay archivo.' },
  { id: 'CU-35f', archivo: 'utils/definicionVigente.ts', tipo: 'debe', texto: '...porDefecto, ...def, ...fresca,',
    msg: 'Las banderas salen de la definición fresca de la obra (AccionesDef), por encima del catálogo.' },
  { id: 'CU-35g', archivo: 'services/inicioService.js', tipo: 'debe', texto: 'const SIEMPRE_CATALOGO_FRESCO = true;',
    msg: 'El catálogo se pide completo en cada carga (la versión no detecta cambios de banderas).' },

  // ── Documentos opcionales de una acción (CU-36) ──
  { id: 'CU-36a', archivo: 'app/components/DocumentosOpcionalesBoton.tsx', tipo: 'debe', texto: 'Agregar documento opcional',
    msg: 'El botón de documentos opcionales se llama «Agregar documento opcional».' },
  { id: 'CU-36b', archivo: 'app/components/TramitePendienteCard.tsx', tipo: 'debe', texto: 'accion?.TiposDocumentoOpcional?.length',
    msg: 'La tarjeta de la acción muestra el botón solo si la API entrega TiposDocumentoOpcional.' },
  { id: 'CU-36c', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'accion.TiposDocumentoOpcional?.length',
    msg: 'Las acciones de Ctrl. Obra también ofrecen sus documentos opcionales.' },
  { id: 'CU-36d', archivo: 'services/eventosService.js', tipo: 'debe', texto: '/documentos`',
    msg: 'Los opcionales se suben por el endpoint propio /solicitudes/{id}/documentos (no dentro del evento).' },
  { id: 'CU-36e', archivo: '../../pwa-backend/routes/eventos.js', tipo: 'debe', texto: 'TIPO_DOCUMENTO_NO_PERMITIDO',
    msg: 'El backend revalida que el tipo esté en TiposDocumentoOpcional de una acción habilitada.' },
  { id: 'CU-36f', archivo: '../../pwa-backend/apiEventos.js', tipo: 'debe', texto: 'TiposDocumentoOpcional: Array.isArray(a.TiposDocumentoOpcional)',
    msg: 'El backend conserva TiposDocumentoOpcional de cada acción.' },

  // ── Adjuntos de una inspección nueva (CU-37) ──
  { id: 'CU-37a', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'fotosCargando ? <Loader2',
    msg: 'Mientras llegan las fotos se muestra «cargando», no un 0.' },
  { id: 'CU-37b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'informesCargando ? <Loader2',
    msg: 'Mientras llegan los informes se muestra «cargando», no un 0.' },
  { id: 'CU-37c', archivo: 'utils/refrescarObra.ts', tipo: 'debe', texto: 'esperarAdjuntosInspeccionEnSegundoPlano(',
    msg: 'La inspección nueva espera en segundo plano a que lleguen sus fotos e informes.' },
  { id: 'CU-37d', archivo: 'app/App.tsx', tipo: 'debe', texto: 'esperaAdjuntosInspeccion:',
    msg: 'Al guardar una inspección se indica cuántas fotos e informes se esperan.' },
  { id: 'CU-37e', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: '...conservar(prev.fotos), ...fotosMap',
    msg: 'Recargar el detalle no vacía las fotos ya cargadas de las otras inspecciones.' },

  // ── Actualizar el detalle de una obra (CU-38) ──
  { id: 'CU-38a', archivo: 'app/components/Header.tsx', tipo: 'debe', texto: "refreshing ? 'Actualizando…' : 'Actualizar'",
    msg: 'El encabezado ofrece el botón «Actualizar» (y dice «Actualizando…» mientras trabaja).' },
  { id: 'CU-38b', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'onRefresh={actualizarDatos}',
    msg: 'El detalle de la obra muestra «Actualizar» en su encabezado, para todas las pestañas.' },
  { id: 'CU-38c', archivo: 'app/components/SolicitudDetail.tsx', tipo: 'debe', texto: 'setTimeout(() => setEnfriando(false), 5000)',
    msg: 'Tras actualizar el botón queda bloqueado unos segundos (límite de peticiones de la API).' },

  // ── Login bloqueado por intentos (CU-39) ──
  { id: 'CU-39a', archivo: 'services/auth.js', tipo: 'debe', texto: "data.message || data.error || 'Error al iniciar sesión'",
    msg: 'El login muestra el mensaje del bloqueo por demasiados intentos (429), que viene en `message`.' },

  // ── Control de obra (CU-04) ──
  { id: 'CU-04a', archivo: 'app/components/ControlObra.tsx', tipo: 'debe', texto: 'comentarioDevolucion',
    msg: 'Ctrl. Obra muestra el comentario de devolución.' },
];

let fallos = 0;
for (const r of REGLAS) {
  let ok = true;
  let contenido = '';
  try { contenido = leer(r.archivo); } catch { ok = false; }
  if (ok) {
    if (r.tipo === 'debe') ok = contenido.includes(r.texto);
    else if (r.tipo === 'noDebe') ok = !contenido.includes(r.texto);
    else if (r.tipo === 'noCerca') {
      const i = contenido.indexOf(r.ancla);
      ok = i === -1 ? true : !contenido.slice(i, i + r.ventana).includes(r.texto);
    } else if (r.tipo === 'debeAntes') {
      const i = contenido.indexOf(r.ancla);
      ok = i === -1 ? true : contenido.slice(Math.max(0, i - r.ventana), i).includes(r.texto);
    }
  }
  if (!ok) { fallos++; console.error(`✗ ${r.id} [${r.archivo}] ${r.msg}`); }
}

if (fallos) {
  console.error(`\n${fallos} regla(s) del contrato de UI incumplida(s). Ver references/contrato-ui.md`);
  process.exit(1);
}
console.log(`✓ Contrato de UI OK (${REGLAS.length} reglas)`);
