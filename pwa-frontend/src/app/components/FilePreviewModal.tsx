import { X, Download, ExternalLink, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  fileType: string;
  onDownload: () => void;
}

export function FilePreviewModal({ 
  isOpen, 
  onClose, 
  fileName, 
  fileUrl, 
  fileType,
  onDownload 
}: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [imageError, setImageError] = useState(false);
  
  if (!isOpen) return null;

  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileType);
  const isPDF = fileType === 'pdf';
  
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  // Función para abrir en nueva pestaña
  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-[#003D7A] text-white p-4 flex items-center justify-between z-10">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium truncate">{fileName}</h3>
          <p className="text-xs text-white/70 mt-1">
            {isImage ? 'Imagen' : isPDF ? 'Documento PDF' : 'Documento'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {isImage && !imageError && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm min-w-[60px] text-center">{zoom}%</span>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2"></div>
            </>
          )}
          
          <button
            onClick={onDownload}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Descargar"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleOpenInNewTab}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full h-full pt-16 pb-4 px-4 overflow-auto">
        <div className="flex items-center justify-center min-h-full">
          {/* Imágenes */}
          {isImage && !imageError && (
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full h-auto rounded-lg shadow-2xl transition-transform"
              style={{ transform: `scale(${zoom / 100})` }}
              onError={() => setImageError(true)}
            />
          )}
          
          {/* Error cargando imagen o restricción de SharePoint */}
          {(isImage && imageError) || isPDF ? (
            <div className="bg-white rounded-lg p-8 text-center max-w-md">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-[#0066CC]" />
              </div>
              <h3 className="text-xl text-[#003D7A] mb-2">
                {isPDF ? 'Documento PDF' : 'Imagen de SharePoint'}
              </h3>
              <p className="text-[#4A4A4A] mb-2">
                {isPDF 
                  ? 'Los archivos PDF de SharePoint no se pueden previsualizar directamente por razones de seguridad.'
                  : 'Esta imagen requiere autenticación de SharePoint para visualizarse.'
                }
              </p>
              <p className="text-sm text-[#4A4A4A] mb-6">
                Puedes abrirla en una nueva pestaña o descargarla.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleOpenInNewTab}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0066CC] text-white rounded-lg hover:bg-[#0052A3] transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir en SharePoint
                </button>
                <button
                  onClick={onDownload}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Descargar archivo
                </button>
              </div>
              
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-[#4A4A4A]">
                  💡 <strong>Tip:</strong> Al abrir en SharePoint podrás ver el archivo completo con todas sus funcionalidades.
                </p>
              </div>
            </div>
          ) : null}
          
          {/* Otros tipos de archivos */}
          {!isImage && !isPDF && (
            <div className="bg-white rounded-lg p-8 text-center max-w-md">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl text-[#003D7A] mb-2">Vista previa no disponible</h3>
              <p className="text-[#4A4A4A] mb-6">
                Este tipo de archivo (.{fileType}) no se puede previsualizar en el navegador.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onDownload}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0066CC] text-white rounded-lg hover:bg-[#0052A3] transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Descargar
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir en SharePoint
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click fuera para cerrar */}
      <div 
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}