import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { Camera, X, CheckCircle2, XCircle, AlertOctagon } from 'lucide-react';
import type { Solicitud, InspectionPhoto } from '../../types/solicitud';

interface NewInspectionProps {
  solicitud: Solicitud;
  onBack: () => void;
  isSaving?: boolean;
  onSave: (inspection: {
    type: string;
    progress: number;
    comentariosAvance: string;
    observacionesInspeccion: string;
    status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[];
    solicitarParalizacion?: boolean;
    // motivoParalizacion?: string; // RESERVADO PARA USO FUTURO
  }) => void;
  onAddPhoto: () => void;
  tempPhotos: InspectionPhoto[];
  onRemovePhoto: (photoId: string) => void;
}

const inspectionTypes = [
  'Inspección General',
  'Control de Calidad',
  'Seguridad',
  'Avance de Obra',
  'Recepción de Materiales',
  'Verificación Técnica',
];

export function NewInspection({
  solicitud,
  onBack,
  onSave,
  isSaving = false,
  onAddPhoto,
  tempPhotos,
  onRemovePhoto,
}: NewInspectionProps) {
  const draftKey = useMemo(() => `newInspectionDraft:${solicitud.id}`, [solicitud.id]);

  const [type, setType] = useState('');
  const [progress, setProgress] = useState(0);
  const [comentariosAvance, setComentariosAvance] = useState('');
  const [observacionesInspeccion, setObservacionesInspeccion] = useState('');
  const [status, setStatus] = useState<'conforme' | 'no-conforme'>('conforme');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [solicitarParalizacion, setSolicitarParalizacion] = useState(false);
  // const [motivoParalizacion, setMotivoParalizacion] = useState(''); // RESERVADO PARA USO FUTURO

  // ============================================================
  // Persistencia de borrador (para no perder campos al ir a cámara)
  // ============================================================
  const saveDraftToSession = () => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          type,
          progress,
          comentariosAvance,
          observacionesInspeccion,
          status,
          solicitarParalizacion,
        })
      );
    } catch {
      // Ignorar errores de sessionStorage
    }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);

      if (typeof draft.type === 'string') setType(draft.type);
      if (typeof draft.progress === 'number') setProgress(draft.progress);
      if (typeof draft.comentariosAvance === 'string') setComentariosAvance(draft.comentariosAvance);
      if (typeof draft.observacionesInspeccion === 'string')
        setObservacionesInspeccion(draft.observacionesInspeccion);
      if (draft.status === 'conforme' || draft.status === 'no-conforme') setStatus(draft.status);
      if (typeof draft.solicitarParalizacion === 'boolean') setSolicitarParalizacion(draft.solicitarParalizacion);
    } catch {
      // Si el draft está corrupto, lo ignoramos silenciosamente
    }
    // Solo al cambiar de solicitud/draftKey
  }, [draftKey]);

  const now = new Date();
  const currentDate = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!type) {
      newErrors.type = 'Debe seleccionar un tipo de inspección';
    }

    if (status === 'no-conforme' && observacionesInspeccion.trim().length < 10) {
      newErrors.observacionesInspeccion = 'Las observaciones son obligatorias para "No Conforme" (mínimo 10 caracteres)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Guardar borrador final por si algo falla después del submit
    saveDraftToSession();

    onSave({
      type,
      progress,
      comentariosAvance,
      observacionesInspeccion,
      status,
      photos: tempPhotos,
      solicitarParalizacion,
      // motivoParalizacion: undefined, // RESERVADO PARA USO FUTURO
    });
  };

  const statusOptions = [
    {
      value: 'conforme' as const,
      label: 'Conforme',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'border-green-600 bg-green-50 text-green-700',
      activeColor: 'border-green-600 bg-green-600 text-white',
    },
    {
      value: 'no-conforme' as const,
      label: 'No Conforme',
      icon: <XCircle className="w-5 h-5" />,
      color: 'border-[#E30613] bg-red-50 text-[#E30613]',
      activeColor: 'border-[#E30613] bg-[#E30613] text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 md:pb-8">
      <Header title="Nueva Inspección" showBackButton onBack={onBack} />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">

        {/* Información del proyecto */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-[#4A4A4A] mb-1">Proyecto</p>
          <p className="text-[#003D7A]">Solicitud #{solicitud.codigo}</p>
        </div>

        {/* Fecha y hora */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#4A4A4A] mb-2">Fecha</label>
              <input
                type="text"
                value={currentDate}
                disabled
                className="w-full h-11 px-3 bg-[#F5F7FA] rounded-lg text-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#4A4A4A] mb-2">Hora</label>
              <input
                type="text"
                value={currentTime}
                disabled
                className="w-full h-11 px-3 bg-[#F5F7FA] rounded-lg text-[#1A1A1A]"
              />
            </div>
          </div>
        </div>

        {/* Tipo de inspección */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-2">
            Tipo de Inspección <span className="text-[#E30613]">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setErrors({ ...errors, type: '' });
            }}
            className={`w-full h-11 px-3 bg-white rounded-lg border ${
              errors.type ? 'border-[#E30613]' : 'border-[#003D7A]/20'
            } focus:outline-none focus:ring-2 focus:ring-[#0066CC]`}
          >
            <option value="">Seleccionar tipo...</option>
            {inspectionTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.type && (
            <p className="mt-1 text-sm text-[#E30613]">{errors.type}</p>
          )}
        </div>

        {/* Slider de avance */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-[#4A4A4A]">% Avance de Obra</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setProgress(Math.max(0, Math.min(100, value)));
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setProgress(Math.max(0, Math.min(100, value)));
                }}
                className="w-16 h-9 px-2 text-center bg-white border-2 border-[#0066CC] rounded-lg text-[#0066CC] font-bold focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
              <span className="text-xl text-[#0066CC] font-bold">%</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full h-2 bg-[#F5F7FA] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0066CC] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#0066CC] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            style={{
              background: `linear-gradient(to right, #0066CC 0%, #0066CC ${progress}%, #F5F7FA ${progress}%, #F5F7FA 100%)`
            }}
          />
          <div className="flex justify-between mt-2 text-xs text-[#4A4A4A]">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Textarea 1: Comentarios de Avance (siempre visible, siempre opcional) */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-2">
            Comentarios de Avance
          </label>
          <textarea
            value={comentariosAvance}
            onChange={(e) => setComentariosAvance(e.target.value)}
            placeholder="Agregue cualquier comentario respecto al avance..."
            rows={3}
            className="w-full px-3 py-2 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
          />
          <p className="mt-2 text-xs text-[#4A4A4A]">{comentariosAvance.length} caracteres</p>
        </div>

        {/* Estado general */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-3">Estado General</label>
          <div className="grid grid-cols-1 gap-2">
            {statusOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatus(option.value);
                  if (option.value === 'conforme') {
                    setSolicitarParalizacion(false);
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  status === option.value ? option.activeColor : option.color
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Solicitud de Paralización - solo visible si No Conforme */}
        {status === 'no-conforme' && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-[#003D7A] font-medium mb-1">Solicitar Paralización de Obra</h3>
                <p className="text-sm text-[#4A4A4A] mb-3">
                  Si la situación requiere detener la obra, el supervisor será notificado para su revisión.
                </p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={solicitarParalizacion}
                    onChange={(e) => setSolicitarParalizacion(e.target.checked)}
                    className="w-5 h-5 text-orange-600 border-2 border-orange-400 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-[#003D7A]">
                    Solicitar paralización de esta obra
                  </span>
                </label>

                {solicitarParalizacion && (
                  <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                    <p className="text-xs text-orange-800">
                      <strong>Importante:</strong> Esta solicitud será enviada al supervisor para su revisión. La obra no se paralizará automáticamente.
                    </p>
                  </div>
                )}

                {/* CAMPO MOTIVO - RESERVADO PARA USO FUTURO */}
                {/* {solicitarParalizacion && (
                  <div className="mt-4">
                    <label className="block text-sm text-[#4A4A4A] mb-2">
                      Motivo de la Paralización <span className="text-[#E30613]">*</span>
                    </label>
                    <textarea
                      value={motivoParalizacion}
                      onChange={(e) => {
                        setMotivoParalizacion(e.target.value);
                        setErrors({ ...errors, motivoParalizacion: '' });
                      }}
                      placeholder="Describa detalladamente por qué es necesario paralizar la obra..."
                      rows={4}
                      className={`w-full px-3 py-2 bg-white rounded-lg border-2 ${
                        errors.motivoParalizacion ? 'border-[#E30613]' : 'border-orange-400'
                      } focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none`}
                    />
                    {errors.motivoParalizacion && (
                      <p className="mt-1 text-sm text-[#E30613]">{errors.motivoParalizacion}</p>
                    )}
                    <p className="mt-2 text-xs text-[#4A4A4A]">
                      {motivoParalizacion.length} caracteres (mínimo 20)
                    </p>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        )}

        {/* Textarea 2: Observaciones de Inspección (obligatorio solo para No Conforme) */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-2">
            Observaciones de Inspección
            {status === 'no-conforme' && <span className="text-[#E30613]"> *</span>}
            {status === 'no-conforme' && (
              <span className="text-xs text-[#E30613] ml-1">(Obligatorio para No Conforme)</span>
            )}
          </label>
          <textarea
            value={observacionesInspeccion}
            onChange={(e) => {
              setObservacionesInspeccion(e.target.value);
              setErrors({ ...errors, observacionesInspeccion: '' });
            }}
            placeholder={
              status === 'no-conforme'
                ? 'Describa los problemas detectados en la inspección...'
                : 'Describa los detalles de la inspección (opcional)...'
            }
            rows={4}
            className={`w-full px-3 py-2 bg-white rounded-lg border ${
              errors.observacionesInspeccion ? 'border-[#E30613]' : 'border-[#003D7A]/20'
            } focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none`}
          />
          {errors.observacionesInspeccion && (
            <p className="mt-1 text-sm text-[#E30613]">{errors.observacionesInspeccion}</p>
          )}
          <p className="mt-2 text-xs text-[#4A4A4A]">
            {observacionesInspeccion.length} caracteres
            {status === 'no-conforme' && ' (mínimo 10 requerido)'}
          </p>
        </div>

        {/* Fotos */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-[#4A4A4A]">Fotos Adjuntas</label>
            <span className="text-sm text-[#0066CC]">{tempPhotos.length}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              // Guardar borrador antes de ir a la cámara
              saveDraftToSession();
              onAddPhoto();
            }}
            className="w-full h-11 flex items-center justify-center gap-2 border-2 border-dashed border-[#0066CC] rounded-lg text-[#0066CC] active:bg-[#0066CC]/5 transition-colors mb-3"
          >
            <Camera className="w-5 h-5" />
            Agregar Foto
          </button>

          {tempPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {tempPhotos.map(photo => (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.description}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-[#E30613] rounded-full text-white shadow-lg active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botón guardar */}
        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </span>
            ) : (
              'Guardar Inspección'
            )}
          </Button>
        </div>

      </form>
    </div>
  );
}