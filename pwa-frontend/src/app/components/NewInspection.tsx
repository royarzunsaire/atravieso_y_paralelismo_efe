import { useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { Camera, X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface InspectionPhoto {
  id: string;
  url: string;
  description: string;
}

interface Responsable {
  nombre: string;
  email: string;
  departamento?: string | null;
  cargo?: string | null;
  foto?: string;
}

interface Solicitud {
  id: number;
  codigo: string | null;
  cliente: string | null;
  tipoProyecto: string | null;
  tipoObra: string | null;
  tipoServicio: string | null;
  region: string | null;
  comuna: string | null;
  responsable: Responsable | null;
  prioridad: string | null;
  estadoSolicitud: string | null;
  // ... puedes agregar más campos según necesites
}

interface NewInspectionProps {
  solicitud: Solicitud; // ← CAMBIADO: ahora recibe toda la solicitud
  onBack: () => void;
  onSave: (inspection: {
    type: string;
    progress: number;
    observations: string;
    status: 'conforme' | 'observaciones' | 'no-conforme';
    photos: InspectionPhoto[];
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
  onAddPhoto,
  tempPhotos,
  onRemovePhoto,
}: NewInspectionProps) {
  const [type, setType] = useState('');
  const [progress, setProgress] = useState(0);
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState<'conforme' | 'observaciones' | 'no-conforme'>('conforme');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
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
    
    if (observations.trim().length < 10) {
      newErrors.observations = 'Las observaciones deben tener al menos 10 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    onSave({
      type,
      progress,
      observations,
      status,
      photos: tempPhotos,
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
      value: 'observaciones' as const,
      label: 'Observaciones',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'border-orange-500 bg-orange-50 text-orange-600',
      activeColor: 'border-orange-500 bg-orange-500 text-white',
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
            <span className="text-xl text-[#0066CC]">{progress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
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
        
        {/* Estado general */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-3">Estado General</label>
          <div className="grid grid-cols-1 gap-2">
            {statusOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
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
        
        {/* Observaciones */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm text-[#4A4A4A] mb-2">
            Observaciones <span className="text-[#E30613]">*</span>
          </label>
          <textarea
            value={observations}
            onChange={(e) => {
              setObservations(e.target.value);
              setErrors({ ...errors, observations: '' });
            }}
            placeholder="Describa los detalles de la inspección..."
            rows={4}
            className={`w-full px-3 py-2 bg-white rounded-lg border ${
              errors.observations ? 'border-[#E30613]' : 'border-[#003D7A]/20'
            } focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none`}
          />
          {errors.observations && (
            <p className="mt-1 text-sm text-[#E30613]">{errors.observations}</p>
          )}
          <p className="mt-2 text-xs text-[#4A4A4A]">
            {observations.length} caracteres (mínimo 10)
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
            onClick={onAddPhoto}
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
          <Button type="submit" variant="primary" size="lg" fullWidth>
            Guardar Inspección
          </Button>
        </div>
      </form>
    </div>
  );
}
