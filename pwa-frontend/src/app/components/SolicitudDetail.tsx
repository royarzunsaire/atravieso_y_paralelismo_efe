import { useState, useEffect, useMemo } from 'react';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import {
  MapPin,
  Building2,
  FileText,
  Loader2,
  Plus,
  CheckCircle2,
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
  X,
  Search,
  Filter,
  Lock,
} from 'lucide-react';
import { getEstadoColor, getPrioridadTextColor } from '@/utils/solicitudUtils';
import type { Solicitud, InspeccionDetalle, Archivo, FotoInspeccion } from '@/types/solicitud';
import { getFileIconInfo, getTipoDocumentoBadgeColor } from '@/utils/fileUtils';
import { PhotosModal } from './PhotosModal';
import { useSolicitudContext } from '@/context/SolicitudContext';

type TabId = 'info' | 'documentos' | 'inspections';

interface SolicitudDetailProps {
  solicitudId: number;
  onBack: () => void;
  onNewInspection: (solicitud: Solicitud) => void;
  onCierreObra: (solicitud: Solicitud) => void;
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
}

interface InspeccionFiltros {
  texto: string;
  tipoInspeccion: string;
  estado: string;
  desfase: string;
  solicitaParalizacion: boolean | null;
}

const FILTROS_INICIALES: InspeccionFiltros = {
  texto: '',
  tipoInspeccion: '',
  estado: '',
  desfase: '',
  solicitaParalizacion: null,
};

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
  'no-conforme': {
    icon: <XCircle className="w-6 h-6" />,
    label: 'No Conforme',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-[#E30613]',
    badgeColor: 'bg-red-100 text-red-700 border-red-300',
  },
} as const;

export function SolicitudDetail({ solicitudId, onBack, onNewInspection, onCierreObra }: SolicitudDetailProps) {
  const {
    solicitudActual, inspecciones, archivos, fotos, fotosLoadingIds,
    loadingSolicitud, loadingInspecciones, loadingArchivos,
    errorSolicitud, errorInspecciones, errorArchivos,
    cargarSolicitud, recargarInspecciones, recargarArchivos,
  } = useSolicitudContext();

  const solicitud = solicitudActual;
  const inspeccionesList: InspeccionDetalle[] = inspecciones[solicitudId] ?? [];
  const archivosList: Archivo[] = archivos[solicitudId] ?? [];

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'tipo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filtros, setFiltros] = useState<InspeccionFiltros>(FILTROS_INICIALES);
  const [showEstadoMenu, setShowEstadoMenu] = useState(false);
  const [showTipoMenu, setShowTipoMenu] = useState(false);
  const [showDesfaseMenu, setShowDesfaseMenu] = useState(false);
  const [showParalizacionMenu, setShowParalizacionMenu] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [currentInspectionForPhotos, setCurrentInspectionForPhotos] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    cargarSolicitud(solicitudId);
    setActiveTab('info');
    setExpandedCards(new Set());
    setFiltros(FILTROS_INICIALES);
  }, [solicitudId, cargarSolicitud]);

  const tiposUnicos = useMemo(() => {
    const tipos = inspeccionesList.map(i => i.type).filter(Boolean);
    return Array.from(new Set(tipos)).sort();
  }, [inspeccionesList]);

  // Última inspección por fechaInspeccion (fallback a fechaCreacion)
  const ultimaInspeccion = useMemo(() => {
    if (!inspeccionesList.length) return null;
    return [...inspeccionesList].sort((a, b) => {
      const dateA = new Date(a.fechaInspeccion ?? a.fechaCreacion ?? 0).getTime();
      const dateB = new Date(b.fechaInspeccion ?? b.fechaCreacion ?? 0).getTime();
      return dateB - dateA;
    })[0];
  }, [inspeccionesList]);

  const inspeccionesFiltradas = useMemo(() => {
    return inspeccionesList.filter(i => {
      if (filtros.texto.trim()) {
        const q = filtros.texto.toLowerCase();
        const match = i.type?.toLowerCase().includes(q) || i.inspector?.toLowerCase().includes(q) ||
            i.observations?.toLowerCase().includes(q) || i.observacionesAvance?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filtros.tipoInspeccion && i.type !== filtros.tipoInspeccion) return false;
      if (filtros.estado && i.status !== filtros.estado) return false;
      if (filtros.desfase && i.desfase !== filtros.desfase) return false;
      if (filtros.solicitaParalizacion !== null && i.solicitaParalizacion !== filtros.solicitaParalizacion) return false;
      return true;
    });
  }, [inspeccionesList, filtros]);

  const filtrosActivos = useMemo(() => {
    let n = 0;
    if (filtros.texto.trim()) n++;
    if (filtros.tipoInspeccion) n++;
    if (filtros.estado) n++;
    if (filtros.desfase) n++;
    if (filtros.solicitaParalizacion !== null) n++;
    return n;
  }, [filtros]);

  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  const toggleCard = (inspectionId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(inspectionId) ? next.delete(inspectionId) : next.add(inspectionId);
      return next;
    });
  };

  const handleSort = (newSortBy: 'fecha' | 'nombre' | 'tipo') => {
    if (sortBy === newSortBy) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(newSortBy); setSortOrder('desc'); }
  };

  const getSortedArchivos = (): Archivo[] => {
    return [...archivosList].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fecha') cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      else if (sortBy === 'nombre') cmp = a.fileName.localeCompare(b.fileName);
      else cmp = a.tipoDocumento.localeCompare(b.tipoDocumento);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  };

  const openPhotosModal = (inspection: InspeccionDetalle) => {
    if (!inspection?.id) return;
    setCurrentInspectionForPhotos({ id: String(inspection.id), title: String(inspection.type) });
    setIsPhotosModalOpen(true);
  };

  const closePhotosModal = () => { setIsPhotosModalOpen(false); setCurrentInspectionForPhotos(null); };

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
              <button onClick={() => cargarSolicitud(solicitudId)} className="mt-3 text-sm text-[#0066CC] hover:underline">Reintentar</button>
            </div>
          </div>
        </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'inspections', label: 'Inspecciones' },
  ];

  const ESTADO_OPTIONS = [
    { value: '', label: 'Todos los estados', icon: <Eye className="w-5 h-5" />, chipColors: 'bg-gray-100 text-[#4A4A4A] border-gray-300', listColors: 'bg-gray-50 hover:bg-gray-100 text-[#4A4A4A]' },
    { value: 'conforme', label: 'Conforme', icon: <CheckCircle2 className="w-5 h-5" />, chipColors: 'bg-green-600 text-white border-green-600', listColors: 'bg-green-50 hover:bg-green-100 text-green-800' },
    { value: 'no-conforme', label: 'No Conforme', icon: <XCircle className="w-5 h-5" />, chipColors: 'bg-[#E30613] text-white border-[#E30613]', listColors: 'bg-red-50 hover:bg-red-100 text-red-800' },
  ];
  const DESFASE_OPTIONS = [
    { value: '', label: 'Todos (desfase)', chipColors: 'bg-amber-50 text-amber-700 border-amber-200', listColors: 'bg-amber-50 hover:bg-amber-100 text-amber-800' },
    { value: '1', label: 'Con desfase', chipColors: 'bg-amber-500 text-white border-amber-500', listColors: 'bg-amber-50 hover:bg-amber-100 text-amber-800' },
    { value: '0', label: 'Sin desfase', chipColors: 'bg-gray-100 text-gray-800 border-gray-300', listColors: 'bg-gray-50 hover:bg-gray-100 text-gray-800' },
  ];
  const PARALIZACION_OPTIONS = [
    { value: null, label: 'Todas (paralización)', chipColors: 'bg-orange-50 text-orange-700 border-orange-200', listColors: 'bg-orange-50 hover:bg-orange-100 text-orange-800' },
    { value: true, label: 'Con paralización', chipColors: 'bg-orange-600 text-white border-orange-600', listColors: 'bg-orange-50 hover:bg-orange-100 text-orange-800' },
    { value: false, label: 'Sin paralización', chipColors: 'bg-gray-100 text-gray-800 border-gray-300', listColors: 'bg-gray-50 hover:bg-gray-100 text-gray-800' },
  ] as const;
  const TIPO_OPTIONS = [
    { value: '', label: 'Todos los tipos', chipColors: 'bg-blue-100 text-[#003D7A] border-blue-200', listColors: 'bg-blue-50 hover:bg-blue-100 text-[#003D7A]' },
    ...tiposUnicos.map(tipo => ({ value: tipo, label: tipo, chipColors: 'bg-[#003D7A] text-white border-[#003D7A]', listColors: 'bg-blue-50 hover:bg-blue-100 text-[#003D7A]' })),
  ];

  const currentEstado = ESTADO_OPTIONS.find(o => o.value === filtros.estado) || ESTADO_OPTIONS[0];
  const currentDesfase = DESFASE_OPTIONS.find(o => o.value === filtros.desfase) ?? DESFASE_OPTIONS[0];
  const currentParalizacion = PARALIZACION_OPTIONS.find(o => o.value === filtros.solicitaParalizacion) ?? PARALIZACION_OPTIONS[0];
  const currentTipo = TIPO_OPTIONS.find(o => o.value === filtros.tipoInspeccion) ?? TIPO_OPTIONS[0];

  return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <Header title={`Solicitud #${solicitud.codigo ?? solicitud.id}`} showBackButton onBack={onBack} />

        {/* Tabs */}
        <div className="sticky top-14 z-40 bg-white border-b border-[#003D7A]/10 shadow-sm">
          <div className="flex">
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 h-12 transition-colors ${activeTab === tab.id ? 'text-[#0066CC] border-b-2 border-[#0066CC]' : 'text-[#4A4A4A] border-b-2 border-transparent'}`}>
                  {tab.label}
                  {tab.id === 'inspections' && filtrosActivos > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0066CC] text-white text-[10px]">{filtrosActivos}</span>
                  )}
                </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ── TAB: INFO ── */}
          {activeTab === 'info' && (
              <div className="space-y-4">

                {/* ── Card de Progreso de Obra — siempre visible ── */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#003D7A] to-[#0066CC] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-white/80" />
                      <span className="text-sm font-semibold text-white">Progreso de Obra</span>
                    </div>
                    {!loadingInspecciones && ultimaInspeccion && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            ultimaInspeccion.status === 'conforme'
                                ? 'bg-green-400/20 text-green-100 border-green-300/40'
                                : 'bg-red-400/20 text-red-100 border-red-300/40'
                        }`}>
                    {ultimaInspeccion.status === 'conforme' ? 'Conforme' : 'No Conforme'}
                  </span>
                    )}
                  </div>

                  <div className="p-4">
                    {loadingInspecciones ? (
                        /* Skeleton mientras carga */
                        <div className="animate-pulse space-y-3">
                          <div className="flex items-end gap-4">
                            <div className="w-24 h-12 bg-gray-200 rounded-lg" />
                            <div className="flex-1 space-y-2 pb-1">
                              <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                              <div className="h-3 bg-gray-200 rounded-full" />
                            </div>
                          </div>
                          <div className="border-t border-gray-100 pt-3 space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                            <div className="h-3 bg-gray-200 rounded w-2/3" />
                          </div>
                        </div>
                    ) : ultimaInspeccion ? (
                        <>
                          {/* Con inspecciones — muestra el % real */}
                          <div className="flex items-end gap-4 mb-4">
                            <div>
                        <span className="text-5xl font-bold text-[#0066CC] leading-none tabular-nums">
                          {ultimaInspeccion.progress}
                        </span>
                              <span className="text-2xl font-bold text-[#0066CC]">%</span>
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex justify-between text-xs text-[#4A4A4A] mb-1.5">
                                <span>Avance registrado</span>
                                <span>{ultimaInspeccion.progress}%</span>
                              </div>
                              <div className="h-3 bg-[#F5F7FA] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        ultimaInspeccion.progress === 100
                                            ? 'bg-green-500' // Color cuando está completado
                                            : ultimaInspeccion.progress >= 75
                                                ? 'bg-gradient-to-r from-[#0066CC] to-green-500'
                                                : 'bg-gradient-to-r from-[#003D7A] to-[#0066CC]'
                                    }`}
                                    style={{ width: `${ultimaInspeccion.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-[#003D7A]/10 pt-3 space-y-1.5">
                            <p className="text-xs text-[#4A4A4A] font-medium uppercase tracking-wide">
                              Basado en última inspección
                            </p>
                            <div className="flex items-center gap-2 text-sm text-[#1A1A1A]">
                              <Clock className="w-3.5 h-3.5 text-[#0066CC] flex-shrink-0" />
                              <span>{ultimaInspeccion.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#1A1A1A]">
                              <FileText className="w-3.5 h-3.5 text-[#0066CC] flex-shrink-0" />
                              <span>{ultimaInspeccion.type}</span>
                            </div>
                            {ultimaInspeccion.inspector && (
                                <div className="flex items-center gap-2 text-sm text-[#1A1A1A]">
                                  <User className="w-3.5 h-3.5 text-[#0066CC] flex-shrink-0" />
                                  <span>{ultimaInspeccion.inspector}</span>
                                </div>
                            )}
                          </div>
                        </>
                    ) : (
                        <>
                          {/* Sin inspecciones — muestra 0% explícito */}
                          <div className="flex items-end gap-4 mb-4">
                            <div>
                              <span className="text-5xl font-bold text-[#4A4A4A] leading-none tabular-nums">0</span>
                              <span className="text-2xl font-bold text-[#4A4A4A]">%</span>
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex justify-between text-xs text-[#4A4A4A] mb-1.5">
                                <span>Avance registrado</span>
                                <span>0%</span>
                              </div>
                              <div className="h-3 bg-[#F5F7FA] rounded-full overflow-hidden">
                                <div className="h-full w-0 rounded-full bg-gray-300" />
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-[#003D7A]/10 pt-3">
                            <p className="text-xs text-[#4A4A4A] font-medium uppercase tracking-wide mb-1">
                              Sin inspecciones de avance realizadas
                            </p>
                            <p className="text-xs text-[#4A4A4A]">
                              El progreso se actualizará al registrar la primera inspección
                            </p>
                          </div>
                        </>
                    )}
                  </div>
                </div>
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
                      <p className={`font-medium ${getPrioridadTextColor(solicitud.prioridad)}`}>{solicitud.prioridad ?? 'Sin prioridad'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="text-[#003D7A] mb-3 flex items-center gap-2"><FileText className="w-5 h-5" />Datos del Proyecto</h3>
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
                  <h3 className="text-[#003D7A] mb-3 flex items-center gap-2"><MapPin className="w-5 h-5" />Ubicación</h3>
                  <div className="space-y-3">
                    <InfoRow label="Región" value={solicitud.region} />
                    <InfoRow label="Comuna" value={solicitud.comuna} />
                    <InfoRow label="Ramal" value={solicitud.ramal} />
                  </div>
                </div>
                {solicitud.rolAsignado && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h3 className="text-[#003D7A] mb-3 flex items-center gap-2"><Building2 className="w-5 h-5" />Asignación</h3>
                      <InfoRow label="Rol Asignado" value={solicitud.rolAsignado} />
                    </div>
                )}
              </div>
          )}

          {/* ── TAB: INSPECCIONES ── */}
          {activeTab === 'inspections' && (
              <div className="space-y-3">

                {/* Panel de filtros */}
                {!loadingInspecciones && !errorInspecciones && inspeccionesList.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#003D7A]/10 overflow-visible">

                      {/* Cabecera */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#003D7A]/10">
                        <Filter className="w-4 h-4 text-[#0066CC]" />
                        <span className="text-sm font-semibold text-[#003D7A]">Filtrar inspecciones</span>
                        {filtrosActivos > 0 && (
                            <span className="ml-auto inline-flex items-center px-2 py-0.5 bg-[#0066CC] text-white text-xs rounded-full font-medium">
                      {filtrosActivos} activo{filtrosActivos > 1 ? 's' : ''}
                    </span>
                        )}
                      </div>

                      {/* Controles */}
                      <div className="p-3 space-y-2">

                        {/* Estado */}
                        <div className="relative">
                          <button onClick={() => setShowEstadoMenu(v => !v)}
                                  className={`w-full flex items-center justify-between h-12 px-4 rounded-xl border-2 text-base font-medium transition-all active:scale-[0.98] shadow-sm ${currentEstado.chipColors}`}>
                            <span className="flex items-center gap-2">{currentEstado.icon}{currentEstado.label}</span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${showEstadoMenu ? 'rotate-180' : ''}`} />
                          </button>
                          {showEstadoMenu && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowEstadoMenu(false)} />
                                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                  {ESTADO_OPTIONS.map(opt => (
                                      <button key={opt.value}
                                              onClick={() => { setFiltros(f => ({ ...f, estado: opt.value })); setShowEstadoMenu(false); }}
                                              className={`w-full flex items-center gap-3 py-4 px-5 text-left text-base font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.estado === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
                                        {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                                        <span className="flex-1">{opt.label}</span>
                                        {filtros.estado === opt.value && <CheckCircle2 className="w-5 h-5 text-[#0066CC] flex-shrink-0" />}
                                      </button>
                                  ))}
                                </div>
                              </>
                          )}
                        </div>

                        {/* Desfase + Paralización */}
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <button onClick={() => setShowDesfaseMenu(v => !v)}
                                    className={`w-full flex items-center justify-between h-12 px-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.98] shadow-sm ${currentDesfase.chipColors}`}>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{currentDesfase.label}</span>
                        </span>
                              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showDesfaseMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showDesfaseMenu && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowDesfaseMenu(false)} />
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                    {DESFASE_OPTIONS.map(opt => (
                                        <button key={opt.value}
                                                onClick={() => { setFiltros(f => ({ ...f, desfase: opt.value })); setShowDesfaseMenu(false); }}
                                                className={`w-full flex items-center gap-3 py-3 px-4 text-left text-sm font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.desfase === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
                                          <span className="flex-1">{opt.label}</span>
                                          {filtros.desfase === opt.value && <CheckCircle2 className="w-4 h-4 text-[#0066CC] flex-shrink-0" />}
                                        </button>
                                    ))}
                                  </div>
                                </>
                            )}
                          </div>

                          <div className="relative flex-1">
                            <button onClick={() => setShowParalizacionMenu(v => !v)}
                                    className={`w-full flex items-center justify-between h-12 px-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.98] shadow-sm ${currentParalizacion.chipColors}`}>
                        <span className="flex items-center gap-1.5">
                          <AlertOctagon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{currentParalizacion.label}</span>
                        </span>
                              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showParalizacionMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showParalizacionMenu && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowParalizacionMenu(false)} />
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                    {PARALIZACION_OPTIONS.map(opt => (
                                        <button key={String(opt.value)}
                                                onClick={() => { setFiltros(f => ({ ...f, solicitaParalizacion: opt.value })); setShowParalizacionMenu(false); }}
                                                className={`w-full flex items-center gap-3 py-3 px-4 text-left text-sm font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.solicitaParalizacion === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
                                          <span className="flex-1">{opt.label}</span>
                                          {filtros.solicitaParalizacion === opt.value && <CheckCircle2 className="w-4 h-4 text-[#0066CC] flex-shrink-0" />}
                                        </button>
                                    ))}
                                  </div>
                                </>
                            )}
                          </div>
                        </div>

                        {/* Tipo */}
                        {tiposUnicos.length > 1 && (
                            <div className="relative">
                              <button onClick={() => setShowTipoMenu(v => !v)}
                                      className={`w-full flex items-center justify-between h-12 px-4 rounded-xl border-2 text-base font-medium transition-all active:scale-[0.98] shadow-sm ${currentTipo.chipColors}`}>
                                <span>{currentTipo.label}</span>
                                <ChevronDown className={`w-5 h-5 transition-transform ${showTipoMenu ? 'rotate-180' : ''}`} />
                              </button>
                              {showTipoMenu && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowTipoMenu(false)} />
                                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                      {TIPO_OPTIONS.map(opt => (
                                          <button key={opt.value}
                                                  onClick={() => { setFiltros(f => ({ ...f, tipoInspeccion: opt.value })); setShowTipoMenu(false); }}
                                                  className={`w-full flex items-center gap-3 py-3 px-5 text-left text-base font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.tipoInspeccion === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
                                            <span className="flex-1">{opt.label}</span>
                                            {filtros.tipoInspeccion === opt.value && <CheckCircle2 className="w-5 h-5 text-[#0066CC] flex-shrink-0" />}
                                          </button>
                                      ))}
                                    </div>
                                  </>
                              )}
                            </div>
                        )}

                        {/* Limpiar */}
                        {filtrosActivos > 0 && (
                            <button onClick={limpiarFiltros}
                                    className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium border bg-red-50 text-[#E30613] border-red-200 active:bg-red-100 active:scale-[0.98] transition-all">
                              <X className="w-4 h-4" />
                              Limpiar filtros
                            </button>
                        )}

                      </div>
                    </div>
                )}

                {/* Contador */}
                {!loadingInspecciones && !errorInspecciones && filtrosActivos > 0 && (
                    <p className="text-xs text-[#4A4A4A] px-1">
                      Mostrando {inspeccionesFiltradas.length} de {inspeccionesList.length} inspecciones
                    </p>
                )}

                {/* Lista de inspecciones */}
                {loadingInspecciones ? (
                    <div className="bg-white rounded-lg p-8 text-center">
                      <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto mb-4" />
                      <p className="text-[#4A4A4A]">Cargando inspecciones...</p>
                    </div>
                ) : errorInspecciones ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">{errorInspecciones}</p>
                      <button onClick={() => recargarInspecciones(solicitudId)} className="mt-3 text-sm text-[#0066CC] hover:underline">Reintentar</button>
                    </div>
                ) : inspeccionesFiltradas.length > 0 ? (
                    inspeccionesFiltradas.map((inspection) => {
                      const config = STATUS_CONFIG[inspection.status] ?? STATUS_CONFIG['conforme'];
                      const isExpanded = expandedCards.has(inspection.id);
                      return (
                          <div key={inspection.id} className={`bg-white rounded-xl shadow-md border-l-4 ${config.borderColor} overflow-hidden`}>
                            <div className={`${config.bgColor} p-4 border-b ${config.borderColor}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={config.iconColor}>{config.icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[#003D7A] font-semibold text-base truncate">{inspection.type}</h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-[#4A4A4A]" />
                                        <span className="text-xs text-[#4A4A4A]">{inspection.date}</span>
                                      </div>
                                      {inspection.desfase === '1' && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">Desfase</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeColor} whitespace-nowrap`}>{config.label}</span>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              {inspection.inspector && (
                                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <User className="w-4 h-4 text-[#0066CC] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-[#4A4A4A]">Inspector</p>
                                      <p className="text-sm text-[#003D7A] font-medium truncate">{inspection.inspector}</p>
                                    </div>
                                  </div>
                              )}
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-[#0066CC]" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Avance</p>
                                    <p className="text-lg font-bold text-[#0066CC]">{inspection.progress}%</p>
                                  </div>
                                </div>
                                <button type="button" onClick={() => inspection.cantidadFotos > 0 && openPhotosModal(inspection)}
                                        disabled={inspection.cantidadFotos === 0}
                                        className={`flex items-center gap-2 flex-1 text-left ${inspection.cantidadFotos > 0 ? 'cursor-pointer' : 'opacity-60 cursor-default'}`}>
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                                    <Camera className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Fotos</p>
                                    <p className="text-lg font-bold text-purple-600">{inspection.cantidadFotos ?? 0}</p>
                                  </div>
                                </button>
                              </div>
                              <div className="relative mt-3">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                  <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                  <button onClick={() => toggleCard(inspection.id)}
                                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium shadow-sm bg-white border transition-all ${isExpanded ? 'text-gray-600 border-gray-300' : 'text-[#0066CC] border-blue-200 hover:bg-blue-50'}`}>
                                    {isExpanded
                                        ? <><ChevronUp className="w-3.5 h-3.5" /><span>Ocultar</span></>
                                        : <><span>Ver Detalles</span><ChevronDown className="w-3.5 h-3.5" /></>
                                    }
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 -mt-6 space-y-4">
                                  <div className="pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-[#4A4A4A]">Progreso de obra</span>
                                      <span className="text-xs font-bold text-[#0066CC]">{inspection.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-[#0066CC] to-[#0052A3] rounded-full transition-all duration-500" style={{ width: `${inspection.progress}%` }} />
                                    </div>
                                  </div>

                                  {inspection.desfase !== null && (
                                      <div className={`rounded-lg border overflow-hidden ${inspection.desfase === '1' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-2 px-3 py-2">
                              <span className={`text-sm font-medium ${inspection.desfase === '1' ? 'text-amber-700' : 'text-gray-600'}`}>
                                Desfase: {inspection.desfase === '1' ? 'Sí' : 'No'}
                              </span>
                                        </div>
                                        {inspection.desfase === '1' && inspection.fechaInspeccion && inspection.fechaCreacion && (
                                            <div className="px-3 pb-2 space-y-1">
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className="text-amber-600 font-medium w-32">Fecha inspección:</span>
                                                <span className="text-amber-800">
                                    {new Date(inspection.fechaInspeccion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                                                  {new Date(inspection.fechaInspeccion).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className="text-amber-600 font-medium w-32">Fecha registro:</span>
                                                <span className="text-amber-800">
                                    {new Date(inspection.fechaCreacion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                                                  {new Date(inspection.fechaCreacion).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                              </div>
                                            </div>
                                        )}
                                      </div>
                                  )}

                                  {inspection.observacionesAvance?.trim() && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <MessageSquare className="w-4 h-4 text-[#0066CC]" />
                                          <h5 className="text-sm font-semibold text-[#003D7A]">Comentarios de Avance</h5>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                          <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{inspection.observacionesAvance}</p>
                                        </div>
                                      </div>
                                  )}

                                  {inspection.observations?.trim() && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-orange-500" />
                                          <h5 className="text-sm font-semibold text-[#003D7A]">Observaciones de Inspección</h5>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${inspection.status === 'no-conforme' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                                          <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{inspection.observations}</p>
                                        </div>
                                      </div>
                                  )}

                                  {inspection.solicitaParalizacion && (
                                      <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                                        <div className="flex items-start gap-3">
                                          <AlertOctagon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                          <div className="flex-1">
                                            <p className="text-sm font-semibold text-orange-900 mb-1">Solicitud de Paralización</p>
                                            <p className="text-xs text-orange-700">Estado: {inspection.estadoParalizacion ?? 'Pendiente de revisión'}</p>
                                            {inspection.motivoParalizacion?.trim() && (
                                                <p className="text-sm text-orange-800 mt-2 leading-relaxed">{inspection.motivoParalizacion}</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                  )}

                                  {inspection.inspectorEmail && (
                                      <div className="pt-3 border-t border-gray-100">
                                        <p className="text-xs text-[#4A4A4A] mb-1">Contacto del inspector</p>
                                        <a href={`mailto:${inspection.inspectorEmail}`} className="text-sm text-[#0066CC] hover:underline">{inspection.inspectorEmail}</a>
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
                        {filtrosActivos > 0 ? <Search className="w-10 h-10 text-gray-400" /> : <FileText className="w-10 h-10 text-gray-400" />}
                      </div>
                      <p className="text-[#003D7A] font-medium mb-2">
                        {filtrosActivos > 0 ? 'Sin resultados para los filtros aplicados' : 'No hay inspecciones registradas'}
                      </p>
                      {filtrosActivos > 0
                          ? <button onClick={limpiarFiltros} className="text-sm text-[#0066CC] hover:underline">Limpiar filtros</button>
                          : <p className="text-sm text-[#4A4A4A]">Presiona el botón + para crear una nueva inspección</p>
                      }
                    </div>
                )}
              </div>
          )}

          {/* ── TAB: DOCUMENTOS ── */}
          {activeTab === 'documentos' && (
              <div className="space-y-4">
                {!loadingArchivos && !errorArchivos && archivosList.length > 0 && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-[#4A4A4A] mb-2">Ordenar por:</p>
                      <div className="flex gap-2">
                        {(['fecha', 'nombre', 'tipo'] as const).map(field => (
                            <button key={field} onClick={() => handleSort(field)}
                                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm capitalize transition-colors ${sortBy === field ? 'bg-[#0066CC] text-white' : 'bg-gray-100 text-[#4A4A4A]'}`}>
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
                      <button onClick={() => recargarArchivos(solicitudId)} className="mt-3 text-sm text-[#0066CC] hover:underline">Reintentar</button>
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
                                <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium border ${badgeColor}`}>{archivo.tipoDocumento}</span>
                                <p className="text-xs text-[#4A4A4A] mt-2">Modificado: {new Date(archivo.modified).toLocaleDateString('es-CL')} por {archivo.modifiedBy}</p>
                                {archivo.estado && <p className="text-xs text-[#4A4A4A] mt-1">Estado: {archivo.estado}</p>}
                              </div>
                              <div className="flex-shrink-0">
                                <a href={archivo.link} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center justify-center w-10 h-10 bg-[#0066CC] rounded-lg text-white active:scale-95 transition-transform" title="Abrir en SharePoint">
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

        {/* FAB — cambia a "Cerrar Obra" cuando el avance llega al 100% */}
        {ultimaInspeccion?.progress === 100 ? (
            <button
                onClick={() => onCierreObra(solicitud)}
                className="fixed bottom-20 right-4 flex items-center gap-2 h-14 px-5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-full shadow-lg active:scale-95 transition-transform z-30 font-semibold"
                aria-label="Cerrar Obra"
            >
              <Lock className="w-5 h-5 flex-shrink-0" />
              <span>Término de Ejecución de Obra</span>
            </button>
        ) : (
            <FloatingActionButton
                onClick={() => onNewInspection(solicitud)}
                icon={<Plus className="w-6 h-6" />}
                label="Inspección"
            />
        )}

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
