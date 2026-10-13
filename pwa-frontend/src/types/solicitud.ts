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
 * Inspección con todos los campos — usada por SolicitudDetail
 */
export interface InspeccionDetalle {
  id: string;
  /** Ya no lo envía el backend (trabaja en UTC); el frontend lo deriva de fechaInspeccion/fechaCreacion. */
  date?: string;
  type: string;
  progress: number;
  status: 'conforme' | 'no-conforme';
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
  desfase: '1' | '0' | null;
  fechaCreacion: string | null;
  fechaInspeccion: string | null;
  // Presentes solo en inspecciones pendientes/erroradas de sincronizar (outbox Oracle)
  estadoSync?: 'pendiente' | 'error';
  intentosSync?: number;
  oracleId?: string;
}

/**
 * Foto de una inspección — usada por SolicitudDetail y PhotosModal
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
