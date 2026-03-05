import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Header } from './Header';
import { SolicitudCard } from './SolicitudCard';
import { Button } from './Button';
import { solicitudesService } from '@/services/solicitudes';
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

interface SolicitudesDashboardProps {
  onSolicitudSelect: (solicitudId: number) => void;
  onLogout: () => void;
}

// ========================================
// COMPONENTE - SIN CAMBIOS EN LA LÓGICA
// ========================================

export function SolicitudesDashboard({ onSolicitudSelect, onLogout }: SolicitudesDashboardProps) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByUser, setFilterByUser] = useState<boolean>();
  const [stats, setStats] = useState<Stats | null>(null);

  // Cargar solicitudes al montar
  useEffect(() => {
    loadSolicitudes();
    if (filterByUser) {
      loadStats();
    }
  }, [filterByUser]);

  const loadSolicitudes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await solicitudesService.getAll(filterByUser, { forceRefresh: false });
      setSolicitudes(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await solicitudesService.getStats({ forceRefresh: false });
      setStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      if (filterByUser) {
        const [solicitudesData, statsData] = await Promise.all([
          solicitudesService.getAll(filterByUser, { forceRefresh: true }),
          solicitudesService.getStats({ forceRefresh: true }),
        ]);
        setSolicitudes(solicitudesData);
        setStats(statsData);
      } else {
        const data = await solicitudesService.getAll(filterByUser, { forceRefresh: true });
        setSolicitudes(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar solicitudes por búsqueda
  const filteredSolicitudes = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return solicitudes.filter((solicitud) => (
      (solicitud.codigo?.toLowerCase().includes(searchLower)) ||
      (solicitud.cliente?.toLowerCase().includes(searchLower)) ||
      (solicitud.comuna?.toLowerCase().includes(searchLower)) ||
      (solicitud.estadoSolicitud?.toLowerCase().includes(searchLower)) ||
      (solicitud.responsable?.nombre.toLowerCase().includes(searchLower))
    ));
  }, [solicitudes, searchQuery]);

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

          {/* Filtro por usuario */}
          {/* <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#0066CC]" />
              <span className="text-sm text-[#003D7A]">Solo mis solicitudes</span>
            </div>
            <button
              onClick={() => setFilterByUser(!filterByUser)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                filterByUser ? 'bg-[#0066CC]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  filterByUser ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div> */}

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
            filteredSolicitudes.map(solicitud => (
              <SolicitudCard
                key={solicitud.id}
                solicitud={solicitud}
                onClick={() => onSolicitudSelect(solicitud.id)}
              />
            ))
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