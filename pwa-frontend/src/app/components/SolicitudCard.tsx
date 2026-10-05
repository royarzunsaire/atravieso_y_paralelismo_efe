import { MapPin, User, AlertCircle, Handshake, TrendingUp, FileText, Route, UserCog, CalendarDays } from 'lucide-react';
import { getEstadoColor, getPrioridadColor } from '../../utils/solicitudUtils';
import type { Solicitud } from '../../types/solicitud';
import { EtiquetaDetenida } from './BannerDetencion';
import { EtiquetaTramitePendiente } from './TramitePendienteCard';
import { formatearFechaCL, diasDesdeCL } from '../../utils/fechas';

// ========================================
// INTERFACES
// ========================================

interface SolicitudCardProps {
  solicitud: Solicitud;
  onClick: () => void;
  /** Porcentaje de avance de la obra (el que informa la plataforma). */
  ultimoAvance?: number | null;
  /** Días de detención si la obra está detenida (CU-07); null/undefined = no detenida */
  diasDetencion?: number | null;
  /** Etiqueta del trámite documental pendiente (acta de inicio / recepción firmada — CU-15/16) */
  tramitePendiente?: { texto: string; espera: boolean } | null;
}

// ========================================
// HELPERS
// ========================================

function getProgressColor(progress: number): string {
  if (progress === 100) return 'bg-green-500';
  if (progress >= 75) return 'from-[#0066CC] to-green-500';
  return 'from-[#003D7A] to-[#0066CC]';
}

// ========================================
// COMPONENTE
// ========================================

/** Campos extra que trae la obra mapeada desde la API (CU-08). */
interface CamposV2 { rolEnObra?: string; subEstado?: string; fechaInicioObra?: string | null }

function textoDias(n: number): string {
  return `${n} día${n !== 1 ? 's' : ''}`;
}

export function SolicitudCard({ solicitud, onClick, ultimoAvance, diasDetencion, tramitePendiente }: SolicitudCardProps) {
  const v2 = solicitud as Solicitud & CamposV2;
  const inicioFecha = formatearFechaCL(v2.fechaInicioObra);
  const diasObra = diasDesdeCL(v2.fechaInicioObra);
  const tipoUbicacion = [solicitud.tipoObra, solicitud.ramal, solicitud.kilometraje ? `Km ${solicitud.kilometraje}` : null]
      .filter(Boolean).join(' · ');
  const estadoTexto = v2.subEstado ?? solicitud.etapa;
  const avance = ultimoAvance ?? 0;

  return (
      <button
          onClick={onClick}
          className="w-full bg-white rounded-lg shadow-md p-4 text-left transition-all active:scale-[0.98] active:shadow-sm"
      >
        {/* Header con código y prioridad */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 mb-3">
          <div className="flex-1 min-w-fit">
            <h3 className="text-[#003D7A] leading-snug mb-1 whitespace-nowrap">
              Solicitud #{solicitud.codigo}
            </h3>
          </div>

          {(tramitePendiente || diasDetencion != null || diasObra != null) && (
              <div className="flex flex-col items-end gap-1 ml-auto">
                {tramitePendiente && <EtiquetaTramitePendiente texto={tramitePendiente.texto} espera={tramitePendiente.espera} />}
                {diasDetencion != null && <EtiquetaDetenida dias={diasDetencion} />}
                {diasObra != null && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-300 text-xs font-medium text-gray-700 whitespace-nowrap">
                      Inicio de obra · lleva {textoDias(diasObra)}
                    </span>
                )}
              </div>
          )}

          {solicitud.prioridad && (
              <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs ${getPrioridadColor(solicitud.prioridad)}`}>
            {solicitud.prioridad}
          </span>
          )}
        </div>

        {/* Información del proyecto */}
        <div className="space-y-2 mb-3">
          {solicitud.title && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{solicitud.title}</span>
              </div>
          )}

          {tipoUbicacion && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <Route className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{tipoUbicacion}</span>
              </div>
          )}

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

          {v2.rolEnObra && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <UserCog className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{v2.rolEnObra}</span>
              </div>
          )}

          {inicioFecha && (
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Inició el {inicioFecha}</span>
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

            <span className="text-[#0066CC] font-semibold">{avance}%</span>
          </div>

          <div className="w-full bg-[#F5F7FA] rounded-full h-2 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${getProgressColor(avance)}`}
                style={{ width: `${avance}%` }}
            />
          </div>
        </div>

        {/* Etapa */}
        {estadoTexto && (
            <div className="mt-3 pt-2 border-t border-[#003D7A]/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4A4A4A]">Estado:</span>
                <span className={`font-medium ${getEstadoColor(estadoTexto)}`}>
              {estadoTexto}
            </span>
              </div>
            </div>
        )}
      </button>
  );
}
