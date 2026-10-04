import { eventosService } from '@/services/eventosService';
import { refrescarObraTrasEvento } from '@/utils/refrescarObra';
import { ACCION_ACTA_INICIO } from '@/utils/obraIniciada';
import { avisarEsperaPlataforma, type CambiarEtapa } from '@/utils/etapasProgreso';
import type { ObraInicio } from '@/types/eventos';

/** Lo mínimo que se necesita del InicioContext. */
interface ContextoInicio {
  actualizarObra: (id: number, cambios: Partial<ObraInicio>) => void;
  refrescar: () => Promise<void>;
}

export type ResultadoAccion =
  | { estado: 'ok' }
  | { estado: 'noPermitida'; mensaje: string };

interface Parametros {
  inicio: ContextoInicio;
  obra: ObraInicio;
  solicitudId: number;
  tipoEvento: string;
  eventoIdExterno: string;
  payload: Record<string, unknown>;
  /** FechaEvento (UTC ISO); si no se indica, el backend usa la hora actual. */
  fechaEvento?: string;
  /** El evento crea una inspección en la API. Por defecto sí (salvo el acta de inicio). */
  creaInspeccion?: boolean;
  /** Se llama en cuanto la API responde (antes del refresco): permite cerrar el formulario ya. */
  alRegistrar?: () => void;
  /** Cambia el mensaje del indicador de pantalla (CU-22). */
  etapa?: CambiarEtapa;
}

/**
 * Registra una acción de la obra (detener, reactivar, acta de inicio…) y deja la
 * pantalla al día. Es la ÚNICA ruta de envío para Ctrl. Obra y para la tarjeta
 * del acta de inicio (contrato CU-15), así los dos se comportan igual:
 * validación de la API, refresco de la obra (CU-05, con reintentos) y manejo de
 * «la obra cambió de estado» (403). Lanza Error si la API rechaza la acción.
 */
export async function enviarAccionObra({
  inicio, obra, solicitudId, tipoEvento, eventoIdExterno, payload, fechaEvento, creaInspeccion, alRegistrar, etapa,
}: Parametros): Promise<ResultadoAccion> {
  const res: {
    ok: boolean; accionNoPermitida?: boolean; mensaje?: string;
    acciones?: string[]; accionesTipo?: ObraInicio['AccionesTipo']; subEstado?: string; avanceObraPct?: number;
  } = await (async () => {
    const cancelarAviso = avisarEsperaPlataforma(etapa);
    try {
      return await eventosService.registrarEvento({ solicitudId, tipoEvento, eventoIdExterno, payload, fechaEvento, sync: true });
    } finally {
      cancelarAviso();
    }
  })();

  if (!res.ok) {
    if (res.accionNoPermitida) {
      alRegistrar?.();
      await inicio.refrescar();
      return { estado: 'noPermitida', mensaje: res.mensaje || 'La obra cambió de estado.' };
    }
    throw new Error(res.mensaje || 'No se pudo registrar la acción.');
  }

  alRegistrar?.();
  // Actualizar solo esta obra en el caché con la respuesta (sin re-llamar).
  if (res.acciones) {
    inicio.actualizarObra(solicitudId, {
      AccionesHabilitadas: res.acciones,
      AccionesTipo: res.accionesTipo ?? obra.AccionesTipo,
      SubEstado: res.subEstado ?? obra.SubEstado,
      AvanceObraPct: res.avanceObraPct ?? obra.AvanceObraPct,
    });
  } else {
    await inicio.refrescar();
  }
  etapa?.('Actualizando tus datos…');
  // CU-05: la respuesta del evento es parcial → se trae el estado completo de la obra.
  await refrescarObraTrasEvento(inicio.actualizarObra, solicitudId, {
    fechaUltimoEventoPrevia: obra.FechaUltimoEvento,
    creaInspeccion: creaInspeccion ?? tipoEvento !== ACCION_ACTA_INICIO, // el acta de inicio no crea inspección
    tipoInspeccionEsperado: obra.AccionesTipo?.[tipoEvento]?.TipoInspeccionNombre,
    esperaDocumento: Array.isArray(payload.Documentos) && payload.Documentos.length > 0,
  });
  return { estado: 'ok' };
}
