import { useState, useEffect } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import {
  MapPin,
  Building2,
  FileText,
  Loader2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  ArrowUpDown,
  Camera,
  MessageSquare,
  TrendingUp,
  AlertOctagon,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import { getEstadoColor, getPrioridadTextColor } from '@/utils/solicitudUtils';
import type { Solicitud, InspeccionDetalle, Archivo, FotoInspeccion } from '@/types/solicitud';
import { getFileIconInfo, getTipoDocumentoBadgeColor } from '@/utils/fileUtils';
import { PhotosModal } from './PhotosModal';
import { useSolicitudContext } from '@/context/SolicitudContext';

// ============================================================
// TYPES
// ============================================================

type TabId = 'info' | 'documentos' | 'inspections';

interface SolicitudDetailProps {
  solicitudId: number;
  onBack: () => void;
  onNewInspection: (solicitud: Solicitud) => void;
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
}

// ============================================================
// HELPERS
// ============================================================

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
      <div>
        <p className="text-sm text-[#4A4A4A] mb-1">{label}</p>
        <p className="text-[#1A1A1A]">{value}</p>
      </div>
  );
}

const STATUS_CONFIG = {
  conforme: {
    icon: <CheckCircle2 className="w-6 h-6" />,
    label: 'Conforme',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    badgeColor: 'bg-green-100 text-green-700 border-green-300',
  },
  observaciones: {
    icon: <AlertTriangle className="w-6 h-6" />,
    label: 'Con Observaciones',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-500',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-300',
  },
  'no-conforme': {
    icon: <XCircle className="w-6 h-6" />,
    label: 'No Conforme',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-[#E30613]',
    badgeColor: 'bg-red-100 text-red-700 border-red-300',
  },
} as const;

// ============================================================
// COMPONENT
// ============================================================

export function SolicitudDetail({ solicitudId, onBack, onNewInspection }: SolicitudDetailProps) {
  // ── Context: datos globales y acciones ─────────────────────
  const {
    solicitudActual,
    inspecciones,
    archivos,
    fotos,
    fotosLoadingIds,
    loadingSolicitud,
    loadingInspecciones,
    loadingArchivos,
    errorSolicitud,
    errorInspecciones,
    errorArchivos,
    cargarSolicitud,
    recargarInspecciones,
    recargarArchivos,
  } = useSolicitudContext();

  // Derivar los datos del context indexados por solicitudId
  const solicitud = solicitudActual;
  const inspeccionesList: InspeccionDetalle[] = inspecciones[solicitudId] ?? [];
  const archivosList: Archivo[] = archivos[solicitudId] ?? [];

  // ── Estado local: solo UI ───────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'tipo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal de fotos — solo guarda qué inspección está activa;
  // las fotos vienen directo del context (ya pre-cargadas)
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [currentInspectionForPhotos, setCurrentInspectionForPhotos] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // ── Efecto principal: cargar todo al montar o cambiar solicitud ──
  useEffect(() => {
    cargarSolicitud(solicitudId);
    // Resetear UI local al cambiar de solicitud
    setActiveTab('info');
    setExpandedCards(new Set());
  }, [solicitudId, cargarSolicitud]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const toggleCard = (inspectionId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(inspectionId) ? next.delete(inspectionId) : next.add(inspectionId);
      return next;
    });
  };

  const handleSort = (newSortBy: 'fecha' | 'nombre' | 'tipo') => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getSortedArchivos = (): Archivo[] => {
    return [...archivosList].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'fecha':
          cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'nombre':
          cmp = a.fileName.localeCompare(b.fileName);
          break;
        case 'tipo':
          cmp = a.tipoDocumento.localeCompare(b.tipoDocumento);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  };

  const openPhotosModal = (inspection: InspeccionDetalle) => {
    if (!inspection?.id) return;
    setCurrentInspectionForPhotos({
      id: String(inspection.id),
      title: String(inspection.type),
    });
    setIsPhotosModalOpen(true);
  };

  const closePhotosModal = () => {
    setIsPhotosModalOpen(false);
    setCurrentInspectionForPhotos(null);
  };

  // ============================================================
  // LOADING / ERROR STATES
  // ============================================================

  if (loadingSolicitud) {
    return (
        <div className="min-h-screen bg-[#F5F7FA]">
          <Header title="Cargando..." showBackButton onBack={onBack} />
          <div className="flex items-center justify-center h-[calc(100vh-56px)]">
            <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin" />
          </div>
        </div>
    );
  }

  if (errorSolicitud || !solicitud) {
    return (
        <div className="min-h-screen bg-[#F5F7FA]">
          <Header title="Error" showBackButton onBack={onBack} />
          <div className="p-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{errorSolicitud ?? 'Solicitud no encontrada'}</p>
              <button
                  onClick={() => cargarSolicitud(solicitudId)}
                  className="mt-3 text-sm text-[#0066CC] hover:underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'inspections', label: 'Inspecciones' },
  ];

  return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <Header
            title={`Solicitud #${solicitud.codigo ?? solicitud.id}`}
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

          {/* ====================================================
            TAB: INFORMACIÓN (datos críticos, ya cargados)
            ==================================================== */}
          {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div>
                    <p className="text-sm text-[#4A4A4A] mb-1">Etapa</p>
                    <p className={`font-medium ${getEstadoColor(solicitud.etapa)}`}>{solicitud.etapa}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-[#4A4A4A] mb-1">Estado</p>
                      <p className="text-[#0066CC] font-medium">{solicitud.estadoSolicitud}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#4A4A4A] mb-1">Prioridad</p>
                      <p className={`font-medium ${getPrioridadTextColor(solicitud.prioridad)}`}>
                        {solicitud.prioridad ?? 'Sin prioridad'}
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
                    <InfoRow label="P. Kilometraje" value={solicitud.kilometraje ? `${solicitud.kilometraje} Km` : null} />
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

          {/* ====================================================
            TAB: INSPECCIONES (carga async en segundo plano)
            ==================================================== */}
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
                          onClick={() => recargarInspecciones(solicitudId)}
                          className="mt-3 text-sm text-[#0066CC] hover:underline"
                      >
                        Reintentar
                      </button>
                    </div>
                ) : inspeccionesList.length > 0 ? (
                    inspeccionesList.map((inspection) => {
                      const config = STATUS_CONFIG[inspection.status] ?? STATUS_CONFIG['conforme'];
                      const isExpanded = expandedCards.has(inspection.id);

                      return (
                          <div
                              key={inspection.id}
                              className={`bg-white rounded-xl shadow-md border-l-4 ${config.borderColor} overflow-hidden`}
                          >
                            {/* Header siempre visible */}
                            <div className={`${config.bgColor} p-4 border-b ${config.borderColor}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={config.iconColor}>{config.icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[#003D7A] font-semibold text-base truncate">
                                      {inspection.type}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Clock className="w-3 h-3 text-[#4A4A4A]" />
                                      <span className="text-xs text-[#4A4A4A]">{inspection.date}</span>
                                    </div>
                                  </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeColor} whitespace-nowrap`}>
                          {config.label}
                        </span>
                              </div>
                            </div>

                            {/* Resumen compacto */}
                            <div className="p-4 space-y-3">
                              {inspection.inspector && (
                                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <User className="w-4 h-4 text-[#0066CC] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-[#4A4A4A]">Inspector</p>
                                      <p className="text-sm text-[#003D7A] font-medium truncate">
                                        {inspection.inspector}
                                      </p>
                                    </div>
                                  </div>
                              )}

                              <div className="flex items-center gap-3">
                                {/* Avance */}
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-[#0066CC]" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Avance</p>
                                    <p className="text-lg font-bold text-[#0066CC]">{inspection.progress}%</p>
                                  </div>
                                </div>

                                {/* Fotos */}
                                <button
                                    type="button"
                                    onClick={() => inspection.cantidadFotos > 0 && openPhotosModal(inspection)}
                                    disabled={inspection.cantidadFotos === 0}
                                    className={`flex items-center gap-2 flex-1 text-left ${
                                        inspection.cantidadFotos > 0
                                            ? 'cursor-pointer'
                                            : 'opacity-60 cursor-default'
                                    }`}
                                    title={inspection.cantidadFotos > 0 ? 'Ver fotos' : 'Sin fotos'}
                                >
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                                    <Camera className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Fotos</p>
                                    <p className="text-lg font-bold text-purple-600">
                                      {inspection.cantidadFotos ?? 0}
                                    </p>
                                  </div>
                                </button>
                              </div>

                              {/* Botón expandir */}
                              <div className="relative mt-3">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                  <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                  <button
                                      onClick={() => toggleCard(inspection.id)}
                                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium shadow-sm bg-white border transition-all ${
                                          isExpanded
                                              ? 'text-gray-600 border-gray-300 hover:border-gray-400'
                                              : 'text-[#0066CC] border-blue-200 hover:border-blue-300 hover:bg-blue-50'
                                      }`}
                                  >
                                    {isExpanded ? (
                                        <><ChevronUp className="w-3.5 h-3.5" /><span>Ocultar</span></>
                                    ) : (
                                        <><span>Ver más</span><ChevronDown className="w-3.5 h-3.5" /></>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Detalles expandibles */}
                            {isExpanded && (
                                <div className="px-4 pb-4 -mt-6 space-y-4">
                                  {/* Barra de progreso */}
                                  <div className="pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-[#4A4A4A]">Progreso de obra</span>
                                      <span className="text-xs font-bold text-[#0066CC]">{inspection.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                                      <div
                                          className="h-full bg-gradient-to-r from-[#0066CC] to-[#0052A3] rounded-full transition-all duration-500"
                                          style={{ width: `${inspection.progress}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Comentarios de avance */}
                                  {inspection.observacionesAvance?.trim() && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <MessageSquare className="w-4 h-4 text-[#0066CC]" />
                                          <h5 className="text-sm font-semibold text-[#003D7A]">Comentarios de Avance</h5>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                          <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
                                            {inspection.observacionesAvance}
                                          </p>
                                        </div>
                                      </div>
                                  )}

                                  {/* Observaciones de inspección */}
                                  {inspection.observations?.trim() && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-orange-500" />
                                          <h5 className="text-sm font-semibold text-[#003D7A]">Observaciones de Inspección</h5>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${
                                            inspection.status === 'no-conforme'
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-orange-50 border-orange-200'
                                        }`}>
                                          <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
                                            {inspection.observations}
                                          </p>
                                        </div>
                                      </div>
                                  )}

                                  {/* Alerta de paralización */}
                                  {inspection.solicitaParalizacion && (
                                      <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                                        <div className="flex items-start gap-3">
                                          <AlertOctagon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                          <div className="flex-1">
                                            <p className="text-sm font-semibold text-orange-900 mb-1">
                                              Solicitud de Paralización
                                            </p>
                                            <p className="text-xs text-orange-700">
                                              Estado: {inspection.estadoParalizacion ?? 'Pendiente de revisión'}
                                            </p>
                                            {inspection.motivoParalizacion?.trim() && (
                                                <p className="text-sm text-orange-800 mt-2 leading-relaxed">
                                                  {inspection.motivoParalizacion}
                                                </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                  )}

                                  {/* Email inspector */}
                                  {inspection.inspectorEmail && (
                                      <div className="pt-3 border-t border-gray-100">
                                        <p className="text-xs text-[#4A4A4A] mb-1">Contacto del inspector</p>
                                        <a
                                            href={`mailto:${inspection.inspectorEmail}`}
                                            className="text-sm text-[#0066CC] hover:underline"
                                        >
                                          {inspection.inspectorEmail}
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
                      <p className="text-sm text-[#4A4A4A]">Presiona el botón + para crear una nueva inspección</p>
                    </div>
                )}
              </div>
          )}

          {/* ====================================================
            TAB: DOCUMENTOS (carga async en segundo plano)
            ==================================================== */}
          {activeTab === 'documentos' && (
              <div className="space-y-4">
                {/* Controles de orden */}
                {!loadingArchivos && !errorArchivos && archivosList.length > 0 && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-[#4A4A4A] mb-2">Ordenar por:</p>
                      <div className="flex gap-2">
                        {(['fecha', 'nombre', 'tipo'] as const).map(field => (
                            <button
                                key={field}
                                onClick={() => handleSort(field)}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                                    sortBy === field ? 'bg-[#0066CC] text-white' : 'bg-gray-100 text-[#4A4A4A]'
                                }`}
                            >
                              {field}
                              {sortBy === field && <ArrowUpDown className="w-4 h-4" />}
                            </button>
                        ))}
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
                      <button
                          onClick={() => recargarArchivos(solicitudId)}
                          className="mt-3 text-sm text-[#0066CC] hover:underline"
                      >
                        Reintentar
                      </button>
                    </div>
                ) : archivosList.length > 0 ? (
                    getSortedArchivos().map(archivo => {
                      const badgeColor = getTipoDocumentoBadgeColor(archivo.tipoDocumento);
                      const iconInfo = getFileIconInfo(archivo.fileName);
                      return (
                          <div key={archivo.id} className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className={`w-12 h-14 flex flex-col items-center justify-center ${iconInfo.bg} rounded-lg shadow-sm flex-shrink-0`}>
                                <div className={`w-8 h-1 ${iconInfo.color} rounded-t mb-1`} />
                                <span className="text-[10px] font-bold text-gray-700">{iconInfo.text}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[#003D7A] font-medium truncate mb-2">{archivo.fileName}</h4>
                                <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium border ${badgeColor}`}>
                          {archivo.tipoDocumento}
                        </span>
                                <p className="text-xs text-[#4A4A4A] mt-2">
                                  Modificado: {new Date(archivo.modified).toLocaleDateString('es-CL')} por {archivo.modifiedBy}
                                </p>
                                {archivo.estado && (
                                    <p className="text-xs text-[#4A4A4A] mt-1">Estado: {archivo.estado}</p>
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
                      <p className="text-sm text-[#4A4A4A]">Los documentos de esta solicitud aparecerán aquí</p>
                    </div>
                )}
              </div>
          )}
        </div>

        {/* FAB - Nueva Inspección */}
        <FloatingActionButton
            onClick={() => onNewInspection(solicitud)}
            icon={<Plus className="w-6 h-6" />}
            label="Inspección"
        />

        {/* Modal de fotos — datos ya pre-cargados desde el context */}
        {currentInspectionForPhotos && (
            <PhotosModal
                isOpen={isPhotosModalOpen}
                title={`Fotos de ${currentInspectionForPhotos.title}`}
                inspeccionId={currentInspectionForPhotos.id}
                photos={(fotos[currentInspectionForPhotos.id] ?? []) as FotoInspeccion[]}
                loading={fotosLoadingIds.has(currentInspectionForPhotos.id)}
                error={null}
                onClose={closePhotosModal}
            />
        )}
      </div>
  );
}
