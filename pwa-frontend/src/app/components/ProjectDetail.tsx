import { useState } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import { Plus, Calendar, Phone, Mail, User, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Project } from './ProjectCard';

export interface Inspection {
  id: string;
  date: string;
  type: string;
  progress: number;
  status: 'conforme' | 'observaciones' | 'no-conforme';
  observations: string;
}

export interface Photo {
  id: string;
  url: string;
  description: string;
  date: string;
}

interface ProjectDetailProps {
  project: Project;
  inspections: Inspection[];
  photos: Photo[];
  onBack: () => void;
  onNewInspection: () => void;
}

export function ProjectDetail({ project, inspections, photos, onBack, onNewInspection }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'inspections' | 'photos'>('info');
  
  const tabs = [
    { id: 'info' as const, label: 'Información' },
    { id: 'inspections' as const, label: 'Inspecciones' },
    { id: 'photos' as const, label: 'Fotos' },
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
  
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 md:pb-8">
      <Header title={project.name} showBackButton onBack={onBack} />
      
      {/* Tabs horizontales */}
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
      
      <div className="p-4">
        {/* Tab: Información */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-[#003D7A] mb-3">Datos del Proyecto</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Cliente</p>
                  <p className="text-[#1A1A1A]">Ministerio de Transportes y Telecomunicaciones</p>
                </div>
                <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Ubicación</p>
                  <p className="text-[#1A1A1A]">{project.location}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-[#4A4A4A] mb-1">Fecha Inicio</p>
                    <p className="text-[#1A1A1A]">15/01/2026</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#4A4A4A] mb-1">Fecha Término</p>
                    <p className="text-[#1A1A1A]">30/06/2026</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[#4A4A4A] mb-1">Estado</p>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-[#F5F7FA] rounded-full h-2">
                      <div
                        className="h-full bg-[#0066CC] rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="text-[#0066CC] text-sm">{project.progress}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-[#003D7A] mb-3">Contactos</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[#0066CC] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#4A4A4A]">Jefe de Proyecto</p>
                    <p className="text-[#1A1A1A]">Carlos Muñoz Silva</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#0066CC] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#4A4A4A]">Teléfono</p>
                    <p className="text-[#1A1A1A]">+56 9 8765 4321</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#0066CC] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#4A4A4A]">Email</p>
                    <p className="text-[#1A1A1A]">c.munoz@efe.cl</p>
                  </div>
                </div>
              </div>
            </div>
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
        
        {/* Tab: Fotos */}
        {activeTab === 'photos' && (
          <div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="bg-white rounded-lg overflow-hidden shadow-sm">
                    <div className="aspect-square bg-[#F5F7FA] relative">
                      <img
                        src={photo.url}
                        alt={photo.description}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-sm text-[#1A1A1A] line-clamp-2">{photo.description}</p>
                      <p className="text-xs text-[#4A4A4A] mt-1">{photo.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-[#4A4A4A] mb-4">No hay fotos registradas</p>
                <p className="text-sm text-[#4A4A4A]">Las fotos se agregarán automáticamente al realizar inspecciones</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <FloatingActionButton
        onClick={onNewInspection}
        icon={<Plus className="w-6 h-6" />}
        label="Nueva Inspección"
      />
    </div>
  );
}
