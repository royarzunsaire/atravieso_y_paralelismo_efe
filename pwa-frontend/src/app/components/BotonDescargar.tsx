import { useState } from 'react';
import { Download } from 'lucide-react';
import { descargarArchivo } from '@/utils/descargarArchivo';

interface BotonDescargarProps {
  /** Enlace de descarga de la API (UrlDescarga); sin él el botón queda desactivado. */
  url?: string | null;
  /** Nombre con el que se guarda el archivo. */
  nombre: string;
}

/**
 * Botón «Descargar» único para todos los documentos (contrato CU-12): grande,
 * con texto claro, estado «Descargando…» y aviso si falla. Reemplaza al ícono
 * del «ojito».
 */
export function BotonDescargar({ url, nombre }: BotonDescargarProps) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const bajar = async () => {
    if (!url) return;
    setError('');
    setDescargando(true);
    try {
      await descargarArchivo(url, nombre);
    } catch {
      setError('No se pudo descargar. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={bajar}
        disabled={!url || descargando}
        title={url ? undefined : 'Archivo no disponible'}
        className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-[#0066CC] text-white text-base font-semibold active:bg-[#003D7A] disabled:opacity-50"
      >
        <Download className="w-5 h-5" />
        {descargando ? 'Descargando…' : url ? 'Descargar' : 'No disponible'}
      </button>
      {error && <p className="text-base text-[#E30613] mt-2">{error}</p>}
    </div>
  );
}
