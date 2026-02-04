import { useState, useEffect } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import { MapPin, Building2, User, Calendar, FileText, Loader2, Plus, CheckCircle2, AlertTriangle, XCircle, Eye, ArrowUpDown } from 'lucide-react';
import { solicitudesService } from '../../services/solicitudes';
import { getEstadoColor, getPrioridadTextColor  } from '../../utils/solicitudUtils';
import type { Solicitud, Inspection, Archivo } from '../../types/solicitud';
import { archivosService } from '../../services/archivos';
import { getFileIconInfo, getTipoDocumentoColor, getTipoDocumentoBadgeColor } from '../../utils/fileUtils';


// ========================================
// INTERFACES
// ========================================

interface SolicitudDetailProps {
  solicitudId: number;
  inspections: Inspection[];
  onBack: () => void;
  onNewInspection: (solicitud: Solicitud) => void;
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
}

// ========================================
// COMPONENTE
// ========================================

export function SolicitudDetail({ solicitudId, inspections, onBack, onNewInspection  }: SolicitudDetailProps) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [errorArchivos, setErrorArchivos] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'tipo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');


  useEffect(() => {
    if (activeTab === 'documentos') {
      loadArchivos();
      return
    }
    loadSolicitud();
  }, [activeTab, solicitudId]);

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

  const loadArchivos = async () => {
    setLoadingArchivos(true);
    setErrorArchivos(null);
    
    try {
      const data = await archivosService.getBySolicitudId(solicitudId);
      setArchivos(data);
    } catch (err: any) {
      setErrorArchivos(err.message);
      console.error('Error cargando archivos:', err);
    } finally {
      setLoadingArchivos(false);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    if (tabId === 'documentos' && archivos.length === 0) {
      loadArchivos();
    }
  };

  const handleSort = (newSortBy: 'fecha' | 'nombre' | 'tipo') => {
    if (sortBy === newSortBy) {
      // Toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getSortedArchivos = () => {
    const sorted = [...archivos].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'fecha':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'nombre':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'tipo':
          comparison = a.tipoDocumento.localeCompare(b.tipoDocumento);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
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
              onClick={() => handleTabChange(tab.id)}
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
                  <p className={`font-medium ${getPrioridadTextColor(solicitud.prioridad)}`}>
                    {solicitud.prioridad || 'Sin prioridad'}
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
                <InfoRow label="Empresa Mandante" value={solicitud.cliente} />
                <InfoRow label="Inspector Técnico / Constructora" value={solicitud.consultor} />
                <InfoRow label="Tipo de Proyecto" value={solicitud.tipoProyecto} />
                <InfoRow label="Tipo de Obra" value={solicitud.tipoObra} />
                <InfoRow label="Tipo de Servicio" value={solicitud.tipoServicio} />
                <InfoRow label="P. Kilometraje" value={solicitud.kilometraje +' Km'}  />
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
        {/* Tab: Documentos */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            {/* Controles de ordenamiento */}
            {!loadingArchivos && !errorArchivos && archivos.length > 0 && (
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-sm text-[#4A4A4A] mb-2">Ordenar por:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSort('fecha')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === 'fecha'
                        ? 'bg-[#0066CC] text-white'
                        : 'bg-gray-100 text-[#4A4A4A]'
                    }`}
                  >
                    Fecha
                    {sortBy === 'fecha' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('nombre')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === 'nombre'
                        ? 'bg-[#0066CC] text-white'
                        : 'bg-gray-100 text-[#4A4A4A]'
                    }`}
                  >
                    Nombre
                    {sortBy === 'nombre' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('tipo')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === 'tipo'
                        ? 'bg-[#0066CC] text-white'
                        : 'bg-gray-100 text-[#4A4A4A]'
                    }`}
                  >
                    Tipo
                    {sortBy === 'tipo' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Lista de archivos */}
            {loadingArchivos ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto mb-4" />
                <p className="text-[#4A4A4A]">Cargando documentos...</p>
              </div>
            ) : errorArchivos ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errorArchivos}</p>
              </div>
            ) : archivos.length > 0 ? (
              getSortedArchivos().map(archivo => {
                const badgeColor = getTipoDocumentoBadgeColor(archivo.tipoDocumento);
                const iconInfo = getFileIconInfo(archivo.fileName);
                
                return (
                  <div 
                    key={archivo.id} 
                    className="bg-white rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icono del archivo */}
                      <div className={`w-12 h-14 flex flex-col items-center justify-center ${iconInfo.bg} rounded-lg shadow-sm flex-shrink-0`}>
                        <div className={`w-8 h-1 ${iconInfo.color} rounded-t mb-1`}></div>
                        <span className="text-[10px] font-bold text-gray-700">{iconInfo.text}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[#003D7A] font-medium truncate mb-2">
                          {archivo.fileName}
                        </h4>
                        
                        {/* Badge del tipo de documento con color */}
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium border ${badgeColor}`}>
                          {archivo.tipoDocumento}
                        </span>
                        
                        <p className="text-xs text-[#4A4A4A] mt-2">
                          Modificado: {new Date(archivo.modified).toLocaleDateString('es-CL')} por {archivo.modifiedBy}
                        </p>
                        {archivo.estado && (
                          <p className="text-xs text-[#4A4A4A] mt-1">
                            Estado: {archivo.estado}
                          </p>
                        )}
                      </div>
                              <div className="flex-shrink-0">
                                <a
                                  href={archivo.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center w-10 h-10 bg-[#0066CC] rounded-lg text-white active:scale-95 transition-transform"
                                  title="Abrir en SharePoint"
                                >
                                  <Eye className="w-5 h-5" />
                                </a>
                            </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <FileText className="w-16 h-16 text-[#4A4A4A] opacity-30 mx-auto mb-4" />
                <p className="text-[#4A4A4A] mb-2">No hay documentos adjuntos</p>
                <p className="text-sm text-[#4A4A4A]">
                  Los documentos de esta solicitud aparecerán aquí
                </p>
              </div>
            )}
          </div>
        )}    
      </div>
      <FloatingActionButton
        onClick={() => solicitud && onNewInspection(solicitud)} // ← CAMBIADO: pasa la solicitud
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

// Exportar Inspection para que App.tsx pueda usarlo
export type { Inspection };