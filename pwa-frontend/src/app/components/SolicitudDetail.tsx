import { useState, useEffect } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import { MapPin, Building2, User, Calendar, FileText, Loader2, Plus, CheckCircle2, AlertTriangle, XCircle, Eye, ArrowUpDown, Camera, MessageSquare, TrendingUp, AlertOctagon, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { solicitudesService } from '@/services/solicitudes';
import { inspeccionesService } from '@/services/inspecciones';
import { getEstadoColor, getPrioridadTextColor  } from '@/utils/solicitudUtils.ts';
import type { Solicitud, Inspection, Archivo } from '@/types/solicitud.ts';
import { archivosService } from '@/services/archivos';
import { getFileIconInfo, getTipoDocumentoColor, getTipoDocumentoBadgeColor } from '@/utils/fileUtils.ts';

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

export function SolicitudDetail({ solicitudId, onBack, onNewInspection  }: SolicitudDetailProps) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [errorArchivos, setErrorArchivos] = useState<string | null>(null);

  // Estados para inspecciones
  const [inspecciones, setInspecciones] = useState<Inspection[]>([]);
  const [loadingInspecciones, setLoadingInspecciones] = useState(false);
  const [errorInspecciones, setErrorInspecciones] = useState<string | null>(null);
  
  // ← NUEVO: Estado para controlar qué tarjetas están expandidas
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'tipo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSolicitud();
  }, [solicitudId]);

  useEffect(() => {
    if (activeTab === 'documentos' && archivos.length === 0) {
      loadArchivos();
    } else if (activeTab === 'inspections') {
      loadInspecciones();
    }
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

  const loadInspecciones = async () => {
    setLoadingInspecciones(true);
    setErrorInspecciones(null);
    
    try {
      const data = await inspeccionesService.getBySolicitudId(solicitudId);
      setInspecciones(data);
    } catch (err: any) {
      setErrorInspecciones(err.message);
      console.error('Error cargando inspecciones:', err);
    } finally {
      setLoadingInspecciones(false);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // ← NUEVO: Toggle para expandir/colapsar tarjetas
  const toggleCard = (inspectionId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(inspectionId)) {
        newSet.delete(inspectionId);
      } else {
        newSet.add(inspectionId);
      }
      return newSet;
    });
  };

  const handleSort = (newSortBy: 'fecha' | 'nombre' | 'tipo') => {
    if (sortBy === newSortBy) {
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

  const statusConfig = {
    conforme: {
      icon: <CheckCircle2 className="w-6 h-6" />,
      label: 'Conforme',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      textColor: 'text-green-700',
      badgeColor: 'bg-green-100 text-green-700 border-green-300',
    },
    observaciones: {
      icon: <AlertTriangle className="w-6 h-6" />,
      label: 'Con Observaciones',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-500',
      textColor: 'text-orange-600',
      badgeColor: 'bg-orange-100 text-orange-700 border-orange-300',
    },
    'no-conforme': {
      icon: <XCircle className="w-6 h-6" />,
      label: 'No Conforme',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-[#E30613]',
      textColor: 'text-red-700',
      badgeColor: 'bg-red-100 text-red-700 border-red-300',
    },
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
              </div>
            </div>

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

        {/* Tab: Inspecciones - DISEÑO EXPANDIBLE */}
        {activeTab === 'inspections' && (
          <div className="space-y-4">
            {loadingInspecciones ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto mb-4" />
                <p className="text-[#4A4A4A]">Cargando inspecciones...</p>
              </div>
            ) : errorInspecciones ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errorInspecciones}</p>
                <button
                  onClick={loadInspecciones}
                  className="mt-3 text-sm text-[#0066CC] hover:underline"
                >
                  Reintentar
                </button>
              </div>
            ) : inspecciones.length > 0 ? (
              inspecciones.map((inspection: any) => {
                const config = statusConfig[inspection.status as keyof typeof statusConfig];
                const isExpanded = expandedCards.has(inspection.id);
                
                return (
                  <div 
                    key={inspection.id} 
                    className={`bg-white rounded-xl shadow-md border-l-4 ${config.borderColor} overflow-hidden transition-all duration-300`}
                  >
                    {/* ========================================
                        HEADER - SIEMPRE VISIBLE
                        ======================================== */}
                    <div className={`${config.bgColor} p-4 border-b ${config.borderColor}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={config.iconColor}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[#003D7A] font-semibold text-base truncate">
                              {String(inspection.type)}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-[#4A4A4A]" />
                              <span className="text-xs text-[#4A4A4A]">
                                {String(inspection.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeColor} whitespace-nowrap`}>
                          {config.label}
                        </span>
                      </div>
                    </div>

                    {/* ========================================
                        RESUMEN COMPACTO - SIEMPRE VISIBLE
                        ======================================== */}
                    <div className="p-4 space-y-3">
                      {/* Inspector */}
                      {inspection.inspector && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <User className="w-4 h-4 text-[#0066CC] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#4A4A4A]">Inspector</p>
                            <p className="text-sm text-[#003D7A] font-medium truncate">
                              {String(inspection.inspector)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Grid de métricas compacto */}
                      <div className="flex items-center gap-3">
                        {/* Avance */}
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-[#0066CC]" />
                          </div>
                          <div>
                            <p className="text-xs text-[#4A4A4A]">Avance</p>
                            <p className="text-lg font-bold text-[#0066CC]">
                              {String(inspection.progress)}%
                            </p>
                          </div>
                        </div>

                        {/* Fotos */}
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                            <Camera className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-[#4A4A4A]">Fotos</p>
                            <p className="text-lg font-bold text-purple-600">
                              {String(inspection.cantidadFotos || 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Botón Expandir/Colapsar - VERSIÓN BARRA */}
                      <div className="relative mt-3">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <button
                            onClick={() => toggleCard(inspection.id)}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm ${
                              isExpanded 
                                ? 'bg-white text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400' 
                                : 'bg-white text-[#0066CC] hover:text-[#0052A3] border border-blue-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Ocultar</span>
                              </>
                            ) : (
                              <>
                                <span>Ver más</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ========================================
                        DETALLES EXPANDIBLES
                        ======================================== */}
                    {isExpanded && (
                      <div className="px-4 pb-4 -mt-6 space-y-4">
                        {/* Barra de progreso detallada */}
                        <div className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-[#4A4A4A]">
                              Progreso de obra
                            </span>
                            <span className="text-xs font-bold text-[#0066CC]">
                              {String(inspection.progress)}%
                            </span>
                          </div>
                          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#0066CC] to-[#0052A3] rounded-full transition-all duration-500"
                              style={{ width: `${inspection.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Observaciones de Avance */}
                        {inspection.observacionesAvance && String(inspection.observacionesAvance).trim() && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-[#0066CC]" />
                              <h5 className="text-sm font-semibold text-[#003D7A]">
                                Comentarios de Avance
                              </h5>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
                                {String(inspection.observacionesAvance)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Observaciones de Inspección */}
                        {inspection.observations && String(inspection.observations).trim() && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-orange-500" />
                              <h5 className="text-sm font-semibold text-[#003D7A]">
                                Observaciones de Inspección
                              </h5>
                            </div>
                            <div className={`p-3 rounded-lg border ${
                              inspection.status === 'no-conforme' 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-orange-50 border-orange-200'
                            }`}>
                              <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
                                {String(inspection.observations)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Alerta de Paralización */}
                        {inspection.solicitaParalizacion && (
                          <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                            <div className="flex items-start gap-3">
                              <AlertOctagon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-orange-900 mb-1">
                                  Solicitud de Paralización
                                </p>
                                <p className="text-xs text-orange-700">
                                  Estado: {inspection.estadoParalizacion || 'Pendiente de revisión'}
                                </p>
                                {inspection.motivoParalizacion && String(inspection.motivoParalizacion).trim() && (
                                  <p className="text-sm text-orange-800 mt-2 leading-relaxed">
                                    {String(inspection.motivoParalizacion)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Información adicional */}
                        {inspection.inspectorEmail && (
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-xs text-[#4A4A4A] mb-1">Contacto del inspector</p>
                            <a 
                              href={`mailto:${inspection.inspectorEmail}`}
                              className="text-sm text-[#0066CC] hover:underline"
                            >
                              {String(inspection.inspectorEmail)}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-[#003D7A] font-medium mb-2">No hay inspecciones registradas</p>
                <p className="text-sm text-[#4A4A4A]">
                  Presiona el botón + para crear una nueva inspección
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Documentos - SIN CAMBIOS */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
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
                    {sortBy === 'fecha' && <ArrowUpDown className="w-4 h-4" />}
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
                    {sortBy === 'nombre' && <ArrowUpDown className="w-4 h-4" />}
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
                    {sortBy === 'tipo' && <ArrowUpDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

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
                  <div key={archivo.id} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-14 flex flex-col items-center justify-center ${iconInfo.bg} rounded-lg shadow-sm flex-shrink-0`}>
                        <div className={`w-8 h-1 ${iconInfo.color} rounded-t mb-1`}></div>
                        <span className="text-[10px] font-bold text-gray-700">{iconInfo.text}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[#003D7A] font-medium truncate mb-2">
                          {archivo.fileName}
                        </h4>
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
        onClick={() => solicitud && onNewInspection(solicitud)}
        icon={<Plus className="w-6 h-6" />}
        label="Inspección"
      />
    </div>
  );
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  
  return (
    <div>
      <p className="text-sm text-[#4A4A4A] mb-1">{label}</p>
      <p className="text-[#1A1A1A]">{value}</p>
    </div>
  );
}

export type { Inspection };