import { useState, useMemo, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import type { AccionCatalogo } from '@/types/eventos';
import {
  armarFotos, armarInformes, armarDocumento, validarPesos,
  ArchivoInvalidoError, type DocumentoBase64,
} from '@/utils/prepararArchivos';

// Los 8 INSPECCION_* son el único grupo que acepta Fotos/Informes.
// El resto de acciones con adjunto usan el canal Documento.
function esInspeccion(codigo: string): boolean {
  return codigo.startsWith('INSPECCION_');
}

function fileADataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

interface EventoFormProps {
  accion: AccionCatalogo;
  /** UUID ya generado (se reusa en reintentos) — para nombrar archivos. */
  eventoIdExterno: string;
  onCancel: () => void;
  /** Devuelve el Payload armado según las banderas de la acción. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

export function EventoForm({ accion, eventoIdExterno, onCancel, onSubmit }: EventoFormProps) {
  const [comentario, setComentario] = useState('');
  const [avance, setAvance] = useState('');
  const [tipoDocumentoId, setTipoDocumentoId] = useState<number | ''>('');
  const [fotos, setFotos] = useState<string[]>([]); // data URLs
  const [adjunto, setAdjunto] = useState<{ nombre: string; dataUrl: string } | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const inspeccion = esInspeccion(accion.Codigo);
  const tieneTiposDoc = Array.isArray(accion.TiposDocumento) && accion.TiposDocumento.length > 0;

  const puedeEnviar = useMemo(() => {
    if (accion.RequiereComentario && comentario.trim().length === 0) return false;
    if (accion.RequiereAvance && avance === '') return false;
    if (accion.RequiereAdjunto) {
      if (inspeccion && fotos.length === 0 && !adjunto) return false;
      if (!inspeccion && !adjunto) return false;
      if (!inspeccion && tieneTiposDoc && tipoDocumentoId === '') return false;
    }
    return true;
  }, [accion, comentario, avance, fotos, adjunto, inspeccion, tieneTiposDoc, tipoDocumentoId]);

  const handleFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map(fileADataUrl));
    setFotos((prev) => [...prev, ...urls]);
  };

  const handleAdjunto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileADataUrl(file);
    setAdjunto({ nombre: file.name, dataUrl });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación por banderas (defensa en cliente además del servidor).
    if (accion.RequiereComentario && comentario.trim().length === 0) {
      setError('El comentario es obligatorio para esta acción.');
      return;
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
    if (accion.RequiereAvance) payload.AvancePct = Number(avance);

    let fotosB64: ReturnType<typeof armarFotos> = [];
    let informesB64: ReturnType<typeof armarInformes> = [];
    let documentoB64: DocumentoBase64 | null = null;

    if (inspeccion) {
      if (fotos.length > 0) fotosB64 = armarFotos(eventoIdExterno, fotos);
      if (adjunto) informesB64 = armarInformes(eventoIdExterno, [adjunto]);
    } else if (adjunto) {
      documentoB64 = armarDocumento(eventoIdExterno, {
        nombre: adjunto.nombre,
        dataUrl: adjunto.dataUrl,
        tipoDocumentoId: tipoDocumentoId === '' ? undefined : Number(tipoDocumentoId),
      });
    }

    // Validar pesos ANTES de enviar (evita perder el evento completo).
    try {
      validarPesos({ fotos: fotosB64, informes: informesB64, documento: documentoB64 });
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) { setError(err.message); return; }
      throw err;
    }

    if (fotosB64.length) payload.Fotos = fotosB64;
    if (informesB64.length) payload.Informes = informesB64;
    if (documentoB64) payload.Documento = documentoB64;

    setEnviando(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el evento.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#003D7A]/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#003D7A]">{accion.Label}</h2>
          <button type="button" onClick={onCancel} className="p-1 text-[#4A4A4A] hover:text-[#003D7A]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {accion.RequiereComentario && (
            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-1">Comentario</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC]"
                placeholder="Describe la acción…"
              />
            </div>
          )}

          {accion.RequiereAvance && (
            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-1">Avance de obra (%)</label>
              <input
                type="number" min={0} max={100}
                value={avance}
                onChange={(e) => setAvance(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC]"
                placeholder="0 – 100"
              />
            </div>
          )}

          {accion.RequiereAdjunto && inspeccion && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#003D7A] mb-1">Fotos</label>
                <input type="file" accept="image/*" multiple onChange={handleFotos} className="block w-full text-sm" />
                {fotos.length > 0 && <p className="text-xs text-[#4A4A4A] mt-1">{fotos.length} foto(s) seleccionada(s)</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#003D7A] mb-1">Informe / adjunto (opcional)</label>
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={handleAdjunto} className="block w-full text-sm" />
                {adjunto && <p className="text-xs text-[#4A4A4A] mt-1">{adjunto.nombre}</p>}
              </div>
            </>
          )}

          {accion.RequiereAdjunto && !inspeccion && (
            <>
              {tieneTiposDoc && (
                <div>
                  <label className="block text-sm font-medium text-[#003D7A] mb-1">Tipo de documento</label>
                  <select
                    value={tipoDocumentoId}
                    onChange={(e) => setTipoDocumentoId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] bg-white"
                  >
                    <option value="">Selecciona…</option>
                    {accion.TiposDocumento.map((t) => (
                      <option key={t.Id} value={t.Id}>{t.Value}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#003D7A] mb-1">Documento</label>
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={handleAdjunto} className="block w-full text-sm" />
                {adjunto && <p className="text-xs text-[#4A4A4A] mt-1">{adjunto.nombre}</p>}
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-[#E30613] rounded-lg p-3">
              <p className="text-sm text-[#E30613]">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" size="lg" fullWidth onClick={onCancel} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={!puedeEnviar || enviando}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
