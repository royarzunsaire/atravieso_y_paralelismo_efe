import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Header } from './Header';
import { SolicitudCard } from './SolicitudCard';
import { Button } from './Button';
import { mapObraToSolicitud } from '@/utils/mapInicio';
import { useInicio } from '@/context/InicioContext';
import { detalleService } from '@/services/detalleService';
import { detalleCache } from '@/services/detalleCache';
import { cargarMotivoDetencion } from '@/utils/useMotivoDetencion';
import { etiquetaDashboard } from '@/utils/tramitesObra';
import type { Solicitud } from '@/types/solicitud.ts';

// ========================================
// INTERFACES
// ========================================

interface SolicitudesDashboardProps {
  onSolicitudSelect: (solicitudId: number) => void;
  onLogout: () => void;
}

// ========================================
// COMPONENTE
// ========================================

export function SolicitudesDashboard({ onSolicitudSelect, onLogout }: SolicitudesDashboardProps) {
  // Estado compartido de la carga inicial (API_Inicio) — se reutiliza en toda la sesión sin re-cargar al navegar.
  const inicio = useInicio();

  const [searchQuery, setSearchQuery] = useState('');
  // Re-dibuja las tarjetas cuando llega un detalle (etiqueta «ACTA RECHAZADA»: depende del comentario del líder).
  const [, setVersionDetalle] = useState(0);
  useEffect(() => detalleCache.suscribir(() => setVersionDetalle((v) => v + 1)), []);

  const solicitudes: Solicitud[] = inicio.obras.map(mapObraToSolicitud);
  // `loading` controla el spinner de PANTALLA COMPLETA — solo debe verse en la carga inicial, cuando todavía
  // no hay nada que mostrar. `refreshing` controla el botón "Actualizar": debe reflejar inicio.loading SIEMPRE
  // (también en refrescos posteriores al primero), para que el botón dé feedback real sin ocultar la lista.
  const loading = inicio.loading && !inicio.cargado;
  const refreshing = inicio.loading;
  const error = inicio.error;

  // ── Efectos ─────────────────────────────────────────────────

  // El InicioContext carga UNA vez y se reutiliza toda la sesión; cargar() es idempotente.
  useEffect(() => {
    void inicio.cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga en segundo plano (mejora de performance): apenas está
  // el listado de obras, precalienta el detalle de las 2 más recientes
  // (por FechaUltimoEvento) para que abran instantáneas. Silencioso — si
  // falla, no pasa nada, el detalle se carga normal al entrar.
  useEffect(() => {
    if (!inicio.cargado) return;

    const masRecientes = [...inicio.obras]
      .sort((a, b) => {
        const ta = new Date(a.FechaUltimoEvento ?? 0).getTime();
        const tb = new Date(b.FechaUltimoEvento ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 2);

    masRecientes.forEach((obra) => {
      void detalleService.prefetchDetalle(obra.Id);
      // Obra detenida: se precarga también el motivo/acta para Ctrl. Obra
      // (pedidos compartidos con el detalle → sin trabajo doble).
      const fechaDetencion = obra.Detencion?.FechaDetencionActual;
      if (fechaDetencion) void cargarMotivoDetencion(obra.Id, fechaDetencion);
    });
  }, [inicio.cargado, inicio.obras]);

  // ── Refresh ─────────────────────────────────────────────────

  const handleRefresh = async () => {
    // forceRefresh trae el catálogo completo de nuevo (gesto de recarga). También se descarta el detalle
    // cacheado (CU-11): si alguien más agregó algo, al entrar al detalle se ve lo último, no lo guardado.
    detalleCache.limpiarTodo();
    await inicio.cargar(true);
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

            {/* Botón de refresh — refleja refreshing (no loading), así da
                feedback también en refrescos posteriores al primero, sin
                depender de que la pantalla completa esté en su spinner
                inicial. */}
            <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={handleRefresh}
                disabled={refreshing}
                icon={<RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              {refreshing ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>

          {/* Manejo de errores */}
          {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
          )}

          {/* Lista de solicitudes */}
          <div className="space-y-3">
            <h2 className="text-[#003D7A] px-1">
              Todas las Solicitudes
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
                        // El avance viene en la propia obra (avanceObraPct).
                        ultimoAvance={Math.round((solicitud as { avanceObraPct?: number }).avanceObraPct ?? 0)}
                        tramitePendiente={etiquetaDashboard(inicio.getObra(solicitud.id), inicio.catalogo, detalleCache.get(solicitud.id)?.data?.ComentarioDevolucion)}
                        diasDetencion={(solicitud as { diasDetencion?: number | null }).diasDetencion}
                    />
                ))
            ) : (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-[#4A4A4A]">
                    {searchQuery
                        ? 'No se encontraron solicitudes con ese criterio de búsqueda'
                        : 'No hay solicitudes registradas'}
                  </p>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}
