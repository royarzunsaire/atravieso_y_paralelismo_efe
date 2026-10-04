// ========================================
// TIPOS — API de eventos unificada (spec 10)
// Contrato de API_Mobile_Inicio y API_Evento_Obra_v2.
// Los nombres de campo respetan el PascalCase que devuelve la API.
// ========================================

/** Un tipo de documento seleccionable para una acción con adjunto. */
export interface TipoDocumento {
  Id: number;
  Value: string;
}

/**
 * Una acción del catálogo. Las banderas Requiere* son las reglas de
 * validación del formulario — vienen del servidor, no se hardcodean.
 */
export interface AccionCatalogo {
  Codigo: string;
  Label: string;
  Icono: string; // nombre de ícono del set Lucide
  Grupo: string; // 'Registro' | 'Inspecciones' | 'Control de obra' | 'Documentos'
  Orden: number; // puede venir como decimal (43.0)
  Activo?: boolean;
  RequiereComentario: boolean;
  RequiereAdjunto: boolean;
  RequiereAvance: boolean;
  TiposDocumento: TipoDocumento[];
}

/**
 * Definición fresca de una acción habilitada (viene con cada obra, no del
 * catálogo cacheado, cuya versión no detecta cambios de contenido).
 */
export interface DefinicionAccion {
  RequiereComentario: boolean;
  RequiereAdjunto: boolean;
  RequiereAvance: boolean;
  TiposDocumento: TipoDocumento[];
}

/** Un subestado posible de una obra. */
export interface SubEstadoCatalogo {
  Id: number;
  Codigo: string;
  Label: string;
}

/**
 * Un tipo de inspección seleccionable (catálogo nuevo de la API directa a
 * SharePoint, spec 13 — antes "type" no existía en el Payload, ahora se
 * manda como TipoInspeccionId).
 */
export interface TipoInspeccionCatalogo {
  Id: number;
  Nombre: string;
}

/** El catálogo completo que trae API_Inicio (cacheable por CatalogosVersion). */
export interface CatalogoInicio {
  TiposEvento: AccionCatalogo[];
  SubEstados: SubEstadoCatalogo[];
  TiposDocumento: TipoDocumento[];
  TiposInspeccion: TipoInspeccionCatalogo[];
}

/** Bloque de ubicación de una obra. */
export interface UbicacionObra {
  Region: string | null;
  Comuna: string | null;
  Ramal: string | null;
  TipoObra: string | null;
  Kilometraje: string | null;
}

/**
 * Bloque de detención. OJO: DiasAcumulados solo se recalcula al reactivar
 * — mientras está detenida no avanza (ver mapInicio para el cálculo real).
 */
export interface DetencionObra {
  FechaDetencionActual: string | null; // ISO UTC; != null => detenida ahora
  FechaReactivacion: string | null;
  DiasAcumulados: number;
}

/**
 * Una obra tal como la devuelve API_Inicio (ya filtrada por el servidor:
 * etapa Obra, donde el usuario es ITO/Supervisor).
 */
export interface ObraInicio {
  Id: number;
  Codigo: string;
  Titulo: string;
  Rol: string; // rol del usuario EN ESTA obra: 'ITO Proyecto' | 'Supervisor Obra…'
  SubEstado: string;
  RutaActual: string | null;
  Etapa: string | null;
  Estado: string | null;
  Cliente: string | null;
  AvanceObraPct: number; // puede venir decimal
  FechaInicioObra: string | null;
  FechaUltimoEvento: string | null;
  FechaLimiteInformeFinal: string | null;
  Ubicacion: UbicacionObra;
  Detencion: DetencionObra;
  /** Lista de códigos permitidos AHORA, en orden de pintado. */
  AccionesHabilitadas: string[];
  /**
   * Tipo de inspección que corresponde a cada acción habilitada (lo agrega
   * nuestro backend a partir de TipoInspeccionId/Nombre de la API). Con la
   * obra paralizada, por ejemplo, solo queda un tipo posible.
   */
  AccionesTipo?: Record<string, { TipoInspeccionId: number; TipoInspeccionNombre: string }>;
  /** Definición fresca de cada acción habilitada (banderas Requiere* y tipos de documento). */
  AccionesDef?: Record<string, DefinicionAccion>;
}

/** Resultado normalizado de inicioService.getInicio(). */
export interface InicioResult {
  usuario: { Id: number; Nombre: string; Email: string } | null;
  obras: ObraInicio[];
  total: number;
  catalogo: CatalogoInicio | null;
  catalogosVersion: string;
}

/**
 * Respuesta de API_Evento_Obra_v2 (Etapa C). AccionesHabilitadas aquí
 * viene con objetos completos (a diferencia de Inicio, que trae códigos)
 * — normalizar a códigos al recibir.
 */
export interface EventoResponse {
  success: boolean;
  EventoId?: number;
  EventoIdExterno?: string;
  duplicado?: boolean;
  SubEstado?: string;
  AvanceObraPct?: number;
  AccionesHabilitadas?: Array<string | AccionCatalogo>;
  Mensaje?: string;
  error?: string;
}
