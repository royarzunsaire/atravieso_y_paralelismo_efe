// ========================================
// INTERFACES COMPARTIDAS - SOLICITUDES
// ========================================

/**
 * Información de una persona (responsable o autor)
 */
export interface Persona {
  nombre: string;
  email: string;
  departamento?: string | null;
  cargo?: string | null;
  foto?: string;
}

/**
 * Alias más específicos para claridad
 */
export type Responsable = Persona;
export type Autor = Persona;

/**
 * Solicitud completa con todos sus campos
 */
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
 * Inspección de una solicitud
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
 * Foto adjunta a una inspección
 */
export interface InspectionPhoto {
  id: string;
  url: string;
  description: string;
}

/**
 * Foto con información completa
 */
export interface Photo {
  id: string;
  url: string;
  description: string;
  date: string;
}

/**
 * Estadísticas de solicitudes
 */
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