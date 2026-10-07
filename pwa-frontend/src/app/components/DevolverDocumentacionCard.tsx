import { useState } from 'react';
import { ClipboardList, Undo2 } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { BotonDescargar } from './BotonDescargar';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { ACCION_DEVOLVER_DOCUMENTACION, TEXTOS_DEVOLUCION } from '@/utils/tramitesObra';
import { definicionVigente } from '@/utils/definicionVigente';

interface DevolverDocumentacionCardProps {
  solicitudId: number;
  /** Los documentos más recientes del ITO (el último de cada tipo), para revisarlos antes de decidir. */
  documentos: { nombre: string; url?: string | null; etiqueta?: string }[];
  /** Se dispara tras devolver con éxito (para refrescar el detalle). */
  onRegistrado?: () => void;
}

/**
 * «Devolver documentación» en cualquier etapa donde la API la habilite y no vaya dentro de otra tarjeta (contrato CU-32):
 * equivale a RECHAZAR; el Supervisor no sube nada, escribe en el comentario las correcciones y el ITO carga de nuevo el
 * documento. Mismo EventoForm de las demás acciones (comentario obligatorio, sin adjunto).
 */
export function DevolverDocumentacionCard({ solicitudId, documentos, onRegistrado }: DevolverDocumentacionCardProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const [abierto, setAbierto] = useState(false);
  const [eventoId, setEventoId] = useState('');
  const [toast, setToast] = useState<{ tipo: 'ok' | 'warn'; msg: string } | null>(null);

  if (!obra) return null;

  if (!obra.AccionesHabilitadas.includes(ACCION_DEVOLVER_DOCUMENTACION)) return null;
  const accion = definicionVigente(obra, inicio.catalogo, ACCION_DEVOLVER_DOCUMENTACION, {
    Label: TEXTOS_DEVOLUCION.devolver, Icono: 'corner-down-left', Orden: 50, RequiereComentario: true,
  });
  if (!accion) return null;

  const abrir = () => { setEventoId(generarEventoIdExterno()); setAbierto(true); };
  const cerrar = () => { setAbierto(false); setEventoId(''); };

  const enviar = async (payload: Record<string, unknown>, opciones?: { etapa?: CambiarEtapa }) => {
    const r = await enviarAccionObra({
      inicio, obra, solicitudId, tipoEvento: ACCION_DEVOLVER_DOCUMENTACION, eventoIdExterno: eventoId, payload,
      creaInspeccion: false, alRegistrar: cerrar, etapa: opciones?.etapa,
    });
    if (r.estado === 'noPermitida') { setToast({ tipo: 'warn', msg: r.mensaje }); return; }
    setToast({ tipo: 'ok', msg: TEXTOS_DEVOLUCION.toastOk });
    onRegistrado?.();
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <h3 className="text-base font-semibold text-amber-900">{TEXTOS_DEVOLUCION.tituloGeneral}</h3>
        </div>
        <p className="text-base text-amber-900">{TEXTOS_DEVOLUCION.mensajeGeneral}</p>

        {documentos.map((doc) => (
          <div key={doc.nombre} className="bg-white rounded-lg p-3 border border-amber-200">
            {doc.etiqueta && <p className="text-sm font-semibold text-[#003D7A] mb-1">{doc.etiqueta}</p>}
            <p className="text-base text-[#1A1A1A] break-all mb-2">{doc.nombre}</p>
            <BotonDescargar url={doc.url} nombre={doc.nombre} />
          </div>
        ))}

        <button
          type="button"
          onClick={abrir}
          className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-[#E30613] text-white text-base font-semibold active:bg-[#B8050F]"
        >
          <Undo2 className="w-5 h-5" />
          {TEXTOS_DEVOLUCION.devolver}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.tipo === 'ok' ? 'bg-green-600' : 'bg-orange-500'}`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {abierto && (
        <EventoForm
          accion={accion}
          avisoConfirmacion={TEXTOS_DEVOLUCION.aviso}
          ayudaComentario={TEXTOS_DEVOLUCION.ayuda}
          eventoIdExterno={eventoId}
          onCancel={cerrar}
          onSubmit={enviar}
        />
      )}
    </>
  );
}
