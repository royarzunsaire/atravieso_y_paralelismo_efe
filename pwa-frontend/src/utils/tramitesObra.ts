import type { CatalogoInicio, ObraInicio } from '@/types/eventos';
import { esperaAprobacionRecepcion } from '@/utils/obraIniciada';
import { ACCIONES_OCULTAS, ACCIONES_CON_PANTALLA_PROPIA, GRUPOS_CTRL, GRUPOS_FORM_INSPECCION, definicionDe, esAccionInspeccion } from '@/utils/gruposAcciones';

/**
 * Trámites documentales que la app le pide al usuario con una tarjeta de aviso en
 * «Información» y una etiqueta en el dashboard (contrato CU-15 / CU-16). Cada uno
 * es una acción de la API que se envía con un documento.
 */
export interface Tramite {
  codigo: string;
  /** Etiqueta pequeña (ámbar) del dashboard para quien PUEDE subir el documento. */
  etiqueta: string;
  /** Etiqueta gris del dashboard para quien NO puede subirlo: se está esperando al responsable. */
  etiquetaEspera: string;
  titulo: string;
  mensaje: string;
  /** Botón cuando el usuario sí tiene el permiso. */
  boton: string;
  /** Mensaje cuando el usuario NO tiene el permiso. */
  sinPermiso: string;
  /** Pide «Fecha de inicio de la obra» (→ FechaEvento). */
  pedirFechaInicio: boolean;
  /** El evento crea una inspección en la API (afecta cuánto espera el refresco). */
  creaInspeccion: boolean;
  /** Sub-estado (código del catálogo) en el que el trámite sigue pendiente aunque el usuario no pueda subirlo. */
  subEstadoCodigo: string;
  toastOk: string;
  /**
   * Variante cuando el líder RECHAZÓ el documento: la API vuelve a habilitar la misma acción y
   * la obra trae `ComentarioDevolucion`. Se muestra el comentario y se pide el documento corregido.
   */
  rechazo?: {
    titulo: string;
    mensaje: string;
    boton: string;
    sinPermiso: string;
    etiqueta: string;
    toastOk: string;
  };
}

export const TRAMITES: readonly Tramite[] = [
  {
    codigo: 'ACTA_ENTREGA_TERRENO',
    etiqueta: 'FALTA ACTA DE ENTREGA',
    etiquetaEspera: 'ESPERANDO ACTA DE ENTREGA',
    titulo: 'Falta el acta de entrega de terreno',
    mensaje: 'Hasta que se suba el acta de entrega de terreno la obra no puede iniciarse: no se pueden agregar inspecciones ni usar el control de obra.',
    boton: 'Subir acta de entrega de terreno',
    sinPermiso: 'Aún no se sube el acta de entrega de terreno. Debe hacerlo el ITO de esta obra.',
    pedirFechaInicio: false,
    creaInspeccion: false,
    subEstadoCodigo: 'EnEntregaTerreno',
    toastOk: 'Acta de entrega de terreno registrada. Ahora falta el acta de inicio.',
    rechazo: {
      titulo: 'El acta de entrega de terreno fue rechazada',
      mensaje: 'El Supervisor devolvió el acta. Corrígela según su comentario y súbela de nuevo.',
      boton: 'Subir acta corregida',
      sinPermiso: 'El ITO debe subir el acta de entrega de terreno corregida.',
      etiqueta: 'ACTA DE ENTREGA RECHAZADA',
      toastOk: 'Acta de entrega corregida enviada.',
    },
  },
  {
    codigo: 'ACTA_INICIO',
    etiqueta: 'FALTA ACTA DE INICIO',
    etiquetaEspera: 'ESPERANDO ACTA DE INICIO',
    titulo: 'Falta el acta de inicio de obra',
    mensaje: 'Hasta que se registre el acta de inicio no se pueden agregar inspecciones ni usar el control de obra.',
    boton: 'Subir acta de inicio de obra',
    sinPermiso: 'Aún no se sube el acta de inicio. Debe hacerlo quien tiene el permiso para esta obra.',
    pedirFechaInicio: true,
    creaInspeccion: false,
    subEstadoCodigo: 'PorIniciar',
    toastOk: 'Acta de inicio registrada. La obra ya puede comenzar.',
  },
  {
    codigo: 'ACTA_RECEPCION_FIRMADA',
    etiqueta: 'FALTA ACTA DE RECEPCIÓN',
    etiquetaEspera: 'ESPERANDO ACTA DE RECEPCIÓN',
    titulo: 'Falta el acta de recepción firmada',
    mensaje: 'La obra fue finalizada. Para continuar con el cierre debes subir el acta de recepción firmada.',
    boton: 'Subir acta de recepción firmada',
    sinPermiso: 'Aún no se sube el acta de recepción firmada. Debe hacerlo quien tiene el permiso para esta obra.',
    pedirFechaInicio: false,
    creaInspeccion: false,
    subEstadoCodigo: 'EnRecepcion',
    toastOk: 'Acta de recepción firmada registrada.',
    rechazo: {
      titulo: 'El acta de recepción fue rechazada',
      mensaje: 'El líder rechazó el acta. Corrígela según su comentario y súbela de nuevo.',
      boton: 'Subir acta corregida',
      sinPermiso: 'El ITO debe subir el acta corregida.',
      etiqueta: 'ACTA RECHAZADA',
      toastOk: 'Acta corregida enviada.',
    },
  },
  {
    codigo: 'INFORME_FINAL',
    etiqueta: 'FALTA INFORME FINAL',
    etiquetaEspera: 'ESPERANDO INFORME FINAL',
    titulo: 'Falta el informe final de obra',
    mensaje: 'El acta de recepción fue aprobada. Para cerrar la obra debes subir el informe final.',
    boton: 'Subir informe final de obra',
    sinPermiso: 'Aún no se sube el informe final. Debe hacerlo el ITO de esta obra.',
    pedirFechaInicio: false,
    creaInspeccion: false,
    subEstadoCodigo: 'EnInformeFinal',
    toastOk: 'Informe final enviado.',
    rechazo: {
      titulo: 'El informe final fue rechazado',
      mensaje: 'El líder rechazó el informe. Corrígelo según su comentario y súbelo de nuevo.',
      boton: 'Subir informe corregido',
      sinPermiso: 'El ITO debe subir el informe corregido.',
      etiqueta: 'INFORME RECHAZADO',
      toastOk: 'Informe corregido enviado.',
    },
  },
  {
    codigo: 'DOCUMENTACION_ITO',
    etiqueta: 'FALTA DOCUMENTACIÓN',
    etiquetaEspera: 'ESPERANDO DOCUMENTACIÓN',
    titulo: 'Falta la documentación de la obra',
    mensaje: 'Para continuar con el cierre debes subir la documentación de la obra.',
    boton: 'Subir documentación de obra',
    sinPermiso: 'Aún no se sube la documentación. Debe hacerlo el ITO de esta obra.',
    pedirFechaInicio: false,
    creaInspeccion: false,
    subEstadoCodigo: 'EnDocumentacionITO',
    toastOk: 'Documentación enviada.',
    rechazo: {
      titulo: 'La documentación de la obra fue rechazada',
      mensaje: 'El líder rechazó los documentos. Corrígelos según su comentario y súbelos de nuevo (los dos).',
      boton: 'Subir documentación corregida',
      sinPermiso: 'El ITO debe subir la documentación corregida.',
      etiqueta: 'DOCUMENTACIÓN RECHAZADA',
      toastOk: 'Documentación corregida enviada.',
    },
  },
];

/** «Subir acta de entrega de terreno» → «ACTA DE ENTREGA DE TERRENO» (sin el verbo inicial, en mayúsculas). */
function sustantivo(label: string): string {
  return label.replace(/^(subir|cargar|adjuntar|registrar|generar|enviar)\s+/i, '').trim().toUpperCase();
}

/** Código sin definición en el catálogo → «ACTA_X» queda «Acta x». */
function humanizar(codigo: string): string {
  const t = codigo.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Trámite genérico para una acción que la app no conoce de antemano (contrato CU-28). Los textos salen
 * del `Label` del catálogo; las banderas (comentario, adjunto, tipos de documento) las toma EventoForm.
 */
function tramiteGenerico(codigo: string, label: string): Tramite {
  const nombre = sustantivo(label);
  return {
    codigo,
    etiqueta: `FALTA ${nombre.length > 26 ? `${nombre.slice(0, 25)}…` : nombre}`,
    etiquetaEspera: '',
    titulo: `Pendiente: ${label}`,
    mensaje: 'Esta acción está habilitada para ti en esta obra. Complétala cuando corresponda.',
    boton: label,
    sinPermiso: '',
    pedirFechaInicio: false,
    creaInspeccion: false,
    subEstadoCodigo: '',
    toastOk: 'Acción registrada correctamente.',
  };
}

/**
 * Acciones habilitadas que ninguna pantalla de la app conoce (no están en TRAMITES, ni son de Ctrl. Obra,
 * inspecciones, validación del informe ni están ocultas a propósito): se detectan solas y aparecen como
 * tarjeta en Información. NO bloquean la obra (contrato CU-28).
 */
export function tramitesNuevos(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): Tramite[] {
  if (!obra) return [];
  const conocidos = new Set(TRAMITES.map((t) => t.codigo));
  const nuevos: { codigo: string; label: string; orden: number }[] = [];
  for (const codigo of obra.AccionesHabilitadas) {
    if (conocidos.has(codigo) || ACCIONES_OCULTAS.includes(codigo) || ACCIONES_CON_PANTALLA_PROPIA.includes(codigo)) continue;
    const def = definicionDe(codigo, catalogo);
    if (def) {
      if (GRUPOS_CTRL.includes(def.Grupo) || GRUPOS_FORM_INSPECCION.includes(def.Grupo)) continue;
    } else if (esAccionInspeccion(codigo, catalogo) || codigo.startsWith('OBRA_')) {
      continue; // sin catálogo: se reconocen por su nombre
    }
    nuevos.push({ codigo, label: def?.Label ?? humanizar(codigo), orden: def?.Orden ?? 99 });
  }
  return nuevos.sort((a, b) => a.orden - b.orden).map((n) => tramiteGenerico(n.codigo, n.label));
}

/**
 * El trámite pendiente de la obra, si hay uno: la API habilita su acción, o la obra está en
 * el sub-estado en que ese trámite corresponde (el usuario puede no tener el permiso).
 */
export function tramitePendiente(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): Tramite | null {
  if (!obra) return null;
  for (const t of TRAMITES) {
    if (obra.AccionesHabilitadas.includes(t.codigo)) return t;
    const label = catalogo?.SubEstados?.find((s) => s.Codigo === t.subEstadoCodigo)?.Label;
    if (label && obra.SubEstado === label) return t;
  }
  return null;
}

/** ¿El líder rechazó el documento de este trámite? (la obra trae un comentario de devolución) */
export function tramiteRechazado(tramite: Tramite | null, comentarioDevolucion: string | null | undefined): boolean {
  return !!tramite?.rechazo && !!comentarioDevolucion?.trim();
}

/** Texto de la etiqueta del dashboard: «ACTA RECHAZADA» si hay comentario de devolución, si no la normal. */
export function etiquetaTramite(tramite: Tramite | null, comentarioDevolucion: string | null | undefined): string | null {
  if (!tramite) return null;
  return tramiteRechazado(tramite, comentarioDevolucion) ? tramite.rechazo!.etiqueta : tramite.etiqueta;
}

/**
 * Etiqueta del dashboard para la obra (CU-16): ámbar si el usuario PUEDE subir el documento
 * (o «ACTA/INFORME RECHAZADO» si el líder lo devolvió); gris «ESPERANDO…» si no puede.
 */
export function etiquetaDashboard(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
  comentarioDevolucion: string | null | undefined,
): { texto: string; espera: boolean } | null {
  if (!obra) return null;
  // El Supervisor debe aprobar o rechazar el informe final (CU-19); el resto solo espera.
  if (puedeValidarInforme(obra)) {
    const contexto: ContextoValidacion = esperaValidacionDocumentacion(obra, catalogo) ? 'documentacion' : 'informe';
    return { texto: TEXTOS_VALIDACION[contexto].etiqueta, espera: false };
  }
  const t = tramitePendiente(obra, catalogo);
  if (!t) {
    if (esperaValidacionDocumentacion(obra, catalogo)) return { texto: 'ESPERANDO VALIDACIÓN DOCUMENTACIÓN', espera: true };
    if (esperaValidacionInforme(obra, catalogo)) return { texto: 'ESPERANDO VALIDACIÓN INFORME FINAL', espera: true };
    if (esperaAprobacionRecepcion(obra, catalogo)) return { texto: 'ESPERANDO APROBACIÓN DEL ACTA', espera: true };
    // CU-32: el Supervisor puede devolver la documentación del ITO en esta etapa.
    if (obra.AccionesHabilitadas.includes(ACCION_DEVOLVER_DOCUMENTACION)) return { texto: 'REVISAR DOCUMENTACIÓN', espera: false };
    // CU-28: una acción nueva que la API habilita y la app no conoce también se avisa en el dashboard.
    const nuevo = tramitesNuevos(obra, catalogo)[0];
    return nuevo ? { texto: nuevo.etiqueta, espera: false } : null;
  }
  if (!obra.AccionesHabilitadas.includes(t.codigo)) {
    // CU-33: documento devuelto/rechazado y el usuario no puede subir la corrección → está esperando al ITO.
    if (tramiteRechazado(t, comentarioDevolucion)) return { texto: TEXTOS_ESPERA_CORRECCION.etiqueta, espera: true };
    return { texto: t.etiquetaEspera, espera: true };
  }
  return { texto: etiquetaTramite(t, comentarioDevolucion) ?? t.etiqueta, espera: false };
}

/**
 * El Supervisor puede DEVOLVER la documentación del ITO (acción `DEVOLVER_DOCUMENTACION`): equivale a rechazar; no sube
 * nada, solo escribe en el comentario las correcciones y el ITO debe cargar de nuevo el documento (contrato CU-32).
 */
export const ACCION_DEVOLVER_DOCUMENTACION = 'DEVOLVER_DOCUMENTACION';

/** Quien devolvió/rechazó un documento y espera la corrección del ITO (no puede subirla él; contrato CU-33). */
export const TEXTOS_ESPERA_CORRECCION = {
  etiqueta: 'ESPERANDO CORRECCIÓN DEL ITO',
  titulo: 'Devuelto al ITO · en espera de la corrección',
  mensaje: 'El documento fue devuelto con el comentario de abajo. Cuando el ITO suba la corrección podrás revisarlo de nuevo. Por ahora no hay nada más que hacer.',
  comentario: 'Comentario de devolución',
};

export const TEXTOS_DEVOLUCION = {
  /** Tarjeta propia (cualquier etapa distinta de «Gestión de Obra»). */
  tituloGeneral: 'Documentación por revisar',
  mensajeGeneral: 'Revisa los últimos documentos que subió el ITO. Si algo no está bien, devuélvelos con tus correcciones.',
  /** Dentro de la tarjeta del acta de inicio («Gestión de Obra»). */
  titulo: 'Entrega de terreno por revisar',
  mensaje: 'Revisa el acta de entrega de terreno que subió el ITO. Si está bien, sube el acta de inicio de obra; si no, devuélvela con tus correcciones.',
  devolver: 'Devolver documentación',
  aviso: 'Vas a devolver la documentación al ITO: deberá cargar de nuevo el documento. Escribe en el comentario las correcciones.',
  ayuda: 'Escribe las correcciones que debe hacer el ITO…',
  toastOk: 'Documentación devuelta al ITO.',
};

/** Qué está validando el Supervisor: el informe final o la documentación del ITO (contrato CU-19). */
export type ContextoValidacion = 'informe' | 'documentacion';

/** Textos de la tarjeta/formularios de validación según lo que se valida (las acciones de la API son las mismas). */
export const TEXTOS_VALIDACION: Record<ContextoValidacion, {
  titulo: string; mensaje: string; aprobar: string; rechazar: string;
  avisoAprobar: string; avisoRechazar: string; ayudaAprobar: string; ayudaRechazo: string;
  toastAprobar: string; toastRechazar: string; etiqueta: string;
}> = {
  informe: {
    titulo: 'Informe final por validar',
    mensaje: 'El ITO envió el informe final de la obra. Revísalo y decide si lo apruebas o lo rechazas.',
    aprobar: 'Aprobar informe final',
    rechazar: 'Rechazar informe final',
    avisoAprobar: 'Vas a aprobar el informe final.',
    avisoRechazar: 'Vas a rechazar el informe final. El ITO deberá corregirlo: explica el motivo.',
    ayudaAprobar: 'Escribe un comentario sobre la aprobación del informe…',
    ayudaRechazo: 'Explica por qué se rechaza el informe…',
    toastAprobar: 'Informe final aprobado.',
    toastRechazar: 'Informe final rechazado. El ITO deberá corregirlo.',
    etiqueta: 'VALIDAR INFORME FINAL',
  },
  documentacion: {
    titulo: 'Documentación por validar',
    mensaje: 'El ITO envió la documentación de la obra (2 documentos). Revísala y decide si la apruebas o la rechazas.',
    aprobar: 'Aprobar documentación',
    rechazar: 'Rechazar documentación',
    avisoAprobar: 'Vas a aprobar la documentación de la obra.',
    avisoRechazar: 'Vas a rechazar la documentación. El ITO deberá corregirla (los dos documentos): explica el motivo.',
    ayudaAprobar: 'Escribe un comentario sobre la aprobación de la documentación…',
    ayudaRechazo: 'Explica por qué se rechaza la documentación…',
    toastAprobar: 'Documentación aprobada.',
    toastRechazar: 'Documentación rechazada. El ITO deberá corregirla.',
    etiqueta: 'VALIDAR DOCUMENTACIÓN',
  },
};

/** Acciones con las que el Supervisor revisa el informe final (contrato CU-19). */
export const ACCION_VALIDAR_INFORME = 'VALIDAR_INFORME';
export const ACCION_RECHAZAR_INFORME = 'RECHAZAR_INFORME';

/** ¿El usuario puede aprobar o rechazar el informe final de esta obra ahora? */
export function puedeValidarInforme(obra: ObraInicio | null | undefined): boolean {
  return !!obra && (obra.AccionesHabilitadas.includes(ACCION_VALIDAR_INFORME) || obra.AccionesHabilitadas.includes(ACCION_RECHAZAR_INFORME));
}

/**
 * ¿La obra está en «En validación del Líder AyP»? Ese sub-estado es genérico: la API distingue QUÉ se está
 * validando en el campo `Estado` de la obra (ej. «Validación Documentación con ITO»).
 */
function enValidacionDelLider(obra: ObraInicio | null | undefined, catalogo: CatalogoInicio | null | undefined): boolean {
  if (!obra) return false;
  const label = catalogo?.SubEstados?.find((x) => x.Codigo === 'EnValidacion')?.Label;
  return !!label && obra.SubEstado === label;
}

/** ¿El líder está validando la DOCUMENTACIÓN del ITO (documentos enviados, esperando la decisión)? (CU-19) */
export function esperaValidacionDocumentacion(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): boolean {
  return enValidacionDelLider(obra, catalogo) && /documentaci[oó]n/i.test(obra?.Estado ?? '');
}

/** ¿La obra está en «En validación del Líder AyP» con el informe final enviado, esperando la decisión? */
export function esperaValidacionInforme(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): boolean {
  return enValidacionDelLider(obra, catalogo) && !esperaValidacionDocumentacion(obra, catalogo);
}
