import { useState } from 'react';
import { ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { BotonDescargar } from './BotonDescargar';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { ACCION_VALIDAR_INFORME, ACCION_RECHAZAR_INFORME } from '@/utils/tramitesObra';
import type { AccionCatalogo } from '@/types/eventos';

interface InformeParaRevisar {
  nombre: string;
  url?: string | null;
}

interface ValidarInformeCardProps {
  solicitudId: number;
  /** Informes finales de la obra para revisar antes de decidir (con su botón «Descargar»). */
  informes: InformeParaRevisar[];
  /** Se dispara tras aprobar o rechazar con éxito (para refrescar el detalle). */
  onRegistrado?: () => void;
}

const TOAST: Record<string, string> = {
  [ACCION_VALIDAR_INFORME]: 'Informe final aprobado.',
  [ACCION_RECHAZAR_INFORME]: 'Informe final rechazado. El ITO deberá corregirlo.',
};

/**
 * Tarjeta de «Información» para el Supervisor cuando el ITO envió el informe final y falta
 * decidir (contrato CU-19): puede descargar el informe y luego aprobarlo o rechazarlo con un
 * comentario. Usa el mismo envío que el resto de las acciones de la obra.
 */
export function ValidarInformeCard({ solicitudId, informes, onRegistrado }: ValidarInformeCardProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const [accionActiva, setAccionActiva] = useState<AccionCatalogo | null>(null);
  const [eventoId, setEventoId] = useState('');
  const [toast, setToast] = useState<{ tipo: 'ok' | 'warn'; msg: string } | null>(null);

  if (!obra) return null;

  // La definición fresca de la obra (AccionesDef) manda sobre el catálogo cacheado.
  const resolver = (codigo: string): AccionCatalogo | null => {
    if (!obra.AccionesHabilitadas.includes(codigo)) return null;
    const def = inicio.catalogo?.TiposEvento?.find((t) => t.Codigo === codigo);
    const fresca = obra.AccionesDef?.[codigo];
    return def ? (fresca ? { ...def, ...fresca } : def) : null;
  };
  const validar = resolver(ACCION_VALIDAR_INFORME);
  const rechazar = resolver(ACCION_RECHAZAR_INFORME);

  const abrir = (a: AccionCatalogo) => { setEventoId(generarEventoIdExterno()); setAccionActiva(a); };
  const cerrar = () => { setAccionActiva(null); setEventoId(''); };

  const enviar = async (payload: Record<string, unknown>, opciones?: { etapa?: CambiarEtapa }) => {
    if (!accionActiva) return;
    const codigo = accionActiva.Codigo;
    const r = await enviarAccionObra({
      inicio, obra, solicitudId, tipoEvento: codigo, eventoIdExterno: eventoId, payload, creaInspeccion: false, alRegistrar: cerrar, etapa: opciones?.etapa,
    });
    if (r.estado === 'noPermitida') { setToast({ tipo: 'warn', msg: r.mensaje }); return; }
    setToast({ tipo: 'ok', msg: TOAST[codigo] ?? 'Acción registrada.' });
    onRegistrado?.();
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <h3 className="text-base font-semibold text-amber-900">Informe final por validar</h3>
        </div>
        <p className="text-base text-amber-900">
          El ITO envió el informe final de la obra. Revísalo y decide si lo apruebas o lo rechazas.
        </p>

        {informes.map((inf) => (
          <div key={inf.nombre} className="bg-white rounded-lg p-3 border border-amber-200">
            <p className="text-base text-[#1A1A1A] break-all mb-2">{inf.nombre}</p>
            <BotonDescargar url={inf.url} nombre={inf.nombre} />
          </div>
        ))}

        <div className="grid grid-cols-1 gap-2">
          {validar && (
            <button
              type="button"
              onClick={() => abrir(validar)}
              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white text-base font-semibold active:bg-green-700"
            >
              <CheckCircle className="w-5 h-5" />
              Aprobar informe final
            </button>
          )}
          {rechazar && (
            <button
              type="button"
              onClick={() => abrir(rechazar)}
              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-[#E30613] text-[#E30613] text-base font-semibold active:bg-red-50"
            >
              <XCircle className="w-5 h-5" />
              Rechazar informe final
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.tipo === 'ok' ? 'bg-green-600' : 'bg-orange-500'}`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {accionActiva && (
        <EventoForm accion={accionActiva} eventoIdExterno={eventoId} onCancel={cerrar} onSubmit={enviar} />
      )}
    </>
  );
}
