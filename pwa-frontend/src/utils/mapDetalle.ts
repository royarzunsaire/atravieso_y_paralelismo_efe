import type { InspeccionDetalle, Archivo, FotoInspeccion } from '@/types/solicitud';

// ========================================
// Mapeadores — API_Detalle (spec 13, Etapa B) → tipos viejos
// La API nueva devuelve todo en un solo llamado (Inspecciones con sus
// Fotos/Informes adentro, y Documentos aparte). Mapeamos a los mismos
// tipos que ya consume SolicitudDetail.tsx / PhotosModal / InformesModal,
// para reutilizar esa UI sin reescribirla. Las URLs de archivos son
// directas a SharePoint y expiran ~1h — no se cachean más allá de esta
// carga de pantalla.
// ========================================

interface FotoOInformeApi {
  Nombre: string;
  Extension?: string;
  // La API cambió de `Url` (directo a SharePoint) a `UrlDescarga` (gateway
  // propio del cliente, `/v1/documentos/{DriveItemId}/descargar?token=...`)
  // — se detectó probando en el navegador (28-09-2026). Se deja `Url` como
  // fallback por si algún endpoint viejo todavía lo usa.
  UrlDescarga?: string;
  Url?: string;
  DriveItemId?: string;
  Tamano?: number;
  MimeType?: string;
}

interface InspeccionApi {
  Id: number;
  Titulo?: string;
  Fecha?: string;
  Tipo?: string;
  TipoInspeccionId?: number | string | null;
  Estado?: string;
  PorcentajeAvance?: number;
  Comentario?: string;
  Inspector?: string;
  CorreoInspector?: string;
  Latitud?: string | number | null;
  Longitud?: string | number | null;
  // El detalle de obra ahora solo trae un resumen con CantidadFotos; el
  // resto (Comentario, Fotos, Documentos, Latitud...) llega en GET /inspecciones/{id}.
  CantidadFotos?: number;
  SolicitaParalizacion?: boolean;
  Fotos?: FotoOInformeApi[];
  Informes?: FotoOInformeApi[];
  Documentos?: FotoOInformeApi[];
}

interface DocumentoApi {
  Nombre: string;
  Extension?: string;
  UrlDescarga?: string;
  Url?: string;
  DriveItemId?: string;
  Tamano?: number;
  MimeType?: string;
  TipoDocumentoId?: number;
  TipoDocumento?: string;
  CargadoPorIto?: boolean;
}

export function mapInspeccionApi(
  inspeccion: InspeccionApi,
  solicitudId: number,
  codigoSolicitud: string
): InspeccionDetalle {
  return {
    id: String(inspeccion.Id),
    type: inspeccion.Tipo ?? '', // Antes no venía (spec 10/13); ahora sí, si se mandó TipoInspeccionId al crear.
    progress: inspeccion.PorcentajeAvance ?? 0,
    status: inspeccion.Estado === 'No Conforme' ? 'no-conforme' : 'conforme',
    observations: inspeccion.Comentario ?? '', // Antes no venía en la lectura.
    solicitudId,
    codigoSolicitud,
    inspector: inspeccion.Inspector ?? '',
    inspectorEmail: inspeccion.CorreoInspector ?? '',
    cantidadFotos: inspeccion.Fotos?.length ?? inspeccion.CantidadFotos ?? 0,
    solicitaParalizacion: inspeccion.SolicitaParalizacion ?? false,
    estadoParalizacion: null,
    observacionesAvance: '',
    motivoParalizacion: '',
    latitud: inspeccion.Latitud != null ? String(inspeccion.Latitud) : '',
    longitud: inspeccion.Longitud != null ? String(inspeccion.Longitud) : '',
    desfase: null,
    fechaCreacion: inspeccion.Fecha ?? null,
    fechaInspeccion: inspeccion.Fecha ?? null,
  };
}

/**
 * Datos del detalle completo de una inspección (GET /inspecciones/{id})
 * traducidos a los campos que completan la tarjeta del listado: se aplican
 * encima de lo que ya trajo el resumen de la obra.
 */
export function mapInspeccionCompleta(completa: InspeccionApi): {
  patch: Partial<InspeccionDetalle>;
  fotos: FotoInspeccion[];
  informes: FotoInspeccion[];
} {
  const fotos = (completa.Fotos ?? []).map(mapFotoOInformeApi);
  // Los documentos adjuntos de la inspección (informes PDF/Word) viven en
  // la carpeta Documentos Obra asociados por InspeccionId; llegan como Documentos.
  const informes = (completa.Documentos ?? completa.Informes ?? []).map(mapFotoOInformeApi);
  return {
    patch: {
      observations: completa.Comentario ?? '',
      ...(completa.Tipo ? { type: completa.Tipo } : {}),
      inspectorEmail: completa.CorreoInspector ?? '',
      latitud: completa.Latitud != null ? String(completa.Latitud) : '',
      longitud: completa.Longitud != null ? String(completa.Longitud) : '',
      solicitaParalizacion: completa.SolicitaParalizacion ?? false,
      cantidadFotos: fotos.length,
    },
    fotos,
    informes,
  };
}

export function mapFotoOInformeApi(item: FotoOInformeApi, index: number): FotoInspeccion {
  return {
    id: `${item.Nombre}-${index}`,
    url: item.UrlDescarga ?? item.Url,
    description: '',
    fileName: item.Nombre,
    created: undefined, // La API no manda fecha de captura/carga en Fotos/Informes.
  };
}

export function mapDocumentoApi(doc: DocumentoApi, index: number): Archivo {
  return {
    id: `documento-${index}`,
    name: doc.Nombre,
    fileName: doc.Nombre,
    fullPath: '',
    link: doc.UrlDescarga ?? doc.Url ?? '',
    modified: '', // La API no manda fecha de modificación para Documentos.
    modifiedBy: '',
    modifiedByEmail: '',
    tipoDocumento: doc.TipoDocumento ?? '',
    tipoDocumentoId: doc.TipoDocumentoId != null ? String(doc.TipoDocumentoId) : '',
    estado: '',
    estadoId: '',
    rol: doc.CargadoPorIto ? 'ITO' : '',
    rolId: '',
  };
}
