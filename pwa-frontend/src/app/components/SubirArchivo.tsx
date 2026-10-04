import { useRef } from 'react';
import { Upload, CheckCircle2, X } from 'lucide-react';

interface SubirArchivoProps {
  /** Texto del botón, claro y con verbo: "Subir acta de detención". */
  etiquetaBoton: string;
  /** Ayuda corta bajo el botón: formatos y peso máximo. */
  ayuda: string;
  accept: string;
  multiple?: boolean;
  obligatorio?: boolean;
  /** Nombres de los archivos ya elegidos (vacío = ninguno). */
  seleccionados: string[];
  onElegir: (files: File[]) => void;
  onQuitarTodo: () => void;
}

/**
 * Subida de archivos pensada para usuarios de mayor edad (contrato CU-06):
 * botón grande con verbo, estado visible del archivo elegido, "Cambiar" y
 * "Quitar" explícitos y marca "Obligatorio" mientras falte.
 */
export function SubirArchivo({
  etiquetaBoton, ayuda, accept, multiple = false, obligatorio = false,
  seleccionados, onElegir, onQuitarTodo,
}: SubirArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hay = seleccionados.length > 0;

  const abrir = () => inputRef.current?.click();
  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onElegir(files);
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={alElegir} className="hidden" />

      {!hay ? (
        <button
          type="button"
          onClick={abrir}
          className={`w-full min-h-[56px] flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed text-base font-semibold active:scale-[0.99] transition-all ${
            obligatorio
              ? 'border-[#E30613] bg-red-50 text-[#E30613]'
              : 'border-[#0066CC] bg-blue-50 text-[#0066CC]'
          }`}
        >
          <Upload className="w-6 h-6 flex-shrink-0" />
          {etiquetaBoton}
        </button>
      ) : (
        <div className="rounded-xl border-2 border-green-600 bg-green-50 p-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-green-800">
                {multiple
                  ? `${seleccionados.length} ${seleccionados.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}`
                  : 'Archivo listo'}
              </p>
              {!multiple && <p className="text-sm text-green-900 break-words">{seleccionados[0]}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={abrir}
              className="flex-1 min-h-[48px] rounded-lg bg-white border-2 border-[#0066CC] text-[#0066CC] text-base font-semibold active:scale-[0.99]"
            >
              {multiple ? 'Agregar más' : 'Cambiar archivo'}
            </button>
            <button
              type="button"
              onClick={onQuitarTodo}
              className="min-h-[48px] px-4 rounded-lg bg-white border-2 border-[#E30613] text-[#E30613] text-base font-semibold flex items-center gap-1 active:scale-[0.99]"
            >
              <X className="w-5 h-5" />
              Quitar
            </button>
          </div>
        </div>
      )}

      <p className="mt-2 text-sm text-[#4A4A4A]">
        {obligatorio && !hay && <span className="font-semibold text-[#E30613]">Obligatorio · </span>}
        {ayuda}
      </p>
    </div>
  );
}
