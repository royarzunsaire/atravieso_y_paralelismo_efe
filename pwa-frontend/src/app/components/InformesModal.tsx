import { X, FileText, Eye, Loader2 } from 'lucide-react';
import { getFileIconInfo } from '@/utils/fileUtils';
import type { FotoInspeccion } from '@/types/solicitud';

interface InformesModalProps {
  isOpen: boolean;
  title: string;
  informes: FotoInspeccion[];
  loading: boolean;
  onClose: () => void;
}

export function InformesModal({ isOpen, title, informes, loading, onClose }: InformesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70">
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg mx-0 sm:mx-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-[#003D7A] truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all flex-shrink-0 ml-2"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#4A4A4A]">
              <Loader2 className="w-8 h-8 text-[#0066CC] animate-spin mb-3" />
              <p className="text-sm">Cargando informes...</p>
            </div>
          ) : informes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-[#4A4A4A]">No hay informes registrados para esta inspección</p>
            </div>
          ) : (
            informes.map(informe => {
              const iconInfo = getFileIconInfo(informe.fileName ?? '');
              return (
                <div key={informe.id} className="bg-white rounded-lg p-4 shadow-sm border border-[#003D7A]/8">
                  <div className="flex items-start gap-3">
                    {/* Icono de tipo de archivo — igual al tab Documentos */}
                    <div className={`w-12 h-14 flex flex-col items-center justify-center ${iconInfo.bg} rounded-lg shadow-sm flex-shrink-0`}>
                      <div className={`w-8 h-1 ${iconInfo.color} rounded-t mb-1`} />
                      <span className="text-[10px] font-bold text-gray-700">{iconInfo.text}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[#003D7A] font-medium truncate mb-1">
                        {informe.fileName ?? 'Informe'}
                      </h4>
                      {informe.created && (
                        <p className="text-xs text-[#4A4A4A]">
                          Cargado el{' '}
                          {new Date(informe.created).toLocaleDateString('es-CL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                          })}
                        </p>
                      )}
                      {informe.description && (
                        <p className="text-xs text-[#4A4A4A] mt-0.5 line-clamp-2">{informe.description}</p>
                      )}
                    </div>

                    {/* Botón abrir en SharePoint — igual al tab Documentos */}
                    <div className="flex-shrink-0">
                      {informe.url ? (
                        <a
                          href={informe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center w-10 h-10 bg-[#0066CC] rounded-lg text-white active:scale-95 transition-transform"
                          title="Abrir en SharePoint"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                      ) : (
                        <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-lg" title="URL no disponible">
                          <Eye className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
