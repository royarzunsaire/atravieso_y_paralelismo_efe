import { MapPin, User, AlertCircle, Handshake, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { getEstadoColor, getPrioridadColor } from '../../utils/solicitudUtils';
import type { Solicitud } from '../../types/solicitud';

// ========================================
// INTERFACES
// ========================================

interface SolicitudCardProps {
  solicitud: Solicitud;
  onClick: () => void;
  /** Porcentaje de avance de la última inspección. Undefined = aún cargando, null = sin inspecciones */
  ultimoAvance?: number | null;
  /** Estado de la última inspección */
  ultimoEstado?: 'conforme' | 'no-conforme' | null;
}

// ========================================
// HELPERS
// ========================================

function getProgressColor(progress: number): string {
  if (progress >= 75) return 'from-[#0066CC] to-green-500';
  return 'from-[#003D7A] to-[#0066CC]';
}

// ========================================
// COMPONENTE
// ========================================

export function SolicitudCard({ solicitud, onClick, ultimoAvance, ultimoEstado }: SolicitudCardProps) {
  // Si es undefined = cargando (no mostrar datos), si es null = sin inspecciones → 0%
  const avance = ultimoAvance ?? 0;
  const sinInspecciones = ultimoAvance == null;

  return (
      <button
          onClick={onClick}
          className="w-full bg-white rounded-lg shadow-md p-4 text-left transition-all active:scale-[0.98] active:shadow-sm"
      >
        {/* Header con código y prioridad */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h3 className="text-[#003D7A] leading-snug mb-1">
              Solicitud #{solicitud.codigo}
            </h3>
          </div>

          {solicitud.prioridad && (
              <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs ${getPrioridadColor(solicitud.prioridad)}`}>
            {solicitud.prioridad}
          </span>
          )}
        </div>

        {/* Información del proyecto */}
        <div className="space-y-2 mb-3">
          {solicitud.tipoProyecto && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{solicitud.tipoProyecto} - {solicitud.tipoServicio}</span>
              </div>
          )}

          {solicitud.comuna && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{solicitud.comuna}, {solicitud.region}</span>
              </div>
          )}

          {solicitud.cliente && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <Handshake className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{solicitud.cliente}</span>
              </div>
          )}

          {solicitud.responsable && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{solicitud.responsable.nombre}</span>
              </div>
          )}
        </div>

        {/* Progreso de obra */}
        <div className="border-t border-[#003D7A]/10 pt-3">
          <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="flex items-center gap-1.5 text-[#4A4A4A]">
            <TrendingUp className="w-4 h-4" />
            Avance de obra
          </span>

            <div className="flex items-center gap-2">
              {/* Badge de estado si hay inspecciones */}
              {!sinInspecciones && ultimoEstado && (
                  ultimoEstado === 'conforme'
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-[#E30613]" />
              )}
              <span className={sinInspecciones ? 'text-[#4A4A4A]' : 'text-[#0066CC] font-semibold'}>
              {sinInspecciones ? 'Sin inspecciones' : `${avance}%`}
            </span>
            </div>
          </div>

          <div className="w-full bg-[#F5F7FA] rounded-full h-2 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${
                    sinInspecciones
                        ? 'bg-gray-300'
                        : `bg-gradient-to-r ${getProgressColor(avance)}`
                }`}
                style={{ width: sinInspecciones ? '0%' : `${avance}%` }}
            />
          </div>
        </div>

        {/* Etapa */}
        {solicitud.etapa && (
            <div className="mt-3 pt-2 border-t border-[#003D7A]/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4A4A4A]">Estado:</span>
                <span className={`font-medium ${getEstadoColor(solicitud.etapa)}`}>
              {solicitud.etapa}
            </span>
              </div>
            </div>
        )}
      </button>
  );
}
