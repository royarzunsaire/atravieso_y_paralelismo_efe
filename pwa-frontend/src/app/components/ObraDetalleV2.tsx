import { useState, useEffect, useCallback } from 'react';
import { Loader2, MapPin, TrendingUp, User } from 'lucide-react';
import { Header } from './Header';
import { AccionesObra } from './AccionesObra';
import { EventoForm } from './EventoForm';
import { Toast } from './Toast';
import { inicioService } from '@/services/inicioService';
import { eventosService, generarEventoIdExterno } from '@/services/eventosService';
import type { ObraInicio, AccionCatalogo, CatalogoInicio } from '@/types/eventos';

interface ObraDetalleV2Props {
  solicitudId: number;
  onBack: () => void;
}

/**
 * Detalle de una obra en modo v2 (event-driven). Muestra las acciones
 * habilitadas y permite registrar eventos. El histórico de inspecciones/
 * fotos queda degradado hasta que exista la API_Detalle (ver spec 10).
 */
export function ObraDetalleV2({ solicitudId, onBack }: ObraDetalleV2Props) {
  const [obra, setObra] = useState<ObraInicio | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoInicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionActiva, setAccionActiva] = useState<AccionCatalogo | null>(null);
  const [eventoIdActivo, setEventoIdActivo] = useState<string>('');
  const [toast, setToast] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning'; title: string; message?: string }>({
    isOpen: false, type: 'success', title: '',
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { obras, catalogo: cat } = await inicioService.getInicio();
      const encontrada = obras.find((o: ObraInicio) => o.Id === solicitudId) || null;
      setObra(encontrada);
      setCatalogo(cat);
      if (!encontrada) setError('No se encontró la obra o ya no tienes acciones en ella.');
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar la obra.');
    } finally {
      setLoading(false);
    }
  }, [solicitudId]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Abrir el formulario de una acción — el EventoIdExterno se genera AQUÍ,
  // una vez, y se reusa si el usuario reintenta.
  const abrirAccion = (accion: AccionCatalogo) => {
    setAccionActiva(accion);
    setEventoIdActivo(generarEventoIdExterno());
  };

  const cerrarForm = () => { setAccionActiva(null); setEventoIdActivo(''); };

  const enviarEvento = async (payload: Record<string, unknown>) => {
    if (!accionActiva) return;
    const res: {
      ok: boolean;
      estadoSync?: string;
      accionNoPermitida?: boolean;
      mensaje?: string;
      acciones?: string[];
      subEstado?: string;
      avanceObraPct?: number;
    } = await eventosService.registrarEvento({
      solicitudId,
      tipoEvento: accionActiva.Codigo,
      eventoIdExterno: eventoIdActivo,
      payload,
      sync: true,
    });

    if (!res.ok) {
      if (res.accionNoPermitida) {
        // 403: otra persona movió la obra — recargar en vez de reintentar.
        cerrarForm();
        setToast({ isOpen: true, type: 'warning', title: 'La obra cambió', message: res.mensaje });
        await cargar();
        return;
      }
      throw new Error(res.mensaje);
    }

    cerrarForm();

    if (res.estadoSync === 'sincronizado') {
      setToast({ isOpen: true, type: 'success', title: 'Registrado', message: 'El evento se registró correctamente.' });
      // Refrescar acciones/estado desde la respuesta del servidor si vino;
      // si no, recargar para traer el estado nuevo de la obra.
      if (res.acciones && obra) {
        setObra({
          ...obra,
          AccionesHabilitadas: res.acciones,
          SubEstado: res.subEstado ?? obra.SubEstado,
          AvanceObraPct: res.avanceObraPct ?? obra.AvanceObraPct,
        });
      } else {
        await cargar();
      }
    } else {
      // Guardado pero no sincronizado (sin señal / cola) — SIN SINCRONIZAR.
      setToast({ isOpen: true, type: 'warning', title: 'Guardado sin conexión', message: 'El evento quedó pendiente y se enviará cuando haya señal.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <Header title={obra ? `Obra #${obra.Codigo}` : 'Obra'} showBackButton onBack={onBack} />

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Loader2 className="w-10 h-10 text-[#0066CC] animate-spin mx-auto mb-3" />
            <p className="text-[#4A4A4A]">Cargando obra…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => void cargar()} className="mt-2 text-sm text-[#0066CC] hover:underline">Reintentar</button>
          </div>
        ) : obra ? (
          <>
            {/* Ficha resumida */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-[#003D7A]">{obra.Titulo}</h2>
                <p className="text-sm text-[#4A4A4A]">{obra.SubEstado}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <User className="w-4 h-4 text-[#0066CC]" /> Tu rol: <span className="font-medium text-[#003D7A]">{obra.Rol}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
                <MapPin className="w-4 h-4 text-[#0066CC]" /> {[obra.Ubicacion?.Comuna, obra.Ubicacion?.Region].filter(Boolean).join(', ') || 'Sin ubicación'}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0066CC]" />
                <span className="text-sm text-[#4A4A4A]">Avance:</span>
                <span className="text-lg font-bold text-[#0066CC]">{Math.round(obra.AvanceObraPct || 0)}%</span>
              </div>
            </div>

            {/* Nota de degradación por falta de API_Detalle */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-[#003D7A]">
              El historial de inspecciones y fotos de esta obra estará disponible próximamente.
            </div>

            {/* Acciones habilitadas (server-driven) */}
            <AccionesObra
              acciones={obra.AccionesHabilitadas}
              catalogo={catalogo}
              onAccion={abrirAccion}
            />
          </>
        ) : null}
      </div>

      {accionActiva && (
        <EventoForm
          accion={accionActiva}
          eventoIdExterno={eventoIdActivo}
          onCancel={cerrarForm}
          onSubmit={enviarEvento}
        />
      )}

      <Toast
        isOpen={toast.isOpen}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, isOpen: false }))}
      />
    </div>
  );
}
