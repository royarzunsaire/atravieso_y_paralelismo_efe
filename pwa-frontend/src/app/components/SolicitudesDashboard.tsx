import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Header } from './Header';
import { SolicitudCard } from './SolicitudCard';
import { Button } from './Button';
import { solicitudesService } from '@/services/solicitudes';
import { inspeccionesService } from '@/services/inspecciones';
import type { Solicitud } from '@/types/solicitud.ts';

// ========================================
// INTERFACES
// ========================================

interface Stats {
  total: number;
  porEstado: Record<string, number>;
  porPrioridad: {
    Alta: number;
    Media: number;
    Baja: number;
  };
  conAdjuntos: number;
  finalizadas: number;
}

/** Resumen del último avance para mostrar en la card del listado */
interface UltimoAvance {
  avance: number;
  estado: 'conforme' | 'no-conforme' | null;
}

interface SolicitudesDashboardProps {
  onSolicitudSelect: (solicitudId: number) => void;
  onLogout: () => void;
}

// ========================================
// HELPER
// ========================================

/**
 * Dada una lista de inspecciones, retorna el avance y estado de la más reciente.
 * Ordena por fechaInspeccion → fechaCreacion como fallback.
 */
function calcularUltimoAvance(inspecciones: any[]): UltimoAvance {
  if (!inspecciones.length) return { avance: 0, estado: null };

  const ultima = [...inspecciones].sort((a, b) => {
    const ta = new Date(a.fechaInspeccion ?? a.fechaCreacion ?? 0).getTime();
    const tb = new Date(b.fechaInspeccion ?? b.fechaCreacion ?? 0).getTime();
    return tb - ta;
  })[0];

  return {
    avance: Number(ultima.progress) || 0,
    estado: (ultima.status === 'no-conforme' ? 'no-conforme' : 'conforme') as UltimoAvance['estado'],
  };
}

// ========================================
// COMPONENTE
// ========================================

export function SolicitudesDashboard({ onSolicitudSelect, onLogout }: SolicitudesDashboardProps) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByUser, setFilterByUser] = useState<boolean>();
  const [stats, setStats] = useState<Stats | null>(null);

  /**
   * Mapa de avances: solicitudId → { avance, estado } | null (cargando).
   * null = aún no terminó el fetch de inspecciones para esa solicitud.
   * { avance: 0, estado: null } = sin inspecciones.
   */
  const [avancesMap, setAvancesMap] = useState<Record<number, UltimoAvance | null>>({});

  // ── Fetch de avances ────────────────────────────────────────

  /**
   * Para cada solicitud, pide sus inspecciones en paralelo y actualiza
   * el mapa de avances conforme van resolviendo (una a una, sin bloquear).
   * Usa la caché de requestCache.js, por lo que si el usuario abre una
   * solicitud después, no vuelve a fetchear.
   */
  const cargarAvances = useCallback(async (lista: Solicitud[]) => {
    if (!lista.length) return;

    // Inicializar todas como null (cargando)
    const inicial: Record<number, UltimoAvance | null> = {};
    lista.forEach(s => { inicial[s.id] = null; });
    setAvancesMap(inicial);

    // Fetch en paralelo — cada Promise actualiza su entrada al resolver
    lista.forEach(solicitud => {
      inspeccionesService
          .getBySolicitudId(solicitud.id, { forceRefresh: false })
          .then((inspecciones: any[]) => {
            const resumen = calcularUltimoAvance(Array.isArray(inspecciones) ? inspecciones : []);
            setAvancesMap(prev => ({ ...prev, [solicitud.id]: resumen }));
          })
          .catch(() => {
            // En caso de error mostramos 0% para no dejar en estado null
            setAvancesMap(prev => ({ ...prev, [solicitud.id]: { avance: 0, estado: null } }));
          });
    });
  }, []);

  // ── Cargar solicitudes ──────────────────────────────────────

  const loadSolicitudes = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = await solicitudesService.getAll(filterByUser, { forceRefresh });
      setSolicitudes(data);
      // Disparar avances sin bloquear el render de la lista
      void cargarAvances(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  }, [filterByUser, cargarAvances]);

  const loadStats = useCallback(async (forceRefresh = false) => {
    try {
      const data = await solicitudesService.getStats({ forceRefresh });
      setStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  }, []);

  // ── Efectos ─────────────────────────────────────────────────

  useEffect(() => {
    void loadSolicitudes();
    if (filterByUser) void loadStats();
  }, [filterByUser, loadSolicitudes, loadStats]);

  // ── Refresh ─────────────────────────────────────────────────

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      if (filterByUser) {
        const [solicitudesData] = await Promise.all([
          solicitudesService.getAll(filterByUser, { forceRefresh: true }),
          loadStats(true),
        ]);
        setSolicitudes(solicitudesData);
        void cargarAvances(solicitudesData);
      } else {
        const data = await solicitudesService.getAll(filterByUser, { forceRefresh: true });
        setSolicitudes(data);
        void cargarAvances(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtro de búsqueda ──────────────────────────────────────

  const filteredSolicitudes = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return solicitudes.filter(solicitud => (
        (solicitud.codigo?.toLowerCase().includes(searchLower)) ||
        (solicitud.cliente?.toLowerCase().includes(searchLower)) ||
        (solicitud.comuna?.toLowerCase().includes(searchLower)) ||
        (solicitud.estadoSolicitud?.toLowerCase().includes(searchLower)) ||
        (solicitud.responsable?.nombre.toLowerCase().includes(searchLower))
    ));
  }, [solicitudes, searchQuery]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <Header
            title="Solicitudes AyP"
            showLogout={true}
            onLogout={onLogout}
        />

        <div className="p-4 space-y-4">
          {/* Barra de búsqueda y filtros */}
          <div className="space-y-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A4A4A]" />
              <input
                  type="text"
                  placeholder="Buscar por código, cliente, ubicación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border border-[#003D7A]/10 focus:outline-none focus:ring-2 focus:ring-[#0066CC] transition-shadow"
              />
            </div>

            {/* Botón de refresh */}
            <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={handleRefresh}
                disabled={loading}
                icon={<RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />}
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>

          {/* Estadísticas */}
          {stats && filterByUser && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-2xl text-[#0066CC] mb-1">{stats.total}</p>
                  <p className="text-xs text-[#4A4A4A]">Total</p>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-2xl text-red-600 mb-1">{stats.porPrioridad?.Alta || 0}</p>
                  <p className="text-xs text-[#4A4A4A]">Prioridad Alta</p>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-2xl text-green-600 mb-1">{stats.conAdjuntos}</p>
                  <p className="text-xs text-[#4A4A4A]">Con Adjuntos</p>
                </div>
              </div>
          )}

          {/* Manejo de errores */}
          {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
          )}

          {/* Lista de solicitudes */}
          <div className="space-y-3">
            <h2 className="text-[#003D7A] px-1">
              {filterByUser ? 'Mis Solicitudes Asignadas' : 'Todas las Solicitudes'}
              ({filteredSolicitudes.length})
            </h2>

            {loading ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066CC] mx-auto mb-4"></div>
                  <p className="text-[#4A4A4A]">Cargando solicitudes...</p>
                </div>
            ) : filteredSolicitudes.length > 0 ? (
                filteredSolicitudes.map(solicitud => {
                  const avanceData = avancesMap[solicitud.id];
                  // null = aún cargando (undefined para que SolicitudCard no muestre nada aún)
                  // objeto = ya resuelto
                  return (
                      <SolicitudCard
                          key={solicitud.id}
                          solicitud={solicitud}
                          onClick={() => onSolicitudSelect(solicitud.id)}
                          ultimoAvance={avanceData !== null && avanceData !== undefined ? avanceData.avance : undefined}
                          ultimoEstado={avanceData?.estado ?? null}
                      />
                  );
                })
            ) : (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-[#4A4A4A]">
                    {searchQuery
                        ? 'No se encontraron solicitudes con ese criterio de búsqueda'
                        : filterByUser
                            ? 'No tienes solicitudes asignadas'
                            : 'No hay solicitudes registradas'}
                  </p>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}
