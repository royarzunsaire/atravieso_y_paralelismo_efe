import { useState, useEffect } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import { 
  MapPin, Building2, User, Calendar, 
  AlertCircle, FileText, Loader2,
  Plus, Phone, Mail, CheckCircle2, AlertTriangle, XCircle 
} from 'lucide-react';
import { solicitudesService } from '../../services/solicitudes';

// ========================================
// INTERFACES - AGREGADAS
// ========================================

interface Responsable {
  nombre: string;
  email: string;
  departamento?: string | null;
  cargo?: string | null;
  foto?: string;
}

interface Autor {
  nombre: string;
  email: string;
  departamento?: string | null;
  cargo?: string | null;
  foto?: string;
}

interface Solicitud {
  id: number;
  title: string;
  codigo: string | null;
  estadoSolicitud: string | null;
  estadoSolicitudId: number | null;
  prioridad: string | null;
  prioridadId: number | null;
  cliente: string | null;
  clienteId: number | null;
  consultor: string | null;
  consultorId: number | null;
  tipoProyecto: string | null;
  tipoProyectoId: number | null;
  tipoObra: string | null;
  tipoObraId: number | null;
  tipoServicio: string | null;
  tipoServicioId: number | null;
  ramal: string | null;
  ramalId: number | null;
  region: string | null;
  regionId: number | null;
  comuna: string | null;
  comunaId: number | null;
  rolAsignado: string | null;
  rolAsignadoId: number | null;
  esExcepcion: boolean;
  finalizada: boolean;
  responsable: Responsable | null;
  autor: Autor | null;
  hasAttachments: boolean;
  link: string | null;
  versionNumber: string | null;
  etag: string | null;
  observacion: string | null;
  descripcion: string | null;
  etapa: string | null;
  kilometraje: string | null;
}

export interface Inspection {
  id: string;
  date: string;
  type: string;
  progress: number;
  status: 'conforme' | 'observaciones' | 'no-conforme';
  observations: string;
}

interface SolicitudDetailProps {
  solicitudId: number;
  inspections: Inspection[];
  onBack: () => void;
  onNewInspection: () => void;
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
}

// Función para obtener color del estado
const getEstadoColor = (etapa: string): string => {
    // Puedes personalizar según tus estados
    const estadosActivos = ['Análisis de Proyecto', 'Asignación de Proyecto', 'Recepción de Solicitud'];
    const estadosCompletados = ['Inicio de Obra', 'Contrato Firmado', 'Aprobación y Contrato'];
    const estadosRechazados = ['Proyecto Rechazado', 'Solicitud Devuelta'];

    if (estadosActivos.includes(etapa)) {
      return 'text-[#0066CC]';
    } else if (estadosCompletados.includes(etapa)) {
      return 'text-green-600';
    } else if (estadosRechazados.includes(etapa)) {
      return 'text-red-600';
    }
    return 'text-[#4A4A4A]';
};

// ========================================
// COMPONENTE - SIN CAMBIOS EN LA LÓGICA
// ========================================

export function SolicitudDetail({ solicitudId, inspections, onBack, onNewInspection  }: SolicitudDetailProps) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    loadSolicitud();
  }, [solicitudId]);

  const loadSolicitud = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await solicitudesService.getById(solicitudId);
      setSolicitud(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'info' as const, label: 'Información' },
    { id: 'documentos' as const, label: 'Documentos' },
    { id: 'inspections' as const, label: 'Inspecciones' },
  ];

  const statusIcons = {
    conforme: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    observaciones: <AlertTriangle className="w-5 h-5 text-orange-500" />,
    'no-conforme': <XCircle className="w-5 h-5 text-[#E30613]" />,
  };
  
  const statusLabels = {
    conforme: 'Conforme',
    observaciones: 'Con Observaciones',
    'no-conforme': 'No Conforme',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        <Header title="Cargando..." showBackButton onBack={onBack} />
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !solicitud) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        <Header title="Error" showBackButton onBack={onBack} />
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Solicitud no encontrada'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 md:pb-8">
      <Header 
        title={`Solicitud #${solicitud.codigo || solicitud.id}`} 
        showBackButton 
        onBack={onBack} 
      />

      {/* Tabs */}
      <div className="sticky top-14 z-40 bg-white border-b border-[#003D7A]/10 shadow-sm">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 h-12 transition-colors ${
                activeTab === tab.id
                  ? 'text-[#0066CC] border-b-2 border-[#0066CC]'
                  : 'text-[#4A4A4A] border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tab: Información */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Card de estado y prioridad */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Etapa</p>
                  <p className={`font-medium ${getEstadoColor(solicitud.etapa)}`}>{solicitud.etapa}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Estado</p>
                  <p className="text-[#0066CC] font-medium">{solicitud.estadoSolicitud}</p>
                </div>
                <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Prioridad</p>
                  <p className={`font-medium ${
                    solicitud.prioridad === 'Alta' ? 'text-red-600' :
                    solicitud.prioridad === 'Media' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {solicitud.prioridad}
                  </p>
                </div>
              </div>
            </div>

            {/* Datos del proyecto */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-[#003D7A] mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Datos del Proyecto
              </h3>
              <div className="space-y-3">
                <InfoRow label="Descripción" value={solicitud.descripcion} />
                <InfoRow label="Cliente" value={solicitud.cliente} />
                <InfoRow label="Consultor" value={solicitud.consultor} />
                <InfoRow label="Tipo de Proyecto" value={solicitud.tipoProyecto} />
                <InfoRow label="Tipo de Obra" value={solicitud.tipoObra} />
                <InfoRow label="Tipo de Servicio" value={solicitud.tipoServicio} />
                <InfoRow label="Observación" value={solicitud.observacion} />
                {/* <InfoRow 
                  label="Es Excepción" 
                  value={solicitud.esExcepcion ? 'Sí' : 'No'} 
                /> */}
              </div>
            </div>

            {/* Ubicación */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-[#003D7A] mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Ubicación
              </h3>
              <div className="space-y-3">
                <InfoRow label="Región" value={solicitud.region} />
                <InfoRow label="Comuna" value={solicitud.comuna} />
                <InfoRow label="Ramal" value={solicitud.ramal} />
              </div>
            </div>

            {/* Rol Asignado */}
            {solicitud.rolAsignado && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-[#003D7A] mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Asignación
                </h3>
                <InfoRow label="Rol Asignado" value={solicitud.rolAsignado} />
              </div>
            )}
          </div>
        )}

        {/* Tab: Contactos */}
        {activeTab === 'contactos' && (
          <div className="space-y-4">
            {/* Responsable */}
            {solicitud.responsable && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-[#003D7A] mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Responsable
                </h3>
                <div className="space-y-3">
                  <InfoRow label="Nombre" value={solicitud.responsable.nombre} />
                  <InfoRow label="Email" value={solicitud.responsable.email} />
                  {solicitud.responsable.departamento && (
                    <InfoRow label="Departamento" value={solicitud.responsable.departamento} />
                  )}
                  {solicitud.responsable.cargo && (
                    <InfoRow label="Cargo" value={solicitud.responsable.cargo} />
                  )}
                </div>
              </div>
            )}

            {/* Autor */}
            {solicitud.autor && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-[#003D7A] mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Autor
                </h3>
                <div className="space-y-3">
                  <InfoRow label="Nombre" value={solicitud.autor.nombre} />
                  <InfoRow label="Email" value={solicitud.autor.email} />
                  {solicitud.autor.departamento && (
                    <InfoRow label="Departamento" value={solicitud.autor.departamento} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Inspecciones */}
        {activeTab === 'inspections' && (
          <div className="space-y-3">
            {inspections.length > 0 ? (
              inspections.map(inspection => (
                <div key={inspection.id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-[#003D7A] mb-1">{inspection.type}</h4>
                      <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                        <Calendar className="w-4 h-4" />
                        {inspection.date}
                      </div>
                    </div>
                    {statusIcons[inspection.status]}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#4A4A4A]">Avance registrado</span>
                      <span className="text-[#0066CC]">{inspection.progress}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#4A4A4A]">Estado</span>
                      <span className={`${
                        inspection.status === 'conforme' ? 'text-green-600' :
                        inspection.status === 'observaciones' ? 'text-orange-500' :
                        'text-[#E30613]'
                      }`}>
                        {statusLabels[inspection.status]}
                      </span>
                    </div>
                    {inspection.observations && (
                      <div className="mt-2 p-2 bg-[#F5F7FA] rounded text-sm text-[#4A4A4A]">
                        {inspection.observations}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-[#4A4A4A] mb-4">No hay inspecciones registradas</p>
                <p className="text-sm text-[#4A4A4A]">Presiona el botón + para crear una nueva inspección</p>
              </div>
            )}
          </div>
        )}      
      </div>
      <FloatingActionButton
        onClick={onNewInspection}
        icon={<Plus className="w-6 h-6" />}
        label="Inspección"
      />
    </div>
  );
}

// Componente auxiliar para mostrar filas de información
function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  
  return (
    <div>
      <p className="text-sm text-[#4A4A4A] mb-1">{label}</p>
      <p className="text-[#1A1A1A]">{value}</p>
    </div>
  );
}