import { useState, useRef, useEffect } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { Camera, RotateCw } from 'lucide-react';

interface PhotoCaptureProps {
  onBack: () => void;
  onPhotoConfirm: (photo: { url: string; description: string }) => void;
}

export function PhotoCapture({ onBack, onPhotoConfirm }: PhotoCaptureProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [capturedImage]);
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1920, height: 1080 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      // Fallback: simular captura con generador de imagen
      setIsCameraActive(false);
    }
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };
  
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageUrl);
        stopCamera();
      }
    } else {
      // Fallback: usar placeholder de Unsplash
      const mockImage = `https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&h=600&fit=crop`;
      setCapturedImage(mockImage);
    }
  };
  
  const retakePhoto = () => {
    setCapturedImage(null);
    setDescription('');
    startCamera();
  };
  
  const handleConfirm = () => {
    if (capturedImage) {
      onPhotoConfirm({
        url: capturedImage,
        description: description || 'Sin descripción',
      });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black z-50">
      <Header title="Capturar Foto" showBackButton onBack={onBack} />
      
      {!capturedImage ? (
        // Vista de cámara
        <div className="relative w-full h-[calc(100vh-56px)]">
          {isCameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1A1A1A] text-white">
              <div className="text-center">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm opacity-75">Activando cámara...</p>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Botón de captura */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-[#0066CC] shadow-lg active:scale-95 transition-transform"
              aria-label="Capturar foto"
            />
          </div>
          
          {/* Guía visual */}
          <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none" />
        </div>
      ) : (
        // Vista de preview
        <div className="w-full h-[calc(100vh-56px)] flex flex-col bg-[#F5F7FA]">
          <div className="flex-1 bg-black">
            <img
              src={capturedImage}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="bg-white p-4 space-y-4">
            <div>
              <label className="block text-sm text-[#4A4A4A] mb-2">
                Descripción de la foto
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Vista general del avance en el sector norte..."
                rows={3}
                className="w-full px-3 py-2 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                fullWidth
                onClick={retakePhoto}
                icon={<RotateCw className="w-5 h-5" />}
              >
                Rehacer
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleConfirm}
              >
                Usar Foto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
