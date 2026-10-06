import { useState } from 'react';
import { ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { BotonDescargar } from './BotonDescargar';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { ACCION_VALIDAR_INFORME, ACCION_RECHAZAR_INFORME, TEXTOS_VALIDACION, type ContextoValidacion } from '@/utils/tramitesObra';
import type { AccionCatalogo } from '@/types/eventos';

interface DocumentoParaRevisar {
  nombre: string;
  url?: string | null;
  /** Tipo de documento (ej. «Documento Con ITO 1»), para distinguir los archivos. */
  etiqueta?: string;
}

interface ValidarInformeCardProps {
  solicitudId: number;
  /** Qué se valida: el informe final o la documentación del ITO (cambia todos los textos). */
  contexto: ContextoValidacion;
  /** Documentos para revisar antes de decidir, en la misma tarjeta (cada uno con su botón «Descargar»). */
  documentos: DocumentoParaRevisar[];
  /** Se dispara tras aprobar o rechazar con éxito (para refrescar el detalle). */
  onRegistrado?: () => void;
}

/**
 * Tarjeta de «Información» para el Supervisor cuando el ITO envió el informe final y falta
 * decidir (contrato CU-19): puede descargar el informe y luego aprobarlo o rechazarlo con un
 * comentario. Usa el mismo envío que el resto de las acciones de la obra.
 */
export function ValidarInformeCard({ solicitudId, contexto, documentos, onRegistrado }: ValidarInformeCardProps) {
  const textos = TEXTOS_VALIDACION[contexto];
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
    setToast({ tipo: 'ok', msg: codigo === ACCION_VALIDAR_INFORME ? textos.toastAprobar : textos.toastRechazar });
    onRegistrado?.();
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <h3 className="text-base font-semibold text-amber-900">{textos.titulo}</h3>
        </div>
        <p className="text-base text-amber-900">{textos.mensaje}</p>

        {documentos.map((doc) => (
          <div key={doc.nombre} className="bg-white rounded-lg p-3 border border-amber-200">
            {doc.etiqueta && <p className="text-sm font-semibold text-[#003D7A] mb-1">{doc.etiqueta}</p>}
            <p className="text-base text-[#1A1A1A] break-all mb-2">{doc.nombre}</p>
            <BotonDescargar url={doc.url} nombre={doc.nombre} />
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
              {textos.aprobar}
            </button>
          )}
          {rechazar && (
            <button
              type="button"
              onClick={() => abrir(rechazar)}
              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-[#E30613] text-[#E30613] text-base font-semibold active:bg-red-50"
            >
              <XCircle className="w-5 h-5" />
              {textos.rechazar}
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
        // Mismo EventoForm de todas las acciones: las banderas (comentario obligatorio…) las manda la API y se respetan
        // (hoy VALIDAR_INFORME y RECHAZAR_INFORME exigen comentario). Solo cambian los textos según lo que se valida (CU-19).
        <EventoForm
          accion={{ ...accionActiva, Label: accionActiva.Codigo === ACCION_VALIDAR_INFORME ? textos.aprobar : textos.rechazar }}
          avisoConfirmacion={accionActiva.Codigo === ACCION_VALIDAR_INFORME ? textos.avisoAprobar : textos.avisoRechazar}
          ayudaComentario={accionActiva.Codigo === ACCION_VALIDAR_INFORME ? textos.ayudaAprobar : textos.ayudaRechazo}
          eventoIdExterno={eventoId}
          onCancel={cerrar}
          onSubmit={enviar}
        />
      )}
    </>
  );
}
