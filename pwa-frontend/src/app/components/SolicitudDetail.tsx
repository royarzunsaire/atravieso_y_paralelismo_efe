import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ArrowUp,
  ArrowDown,
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { getEstadoColor, getPrioridadTextColor } from '@/utils/solicitudUtils';
import type { Solicitud, InspeccionDetalle, Archivo, FotoInspeccion } from '@/types/solicitud';
import { getFileIconInfo, getTipoDocumentoBadgeColor, isImageFile } from '@/utils/fileUtils';
import { formatearFechaCL, formatearFechaHoraCL, diasDesdeCL } from '@/utils/fechas';
import { PhotosModal } from './PhotosModal';
import { InformesModal } from './InformesModal';
import { useSolicitudContext } from '@/context/SolicitudContext';
import { useInicio } from '@/context/InicioContext';
import { inspeccionesService } from '@/services/inspecciones';
import { detalleService } from '@/services/detalleService';
import { detalleCache } from '@/services/detalleCache';
import { fotosBlobCache } from '@/services/fotosBlobCache';
import { mapInspeccionApi, mapInspeccionCompleta, mapFotoOInformeApi, mapDocumentoApi } from '@/utils/mapDetalle';
import { mapObraToSolicitud, calcularDiasDetencion } from '@/utils/mapInicio';
import { BannerDetencion } from './BannerDetencion';
import { useMotivoDetencion } from '@/utils/useMotivoDetencion';
import { ControlObra } from './ControlObra';
import { BotonDescargar } from './BotonDescargar';
import { TramitePendienteCard } from './TramitePendienteCard';
import { ValidarInformeCard } from './ValidarInformeCard';
import { EsperaCard } from './EsperaCard';
import { faltaActaInicio, estadoPermiteInspecciones, esperaAprobacionRecepcion, hayTipoInspeccionHabilitado } from '@/utils/obraIniciada';
import { useProgreso } from '@/context/ProgresoContext';
import { tramitePendiente, tramitesNuevos, puedeValidarInforme, esperaValidacionInforme } from '@/utils/tramitesObra';
import { cambiosDesdeDetalle } from '@/utils/refrescarObra';

// Flag de migración (spec 10): en v2 aparece la pestaña "Control de obra".
const USE_API_V2 = import.meta.env.VITE_USE_API_V2 === 'true';

type TabId = 'info' | 'documentos' | 'inspections' | 'control';

interface SolicitudDetailProps {
  solicitudId: number;
  onBack: () => void;
  onNewInspection: (solicitud: Solicitud, minimoAvance: number) => void;
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

// Etiquetas de los botones "Ordenar por" en Documentos — "categoria" es el
// tipo de documento de negocio (Acta de Recepción, etc.), "formato" es la
// extensión del archivo (pdf, txt, docx...).
const SORT_LABELS: Record<'fecha' | 'nombre' | 'categoria' | 'formato', string> = {
  fecha: 'Fecha',
  nombre: 'Nombre',
  categoria: 'Categoría',
  formato: 'Tipo',
};

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
    solicitudActual,
    inspecciones: inspeccionesV1, archivos: archivosV1,
    fotos: fotosV1, fotosLoadingIds: fotosLoadingIdsV1,
    informes: informesV1, informesLoadingIds: informesLoadingIdsV1,
    loadingSolicitud: loadingSolicitudV1, loadingInspecciones: loadingInspeccionesV1, loadingArchivos: loadingArchivosV1,
    errorSolicitud: errorSolicitudV1, errorInspecciones: errorInspeccionesV1, errorArchivos: errorArchivosV1,
    cargarSolicitud, recargarInspecciones: recargarInspeccionesV1, recargarArchivos: recargarArchivosV1,
  } = useSolicitudContext();

  const inicio = useInicio();
  const { conProgreso, mostrarError } = useProgreso();
  const inicioRef = useRef(inicio);
  inicioRef.current = inicio;

  // En v2, "Información" sale directo de InicioContext (ya cargado en
  // memoria desde que se abrió la app) en vez de SolicitudContext (que
  // dispara los flows viejos de Power Automate) — así el detalle abre
  // instantáneo, sin esperar ningún fetch nuevo para esta pestaña.
  const obraV2 = USE_API_V2 ? inicio.getObra(solicitudId) : null;
  const solicitud = USE_API_V2 ? (obraV2 ? mapObraToSolicitud(obraV2) : null) : solicitudActual;
  const loadingSolicitud = USE_API_V2 ? false : loadingSolicitudV1;
  // CU-10: motivo de la detención vigente (solo en Ctrl. Obra).
  const { motivo: motivoDetencion, cargando: cargandoMotivo } = useMotivoDetencion(solicitudId, USE_API_V2 ? obraV2?.Detencion?.FechaDetencionActual : null);
  // CU-15: sin acta de inicio no hay Ctrl. Obra ni inspecciones.
  const obraSinActa = USE_API_V2 && !!obraV2 && faltaActaInicio(obraV2, inicio.catalogo);
  // CU-16: trámite documental pendiente (acta de inicio / acta de recepción firmada): aviso en Información.
  const tramite = USE_API_V2 && obraV2 ? tramitePendiente(obraV2, inicio.catalogo) : null;
  // CU-28: acciones nuevas que la API habilita y la app no conoce de antemano → tarjeta genérica.
  const tramitesNuevosObra = USE_API_V2 && obraV2 ? tramitesNuevos(obraV2, inicio.catalogo) : [];
  // CU-18: acta de recepción enviada → solo queda esperar la aprobación del líder.
  const esperaLider = USE_API_V2 && !!obraV2 && esperaAprobacionRecepcion(obraV2, inicio.catalogo);
  // CU-19: el Supervisor valida el informe final; quien no puede, solo espera.
  const validaInforme = USE_API_V2 && puedeValidarInforme(obraV2);
  const esperaInforme = USE_API_V2 && !validaInforme && esperaValidacionInforme(obraV2, inicio.catalogo);
  // CU-17: desde la finalización («En recepción de obra» en adelante) no se aceptan más inspecciones.
  const obraCerrada = USE_API_V2 && !!obraV2 && !obraSinActa && !estadoPermiteInspecciones(obraV2, inicio.catalogo);
  // Solo se puede abrir «+ Inspección» si la API habilita al menos un tipo de inspección.
  const hayTipoInspeccion = !USE_API_V2 || hayTipoInspeccionHabilitado(obraV2, inicio.catalogo);

  // CU-09: inicio de obra y días corridos (calendario de Chile) en "Información".
  const fechaInicioObra = obraV2 ? formatearFechaCL(obraV2.FechaInicioObra) : '';
  const diasObra = obraV2 ? diasDesdeCL(obraV2.FechaInicioObra) : null;
  const errorSolicitud = USE_API_V2
    ? (obraV2 ? null : 'No se pudo cargar la información de la obra.')
    : errorSolicitudV1;

  // ── Etapa B (spec 13): en v2, inspecciones/documentos/fotos/informes
  // vienen de API_Detalle en un solo llamado (no del SolicitudContext
  // viejo, que sigue activo solo para la pestaña Información). Las URLs
  // de archivos son directas a SharePoint y expiran ~1h — no se cachean
  // más allá de esta carga de pantalla.
  const [detalleV2, setDetalleV2] = useState<{
    inspecciones: InspeccionDetalle[];
    archivos: Archivo[];
    fotos: Record<string, FotoInspeccion[]>;
    informes: Record<string, FotoInspeccion[]>;
    comentarioDevolucion: string | null;
    loading: boolean;
    error: string | null;
    /** El detalle respondió 403: el usuario no tiene rol en esta obra (no sirve reintentar). */
    sinAcceso: boolean;
  }>({ inspecciones: [], archivos: [], fotos: {}, informes: {}, comentarioDevolucion: null, loading: false, error: null, sinAcceso: false });

  // ── Detalle completo de cada inspección, en segundo plano ────────────
  // El detalle de obra ahora es un resumen (sin comentario, fotos ni
  // documentos de la inspección). Esos datos se piden aparte por
  // inspección (GET /inspecciones/{id}) en una cola con concurrencia 3,
  // de la más reciente a la más antigua, y se completan en la tarjeta.
  // `fotos`/`informes` solo tienen entrada para las inspecciones ya
  // completas: eso distingue "cargando" de "sin fotos".
  const [inspCargando, setInspCargando] = useState<Set<string>>(new Set());
  const enVueloRef = useRef<Map<string, Promise<void>>>(new Map());
  const generacionRef = useRef(0);

  const cargarInspeccionCompleta = useCallback(
    (inspId: string, gen: number, forzar = false): Promise<void> => {
      const existente = enVueloRef.current.get(inspId);
      if (existente) return existente;

      setInspCargando((prev) => new Set(prev).add(inspId));
      const promesa = detalleService
        .getInspeccion(Number(inspId), { forzar })
        .then((completa) => {
          if (gen !== generacionRef.current) return; // se cambió de obra mientras cargaba
          const { patch, fotos: fotosInsp, informes: informesInsp } = mapInspeccionCompleta(completa);
          setDetalleV2((prev) => ({
            ...prev,
            inspecciones: prev.inspecciones.map((i) => (i.id === inspId ? { ...i, ...patch } : i)),
            fotos: { ...prev.fotos, [inspId]: fotosInsp },
            informes: { ...prev.informes, [inspId]: informesInsp },
          }));
          // Precarga de blobs: comparte cache con PhotosModal.
          fotosInsp.forEach((f) => { if (f.url) fotosBlobCache.prefetch(f.url); });
        })
        .catch(() => {
          // Queda con el resumen; se reintenta al expandir la tarjeta.
        })
        .finally(() => {
          if (enVueloRef.current.get(inspId) === promesa) enVueloRef.current.delete(inspId);
          setInspCargando((prev) => {
            const next = new Set(prev);
            next.delete(inspId);
            return next;
          });
        });
      enVueloRef.current.set(inspId, promesa);
      return promesa;
    },
    []
  );

  // Al salir de la pantalla se invalida la cola en curso.
  useEffect(() => () => { generacionRef.current++; }, []);

  const iniciarCargaInspecciones = useCallback(
    (ids: string[], forzar = false) => {
      const gen = ++generacionRef.current;
      enVueloRef.current.clear();
      const pendientes = [...ids];
      const trabajador = async () => {
        while (gen === generacionRef.current) {
          const inspId = pendientes.shift();
          if (!inspId) return;
          await cargarInspeccionCompleta(inspId, gen, forzar);
        }
      };
      for (let i = 0; i < Math.min(3, pendientes.length); i++) void trabajador();
    },
    [cargarInspeccionCompleta]
  );

  // Aplica una respuesta del detalle de obra ya obtenida (fresca o del
  // cache) al estado y lanza la carga en segundo plano de cada inspección.
  const aplicarDatosDetalle = useCallback((id: number, data: any, forzar = false) => {
    // CU-05: si este detalle es MÁS RECIENTE que lo que la pantalla sabe de la obra (la API a veces
    // tarda más que los reintentos del refresco), la obra se actualiza también (estado, acciones…).
    // Uno más viejo o igual se ignora: nunca se revierte un estado ya actualizado por el evento.
    const fueDetalle = data?.Solicitud?.FechaUltimoEvento as string | undefined;
    const obraActual = inicioRef.current.getObra(id);
    if (fueDetalle && obraActual
        && (!obraActual.FechaUltimoEvento || new Date(fueDetalle).getTime() > new Date(obraActual.FechaUltimoEvento).getTime())) {
      inicioRef.current.actualizarObra(id, cambiosDesdeDetalle(data));
    }
    const codigo = data.Solicitud?.Codigo ?? '';
    const inspeccionesApi = data.Inspecciones ?? [];
    // Solo hay entrada si el listado todavía trajera Fotos/Informes inline
    // (compatibilidad); normalmente quedan vacíos hasta completar cada una.
    const fotosMap: Record<string, FotoInspeccion[]> = {};
    const informesMap: Record<string, FotoInspeccion[]> = {};
    for (const insp of inspeccionesApi) {
      if (insp.Fotos) fotosMap[String(insp.Id)] = insp.Fotos.map(mapFotoOInformeApi);
      if (insp.Informes) informesMap[String(insp.Id)] = insp.Informes.map(mapFotoOInformeApi);
    }
    setDetalleV2({
      inspecciones: inspeccionesApi.map((i: any) => mapInspeccionApi(i, id, codigo)),
      archivos: (data.Documentos ?? []).map(mapDocumentoApi),
      fotos: fotosMap,
      informes: informesMap,
      comentarioDevolucion: data.ComentarioDevolucion ?? null,
      loading: false,
      error: null,
      sinAcceso: false,
    });

    // Precarga en segundo plano (mejora de performance): fetch() directo
    // al gateway del cliente, no <img> (bloqueado por CORP — ver spec 13).
    // Comparte cache con PhotosModal, así que si el usuario abre el modal
    // después, ya está lista.
    Object.values(fotosMap).flat().forEach((foto) => {
      if (foto.url) fotosBlobCache.prefetch(foto.url);
    });

    // Más reciente primero: es lo que el usuario ve arriba en el listado.
    const idsPorRecencia = [...inspeccionesApi]
      .sort((a: any, b: any) => new Date(b.Fecha ?? 0).getTime() - new Date(a.Fecha ?? 0).getTime())
      .map((i: any) => String(i.Id));
    iniciarCargaInspecciones(idsPorRecencia, forzar);
  }, [iniciarCargaInspecciones]);

  const cargarDetalleV2 = useCallback(async (id: number, opts: { forzar?: boolean } = {}) => {
    if (!opts.forzar) {
      const cacheado = detalleCache.get(id);
      if (cacheado) {
        aplicarDatosDetalle(id, cacheado.data);
        return;
      }
    }
    setDetalleV2((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await detalleService.getDetalle(id);
      detalleCache.set(id, data);
      aplicarDatosDetalle(id, data, opts.forzar);
    } catch (err) {
      setDetalleV2((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'No se pudo cargar el detalle de la obra.',
        sinAcceso: (err as { code?: string })?.code === 'SIN_ACCESO',
      }));
    }
  }, [aplicarDatosDetalle]);

  const inspeccionesList: InspeccionDetalle[] = USE_API_V2 ? detalleV2.inspecciones : (inspeccionesV1[solicitudId] ?? []);
  const archivosList: Archivo[] = USE_API_V2 ? detalleV2.archivos : (archivosV1[solicitudId] ?? []);
  const fotos = USE_API_V2 ? detalleV2.fotos : fotosV1;
  const fotosLoadingIds = USE_API_V2 ? inspCargando : fotosLoadingIdsV1;
  const informes = USE_API_V2 ? detalleV2.informes : informesV1;
  const informesLoadingIds = USE_API_V2 ? inspCargando : informesLoadingIdsV1;
  const loadingInspecciones = USE_API_V2 ? detalleV2.loading : loadingInspeccionesV1;
  const loadingArchivos = USE_API_V2 ? detalleV2.loading : loadingArchivosV1;
  const errorInspecciones = USE_API_V2 ? detalleV2.error : errorInspeccionesV1;
  const errorArchivos = USE_API_V2 ? detalleV2.error : errorArchivosV1;
  const recargarInspecciones = USE_API_V2
    ? (id: number) => cargarDetalleV2(id, { forzar: true })
    : recargarInspeccionesV1;
  const recargarArchivos = USE_API_V2
    ? (id: number) => cargarDetalleV2(id, { forzar: true })
    : recargarArchivosV1;

  // Documentos recién subidos: la API tarda en mostrarlos. El refresco los espera en segundo plano (refrescarObra.ts)
  // y al llegar se guardan en el caché: acá se completa la pestaña «Documentos» sola, sin recargar nada más.
  const [, setTickDocs] = useState(0);
  useEffect(() => {
    if (!USE_API_V2) return;
    return detalleCache.suscribir(() => {
      setTickDocs((t) => t + 1);
      const data = detalleCache.get(solicitudId)?.data;
      if (!data || data.Solicitud?.Id !== solicitudId) return;
      const docs = (data.Documentos ?? []).map(mapDocumentoApi);
      setDetalleV2((prev) => {
        const mismos = prev.archivos.length === docs.length
          && prev.archivos.every((a, i) => a.name === docs[i].name);
        return mismos ? prev : { ...prev, archivos: docs };
      });
    });
  }, [solicitudId]);
  const esperandoDocumentos = USE_API_V2 && detalleCache.esperaDocumentos(solicitudId);

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (obraSinActa && activeTab === 'control') setActiveTab('info');
  }, [obraSinActa, activeTab]);
  // En v2 la API no manda fecha de modificación de documentos (spec 13) —
  // "Ordenar por fecha" no tendría ningún efecto, se arranca por nombre.
  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'categoria' | 'formato'>(USE_API_V2 ? 'nombre' : 'fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filtros, setFiltros] = useState<InspeccionFiltros>(FILTROS_INICIALES);
  const [showEstadoMenu, setShowEstadoMenu] = useState(false);
  const [showTipoMenu, setShowTipoMenu] = useState(false);
  const [showDesfaseMenu, setShowDesfaseMenu] = useState(false);
  const [showParalizacionMenu, setShowParalizacionMenu] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [currentInspectionForPhotos, setCurrentInspectionForPhotos] = useState<{ id: string; title: string } | null>(null);
  const [isInformesModalOpen, setIsInformesModalOpen] = useState(false);
  const [currentInspectionForInformes, setCurrentInspectionForInformes] = useState<{ id: string; title: string } | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (USE_API_V2) {
      // La Información ya está en InicioContext (instantánea); solo falta
      // el detalle (inspecciones/documentos) vía API_Detalle.
      cargarDetalleV2(solicitudId);
    } else {
      cargarSolicitud(solicitudId);
    }
    setActiveTab('info');
    setExpandedCards(new Set());
    setFiltros(FILTROS_INICIALES);
  }, [solicitudId, cargarSolicitud, cargarDetalleV2]);

  const tiposUnicos = useMemo(() => {
    const tipos = inspeccionesList.map(i => i.type).filter(Boolean);
    return Array.from(new Set(tipos)).sort();
  }, [inspeccionesList]);

  // Los archivos ya vienen filtrados por tipo desde el flow de Power Automate
  const archivosPermitidos = archivosList;

  // Última inspección por fechaInspeccion (fallback a fechaCreacion)
  const ultimaInspeccion = useMemo(() => {
    if (!inspeccionesList.length) return null;
    return [...inspeccionesList].sort((a, b) => {
      const dateA = new Date(a.fechaInspeccion ?? a.fechaCreacion ?? 0).getTime();
      const dateB = new Date(b.fechaInspeccion ?? b.fechaCreacion ?? 0).getTime();
      return dateB - dateA;
    })[0];
  }, [inspeccionesList]);

  // Avance de referencia (CU-13): en v2 es el de la OBRA (el mismo que ven el
  // dashboard y Ctrl. Obra), no el de la última inspección, porque detención,
  // reactivación y finalización llegan de la API con 0 % y arrastrarían a 0 el
  // formulario y la tarjeta de progreso. Solo si la obra viniera en 0 se usa la
  // última inspección con avance mayor a 0 (por fecha).
  const avanceReferencia = useMemo(() => {
    if (!USE_API_V2) return ultimaInspeccion?.progress ?? 0;
    const deObra = Math.round(obraV2?.AvanceObraPct ?? 0);
    if (deObra > 0) return deObra;
    const conAvance = [...inspeccionesList]
      .filter((i) => Number(i.progress) > 0)
      .sort((a, b) => new Date(b.fechaInspeccion ?? b.fechaCreacion ?? 0).getTime() - new Date(a.fechaInspeccion ?? a.fechaCreacion ?? 0).getTime());
    return Number(conAvance[0]?.progress) || 0;
  }, [inspeccionesList, obraV2, ultimaInspeccion]);

  // CU-29: si el detalle no se pudo leer, la tarjeta de progreso no inventa «0 % / sin inspecciones»: muestra el avance de la obra.
  const detalleNoLeido = USE_API_V2 && !!detalleV2.error;
  const avanceSinDetalle = detalleNoLeido ? Math.round(obraV2?.AvanceObraPct ?? 0) : 0;

  const inspeccionesFiltradas = useMemo(() => {
    return inspeccionesList
      .filter(i => {
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
      })
      // Más reciente primero — la API no garantiza el orden de entrega.
      .sort((a, b) => {
        const ta = new Date(a.fechaInspeccion ?? a.fechaCreacion ?? 0).getTime();
        const tb = new Date(b.fechaInspeccion ?? b.fechaCreacion ?? 0).getTime();
        return tb - ta;
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
    // v2: si esta inspección aún no completó su detalle (comentario, fotos),
    // se pide ya, sin esperar su turno en la cola.
    if (USE_API_V2 && !(inspectionId in detalleV2.fotos)) {
      void cargarInspeccionCompleta(inspectionId, generacionRef.current);
    }
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(inspectionId) ? next.delete(inspectionId) : next.add(inspectionId);
      return next;
    });
  };

  const handleSort = (newSortBy: 'fecha' | 'nombre' | 'categoria' | 'formato') => {
    if (sortBy === newSortBy) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(newSortBy); setSortOrder('desc'); }
  };

  const getExtension = (fileName: string): string => fileName.split('.').pop()?.toLowerCase() ?? '';

  const getSortedArchivos = (): Archivo[] => {
    return [...archivosPermitidos].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fecha') cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      else if (sortBy === 'nombre') cmp = a.fileName.localeCompare(b.fileName);
      else if (sortBy === 'formato') cmp = getExtension(a.fileName).localeCompare(getExtension(b.fileName));
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

  const handleReintentarSync = async (oracleId: string) => {
    setRetryingIds(prev => new Set(prev).add(oracleId));
    setRetryErrors(prev => { const next = { ...prev }; delete next[oracleId]; return next; });
    try {
      await inspeccionesService.reintentar(oracleId);
      await recargarInspecciones(solicitudId);
    } catch (error) {
      setRetryErrors(prev => ({ ...prev, [oracleId]: error instanceof Error ? error.message : 'No se pudo sincronizar' }));
    } finally {
      setRetryingIds(prev => { const next = new Set(prev); next.delete(oracleId); return next; });
    }
  };

  const openInformesModal = (inspection: InspeccionDetalle) => {
    if (!inspection?.id) return;
    setCurrentInspectionForInformes({ id: String(inspection.id), title: String(inspection.type) });
    setIsInformesModalOpen(true);
  };
  const closeInformesModal = () => { setIsInformesModalOpen(false); setCurrentInspectionForInformes(null); };

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

  // CU-23: al tocar «+ Inspección» se consulta a la API qué tipos están habilitados AHORA para esta obra
  // (no se confía en la lista guardada). Si la consulta falla: popup con «Reintentar» y
  // «Continuar con los datos guardados».
  const abrirNuevaInspeccion = () => {
    if (!USE_API_V2) {
      onNewInspection(solicitud, avanceReferencia);
      return;
    }
    void conProgreso(
      {
        mensaje: 'Consultando tipos de inspección habilitados…',
        tituloError: 'No se pudieron consultar los tipos de inspección',
        alReintentar: abrirNuevaInspeccion,
        accionAlternativa: {
          texto: 'Continuar con los datos guardados',
          alElegir: () => onNewInspection(solicitud, avanceReferencia),
        },
      },
      async () => {
        const fresca = await inicio.actualizarObraDesdeApi(solicitudId);
        if (!fresca || !hayTipoInspeccionHabilitado(fresca, inicio.catalogo) || !estadoPermiteInspecciones(fresca, inicio.catalogo) || faltaActaInicio(fresca, inicio.catalogo)) {
          // Ya no corresponde: se avisa (sin ofrecer seguir con datos viejos) y no se abre el formulario.
          mostrarError(new Error('La obra cambió de estado: ya no admite nuevas inspecciones.'), 'No se puede registrar una inspección');
          return;
        }
        const avance = Math.round(fresca.AvanceObraPct ?? 0);
        onNewInspection(solicitud, avance > 0 ? avance : avanceReferencia);
      },
    );
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'documentos', label: 'Documentos' },
    // En modo v2, el control de obra (detener/reactivar/cierre) tiene su
    // propia pestaña, antes de Inspecciones.
    ...(USE_API_V2 && !obraSinActa ? [{ id: 'control' as TabId, label: 'Ctrl. Obra' }] : []),
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

        {/* CU-07: obra detenida siempre visible, en todas las pestañas */}
        {USE_API_V2 && obraV2?.Detencion?.FechaDetencionActual && (
          <BannerDetencion dias={calcularDiasDetencion(obraV2.Detencion)} />
        )}

        {/* Tabs */}
        <div className="sticky top-14 z-40 bg-white border-b border-[#003D7A]/10 shadow-sm">
          <div className="flex">
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 basis-0 min-w-0 h-12 flex items-center justify-center px-1 text-center text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'text-[#0066CC] border-b-2 border-[#0066CC]' : 'text-[#4A4A4A] border-b-2 border-transparent'}`}>
                  <span className="truncate">{tab.label}</span>
                  {tab.id === 'inspections' && filtrosActivos > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0066CC] text-white text-[10px] flex-shrink-0">{filtrosActivos}</span>
                  )}
                </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ── TAB: INFO ── */}
          {activeTab === 'info' && (
              <div className="space-y-4">

                {/* CU-15/16: trámite pendiente (acta de inicio / recepción firmada): lo primero que se ve es cómo cumplirlo */}
                {/* CU-19: informe final por validar (Supervisor) / en espera de la validación (resto) */}
                {validaInforme && (
                  <ValidarInformeCard
                    solicitudId={solicitudId}
                    informes={archivosList
                      .filter((a) => /informe final/i.test(a.tipoDocumento ?? ''))
                      .map((a) => ({ nombre: a.fileName, url: a.link }))}
                    onRegistrado={() => cargarDetalleV2(solicitudId)}
                  />
                )}
                {esperaInforme && (
                  <EsperaCard
                    titulo="Informe final enviado"
                    texto="Quedó en espera de la validación del informe. Por ahora no hay nada más que hacer en esta obra."
                  />
                )}

                {/* CU-18: acta de recepción enviada, en espera del líder */}
                {esperaLider && !tramite && (
                  <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <h3 className="text-base font-semibold text-[#1A1A1A]">Acta de recepción enviada</h3>
                    </div>
                    <p className="text-base text-[#1A1A1A]">
                      Quedó en espera de la aprobación del líder. Por ahora no hay nada más que hacer en esta obra.
                    </p>
                  </div>
                )}

                {tramite && (
                  <TramitePendienteCard
                    solicitudId={solicitudId}
                    tramite={tramite}
                    comentarioDevolucion={detalleV2.comentarioDevolucion}
                    bloquea={obraSinActa}
                    onRegistrado={() => cargarDetalleV2(solicitudId)}
                  />
                )}

                {tramitesNuevosObra.map((t) => (
                  <TramitePendienteCard
                    key={t.codigo}
                    solicitudId={solicitudId}
                    tramite={t}
                    comentarioDevolucion={null}
                    bloquea={false}
                    onRegistrado={() => cargarDetalleV2(solicitudId)}
                  />
                ))}

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
                          {avanceReferencia}
                        </span>
                              <span className="text-2xl font-bold text-[#0066CC]">%</span>
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex justify-between text-xs text-[#4A4A4A] mb-1.5">
                                <span>Avance registrado</span>
                                <span>{avanceReferencia}%</span>
                              </div>
                              <div className="h-3 bg-[#F5F7FA] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        avanceReferencia >= 75
                                            ? 'bg-gradient-to-r from-[#0066CC] to-green-500'
                                            : 'bg-gradient-to-r from-[#003D7A] to-[#0066CC]'
                                    }`}
                                    style={{ width: `${avanceReferencia}%` }}
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
                              <span>{formatearFechaHoraCL(ultimaInspeccion.fechaInspeccion ?? ultimaInspeccion.fechaCreacion)}</span>
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
                          {/* Sin inspecciones — 0% explícito; si el detalle no se pudo leer, el avance real de la obra (CU-29) */}
                          <div className="flex items-end gap-4 mb-4">
                            <div>
                              <span className="text-5xl font-bold text-[#4A4A4A] leading-none tabular-nums">{avanceSinDetalle}</span>
                              <span className="text-2xl font-bold text-[#4A4A4A]">%</span>
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex justify-between text-xs text-[#4A4A4A] mb-1.5">
                                <span>{detalleNoLeido ? 'Avance de la obra' : 'Avance registrado'}</span>
                                <span>{avanceSinDetalle}%</span>
                              </div>
                              <div className="h-3 bg-[#F5F7FA] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gray-300" style={{ width: `${Math.min(100, avanceSinDetalle)}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-[#003D7A]/10 pt-3">
                            <p className="text-xs text-[#4A4A4A] font-medium uppercase tracking-wide mb-1">
                              {detalleNoLeido ? 'No se pudo leer el detalle de las inspecciones' : 'Sin inspecciones de avance realizadas'}
                            </p>
                            <p className="text-xs text-[#4A4A4A]">
                              {detalleNoLeido
                                ? 'El avance mostrado es el que informa la plataforma para esta obra.'
                                : 'El progreso se actualizará al registrar la primera inspección'}
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
                  {USE_API_V2 && fechaInicioObra && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-[#4A4A4A] mb-1">Inicio de obra</p>
                        <p className="font-medium text-[#1A1A1A]">{fechaInicioObra}</p>
                      </div>
                      {diasObra != null && (
                        <div>
                          <p className="text-sm text-[#4A4A4A] mb-1">Días de obra</p>
                          <p className="font-medium text-[#1A1A1A]">{diasObra} día{diasObra !== 1 ? 's' : ''}</p>
                        </div>
                      )}
                    </div>
                  )}
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

                {/* CU-17: dice por qué ya no está el botón «+ Inspección» */}
                {obraCerrada && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                      <p className="text-base font-medium text-[#1A1A1A]">
                        Esta obra ya fue finalizada y no acepta nuevas inspecciones.
                      </p>
                    </div>
                )}

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

                        {/* Desfase + Paralización — cada uno en su propia línea */}
                        <div className="space-y-2">
                          <div className="relative">
                            <button onClick={() => setShowDesfaseMenu(v => !v)}
                                    className={`w-full flex items-center justify-between h-12 px-4 rounded-xl border-2 text-base font-medium transition-all active:scale-[0.98] shadow-sm ${currentDesfase.chipColors}`}>
                        <span className="flex items-center gap-2">
                          <Clock className="w-5 h-5 flex-shrink-0" />
                          <span className="truncate">{currentDesfase.label}</span>
                        </span>
                              <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${showDesfaseMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showDesfaseMenu && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowDesfaseMenu(false)} />
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                    {DESFASE_OPTIONS.map(opt => (
                                        <button key={opt.value}
                                                onClick={() => { setFiltros(f => ({ ...f, desfase: opt.value })); setShowDesfaseMenu(false); }}
                                                className={`w-full flex items-center gap-3 py-4 px-5 text-left text-base font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.desfase === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
                                          <span className="flex-1">{opt.label}</span>
                                          {filtros.desfase === opt.value && <CheckCircle2 className="w-4 h-4 text-[#0066CC] flex-shrink-0" />}
                                        </button>
                                    ))}
                                  </div>
                                </>
                            )}
                          </div>

                          <div className="relative">
                            <button onClick={() => setShowParalizacionMenu(v => !v)}
                                    className={`w-full flex items-center justify-between h-12 px-4 rounded-xl border-2 text-base font-medium transition-all active:scale-[0.98] shadow-sm ${currentParalizacion.chipColors}`}>
                        <span className="flex items-center gap-2">
                          <AlertOctagon className="w-5 h-5 flex-shrink-0" />
                          <span className="truncate">{currentParalizacion.label}</span>
                        </span>
                              <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${showParalizacionMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showParalizacionMenu && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowParalizacionMenu(false)} />
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                    {PARALIZACION_OPTIONS.map(opt => (
                                        <button key={String(opt.value)}
                                                onClick={() => { setFiltros(f => ({ ...f, solicitaParalizacion: opt.value })); setShowParalizacionMenu(false); }}
                                                className={`w-full flex items-center gap-3 py-4 px-5 text-left text-base font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.solicitaParalizacion === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
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
                                                  className={`w-full flex items-center gap-3 py-4 px-5 text-left text-base font-medium transition-colors border-b border-gray-100 last:border-b-0 ${filtros.tipoInspeccion === opt.value ? `${opt.listColors} font-semibold` : 'bg-white text-[#4A4A4A] hover:bg-gray-50'}`}>
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
                      {detalleV2.sinAcceso && USE_API_V2
                        ? <p className="mt-2 text-sm text-red-800">Pide que te asignen esta obra como ITO o Supervisor para ver su detalle.</p>
                        : <button onClick={() => recargarInspecciones(solicitudId)} className="mt-3 text-sm text-[#0066CC] hover:underline">Reintentar</button>}
                    </div>
                ) : inspeccionesFiltradas.length > 0 ? (
                    inspeccionesFiltradas.map((inspection) => {
                      const config = STATUS_CONFIG[inspection.status] ?? STATUS_CONFIG['conforme'];
                      const isExpanded = expandedCards.has(inspection.id);
                      const inspeccionIdStr = String(inspection.id);
                      const fotosList = fotos[inspeccionIdStr] ?? [];
                      const fotosLoaded = inspeccionIdStr in fotos;
                      // Si las fotos ya cargaron, derivamos el conteo; si no, usamos el total de SharePoint como fallback
                      const fotosImagenesCount = fotosLoaded ? fotosList.filter(f => isImageFile(f.fileName ?? '')).length : inspection.cantidadFotos;
                      // Informes vienen de su propio listado (DocumentosInspecciones), independiente de fotos
                      const informesCount = (informes[inspeccionIdStr] ?? []).length;
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
                                        <span className="text-xs text-[#4A4A4A]">{formatearFechaHoraCL(inspection.fechaInspeccion ?? inspection.fechaCreacion)}</span>
                                      </div>
                                      {inspection.desfase === '1' && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">Desfase</span>
                                      )}
                                      {inspection.estadoSync === 'pendiente' && (
                                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-[#0066CC] border border-blue-300">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...
                                          </span>
                                      )}
                                      {inspection.estadoSync === 'error' && (
                                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-[#E30613] border border-red-300">
                                            <AlertTriangle className="w-3 h-3" /> Error de sincronización
                                          </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeColor} whitespace-nowrap`}>{config.label}</span>
                              </div>
                              {inspection.estadoSync === 'error' && (() => {
                                // Inspección aún pendiente en Oracle → usar el oracleId puro (sin
                                // el prefijo "outbox-" que trae inspection.id para lectura). Ya
                                // sincronizada (solo archivo con error) → inspection.id ya es el
                                // id real de SharePoint, sin prefijo.
                                const retryId = inspection.oracleId ?? String(inspection.id);
                                return (
                                  <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-xs text-red-800">
                                      No se pudo sincronizar con SharePoint{retryErrors[retryId] ? `: ${retryErrors[retryId]}` : '.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleReintentarSync(retryId)}
                                        disabled={retryingIds.has(retryId)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-[#E30613] text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                                    >
                                      {retryingIds.has(retryId) ? (
                                          <><Loader2 className="w-3 h-3 animate-spin" /> Reintentando...</>
                                      ) : (
                                          <><RefreshCw className="w-3 h-3" /> Reintentar</>
                                      )}
                                    </button>
                                  </div>
                                );
                              })()}
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
                              <div className="grid grid-cols-3 gap-2">
                                {/* Avance */}
                                <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <TrendingUp className="w-5 h-5 text-[#0066CC]" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Avance</p>
                                    <p className="text-lg font-bold text-[#0066CC]">{inspection.progress}%</p>
                                  </div>
                                </div>
                                {/* Fotos — solo imágenes */}
                                <button type="button"
                                        onClick={() => fotosImagenesCount > 0 && openPhotosModal(inspection)}
                                        disabled={fotosImagenesCount === 0}
                                        className={`flex items-center gap-2 text-left ${fotosImagenesCount > 0 ? 'cursor-pointer' : 'opacity-60 cursor-default'}`}>
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Camera className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Fotos</p>
                                    <p className="text-lg font-bold text-purple-600">{fotosImagenesCount}</p>
                                  </div>
                                </button>
                                {/* Informes — PDF/Word, desde DocumentosInspecciones */}
                                <button
                                  type="button"
                                  onClick={() => informesCount > 0 && openInformesModal(inspection)}
                                  disabled={informesCount === 0}
                                  className={`flex items-center gap-2 text-left ${informesCount > 0 ? 'cursor-pointer' : 'opacity-60 cursor-default'}`}
                                >
                                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#4A4A4A]">Informes</p>
                                    <p className="text-lg font-bold text-orange-600">{informesCount}</p>
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

                                  {USE_API_V2 && inspCargando.has(inspeccionIdStr) && (
                                      <div className="flex items-center gap-2 text-xs text-[#4A4A4A]">
                                        <Loader2 className="w-4 h-4 text-[#0066CC] animate-spin" />
                                        Cargando observaciones y archivos...
                                      </div>
                                  )}

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
                                    {formatearFechaHoraCL(inspection.fechaInspeccion)}
                                  </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className="text-amber-600 font-medium w-32">Fecha registro:</span>
                                                <span className="text-amber-800">
                                    {formatearFechaHoraCL(inspection.fechaCreacion)}
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
                {esperandoDocumentos && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-[#0066CC]/30 rounded-lg p-3">
                      <Loader2 className="w-5 h-5 text-[#0066CC] animate-spin flex-shrink-0" />
                      <p className="text-base text-[#003D7A]">Actualizando documentos… el archivo que subiste aparecerá aquí en unos segundos.</p>
                    </div>
                )}
                {!loadingArchivos && !errorArchivos && archivosPermitidos.length > 0 && (
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-[#4A4A4A] mb-2">Ordenar por:</p>
                      <div className="flex gap-2">
                        {(USE_API_V2 ? (['nombre', 'categoria', 'formato'] as const) : (['fecha', 'nombre', 'categoria', 'formato'] as const)).map(field => (
                            <button key={field} onClick={() => handleSort(field)}
                                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${sortBy === field ? 'bg-[#0066CC] text-white' : 'bg-gray-100 text-[#4A4A4A]'}`}>
                              {SORT_LABELS[field]}
                              {sortBy === field && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
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
                      {detalleV2.sinAcceso && USE_API_V2
                        ? <p className="mt-2 text-sm text-red-800">Pide que te asignen esta obra como ITO o Supervisor para ver sus documentos.</p>
                        : <button onClick={() => recargarArchivos(solicitudId)} className="mt-3 text-sm text-[#0066CC] hover:underline">Reintentar</button>}
                    </div>
                ) : archivosPermitidos.length > 0 ? (
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
                                {archivo.modified && (
                                  <p className="text-xs text-[#4A4A4A] mt-2">Modificado: {formatearFechaCL(archivo.modified)} por {archivo.modifiedBy}</p>
                                )}
                                {archivo.estado && <p className="text-xs text-[#4A4A4A] mt-1">Estado: {archivo.estado}</p>}
                              </div>
                            </div>
                            <div className="mt-3"><BotonDescargar url={archivo.link} nombre={archivo.fileName} /></div>
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

          {/* ── TAB: CONTROL DE OBRA (solo v2) ── */}
          {activeTab === 'control' && USE_API_V2 && (
              <ControlObra
                  solicitudId={solicitudId}
                  comentarioDevolucion={detalleV2.comentarioDevolucion}
                  motivoDetencion={motivoDetencion}
                  cargandoMotivo={cargandoMotivo}
                  avancesInspecciones={detalleV2.inspecciones.map((i) => i.progress)}
                  cargandoInspecciones={detalleV2.loading}
                  onEventoRegistrado={() => cargarDetalleV2(solicitudId)}
              />
          )}
        </div>

        {/* FAB — cambia a "Cerrar Obra" cuando el avance llega al 100% */}
        {!USE_API_V2 && ultimaInspeccion?.progress === 100 ? (
            <button
                onClick={() => onCierreObra(solicitud)}
                className="fixed bottom-20 right-4 flex items-center gap-2 h-14 px-5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-full shadow-lg active:scale-95 transition-transform z-30 font-semibold"
                aria-label="Término de Ejecución de Obra"
            >
              <Lock className="w-5 h-5 flex-shrink-0" />
              <span>Término de Ejecución de Obra</span>
            </button>
        ) : obraSinActa || obraCerrada || !hayTipoInspeccion ? null : (
            <FloatingActionButton
                onClick={abrirNuevaInspeccion}
                icon={<Plus className="w-6 h-6" />}
                label="Inspección"
            />
        )}

        {currentInspectionForPhotos && (
            <PhotosModal
                isOpen={isPhotosModalOpen}
                title={`Fotos de ${currentInspectionForPhotos.title}`}
                inspeccionId={currentInspectionForPhotos.id}
                photos={(fotos[currentInspectionForPhotos.id] ?? []).filter(f => isImageFile(f.fileName ?? '')) as FotoInspeccion[]}
                loading={fotosLoadingIds.has(currentInspectionForPhotos.id)}
                error={null}
                onClose={closePhotosModal}
                useDirectUrl={USE_API_V2}
            />
        )}

        {currentInspectionForInformes && (
            <InformesModal
                isOpen={isInformesModalOpen}
                title={`Informes de ${currentInspectionForInformes.title}`}
                informes={informes[currentInspectionForInformes.id] ?? []}
                loading={informesLoadingIds.has(currentInspectionForInformes.id)}
                onClose={closeInformesModal}
            />
        )}
      </div>
  );
}
