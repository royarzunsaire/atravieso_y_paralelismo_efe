import { useState, useRef, useEffect } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { Camera, RotateCw, Upload, RefreshCw } from 'lucide-react';

interface PhotoCaptureProps {
  onBack: () => void;
  onPhotoConfirm: (photo: { url: string; description: string }) => void;
}

export function PhotoCapture({ onBack, onPhotoConfirm }: PhotoCaptureProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [cameraState, setCameraState] = useState<
    'initializing' | 'active' | 'denied' | 'unavailable'
  >('initializing');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  // ============================================================
  // Detectar múltiples cámaras
  // ============================================================
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then((devices) => {
        const cams = devices.filter((d) => d.kind === 'videoinput');
        if (mountedRef.current) setHasMultipleCameras(cams.length > 1);
      })
      .catch(() => {});
  }, []);

  // ============================================================
  // Funciones de cámara (funciones normales, NO useCallback)
  // ============================================================
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera(facing: 'environment' | 'user') {
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }

    setCameraState('initializing');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      // Verificar que seguimos montados
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (mountedRef.current) {
            videoRef.current?.play().catch(() => {});
            setCameraState('active');
          }
        };
      }
    } catch (err: any) {
      console.error('Error cámara:', err);
      if (!mountedRef.current) return;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('denied');
      } else {
        setCameraState('unavailable');
      }
    }
  }

  // ============================================================
  // Efecto: iniciar cámara al montar y al cambiar facing/capturedImage
  // ============================================================
  useEffect(() => {
    mountedRef.current = true;

    if (!capturedImage) {
      startCamera(facingMode);
    }

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
    // Solo re-ejecutar cuando cambie facingMode o capturedImage
    // startCamera y stopCamera son funciones del componente, no deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, capturedImage]);

  // ============================================================
  // Capturar foto desde video
  // ============================================================
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    // Limitar resolución máxima para que el dataURL no supere ~1 MB
    // y sea compatible con todos los browsers móviles/PWA
    const MAX_SIDE = 1600;
    const ratio = Math.min(1, MAX_SIDE / Math.max(vw, vh));
    canvas.width = Math.round(vw * ratio);
    canvas.height = Math.round(vh * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const url = canvas.toDataURL('image/jpeg', 0.80);
    stopCamera();
    setCapturedImage(url);
  };

  // ============================================================
  // Seleccionar foto desde galería
  // ============================================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen no debe superar los 10 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (!result) return;

      // Redimensionar la imagen de galería igual que la de cámara
      // para mantener dataURLs pequeños y compatibles con PWA/SharePoint
      const img = new Image();
      img.onload = () => {
        const MAX_SIDE = 1600;
        const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = w;
        resizeCanvas.height = h;
        const ctx = resizeCanvas.getContext('2d');
        if (!ctx) {
          stopCamera();
          setCapturedImage(result);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        stopCamera();
        setCapturedImage(resizeCanvas.toDataURL('image/jpeg', 0.80));
      };
      img.onerror = () => {
        stopCamera();
        setCapturedImage(result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ============================================================
  // Cambiar cámara frontal/trasera
  // ============================================================
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // ============================================================
  // Rehacer foto (vuelve a la vista de cámara)
  // ============================================================
  const retakePhoto = () => {
    setCapturedImage(null);
    setDescription('');
  };

  // ============================================================
  // Confirmar foto
  // ============================================================
  const handleConfirm = () => {
    if (capturedImage) {
      onPhotoConfirm({
        url: capturedImage,
        description: description.trim() || 'Sin descripción',
      });
    }
  };

  // ============================================================
  // RENDER: Vista de cámara
  // ============================================================
  if (!capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <Header
          title="Capturar Foto"
          showBackButton
          onBack={() => {
            stopCamera();
            onBack();
          }}
        />

        {/* Input oculto para galería */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Área de cámara */}
        <div className="flex-1 relative overflow-hidden bg-black min-h-0">
          {/*
            El <video> SIEMPRE se renderiza para que videoRef nunca sea null
            cuando getUserMedia resuelve. Se oculta visualmente hasta estar activo.
          */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              cameraState === 'active' ? 'block' : 'invisible'
            } ${facingMode === 'user' ? '[transform:scaleX(-1)]' : ''}`}
          />

          {cameraState === 'initializing' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent mx-auto mb-3" />
                <p className="text-sm opacity-75">Activando cámara...</p>
              </div>
            </div>
          )}

          {(cameraState === 'denied' || cameraState === 'unavailable') && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="text-center text-white max-w-xs">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-base mb-2">
                  {cameraState === 'denied'
                    ? 'Acceso a la cámara denegado'
                    : 'Cámara no disponible'}
                </p>
                <p className="text-sm opacity-70 mb-6">
                  {cameraState === 'denied'
                    ? 'Permite el acceso en la configuración del navegador, o selecciona una foto.'
                    : 'Puedes seleccionar una foto desde la galería.'}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0066CC] text-white rounded-xl active:scale-95 transition-transform"
                >
                  <Upload className="w-5 h-5" />
                  Seleccionar Foto
                </button>
              </div>
            </div>
          )}

          {/* Guía visual */}
          {cameraState === 'active' && (
            <div className="absolute inset-3 border-2 border-white/20 rounded-xl pointer-events-none" />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controles inferiores */}
        <div className="flex-shrink-0 bg-black/90 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center justify-around py-4 px-6 max-w-md mx-auto">
            {/* Galería */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-white/80 active:text-white active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-[10px]">Galería</span>
            </button>

            {/* Botón captura */}
            <button
              onClick={capturePhoto}
              disabled={cameraState !== 'active'}
              className="group w-[72px] h-[72px] rounded-full border-[5px] border-white/40 active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100 p-1"
              aria-label="Capturar foto"
            >
              <div className="w-full h-full rounded-full bg-white group-active:bg-gray-200 transition-colors" />
            </button>

            {/* Cambiar cámara */}
            {hasMultipleCameras ? (
              <button
                onClick={switchCamera}
                disabled={cameraState !== 'active'}
                className="flex flex-col items-center gap-1 text-white/80 active:text-white active:scale-95 transition-all disabled:opacity-30"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <span className="text-[10px]">Girar</span>
              </button>
            ) : (
              <div className="w-12" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Vista de preview
  // ============================================================
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <Header title="Vista Previa" showBackButton onBack={retakePhoto} />

      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center min-h-0">
        <img
          src={capturedImage}
          alt="Foto capturada"
          className="max-w-full max-h-full object-contain"
        />
      </div>

      <div className="flex-shrink-0 bg-white pb-[env(safe-area-inset-bottom,0px)]">
        <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
          <div>
            <label className="block text-sm text-[#4A4A4A] mb-2">
              Descripción de la foto
            </label>
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Vista general del avance en el sector norte..."
              rows={2}
              className="w-full px-3 py-2 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none text-base"
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
            <Button variant="primary" fullWidth onClick={handleConfirm}>
              Usar Foto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
