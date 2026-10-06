import { useState } from 'react';
import { FileUp, AlertTriangle, Lock, Clock, Undo2 } from 'lucide-react';
import { EventoForm } from './EventoForm';
import { BotonDescargar } from './BotonDescargar';
import { useInicio } from '@/context/InicioContext';
import { generarEventoIdExterno } from '@/services/eventosService';
import { enviarAccionObra } from '@/utils/enviarAccionObra';
import type { CambiarEtapa } from '@/utils/etapasProgreso';
import { tramiteRechazado, ACCION_DEVOLVER_DOCUMENTACION, TEXTOS_DEVOLUCION, TEXTOS_ESPERA_CORRECCION, type Tramite } from '@/utils/tramitesObra';
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
  /**
   * Documentos del ITO que el Supervisor revisa en esta misma tarjeta (con «Descargar»). Si la API le habilita
   * «Devolver documentación», la tarjeta ofrece además ese botón rojo (equivale a rechazar; CU-32).
   */
  revision?: { documentos: { nombre: string; url?: string | null; etiqueta?: string }[] };
  /** Se dispara tras registrar el documento con éxito (para refrescar el detalle). */
  onRegistrado?: () => void;
}

/**
 * Tarjeta de la pestaña «Información» que le pide al usuario un documento pendiente
 * (acta de inicio, acta de recepción firmada — contrato CU-15/CU-16). Si el usuario
 * tiene el permiso, lo sube aquí mismo; si no, se le explica.
 */
export function TramitePendienteCard({ solicitudId, tramite, bloquea, comentarioDevolucion, revision, onRegistrado }: TramitePendienteCardProps) {
  const inicio = useInicio();
  const obra = inicio.getObra(solicitudId);
  const [abierto, setAbierto] = useState(false);
  const [eventoId, setEventoId] = useState('');
  const [devolviendo, setDevolviendo] = useState(false);
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

  // «Devolver documentación» (CU-32): solo si la API la habilita; mismo EventoForm (comentario, sin adjunto).
  const defDevolver = inicio.catalogo?.TiposEvento?.find((t) => t.Codigo === ACCION_DEVOLVER_DOCUMENTACION);
  const frescaDevolver = obra.AccionesDef?.[ACCION_DEVOLVER_DOCUMENTACION];
  const accionDevolver: AccionCatalogo | null = obra.AccionesHabilitadas.includes(ACCION_DEVOLVER_DOCUMENTACION) && (defDevolver || frescaDevolver)
    ? {
        Codigo: ACCION_DEVOLVER_DOCUMENTACION, Label: TEXTOS_DEVOLUCION.devolver, Icono: 'corner-down-left', Grupo: '', Orden: 50,
        RequiereComentario: true, RequiereAdjunto: false, RequiereAvance: false, TiposDocumento: [],
        ...defDevolver, ...frescaDevolver,
      }
    : null;
  const enRevision = !!revision && !!accionDevolver;
  // CU-33: devuelto/rechazado y este usuario no puede subir la corrección → espera al ITO (ve su comentario y el documento).
  const esperaCorreccion = rechazado && !puedeSubir;
  const verDocumentos = !!revision && (enRevision || esperaCorreccion);

  const abrir = () => { setEventoId(generarEventoIdExterno()); setDevolviendo(false); setAbierto(true); };
  const abrirDevolver = () => { setEventoId(generarEventoIdExterno()); setDevolviendo(true); setAbierto(true); };
  const cerrar = () => { setAbierto(false); setEventoId(''); setDevolviendo(false); };

  const enviar = async (payload: Record<string, unknown>, opciones?: { fechaEvento?: string; etapa?: CambiarEtapa }) => {
    const r = await enviarAccionObra({
      inicio, obra, solicitudId, tipoEvento: devolviendo ? ACCION_DEVOLVER_DOCUMENTACION : tramite.codigo, eventoIdExterno: eventoId, payload,
      fechaEvento: opciones?.fechaEvento, creaInspeccion: devolviendo ? false : tramite.creaInspeccion, alRegistrar: cerrar, etapa: opciones?.etapa,
    });
    if (r.estado === 'noPermitida') { setToast({ tipo: 'warn', msg: r.mensaje }); return; }
    setToast({ tipo: 'ok', msg: devolviendo ? TEXTOS_DEVOLUCION.toastOk : textos.toastOk });
    onRegistrado?.();
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          {bloquea
            ? <Lock className="w-5 h-5 text-amber-700 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />}
          <h3 className="text-base font-semibold text-amber-900">{esperaCorreccion ? TEXTOS_ESPERA_CORRECCION.titulo : enRevision ? TEXTOS_DEVOLUCION.titulo : textos.titulo}</h3>
        </div>
        <p className="text-base text-amber-900 mb-3">{esperaCorreccion ? TEXTOS_ESPERA_CORRECCION.mensaje : enRevision ? TEXTOS_DEVOLUCION.mensaje : textos.mensaje}</p>
        {verDocumentos && revision!.documentos.map((doc) => (
          <div key={doc.nombre} className="bg-white rounded-lg p-3 border border-amber-200 mb-3">
            {doc.etiqueta && <p className="text-sm font-semibold text-[#003D7A] mb-1">{doc.etiqueta}</p>}
            <p className="text-base text-[#1A1A1A] break-all mb-2">{doc.nombre}</p>
            <BotonDescargar url={doc.url} nombre={doc.nombre} />
          </div>
        ))}
        {rechazado && (
          <div className="bg-white border-2 border-[#E30613]/60 rounded-lg p-3 mb-3">
            <p className="text-sm font-semibold text-[#E30613] mb-1">{esperaCorreccion ? TEXTOS_ESPERA_CORRECCION.comentario : 'Comentario rechazo'}</p>
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
        ) : !esperaCorreccion && (
          <p className="text-base font-medium text-amber-900">{textos.sinPermiso}</p>
        )}
        {enRevision && (
          <button
            type="button"
            onClick={abrirDevolver}
            className="w-full min-h-12 mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#E30613] text-white text-base font-semibold active:bg-[#B8050F]"
          >
            <Undo2 className="w-5 h-5" />
            {TEXTOS_DEVOLUCION.devolver}
          </button>
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

      {abierto && devolviendo && accionDevolver && (
        <EventoForm
          accion={{ ...accionDevolver, Label: TEXTOS_DEVOLUCION.devolver }}
          avisoConfirmacion={TEXTOS_DEVOLUCION.aviso}
          ayudaComentario={TEXTOS_DEVOLUCION.ayuda}
          eventoIdExterno={eventoId}
          onCancel={cerrar}
          onSubmit={enviar}
        />
      )}

      {abierto && !devolviendo && accion && (
        <EventoForm
          accion={rechazado ? { ...accion, Label: textos.boton } : accion}
          eventoIdExterno={eventoId}
          pedirFechaInicio={tramite.pedirFechaInicio}
          onCancel={cerrar}
          onSubmit={enviar}
        />
      )}
    </>
  );
}
