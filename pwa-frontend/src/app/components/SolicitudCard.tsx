import { MapPin, Calendar, CircleUser, User, AlertCircle, Handshake } from 'lucide-react';
import { getEstadoColor, getPrioridadColor } from '../../utils/solicitudUtils';
import type { Solicitud } from '../../types/solicitud';

// ========================================
// INTERFACES
// ========================================

interface SolicitudCardProps {
  solicitud: Solicitud;
  onClick: () => void;
}

// ========================================
// COMPONENTE
// ========================================

export function SolicitudCard({ solicitud, onClick }: SolicitudCardProps) {
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

      {/* Estado */}
      {solicitud.etapa && (
        <div className="pt-2 border-t border-[#003D7A]/10">
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