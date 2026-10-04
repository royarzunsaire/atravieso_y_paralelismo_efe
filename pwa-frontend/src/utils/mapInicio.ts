import type { Solicitud } from '@/types/solicitud';
import type { ObraInicio } from '@/types/eventos';

/**
 * Una obra de la API_Inicio mapeada al shape `Solicitud` que el dashboard
 * y SolicitudCard ya saben pintar — así reusamos las cards existentes sin
 * reescribirlas. Se preservan además los campos nuevos del contrato
 * event-driven (Rol, SubEstado, AvanceObraPct, AccionesHabilitadas) como
 * propiedades extra, para la Etapa C.
 */
export interface SolicitudV2 extends Solicitud {
  // Campos nuevos del contrato de eventos — solo presentes en modo v2.
  rolEnObra?: string;
  subEstado?: string;
  avanceObraPct?: number;
  accionesHabilitadas?: string[];
  fechaUltimoEvento?: string | null;
  /** Inicio de la obra (ISO UTC) — la tarjeta muestra fecha y días corridos. */
  fechaInicioObra?: string | null;
  /** Días de detención si la obra está detenida ahora; null si no lo está. */
  diasDetencion?: number | null;
}

/**
 * Días reales de detención: DiasAcumulados no avanza mientras la obra está
 * detenida (solo se recalcula al reactivar), así que si hay
 * FechaDetencionActual sumamos los días corridos desde entonces. OJO: la API
 * deja DiasAcumulados con decimales al reactivar (ej. 0.3019… = 7 h), por eso
 * el total se muestra siempre en días COMPLETOS (se trunca hacia abajo).
 */
export function calcularDiasDetencion(detencion: ObraInicio['Detencion']): number {
  const base = detencion?.DiasAcumulados ?? 0;
  const desde = detencion?.FechaDetencionActual;
  if (!desde) return Math.floor(base);
  const corridos = (Date.now() - new Date(desde).getTime()) / 86400000;
  return Math.floor(base + Math.max(0, corridos));
}

export function mapObraToSolicitud(obra: ObraInicio): SolicitudV2 {
  const u = obra.Ubicacion || ({} as ObraInicio['Ubicacion']);

  return {
    // ── Campos que consume SolicitudCard / el dashboard ──
    id: obra.Id,
    codigo: obra.Codigo ?? null,
    title: obra.Titulo ?? '',
    cliente: obra.Cliente ?? null,
    region: u.Region ?? null,
    comuna: u.Comuna ?? null,
    ramal: u.Ramal ?? null,
    tipoObra: u.TipoObra ?? null,
    kilometraje: u.Kilometraje ?? null,
    etapa: obra.Etapa ?? null,
    estadoSolicitud: obra.SubEstado ?? obra.Estado ?? null,
    // El responsable en el contexto de la obra es este usuario (por su rol).
    responsable: null,
    // tipoProyecto/tipoServicio no vienen en Inicio — la card los muestra
    // como opcionales, quedan null sin romper.
    tipoProyecto: null,
    tipoServicio: null,

    // ── Resto del shape Solicitud, en null/valores neutros ──
    estadoSolicitudId: null,
    prioridad: null,
    prioridadId: null,
    clienteId: null,
    consultor: null,
    consultorId: null,
    tipoProyectoId: null,
    tipoObraId: null,
    tipoServicioId: null,
    ramalId: null,
    regionId: null,
    comunaId: null,
    rolAsignado: obra.Rol ?? null,
    rolAsignadoId: null,
    esExcepcion: false,
    finalizada: false,
    autor: null,
    hasAttachments: false,
    link: null,
    versionNumber: null,
    etag: null,
    observacion: null,
    descripcion: null,

    // ── Campos nuevos del contrato event-driven (modo v2) ──
    rolEnObra: obra.Rol,
    subEstado: obra.SubEstado,
    avanceObraPct: obra.AvanceObraPct,
    accionesHabilitadas: Array.isArray(obra.AccionesHabilitadas) ? obra.AccionesHabilitadas : [],
    fechaUltimoEvento: obra.FechaUltimoEvento ?? null,
    fechaInicioObra: obra.FechaInicioObra ?? null,
    diasDetencion: obra.Detencion?.FechaDetencionActual ? calcularDiasDetencion(obra.Detencion) : null,
  };
}
