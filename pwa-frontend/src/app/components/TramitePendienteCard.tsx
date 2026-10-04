import { useState } from 'react';
import { FileUp, AlertTriangle, Lock, Clock } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { tramiteRechazado, type Tramite } from '@/utils/tramitesObra';
import type { AccionCatalogo } from '@/types/eventos';

/** Etiqueta pequeña para la tarjeta del dashboard: ámbar si hay que actuar, gris si se espera a otro. */
export function EtiquetaTramitePendiente({ texto, espera }: { texto: string; espera?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap ${
        espera ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-amber-100 border-amber-400 text-amber-900'
      }`}
    >
      {espera ? <Clock className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {texto}
    </span>
  );
}

interface TramitePendienteCardProps {
  solicitudId: number;
  tramite: Tramite;
  /** El trámite bloquea Ctrl. Obra e inspecciones (acta de inicio): muestra el candado. */
  bloquea?: boolean;
  /** Comentario del líder cuando rechazó el documento (se muestra y se pide el documento corregido). */
  comentarioDevolucion?: string | null;
  /** Se dispara tras registrar el documento con éxito (para refrescar el detalle). */
  onRegistrado?: () => void;
}

/**
 * Tarjeta de la pestaña «Información» que le pide al usuario un documento pendiente
 * (acta de inicio, acta de recepción firmada — contrato CU-15/CU-16). Si el usuario
 * tiene el permiso, lo sube aquí mismo; si no, se le explica.
 */
export function TramitePendienteCard({ solicitudId, tramite, bloquea, comentarioDevolucion, onRegistrado }: TramitePendienteCardProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const [abierto, setAbierto] = useState(false);
  const [eventoId, setEventoId] = useState('');
  const [toast, setToast] = useState<{ tipo: 'ok' | 'warn'; msg: string } | null>(null);

  if (!obra) return null;

  // La definición fresca de la obra (AccionesDef) manda sobre el catálogo cacheado.
  const def = inicio.catalogo?.TiposEvento?.find((t) => t.Codigo === tramite.codigo);
  const fresca = obra.AccionesDef?.[tramite.codigo];
  // Una acción nueva puede no estar todavía en el catálogo guardado: se arma con la definición fresca de la obra.
  const accion: AccionCatalogo | null = (def || fresca)
    ? {
        Codigo: tramite.codigo, Label: tramite.boton, Icono: 'file-up', Grupo: '', Orden: 99,
        RequiereComentario: false, RequiereAdjunto: false, RequiereAvance: false, TiposDocumento: [],
        ...def, ...fresca,
      }
    : null;
  const puedeSubir = obra.AccionesHabilitadas.includes(tramite.codigo) && !!accion;
  // Rechazado por el líder: se muestra su comentario y se pide el documento corregido (CU-16).
  const rechazado = tramiteRechazado(tramite, comentarioDevolucion);
  const textos = rechazado ? tramite.rechazo! : tramite;

  const abrir = () => { setEventoId(generarEventoIdExterno()); setAbierto(true); };
  const cerrar = () => { setAbierto(false); setEventoId(''); };

  const enviar = async (payload: Record<string, unknown>, opciones?: { fechaEvento?: string; etapa?: CambiarEtapa }) => {
    const r = await enviarAccionObra({
      inicio, obra, solicitudId, tipoEvento: tramite.codigo, eventoIdExterno: eventoId, payload,
      fechaEvento: opciones?.fechaEvento, creaInspeccion: tramite.creaInspeccion, alRegistrar: cerrar, etapa: opciones?.etapa,
    });
    if (r.estado === 'noPermitida') { setToast({ tipo: 'warn', msg: r.mensaje }); return; }
    setToast({ tipo: 'ok', msg: textos.toastOk });
    onRegistrado?.();
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          {bloquea
            ? <Lock className="w-5 h-5 text-amber-700 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />}
          <h3 className="text-base font-semibold text-amber-900">{textos.titulo}</h3>
        </div>
        <p className="text-base text-amber-900 mb-3">{textos.mensaje}</p>
        {rechazado && (
          <div className="bg-white border-2 border-[#E30613]/60 rounded-lg p-3 mb-3">
            <p className="text-sm font-semibold text-[#E30613] mb-1">Comentario del líder</p>
            <p className="text-base text-[#1A1A1A] whitespace-pre-wrap break-words">{comentarioDevolucion}</p>
          </div>
        )}
        {puedeSubir ? (
          <button
            type="button"
            onClick={abrir}
            className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-[#0066CC] text-white text-base font-semibold active:bg-[#003D7A]"
          >
            <FileUp className="w-5 h-5" />
            {textos.boton}
          </button>
        ) : (
          <p className="text-base font-medium text-amber-900">{textos.sinPermiso}</p>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.tipo === 'ok' ? 'bg-green-600' : 'bg-orange-500'}`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {abierto && accion && (
        <EventoForm
          accion={rechazado ? { ...accion, Label: textos.boton } : accion}
          avanceActual={tramite.enviaAvance ? Math.round(obra.AvanceObraPct || 0) : undefined}
          eventoIdExterno={eventoId}
          pedirFechaInicio={tramite.pedirFechaInicio}
          onCancel={cerrar}
          onSubmit={enviar}
        />
      )}
    </>
  );
}
