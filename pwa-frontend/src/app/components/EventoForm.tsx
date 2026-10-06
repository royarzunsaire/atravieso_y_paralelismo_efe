import { useState, useMemo, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { SubirArchivo } from './SubirArchivo';
import type { AccionCatalogo } from '@/types/eventos';
import { AVISO_CONFIRMACION } from '@/utils/accionesApp';
import { useProgreso } from '@/context/ProgresoContext';
import { banderasDesconocidas } from '@/utils/gruposAcciones';
import { mensajeEnvio, type CambiarEtapa } from '@/utils/etapasProgreso';
import { hoyCL, fechaInicioAEventoUTC } from '@/utils/fechas';
import {
  armarFotos, armarInformes, armarDocumento, validarPesos,
  ArchivoInvalidoError, type DocumentoBase64,
} from '@/utils/prepararArchivos';

// Las acciones del grupo «Inspecciones» son las únicas que aceptan Fotos/Informes.
// El resto de acciones con adjunto usan el canal Documentos. Sin grupo, se cae al nombre.
function esInspeccion(accion: AccionCatalogo): boolean {
  return accion.Grupo ? accion.Grupo === 'Inspecciones' : accion.Codigo.startsWith('INSPECCION_');
}

function fileADataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

// Texto de ayuda concreto por acción (contrato CU-06: decir qué hacer).
const AYUDA_COMENTARIO: Record<string, string> = {
  OBRA_DETENIDA: 'Explica por qué se detiene la obra…',
  OBRA_REACTIVADA: 'Explica por qué se reactiva la obra…',
  OBRA_FINALIZADA: 'Describe cómo queda la obra al finalizar…',
  ACTA_INICIO: 'Describe cómo se da inicio a la obra…',
  INFORME_FINAL: 'Escribe un comentario sobre el informe final…',
  RECHAZAR_INFORME: 'Explica por qué se rechaza el informe…',
};

interface EventoFormProps {
  accion: AccionCatalogo;
  /** Avance actual de la obra (%): se reenvía en los eventos sin avance propio para que la inspección no quede en 0. */
  avanceActual?: number;
  /** Aviso de confirmación propio (si no, el de AVISO_CONFIRMACION según la acción). */
  avisoConfirmacion?: string;
  /** Texto de ayuda del comentario propio (si no, el de la acción). */
  ayudaComentario?: string;
  /** UUID ya generado (se reusa en reintentos) — para nombrar archivos. */
  eventoIdExterno: string;
  onCancel: () => void;
  /** Pide «Fecha de inicio de la obra» (acta de inicio): viaja como FechaEvento. */
  pedirFechaInicio?: boolean;
  /** Devuelve el Payload armado según las banderas de la acción (y la FechaEvento si se pidió). */
  onSubmit: (payload: Record<string, unknown>, opciones?: { fechaEvento?: string; etapa?: CambiarEtapa }) => Promise<void>;
}

export function EventoForm({ accion, avanceActual, avisoConfirmacion, ayudaComentario, eventoIdExterno, pedirFechaInicio, onCancel, onSubmit }: EventoFormProps) {
  const tiposDoc = Array.isArray(accion.TiposDocumento) ? accion.TiposDocumento : [];
  const tieneTiposDoc = tiposDoc.length > 0;
  const unSoloTipoDoc = tiposDoc.length === 1;

  const [comentario, setComentario] = useState('');
  const [fechaInicio, setFechaInicio] = useState(() => hoyCL());
  const [avance, setAvance] = useState('');
  // Con un único tipo de documento posible se selecciona solo.
  const [tipoDocumentoId, setTipoDocumentoId] = useState<number | ''>(unSoloTipoDoc ? tiposDoc[0].Id : '');
  const [fotos, setFotos] = useState<string[]>([]); // data URLs
  const [adjunto, setAdjunto] = useState<{ nombre: string; dataUrl: string } | null>(null);
  // Una acción con VARIOS tipos de documento (ej. documentación del ITO) exige un archivo por cada tipo (CU-30).
  const [adjuntosTipo, setAdjuntosTipo] = useState<Record<number, { nombre: string; dataUrl: string }>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { conProgreso } = useProgreso();

  const inspeccion = esInspeccion(accion);
  const multiDoc = !inspeccion && accion.RequiereAdjunto && tiposDoc.length > 1;
  // Requisitos nuevos de la API que la app aún no sabe pedir: se avisa, pero se deja enviar igual (CU-28).
  const desconocidas = banderasDesconocidas(accion);

  // Qué falta para poder enviar, dicho en palabras simples.
  const faltantes = useMemo(() => {
    const f: string[] = [];
    if (pedirFechaInicio && !fechaInicio) f.push('la fecha de inicio de la obra');
    if (accion.RequiereComentario && comentario.trim().length === 0) f.push('el comentario');
    if (accion.RequiereAvance && avance === '') f.push('el porcentaje de avance');
    if (accion.RequiereAdjunto) {
      if (multiDoc) {
        for (const t of tiposDoc) if (!adjuntosTipo[t.Id]) f.push(`el archivo (${t.Value})`);
      } else {
        if (inspeccion && fotos.length === 0 && !adjunto) f.push('al menos una foto');
        if (!inspeccion && tieneTiposDoc && tipoDocumentoId === '') f.push('el tipo de documento');
        if (!inspeccion && !adjunto) {
          f.push(unSoloTipoDoc ? `el archivo (${tiposDoc[0].Value})` : 'el archivo');
        }
      }
    }
    return f;
  }, [accion, comentario, avance, fotos, adjunto, adjuntosTipo, multiDoc, inspeccion, tieneTiposDoc, tipoDocumentoId, unSoloTipoDoc, tiposDoc, pedirFechaInicio, fechaInicio]);

  const puedeEnviar = faltantes.length === 0;
  // Acciones sin campos (ej. aprobar informe): solo se confirma.
  const sinCampos = !accion.RequiereComentario && !accion.RequiereAdjunto && !accion.RequiereAvance;
  const aviso = avisoConfirmacion ?? AVISO_CONFIRMACION[accion.Codigo];

  const handleFotos = async (files: File[]) => {
    const urls = await Promise.all(files.map(fileADataUrl));
    setFotos((prev) => [...prev, ...urls]);
  };

  const handleAdjunto = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const dataUrl = await fileADataUrl(file);
    setAdjunto({ nombre: file.name, dataUrl });
  };

  const handleAdjuntoTipo = (tipoId: number) => async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const dataUrl = await fileADataUrl(file);
    setAdjuntosTipo((prev) => ({ ...prev, [tipoId]: { nombre: file.name, dataUrl } }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación por banderas (defensa en cliente además del servidor).
    if (pedirFechaInicio && (!fechaInicio || fechaInicio > hoyCL())) {
      setError('Elige la fecha de inicio de la obra (hoy o un día anterior).');
      return;
    }
    if (accion.RequiereComentario && comentario.trim().length === 0) {
      setError('El comentario es obligatorio para esta acción.');
      return;
    }
    if (multiDoc) {
      const faltan = tiposDoc.filter((t) => !adjuntosTipo[t.Id]);
      if (faltan.length > 0) {
        setError(`Falta subir: ${faltan.map((t) => t.Value).join(', ')}.`);
        return;
      }
    }
    if (accion.RequiereAvance) {
      const n = Number(avance);
      if (avance === '' || isNaN(n) || n < 0 || n > 100) {
        setError('Ingresa un porcentaje de avance entre 0 y 100.');
        return;
      }
    }

    // Armar el Payload según el tipo de acción.
    const payload: Record<string, unknown> = {};
    if (comentario.trim()) payload.Comentario = comentario.trim();
    // Cada evento crea una inspección en la API y, sin AvancePct, queda en 0 %.
    // Si la acción no pide avance, se conserva el actual de la obra (CU-13).
    if (accion.RequiereAvance) payload.AvancePct = Number(avance);
    else if (avanceActual != null) payload.AvancePct = avanceActual;

    let fotosB64: ReturnType<typeof armarFotos> = [];
    let informesB64: ReturnType<typeof armarInformes> = [];
    let documentoB64: DocumentoBase64 | null = null;
    let documentosB64: DocumentoBase64[] = [];

    if (inspeccion) {
      if (fotos.length > 0) fotosB64 = armarFotos(eventoIdExterno, fotos);
      if (adjunto) informesB64 = armarInformes(eventoIdExterno, [adjunto]);
    } else if (multiDoc) {
      documentosB64 = tiposDoc.map((t, i) => armarDocumento(eventoIdExterno, {
        nombre: adjuntosTipo[t.Id].nombre,
        dataUrl: adjuntosTipo[t.Id].dataUrl,
        tipoDocumentoId: t.Id,
      }, i + 1));
    } else if (adjunto) {
      documentoB64 = armarDocumento(eventoIdExterno, {
        nombre: adjunto.nombre,
        dataUrl: adjunto.dataUrl,
        tipoDocumentoId: tipoDocumentoId === '' ? undefined : Number(tipoDocumentoId),
      });
    }

    // Validar pesos ANTES de enviar (evita perder el evento completo).
    try {
      validarPesos({ fotos: fotosB64, informes: informesB64, documento: documentoB64, documentos: documentosB64 });
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) { setError(err.message); return; }
      throw err;
    }

    if (fotosB64.length) payload.Fotos = fotosB64;
    if (informesB64.length) payload.Informes = informesB64;
    // La API prefiere «Documentos» (lista); «Documento» es solo de retrocompatibilidad.
    if (documentoB64) payload.Documentos = [documentoB64];
    else if (documentosB64.length > 0) payload.Documentos = documentosB64;

    setEnviando(true);
    try {
      // Indicador de pantalla completa + popup si falla (CU-22). El botón conserva su texto.
      await conProgreso(
        {
          mensaje: mensajeEnvio({
            fotos: fotosB64.length, informes: informesB64.length, documentos: documentoB64 ? 1 : documentosB64.length,
            porDefecto: `Enviando «${accion.Label}»…`,
          }),
          tituloError: `No se pudo registrar «${accion.Label}»`,
        },
        (etapa) => onSubmit(payload, { ...(pedirFechaInicio ? { fechaEvento: fechaInicioAEventoUTC(fechaInicio) } : {}), etapa }),
      );
    } finally {
      setEnviando(false);
    }
  };

  const nombreDocumento = unSoloTipoDoc ? tiposDoc[0].Value : 'documento';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#003D7A]/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#003D7A]">{accion.Label}</h2>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="p-2 text-[#4A4A4A] hover:text-[#003D7A]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {aviso && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
              <p className="text-base font-medium text-amber-900">{aviso}</p>
            </div>
          )}
          {desconocidas.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-base text-[#003D7A]">
                Esta acción pide datos adicionales ({desconocidas.join(', ')}) que la app aún no sabe pedir. Puedes enviarla
                igual: si falta algo, la plataforma te lo indicará.
              </p>
            </div>
          )}

          {pedirFechaInicio && (
            <div>
              <label className="block text-base font-semibold text-[#003D7A] mb-1">
                Fecha de inicio de la obra <span className="text-[#E30613]">*</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                max={hoyCL()}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full h-12 px-3 text-base rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] bg-white"
              />
              <p className="text-base text-[#4A4A4A] mt-1">Elige el día en que comenzó la obra. Por defecto es hoy.</p>
            </div>
          )}

          {accion.RequiereComentario && (
            <div>
              <label className="block text-base font-semibold text-[#003D7A] mb-1">
                Comentario <span className="text-[#E30613]">*</span>
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={4}
                className="w-full px-3 py-3 text-base rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC]"
                placeholder={ayudaComentario ?? AYUDA_COMENTARIO[accion.Codigo] ?? 'Escribe aquí los detalles…'}
              />
            </div>
          )}

          {accion.RequiereAvance && (
            <div>
              <label className="block text-base font-semibold text-[#003D7A] mb-1">
                Avance de obra (%) <span className="text-[#E30613]">*</span>
              </label>
              <input
                type="number" min={0} max={100}
                value={avance}
                onChange={(e) => setAvance(e.target.value)}
                className="w-full h-12 px-3 text-base rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC]"
                placeholder="Un número entre 0 y 100"
              />
            </div>
          )}

          {accion.RequiereAdjunto && inspeccion && (
            <>
              <div>
                <p className="text-base font-semibold text-[#003D7A] mb-2">
                  Fotos <span className="text-[#E30613]">*</span>
                </p>
                <SubirArchivo
                  etiquetaBoton="Agregar fotos"
                  ayuda="Elige una o varias fotos. Máximo 1 MB cada una."
                  accept="image/*"
                  multiple
                  obligatorio={fotos.length === 0 && !adjunto}
                  seleccionados={fotos.map((_, i) => `Foto ${i + 1}`)}
                  onElegir={handleFotos}
                  onQuitarTodo={() => setFotos([])}
                />
              </div>
              <div>
                <p className="text-base font-semibold text-[#003D7A] mb-2">Informe (opcional)</p>
                <SubirArchivo
                  etiquetaBoton="Subir informe"
                  ayuda="PDF, Word o foto. Máximo 10 MB."
                  accept=".pdf,.doc,.docx,image/*"
                  seleccionados={adjunto ? [adjunto.nombre] : []}
                  onElegir={handleAdjunto}
                  onQuitarTodo={() => setAdjunto(null)}
                />
              </div>
            </>
          )}

          {multiDoc && (
            <>
              <div className="flex items-start gap-2 rounded-lg border bg-amber-50 border-amber-300 text-amber-900 p-3">
                <p className="text-base font-medium">
                  Esta acción exige <strong>{tiposDoc.length} documentos</strong>: debes subir los dos para poder enviarla.
                </p>
              </div>
              {tiposDoc.map((t) => (
                <div key={t.Id}>
                  <p className="text-base font-semibold text-[#003D7A] mb-2">
                    {t.Value} <span className="text-[#E30613]">*</span>
                  </p>
                  <SubirArchivo
                    etiquetaBoton={`Subir ${t.Value.toLowerCase()}`}
                    ayuda="PDF, Word o foto. Máximo 10 MB."
                    accept=".pdf,.doc,.docx,image/*"
                    obligatorio
                    seleccionados={adjuntosTipo[t.Id] ? [adjuntosTipo[t.Id].nombre] : []}
                    onElegir={handleAdjuntoTipo(t.Id)}
                    onQuitarTodo={() => setAdjuntosTipo((prev) => { const { [t.Id]: _quitado, ...resto } = prev; return resto; })}
                  />
                </div>
              ))}
            </>
          )}

          {accion.RequiereAdjunto && !inspeccion && !multiDoc && (
            <>
              {tieneTiposDoc && !unSoloTipoDoc && (
                <div>
                  <label className="block text-base font-semibold text-[#003D7A] mb-1">
                    ¿Qué tipo de documento es? <span className="text-[#E30613]">*</span>
                  </label>
                  <select
                    value={tipoDocumentoId}
                    onChange={(e) => setTipoDocumentoId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-12 px-3 text-base rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] bg-white"
                  >
                    <option value="">Selecciona una opción…</option>
                    {tiposDoc.map((t) => (
                      <option key={t.Id} value={t.Id}>{t.Value}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-[#003D7A] mb-2">
                  {unSoloTipoDoc ? tiposDoc[0].Value : 'Documento'} <span className="text-[#E30613]">*</span>
                </p>
                <SubirArchivo
                  etiquetaBoton={`Subir ${nombreDocumento.toLowerCase()}`}
                  ayuda="PDF, Word o foto. Máximo 10 MB."
                  accept=".pdf,.doc,.docx,image/*"
                  obligatorio
                  seleccionados={adjunto ? [adjunto.nombre] : []}
                  onElegir={handleAdjunto}
                  onQuitarTodo={() => setAdjunto(null)}
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-[#E30613] rounded-lg p-3">
              <p className="text-base text-[#E30613]">{error}</p>
            </div>
          )}

          {!puedeEnviar && (
            <p className="text-base text-[#4A4A4A]">
              Para enviar falta: <strong>{faltantes.join(', ')}</strong>.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" size="lg" fullWidth onClick={onCancel} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={!puedeEnviar || enviando}>
              {sinCampos ? 'Confirmar' : 'Enviar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
