// ========================================
// INTERFACES COMPARTIDAS - SOLICITUDES
// ========================================

export interface Persona {
  nombre: string;
  email: string;
  departamento?: string | null;
  cargo?: string | null;
  foto?: string;
}

export type Responsable = Persona;
export type Autor = Persona;

export interface Solicitud {
  id: number;
  title: string;
  codigo: string | null;
  estadoSolicitud: string | null;
  estadoSolicitudId: number | null;
  prioridad: string | null;
  prioridadId: number | null;
  cliente: string | null;
  clienteId: number | null;
  consultor: string | null;
  consultorId: number | null;
  tipoProyecto: string | null;
  tipoProyectoId: number | null;
  tipoObra: string | null;
  tipoObraId: number | null;
  tipoServicio: string | null;
  tipoServicioId: number | null;
  ramal: string | null;
  ramalId: number | null;
  region: string | null;
  regionId: number | null;
  comuna: string | null;
  comunaId: number | null;
  rolAsignado: string | null;
  rolAsignadoId: number | null;
  esExcepcion: boolean;
  finalizada: boolean;
  responsable: Responsable | null;
  autor: Autor | null;
  hasAttachments: boolean;
  link: string | null;
  versionNumber: string | null;
  etag: string | null;
  observacion: string | null;
  descripcion: string | null;
  etapa: string | null;
  kilometraje: string | null;
}

/**
 * Inspección resumida — usada en los estados locales de App.tsx
 */
export interface Inspection {
  id: string;
  date: string;
  type: string;
  progress: number;
  status: 'conforme' | 'observaciones' | 'no-conforme';
  observations: string;
}

/**
 * Inspección con todos los campos — usada por SolicitudContext y SolicitudDetail
 */
export interface InspeccionDetalle {
  id: string;
  date: string;
  type: string;
  progress: number;
  status: 'conforme' | 'observaciones' | 'no-conforme';
  observations: string;
  // Campos adicionales del backend
  solicitudId: number;
  codigoSolicitud: string;
  inspector: string;
  inspectorEmail: string;
  cantidadFotos: number;
  solicitaParalizacion: boolean;
  estadoParalizacion: string | null;
  observacionesAvance: string;
  motivoParalizacion: string;
  latitud: string;
  longitud: string;
}

/**
 * Foto de una inspección — usada por SolicitudContext y PhotosModal
 */
export interface FotoInspeccion {
  id: string;
  url?: string;
  description?: string;
  fileName?: string;
  created?: string;
}

/**
 * Foto adjunta en el formulario de nueva inspección (local, antes de subir)
 */
export interface InspectionPhoto {
  id: string;
  url: string;
  description: string;
}

/**
 * Foto con información completa (ya subida, vista en galería)
 */
export interface Photo {
  id: string;
  url: string;
  description: string;
  date: string;
}

export interface SolicitudStats {
  total: number;
  porEstado: Record<string, number>;
  porPrioridad: {
    Alta: number;
    Media: number;
    Baja: number;
  };
  conAdjuntos: number;
  finalizadas: number;
}

export interface Archivo {
  id: string;
  name: string;
  fileName: string;
  fullPath: string;
  link: string;
  modified: string;
  modifiedBy: string;
  modifiedByEmail: string;
  tipoDocumento: string;
  tipoDocumentoId: string;
  estado: string;
  estadoId: string;
  rol: string;
  rolId: string;
}