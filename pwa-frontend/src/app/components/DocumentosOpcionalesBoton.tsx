import { useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { Button } from './Button';
import { SubirArchivo } from './SubirArchivo';
import { useProgreso } from '@/context/ProgresoContext';
import { eventosService, generarEventoIdExterno } from '@/services/eventosService';
import { armarDocumento, validarPesos, ArchivoInvalidoError } from '@/utils/prepararArchivos';
import type { TipoDocumento } from '@/types/eventos';

function fileADataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

interface DocumentosOpcionalesBotonProps {
  solicitudId: number;
  /** Tipos de documento OPCIONALES que la API habilita para esta acción (`TiposDocumentoOpcional`). */
  tipos: TipoDocumento[];
  /** Se dispara tras subir con éxito (para refrescar el detalle y ver los documentos). */
  onSubido?: () => void;
}

/**
 * Botón «Agregar documento opcional» de una acción (contrato CU-36). Solo existe si la API entrega al menos un tipo en
 * `TiposDocumentoOpcional`. Abre un formulario con un campo por cada tipo habilitado; se sube con el endpoint propio
 * `POST /solicitudes/{id}/documentos` (no avanza el flujo, no crea eventos). Sin cola ni reintentos automáticos: ese
 * endpoint no es idempotente y un reintento podría duplicar el archivo.
 */
export function DocumentosOpcionalesBoton({ solicitudId, tipos, onSubido }: DocumentosOpcionalesBotonProps) {
  const { conProgreso } = useProgreso();
  const [abierto, setAbierto] = useState(false);
  const [archivos, setArchivos] = useState<Record<number, { nombre: string; dataUrl: string }>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!Array.isArray(tipos) || tipos.length === 0) return null;

  const cantidad = Object.keys(archivos).length;
  const cerrar = () => { setAbierto(false); setArchivos({}); setError(''); };

  const elegir = (tipoId: number) => async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const dataUrl = await fileADataUrl(file);
    setArchivos((prev) => ({ ...prev, [tipoId]: { nombre: file.name, dataUrl } }));
    setError('');
  };

  const quitar = (tipoId: number) => () =>
    setArchivos((prev) => { const { [tipoId]: _quitado, ...resto } = prev; return resto; });

  const enviar = async () => {
    setError('');
    if (cantidad === 0) { setError('Elige al menos un documento para subir.'); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('Sin conexión: los documentos opcionales no se pueden subir sin internet. Inténtalo cuando tengas señal.');
      return;
    }

    // Nombres únicos por envío; el id solo sirve para nombrar (este endpoint no es idempotente).
    const idNombre = generarEventoIdExterno();
    const documentos = tipos
      .filter((t) => archivos[t.Id])
      .map((t, i) => armarDocumento(idNombre, { nombre: archivos[t.Id].nombre, dataUrl: archivos[t.Id].dataUrl, tipoDocumentoId: t.Id }, i + 1));
    try {
      validarPesos({ documentos });
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) { setError(err.message); return; }
      throw err;
    }

    setEnviando(true);
    try {
      const ok = await conProgreso(
        { mensaje: documentos.length > 1 ? 'Subiendo documentos…' : 'Subiendo documento…', tituloError: 'No se pudo subir el documento opcional' },
        async () => {
          await eventosService.subirDocumentosOpcionales({
            solicitudId,
            documentos: documentos.map((d) => ({ TipoDocumentoId: d.TipoDocumentoId as number, Nombre: d.Nombre, Contenido: d.Contenido })),
          });
          return true;
        },
      );
      if (ok) {
        cerrar();
        setToast(documentos.length > 1 ? 'Documentos subidos correctamente.' : 'Documento subido correctamente.');
        onSubido?.();
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-[#0066CC] text-[#0066CC] text-base font-semibold active:bg-blue-50"
      >
        <FilePlus2 className="w-5 h-5" />
        Agregar documento opcional
      </button>

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white bg-green-600"
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#003D7A]/10 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#003D7A]">Agregar documento opcional</h2>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="p-2 text-[#4A4A4A] hover:text-[#003D7A]">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-base text-[#003D7A]">
                  Sube los documentos que tengas: todos son opcionales. Subirlos <strong>no avanza el flujo</strong> de la obra.
                </p>
              </div>

              {tipos.map((t) => (
                <div key={t.Id}>
                  <p className="text-base font-semibold text-[#003D7A] mb-2">
                    {t.Value} <span className="text-[#4A4A4A] font-normal">(opcional)</span>
                  </p>
                  <SubirArchivo
                    etiquetaBoton={`Subir ${t.Value.toLowerCase()}`}
                    ayuda="PDF, Word o foto. Máximo 10 MB."
                    accept=".pdf,.doc,.docx,image/*"
                    seleccionados={archivos[t.Id] ? [archivos[t.Id].nombre] : []}
                    onElegir={elegir(t.Id)}
                    onQuitarTodo={quitar(t.Id)}
                  />
                </div>
              ))}

              {error && (
                <div className="bg-red-50 border-2 border-[#E30613] rounded-lg p-3">
                  <p className="text-base text-[#E30613]">{error}</p>
                </div>
              )}

              {cantidad === 0 && (
                <p className="text-base text-[#4A4A4A]">Para enviar falta: <strong>al menos un documento</strong>.</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" size="lg" fullWidth onClick={cerrar} disabled={enviando}>
                  Cancelar
                </Button>
                <Button type="button" variant="primary" size="lg" fullWidth onClick={enviar} disabled={cantidad === 0 || enviando}>
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
