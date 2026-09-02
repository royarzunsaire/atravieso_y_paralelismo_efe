import { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { fotosService } from '@/services/fotos';

// Máximo de descargas de fotos en simultáneo al precargar la galería.
// Evita saturar la conexión en terreno con muchas fotos a la vez.
const MAX_DESCARGAS_PARALELAS = 3;

interface RemotePhoto {
  id: string;
  url?: string; // puede ser URL de SharePoint (no siempre usable en <img>)
  description?: string;
  fileName?: string;
  created?: string;
}

interface PhotosModalProps {
  isOpen: boolean;
  title: string;
  inspeccionId: string;
  photos: RemotePhoto[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function PhotosModal({
  isOpen,
  title,
  inspeccionId,
  photos,
  loading,
  error,
  onClose,
}: PhotosModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [erroresPorFoto, setErroresPorFoto] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef(objectUrls);
  objectUrlsRef.current = objectUrls;

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen, photos]);

  // Precarga en cola de todas las fotos al abrir el modal (o al cambiar la
  // lista), con concurrencia limitada. Empieza por la foto seleccionada
  // para que la vista grande aparezca lo antes posible, y va rellenando
  // el resto de miniaturas en segundo plano sin bloquear la UI.
  useEffect(() => {
    if (!isOpen || !inspeccionId) return;
    const hasPhotos = photos && photos.length > 0;
    if (!hasPhotos) return;

    const pendientes = photos
      .map((p, idx) => ({ ...p, idx }))
      .filter((p) => p.fileName && !objectUrlsRef.current[p.fileName]);
    if (pendientes.length === 0) return;

    // Prioriza la seleccionada, luego el resto en orden.
    const orden = [...pendientes].sort((a, b) => {
      if (a.idx === selectedIndex) return -1;
      if (b.idx === selectedIndex) return 1;
      return a.idx - b.idx;
    });

    let cancelled = false;
    let cursor = 0;

    const descargarSiguiente = async (): Promise<void> => {
      while (!cancelled) {
        const item = orden[cursor++];
        if (!item) return;
        const fileName = item.fileName as string;
        try {
          const blob = await fotosService.getContentBlob({ inspeccionId, fileName });
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setObjectUrls((prev) => (prev[fileName] ? prev : { ...prev, [fileName]: url }));
        } catch (err: any) {
          if (cancelled) return;
          setErroresPorFoto((prev) => ({ ...prev, [fileName]: err?.message || 'No se pudo cargar la imagen' }));
        }
      }
    };

    const trabajadores = Array.from(
      { length: Math.min(MAX_DESCARGAS_PARALELAS, orden.length) },
      () => descargarSiguiente()
    );
    void Promise.all(trabajadores);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inspeccionId, photos, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      // limpiar object URLs al cerrar
      Object.values(objectUrlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      setObjectUrls({});
      setErroresPorFoto({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const hasPhotos = photos && photos.length > 0;
  const selected = hasPhotos ? photos[Math.min(selectedIndex, photos.length - 1)] : undefined;
  const selectedFileName = selected?.fileName;
  const selectedObjectUrl = selectedFileName ? objectUrls[selectedFileName] : undefined;
  const selectedImageError = selectedFileName ? erroresPorFoto[selectedFileName] : undefined;
  const imageLoading = Boolean(selected && selectedFileName && !selectedObjectUrl && !selectedImageError);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-[#003D7A] truncate">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Lista de miniaturas / estado */}
          <div className="w-56 border-r border-gray-200 p-3 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-sm text-[#4A4A4A]">
                <Loader2 className="w-6 h-6 text-[#0066CC] animate-spin mb-2" />
                Cargando fotos...
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">
                <p>{error}</p>
              </div>
            ) : !hasPhotos ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-sm text-[#4A4A4A]">
                <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                <p>No hay fotos registradas para esta inspección.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id || index}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      index === selectedIndex
                        ? 'border-[#0066CC] bg-[#E5F1FB]'
                        : 'border-gray-200 hover:border-[#0066CC]/60 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                      {photo.fileName && objectUrls[photo.fileName] ? (
                        <img
                          src={objectUrls[photo.fileName]}
                          alt={photo.description || photo.fileName || 'Foto'}
                          className="w-full h-full object-cover"
                        />
                      ) : photo.fileName && erroresPorFoto[photo.fileName] ? (
                        <ImageIcon className="w-6 h-6 text-red-300" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#003D7A] truncate">
                        {photo.fileName || 'Foto'}
                      </p>
                      {photo.description && (
                        <p className="text-[11px] text-[#4A4A4A] line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vista grande */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex items-center justify-center bg-black">
              {imageLoading ? (
                <div className="flex flex-col items-center justify-center text-white/70 text-sm">
                  <Loader2 className="w-7 h-7 animate-spin mb-3" />
                  <p>Cargando imagen...</p>
                </div>
              ) : selectedImageError ? (
                <div className="text-center text-white/80 text-sm px-6">
                  <p className="mb-2">{selectedImageError}</p>
                  {selected?.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-white"
                    >
                      Abrir en SharePoint
                    </a>
                  )}
                </div>
              ) : selected && selectedObjectUrl ? (
                <img
                  src={selectedObjectUrl}
                  alt={selected.description || selected.fileName || 'Foto inspección'}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/70 text-sm">
                  <ImageIcon className="w-10 h-10 mb-3" />
                  <p>Selecciona una foto para verla en grande.</p>
                </div>
              )}
            </div>

            {/* Pie de foto */}
            {selected && (
              <div className="border-t border-gray-200 px-4 py-3 text-sm">
                <p className="font-medium text-[#003D7A] mb-1">
                  {selected.fileName || 'Foto de inspección'}
                </p>
                {selected.description && (
                  <p className="text-[#4A4A4A] mb-1">{selected.description}</p>
                )}
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0066CC] hover:underline"
                  >
                    Abrir en SharePoint
                  </a>
                )}
                {selected.created && (
                  <p className="text-xs text-gray-500">
                    Capturada el {new Date(selected.created).toLocaleString('es-CL')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

