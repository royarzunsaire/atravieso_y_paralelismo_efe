import { useState } from 'react';
import { PauseCircle, PlayCircle, CheckCircle, CircleHelp, Clock, Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { useInicio } from '@/context/InicioContext';
import { eventosService, generarEventoIdExterno } from '@/services/eventosService';
import { calcularDiasDetencion } from '@/utils/mapInicio';
import type { AccionCatalogo } from '@/types/eventos';

// Íconos de las acciones de control (mismo criterio que AccionesObra).
const ICONOS: Record<string, LucideIcon> = {
  'pause-circle': PauseCircle,
  'play-circle': PlayCircle,
  'check-circle': CheckCircle,
};
const iconoDe = (n: string): LucideIcon => ICONOS[n] || CircleHelp;

interface ControlObraProps {
  solicitudId: number;
  /** Se dispara tras registrar un evento con éxito (para refrescar el detalle). */
  onEventoRegistrado?: () => void;
}

/**
 * Pestaña "Control de obra" (modo v2). Muestra el estado de la obra, el
 * contador de días de detención, y las acciones de control (OBRA_*)
 * habilitadas. Cada acción abre un mini-form (EventoForm) que se adapta a
 * sus banderas y registra el evento vía la API. Ver spec 10.
 */
export function ControlObra({ solicitudId, onEventoRegistrado }: ControlObraProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const catalogo = inicio.catalogo;

  const [accionActiva, setAccionActiva] = useState<AccionCatalogo | null>(null);
  const [eventoIdActivo, setEventoIdActivo] = useState('');
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error' | 'warn'; msg: string } | null>(null);

  if (!obra) {
    return (
      <div className="bg-white rounded-lg p-6 text-center text-sm text-[#4A4A4A]">
        No se pudo cargar el estado de la obra.
      </div>
    );
  }

  // Acciones de control (OBRA_*) habilitadas, resueltas contra el catálogo.
  const accionesControl: AccionCatalogo[] = [];
  for (const codigo of obra.AccionesHabilitadas) {
    if (!codigo.startsWith('OBRA_')) continue;
    const def = catalogo?.TiposEvento?.find((t) => t.Codigo === codigo);
    if (def) accionesControl.push(def);
    else console.warn(`[ControlObra] Código de control desconocido, se omite: ${codigo}`);
  }

  const detenida = obra.Detencion?.FechaDetencionActual != null;
  const dias = calcularDiasDetencion(obra.Detencion);

  const abrirAccion = (accion: AccionCatalogo) => {
    setAccionActiva(accion);
    setEventoIdActivo(generarEventoIdExterno());
  };
  const cerrarForm = () => { setAccionActiva(null); setEventoIdActivo(''); };

  const enviarEvento = async (payload: Record<string, unknown>) => {
    if (!accionActiva) return;
    const res: {
      ok: boolean; estadoSync?: string; accionNoPermitida?: boolean; mensaje?: string;
      acciones?: string[]; subEstado?: string; avanceObraPct?: number;
    } = await eventosService.registrarEvento({
      solicitudId,
      tipoEvento: accionActiva.Codigo,
      eventoIdExterno: eventoIdActivo,
      payload,
      sync: true,
    });

    if (!res.ok) {
      if (res.accionNoPermitida) {
        cerrarForm();
        await inicio.refrescar();
        setToast({ tipo: 'warn', msg: res.mensaje || 'La obra cambió de estado.' });
        return;
      }
      throw new Error(res.mensaje || 'No se pudo registrar la acción.');
    }

    cerrarForm();
    // Actualizar solo esta obra en el caché con la respuesta (sin re-llamar).
    if (res.acciones) {
      inicio.actualizarObra(solicitudId, {
        AccionesHabilitadas: res.acciones,
        SubEstado: res.subEstado ?? obra.SubEstado,
        AvanceObraPct: res.avanceObraPct ?? obra.AvanceObraPct,
      });
    } else {
      await inicio.refrescar();
    }
    setToast({ tipo: 'ok', msg: 'Acción registrada correctamente.' });
    onEventoRegistrado?.();
  };

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#4A4A4A]">Avance</span>
          <span className="text-lg font-bold text-[#0066CC]">{Math.round(obra.AvanceObraPct || 0)}%</span>
        </div>
      </div>

      {/* Contador de detención */}
      <div className={`rounded-xl shadow-sm p-4 ${detenida ? 'bg-orange-50 border-2 border-orange-300' : 'bg-white'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className={`w-5 h-5 ${detenida ? 'text-orange-600' : 'text-[#0066CC]'}`} />
          <h3 className="text-base font-semibold text-[#003D7A]">Detención</h3>
        </div>
        {detenida ? (
          <p className="text-sm text-orange-800">
            Obra <strong>detenida actualmente</strong> · {dias} día{dias !== 1 ? 's' : ''} acumulado{dias !== 1 ? 's' : ''}.
          </p>
        ) : (
          <p className="text-sm text-[#4A4A4A]">
            La obra no está detenida.{dias > 0 && ` ${dias} día${dias !== 1 ? 's' : ''} detenida en total (histórico).`}
          </p>
        )}
      </div>

      {/* Acciones de control */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-base font-semibold text-[#003D7A] mb-3">Acciones de control</h3>
        {accionesControl.length === 0 ? (
          <p className="text-sm text-[#4A4A4A]">No hay acciones de control disponibles en el estado actual de la obra.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {accionesControl.map((accion) => {
              const Icono = iconoDe(accion.Icono);
              return (
                <button
                  key={accion.Codigo}
                  type="button"
                  onClick={() => abrirAccion(accion)}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#003D7A]/10 hover:border-[#0066CC] hover:bg-blue-50/50 active:bg-blue-100/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 flex-shrink-0 bg-[#0066CC]/10 rounded-lg flex items-center justify-center">
                    <Icono className="w-5 h-5 text-[#0066CC]" />
                  </div>
                  <span className="text-sm font-medium text-[#003D7A]">{accion.Label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.tipo === 'ok' ? 'bg-green-600' : toast.tipo === 'warn' ? 'bg-orange-500' : 'bg-[#E30613]'}`}
             onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {accionActiva && (
        <EventoForm
          accion={accionActiva}
          eventoIdExterno={eventoIdActivo}
          onCancel={cerrarForm}
          onSubmit={enviarEvento}
        />
      )}
    </div>
  );
}
