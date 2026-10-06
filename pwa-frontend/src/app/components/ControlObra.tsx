import { useState } from 'react';
import { PauseCircle, PlayCircle, CheckCircle, XCircle, FileUp, ClipboardCheck, CircleHelp, Clock, Activity, AlertTriangle, FileText, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { calcularDiasDetencion } from '@/utils/mapInicio';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { GRUPOS_CTRL_OBRA } from '@/utils/accionesApp';
import { ACCION_FINALIZAR_OBRA, motivoNoPuedeFinalizar } from '@/utils/finalizarObra';
import { descargarActaDetencion, type MotivoDetencion } from '@/utils/useMotivoDetencion';
import type { AccionCatalogo } from '@/types/eventos';

// Íconos de las acciones de control (mismo criterio que AccionesObra).
const ICONOS: Record<string, LucideIcon> = {
  'pause-circle': PauseCircle,
  'play-circle': PlayCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'file-up': FileUp,
  'clipboard-check': ClipboardCheck,
};
const iconoDe = (n: string): LucideIcon => ICONOS[n] || CircleHelp;

interface ControlObraProps {
  solicitudId: number;
  /** Comentario del líder cuando la obra fue devuelta/observada (spec 13). */
  comentarioDevolucion?: string | null;
  /** Motivo de la detención vigente: comentario y acta (CU-10). */
  motivoDetencion?: MotivoDetencion | null;
  /** true mientras se carga el motivo (muestra «Cargando…»). */
  cargandoMotivo?: boolean;
  /** Avance (%) de cada inspección cargada: para exigir una al 100 % antes de finalizar (CU-24). */
  avancesInspecciones?: number[];
  /** true mientras se cargan las inspecciones. */
  cargandoInspecciones?: boolean;
  /** Se dispara tras registrar un evento con éxito (para refrescar el detalle). */
  onEventoRegistrado?: () => void;
}

/**
 * Pestaña "Control de obra" (modo v2). Muestra el estado de la obra, el
 * contador de días de detención, y las acciones de control (OBRA_*)
 * habilitadas. Cada acción abre un mini-form (EventoForm) que se adapta a
 * sus banderas y registra el evento vía la API. Ver spec 10.
 */
export function ControlObra({ solicitudId, comentarioDevolucion, motivoDetencion, cargandoMotivo, avancesInspecciones = [], cargandoInspecciones = false, onEventoRegistrado }: ControlObraProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const catalogo = inicio.catalogo;

  const [accionActiva, setAccionActiva] = useState<AccionCatalogo | null>(null);
  const [eventoIdActivo, setEventoIdActivo] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [errorActa, setErrorActa] = useState('');
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error' | 'warn'; msg: string } | null>(null);

  if (!obra) {
    return (
      <div className="bg-white rounded-lg p-6 text-center text-sm text-[#4A4A4A]">
        No se pudo cargar el estado de la obra.
      </div>
    );
  }

  // Acciones habilitadas AHORA cuyo grupo del catálogo va en Ctrl. Obra (GRUPOS_CTRL_OBRA), resueltas
  // contra el catálogo, agrupadas por su grupo y en el orden del catálogo. Una acción nueva de ese grupo
  // aparece sola (CU-28). Las de otros grupos tienen su propia pantalla.
  const porGrupo = new Map<string, AccionCatalogo[]>();
  for (const codigo of obra.AccionesHabilitadas) {
    const def = catalogo?.TiposEvento?.find((t) => t.Codigo === codigo);
    if (!def) continue;
    if (!GRUPOS_CTRL_OBRA.includes(def.Grupo)) continue;
    // La definición fresca de la obra (AccionesDef) manda sobre el catálogo cacheado.
    const fresca = obra.AccionesDef?.[codigo];
    porGrupo.set(def.Grupo, [...(porGrupo.get(def.Grupo) ?? []), fresca ? { ...def, ...fresca } : def]);
  }
  const grupos = [...porGrupo.entries()].map(([titulo, acciones]) => ({
    titulo,
    acciones: acciones.sort((a, b) => a.Orden - b.Orden),
  }));

  const detenida = obra.Detencion?.FechaDetencionActual != null;
  const dias = calcularDiasDetencion(obra.Detencion);

  // CU-24: finalizar exige obra al 100 % y una inspección al 100 %.
  const motivoBloqueo = (codigo: string): string | null =>
    codigo === ACCION_FINALIZAR_OBRA
      ? motivoNoPuedeFinalizar(obra.AvanceObraPct || 0, avancesInspecciones, cargandoInspecciones)
      : null;

  const abrirAccion = (accion: AccionCatalogo) => {
    if (motivoBloqueo(accion.Codigo)) return;    setAccionActiva(accion);
    setEventoIdActivo(generarEventoIdExterno());
  };
  const cerrarForm = () => { setAccionActiva(null); setEventoIdActivo(''); };

  const bajarActa = async () => {
    if (!motivoDetencion) return;
    setErrorActa('');
    setDescargando(true);
    try {
      await descargarActaDetencion(motivoDetencion);
    } catch {
      setErrorActa('No se pudo descargar el acta. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  const enviarEvento = async (payload: Record<string, unknown>, opciones?: { etapa?: CambiarEtapa }) => {
    if (!accionActiva) return;
    const r = await enviarAccionObra({
      inicio, obra, solicitudId, tipoEvento: accionActiva.Codigo, eventoIdExterno: eventoIdActivo, payload, alRegistrar: cerrarForm, etapa: opciones?.etapa,
    });
    if (r.estado === 'noPermitida') {
      setToast({ tipo: 'warn', msg: r.mensaje });
      return;
    }
    setToast({ tipo: 'ok', msg: 'Acción registrada correctamente.' });
    onEventoRegistrado?.();
  };

  return (
    <div className="space-y-4">
      {/* Comentario de devolución — cuando el líder observó/devolvió la obra */}
      {comentarioDevolucion && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold text-amber-800">Obra devuelta con observaciones</h3>
          </div>
          <p className="text-sm text-amber-900">{comentarioDevolucion}</p>
        </div>
      )}

      {/* Estado de la obra */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#0066CC]" />
          <h3 className="text-base font-semibold text-[#003D7A]">Estado de la obra</h3>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A4A4A]">Sub-estado</span>
          <span className="text-sm font-medium text-[#003D7A]">{obra.SubEstado}</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#4A4A4A]">Avance</span>
            <span className="text-lg font-bold text-[#0066CC]">{Math.round(obra.AvanceObraPct || 0)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#F5F7FA] overflow-hidden">
            <div
                className="h-full rounded-full bg-gradient-to-r from-[#0066CC] to-green-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(obra.AvanceObraPct || 0)))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contador de detención */}
      <div className={`rounded-xl shadow-sm p-4 ${detenida ? 'bg-orange-50 border-2 border-orange-300' : 'bg-white'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className={`w-5 h-5 ${detenida ? 'text-orange-600' : 'text-[#0066CC]'}`} />
          <h3 className="text-base font-semibold text-[#003D7A]">Detención</h3>
        </div>
        {detenida ? (
          <div className="space-y-2">
            <p className="text-sm text-orange-800">
              Obra <strong>detenida actualmente</strong> · {dias} día{dias !== 1 ? 's' : ''} acumulado{dias !== 1 ? 's' : ''}.
            </p>
            {cargandoMotivo && !motivoDetencion && (
              <p className="text-base text-orange-900 animate-pulse">Cargando motivo de la detención…</p>
            )}
            {motivoDetencion?.comentario && (
              <div className="bg-white/70 rounded-lg p-3 border border-orange-200">
                <p className="text-sm font-semibold text-orange-900 mb-1">Motivo de la detención</p>
                <p className="text-base text-[#1A1A1A] whitespace-pre-wrap break-words">{motivoDetencion.comentario}</p>
              </div>
            )}
            {motivoDetencion?.acta && (
              <div className="bg-white rounded-lg p-3 border-2 border-[#0066CC]/40">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-[#0066CC] flex-shrink-0" />
                  <p className="text-base font-semibold text-[#003D7A]">Acta de detención</p>
                </div>
                <p className="text-base text-[#1A1A1A] break-all mb-3">{motivoDetencion.acta}</p>
                <button
                  type="button"
                  onClick={bajarActa}
                  disabled={descargando}
                  className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-[#0066CC] text-white text-base font-semibold active:bg-[#003D7A] disabled:opacity-60"
                >
                  <Download className="w-5 h-5" />
                  {descargando ? 'Descargando…' : 'Descargar'}
                </button>
                {errorActa && <p className="text-base text-[#E30613] mt-2">{errorActa}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#4A4A4A]">
            La obra no está detenida.{dias > 0 && ` ${dias} día${dias !== 1 ? 's' : ''} detenida en total (histórico).`}
          </p>
        )}
      </div>

      {/* Acciones de la obra, por grupo (Control de obra / Cierre de obra) */}
      {grupos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-base font-semibold text-[#003D7A] mb-3">Acciones de control</h3>
          <p className="text-sm text-[#4A4A4A]">No hay acciones de control disponibles en el estado actual de la obra.</p>
        </div>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.titulo} className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-base font-semibold text-[#003D7A] mb-3">{grupo.titulo}</h3>
            <div className="grid grid-cols-1 gap-2">
              {grupo.acciones.map((accion) => {
                const Icono = iconoDe(accion.Icono);
                const bloqueo = motivoBloqueo(accion.Codigo);
                return (
                  <div key={accion.Codigo}>
                    <button
                      type="button"
                      onClick={() => abrirAccion(accion)}
                      disabled={!!bloqueo}
                      className="w-full flex items-center gap-3 p-3 min-h-14 bg-white rounded-lg border border-[#003D7A]/10 hover:border-[#0066CC] hover:bg-blue-50/50 active:bg-blue-100/50 transition-colors text-left disabled:opacity-50 disabled:hover:border-[#003D7A]/10 disabled:hover:bg-white"
                    >
                      <div className="w-10 h-10 flex-shrink-0 bg-[#0066CC]/10 rounded-lg flex items-center justify-center">
                        <Icono className="w-5 h-5 text-[#0066CC]" />
                      </div>
                      <span className="text-base font-medium text-[#003D7A]">{accion.Label}</span>
                    </button>
                    {bloqueo && <p className="text-base text-[#E30613] mt-1 px-1">{bloqueo}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.tipo === 'ok' ? 'bg-green-600' : toast.tipo === 'warn' ? 'bg-orange-500' : 'bg-[#E30613]'}`}
             onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {accionActiva && (
        <EventoForm
          accion={accionActiva}
          avanceActual={accionActiva.Codigo === ACCION_FINALIZAR_OBRA ? 100 : undefined}
          eventoIdExterno={eventoIdActivo}
          onCancel={cerrarForm}
          onSubmit={enviarEvento}
        />
      )}
    </div>
  );
}
