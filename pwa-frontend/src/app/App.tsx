import { useState, useEffect, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { authService } from '@/services/auth';
import { Profile } from './components/Profile';
import { ChangePassword } from './components/ChangePassword';
import { SolicitudesDashboard } from './components/SolicitudesDashboard';
import { SolicitudDetail } from './components/SolicitudDetail';
import { NewInspection, type InformeAdjunto } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';
import { Toast } from './components/Toast';
import type { Solicitud, InspectionPhoto } from '../types/solicitud';
import { eventosService, generarEventoIdExterno } from '@/services/eventosService';
import { armarFotos, armarInformes, validarPesos, ArchivoInvalidoError } from '@/utils/prepararArchivos';
import { refrescarObraTrasEvento } from '@/utils/refrescarObra';
import { reiniciarCachesDeSesion } from '@/services/sesionCache';
import { ProgresoProvider, useProgreso } from '@/context/ProgresoContext';
import { esAccionInspeccion } from '@/utils/gruposAcciones';
import { avisarEsperaPlataforma, mensajeEnvio, type CambiarEtapa } from '@/utils/etapasProgreso';
import { wallChileAUTC, FechaInvalidaError } from '@/utils/fechas';
import { InicioProvider, useInicio } from '@/context/InicioContext';

// ========================================
// TYPES
// ========================================

type Screen =
    | { type: 'login' }
    | { type: 'authCallback' }
    | { type: 'profile' }
    | { type: 'changePassword'; mandatory?: boolean }
    | { type: 'solicitudesDashboard' }
    | { type: 'solicitudDetail'; solicitudId: number }
    | { type: 'newInspection'; solicitudId: number; solicitud: Solicitud; minimoAvance: number }
    | { type: 'photoCapture' };

// ========================================
// APP CONTENT (lógica y UI)
// ========================================

function AppContent() {
  const inicio = useInicio();
  const { conProgreso } = useProgreso();
  // Un reintento del MISMO contenido reutiliza el EventoIdExterno: si el primer envío sí llegó a registrarse
  // (ej. tiempo agotado), la API lo deduplica en vez de crear la inspección dos veces.
  const intentoInspeccion = useRef<{ huella: string; eventoId: string } | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'login' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bottomNavTab, setBottomNavTab] = useState<'home' | 'reports' | 'camera' | 'profile'>('home');
  const [tempPhotos, setTempPhotos] = useState<InspectionPhoto[]>([]);
  // El informe elegido en «+ Inspección» vive acá para no perderse al ir a la cámara y volver (CU-02).
  const [informeBorrador, setInformeBorrador] = useState<InformeAdjunto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message?: string;
  }>({ isOpen: false, type: 'success', title: '' });

  // ── Auth check al montar ─────────────────────────────────────

  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setCurrentScreen({ type: 'authCallback' });
      return;
    }
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);
    if (!isAuth) {
      setCurrentScreen({ type: 'login' });
      return;
    }
    const user = authService.getUser();
    setCurrentScreen(
        user?.debeCambiarPassword
            ? { type: 'changePassword', mandatory: true }
            : { type: 'solicitudesDashboard' }
    );
  }, []);

  useEffect(() => {
    if (currentScreen.type === 'newInspection') {
      sessionStorage.setItem('lastSolicitudScreen', currentScreen.solicitudId.toString());
      sessionStorage.setItem('currentSolicitud', JSON.stringify(currentScreen.solicitud));
      sessionStorage.setItem('minimoAvance', String(currentScreen.minimoAvance ?? 0));
    }
    return () => {
      if (currentScreen.type !== 'newInspection' && currentScreen.type !== 'photoCapture') {
        sessionStorage.removeItem('lastSolicitudScreen');
        sessionStorage.removeItem('currentSolicitud');
      }
    };
  }, [currentScreen]);

  // ── Handlers: auth ───────────────────────────────────────────

  const handleLoginSuccess = () => {
    // CU-20: cada inicio de sesión parte de cero (sin obras ni detalles de la sesión anterior).
    reiniciarCachesDeSesion();
    setIsAuthenticated(true);
    const user = authService.getUser();
    if (user?.debeCambiarPassword) {
      setCurrentScreen({ type: 'changePassword', mandatory: true });
      return;
    }
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentScreen({ type: 'login' });
    setBottomNavTab('home');
  };

  const handleChangePasswordSuccess = () => {
    authService.logout();
    setIsAuthenticated(false);
    setBottomNavTab('home');
    setCurrentScreen({ type: 'login' });
    setToast({
      isOpen: true,
      type: 'success',
      title: 'Contraseña actualizada',
      message: 'Inicia sesión de nuevo con tu nueva contraseña.',
    });
  };

  // ── Handlers: nav ────────────────────────────────────────────

  const handleBackToDashboard = () => {
    setCurrentScreen({ type: 'solicitudesDashboard' });
    setBottomNavTab('home');
  };

  const handleNewInspection = (solicitudId: number, solicitud: Solicitud, minimoAvance: number) => {
    setTempPhotos([]); setInformeBorrador(null);
    setCurrentScreen({ type: 'newInspection', solicitudId, solicitud, minimoAvance });
  };

  const handleCancelNewInspection = (solicitudId: number) => {
    try { sessionStorage.removeItem(`newInspectionDraft:${solicitudId}`); } catch {}
    setTempPhotos([]); setInformeBorrador(null);
    setCurrentScreen({ type: 'solicitudDetail', solicitudId });
  };

  const handleBottomNavChange = (tab: 'home' | 'reports' | 'camera' | 'profile') => {
    setBottomNavTab(tab);
    if (tab === 'profile') {
      setCurrentScreen({ type: 'profile' });
    } else {
      setCurrentScreen({ type: 'solicitudesDashboard' });
    }
  };

  // ── Handlers: fotos ──────────────────────────────────────────

  const handleAddPhoto = () => {
    if (currentScreen.type === 'newInspection') {
      sessionStorage.setItem('lastSolicitudScreen', currentScreen.solicitudId.toString());
      sessionStorage.setItem('currentSolicitud', JSON.stringify(currentScreen.solicitud));
    }
    setCurrentScreen({ type: 'photoCapture' });
  };

  const handlePhotoConfirm = (photo: { url: string; description: string }) => {
    const newPhoto: InspectionPhoto = { id: Date.now().toString(), url: photo.url, description: photo.description };
    setTempPhotos(prev => [...prev, newPhoto]);

    const lastScreen = sessionStorage.getItem('lastSolicitudScreen');
    const solicitudData = sessionStorage.getItem('currentSolicitud');
    if (lastScreen && solicitudData) {
      try {
        const solicitudId = parseInt(lastScreen, 10);
        const solicitud: Solicitud = JSON.parse(solicitudData);
        const minimoAvance = parseInt(sessionStorage.getItem('minimoAvance') ?? '0', 10);
        if (!isNaN(solicitudId) && solicitud) {
          setCurrentScreen({ type: 'newInspection', solicitudId, solicitud, minimoAvance: isNaN(minimoAvance) ? 0 : minimoAvance });
          return;
        }
      } catch {}
    }
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  const handleRemovePhoto = (photoId: string) => {
    setTempPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleBackFromPhotoCapture = () => {
    const lastScreen = sessionStorage.getItem('lastSolicitudScreen');
    const solicitudData = sessionStorage.getItem('currentSolicitud');
    if (lastScreen && solicitudData) {
      try {
        const solicitudId = parseInt(lastScreen, 10);
        const solicitud: Solicitud = JSON.parse(solicitudData);
        const minimoAvance = parseInt(sessionStorage.getItem('minimoAvance') ?? '0', 10);
        if (!isNaN(solicitudId) && solicitud) {
          setCurrentScreen({ type: 'newInspection', solicitudId, solicitud, minimoAvance: isNaN(minimoAvance) ? 0 : minimoAvance });
          return;
        }
      } catch {}
    }
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  // ── Handler: guardar inspección ──────────────────────────────

  const handleSaveInspection = async (solicitudId: number, inspection: {
    /** Tipo de inspección elegido (catálogo de la API) y la acción/evento que le corresponde. */
    tipoInspeccionId?: number;
    tipoEvento?: string;
    progress: number;
    comentariosAvance: string;
    status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[];
    fechaInspeccion?: string;
    informe?: InformeAdjunto | null;
  }) => {
    setIsSaving(true);
    try {
      // Registrar como evento vía la API de eventos (CU-22: pantalla de espera + popup si falla).
      await conProgreso(
        { mensaje: 'Obteniendo ubicación…', tituloError: 'No se pudo guardar la inspección' },
        async (etapa) => {
          const ubicacion = await obtenerUbicacion();
          await guardarInspeccionV2(solicitudId, inspection, ubicacion.latitud, ubicacion.longitud, etapa);
        },
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Guardado v2: la inspección se registra como un evento en la API ──
  // Deduce el TipoEvento según los campos llenados (regla acordada) y solo
  // entre las acciones INSPECCION_* realmente habilitadas para la obra.
  const obtenerUbicacion = async (): Promise<{ latitud: string; longitud: string }> => {
    if (!navigator.geolocation) return { latitud: '', longitud: '' };
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 0 });
      });
      return { latitud: position.coords.latitude.toString(), longitud: position.coords.longitude.toString() };
    } catch {
      return { latitud: '', longitud: '' }; // no disponible: se guarda sin coordenadas
    }
  };

  const guardarInspeccionV2 = async (
      solicitudId: number,
      inspection: Parameters<typeof handleSaveInspection>[1],
      latitud: string,
      longitud: string,
      etapa: CambiarEtapa,
  ) => {
    const obra = inicio.getObra(solicitudId);
    const habilitadas = obra?.AccionesHabilitadas ?? [];

    // El tipo de inspección elegido en el formulario determina el evento:
    // cada acción habilitada trae su TipoInspeccionId (spec 13). Solo si
    // la acción está realmente habilitada. Sin tipo elegido (no debería
    // pasar en v2), se cae a la deducción anterior.
    let tipoEvento: string | null = null;
    if (inspection.tipoEvento && habilitadas.includes(inspection.tipoEvento)) {
      tipoEvento = inspection.tipoEvento;
    } else if (Number(inspection.progress) > 0 && habilitadas.includes('INSPECCION_AVANCE')) {
      tipoEvento = 'INSPECCION_AVANCE';
    } else if (habilitadas.includes('INSPECCION_INFORME_DIARIO')) {
      tipoEvento = 'INSPECCION_INFORME_DIARIO';
    } else {
      // Fallback: la primera inspección habilitada, si hay alguna.
      tipoEvento = habilitadas.find((a) => esAccionInspeccion(a, inicio.catalogo)) ?? null;
    }

    if (!tipoEvento) {
      throw new Error('Esta obra no tiene inspecciones habilitadas en su estado actual.');
    }

    // Fecha/hora real de la inspección — la API ahora la respeta (spec 13),
    // igual que el flujo v1: reloj de pared CL → UTC.
    let fechaEventoUTC: string;
    try {
      fechaEventoUTC = wallChileAUTC(inspection.fechaInspeccion ?? '');
    } catch (e) {
      if (e instanceof FechaInvalidaError) throw new Error('Fecha inválida: revisa la fecha y hora de la inspección.');
      throw e;
    }

    // Armar el Payload con el contrato de la API (los 3 canales de archivos).
    const huella = JSON.stringify([solicitudId, tipoEvento, inspection.tipoInspeccionId, inspection.progress, inspection.status,
      inspection.comentariosAvance, inspection.fechaInspeccion, inspection.photos.map((p) => p.url.length), inspection.informe?.fileName]);
    if (intentoInspeccion.current?.huella !== huella) intentoInspeccion.current = { huella, eventoId: generarEventoIdExterno() };
    const eventoIdExterno = intentoInspeccion.current.eventoId;
    const fotos = inspection.photos.length > 0 ? armarFotos(eventoIdExterno, inspection.photos.map((p) => p.url)) : [];
    const informes = inspection.informe
        ? armarInformes(eventoIdExterno, [{ nombre: inspection.informe.fileName, dataUrl: inspection.informe.fileContentBase64 }])
        : [];

    // Adjunto obligatorio: se revisa contra lo que REALMENTE se va a enviar y la definición vigente de la
    // acción (la de la obra; el catálogo cacheado solo si falta). El backend lo vuelve a validar.
    const defAccion = obra?.AccionesDef?.[tipoEvento] ?? inicio.catalogo?.TiposEvento?.find((t) => t.Codigo === tipoEvento);
    if (defAccion?.RequiereAdjunto && fotos.length === 0 && informes.length === 0) {
      throw new Error('Este tipo de inspección exige al menos un adjunto: agrega una foto o un informe.');
    }

    try {
      validarPesos({ fotos, informes });
    } catch (err) {
      throw err; // ArchivoInvalidoError ya trae el motivo (archivo muy pesado, formato…)
    }

    const payload: Record<string, unknown> = {
      Comentario: inspection.comentariosAvance || '',
      EstadoInspeccion: inspection.status === 'conforme' ? 'Conforme' : 'No Conforme',
    };
    // Todas las inspecciones reportan avance, sin importar el tipo (confirmado
    // por el cliente); el formulario ya impide bajar del último avance.
    payload.AvancePct = Number(inspection.progress);
    if (fotos.length > 0) payload.Fotos = fotos;
    if (informes.length > 0) payload.Informes = informes;
    if (latitud && longitud) { payload.Latitud = Number(latitud); payload.Longitud = Number(longitud); }
    if (inspection.tipoInspeccionId != null) payload.TipoInspeccionId = inspection.tipoInspeccionId;

    etapa(mensajeEnvio({ fotos: fotos.length, informes: informes.length, porDefecto: 'Guardando inspección…' }));
    const cancelarAviso = avisarEsperaPlataforma(etapa);
    const res: {
      ok: boolean;
      estadoSync?: string;
      accionNoPermitida?: boolean;
      mensaje?: string;
      acciones?: string[];
      accionesTipo?: Record<string, { TipoInspeccionId: number; TipoInspeccionNombre: string }>;
      subEstado?: string;
      avanceObraPct?: number;
    } = await eventosService.registrarEvento({
      solicitudId,
      tipoEvento,
      eventoIdExterno,
      payload,
      sync: true,
      fechaEvento: fechaEventoUTC,
    }).finally(cancelarAviso);

    if (!res.ok) {
      if (res.accionNoPermitida) {
        // 403: la obra cambió de estado — recargar y avisar.
        await inicio.refrescar();
        setToast({ isOpen: true, type: 'warning', title: 'La obra cambió', message: res.mensaje });
        setCurrentScreen({ type: 'solicitudDetail', solicitudId });
        return;
      }
      throw new Error(res.mensaje || 'La plataforma no aceptó la inspección.');
    }

    // Éxito: si la respuesta trae acciones/estado nuevos, actualizar solo
    // esa obra en el caché (sin re-llamar a Inicio).
    if (res.acciones && obra) {
      inicio.actualizarObra(solicitudId, {
        AccionesHabilitadas: res.acciones,
        AccionesTipo: res.accionesTipo ?? obra.AccionesTipo,
        SubEstado: res.subEstado ?? obra.SubEstado,
        AvanceObraPct: res.avanceObraPct ?? obra.AvanceObraPct,
      });
    }
    // CU-05: la respuesta del evento es parcial (sin Detencion ni la
    // inspección nueva); se descarta el caché y se actualiza la obra completa.
    etapa('Actualizando tus datos…');
    await refrescarObraTrasEvento(inicio.actualizarObra, solicitudId, {
      fechaUltimoEventoPrevia: obra?.FechaUltimoEvento,
      tipoInspeccionEsperado: obra?.AccionesTipo?.[tipoEvento]?.TipoInspeccionNombre,
    });

    intentoInspeccion.current = null; // registrada: la próxima inspección es otra
    setTempPhotos([]); setInformeBorrador(null);
    try { sessionStorage.removeItem(`newInspectionDraft:${solicitudId}`); } catch {}
    setCurrentScreen({ type: 'solicitudDetail', solicitudId });
    setToast({
      isOpen: true,
      type: res.estadoSync === 'sincronizado' ? 'success' : 'warning',
      title: res.estadoSync === 'sincronizado' ? 'Inspección registrada' : 'Guardada sin conexión',
      message: res.estadoSync === 'sincronizado'
          ? 'La inspección se registró correctamente.'
          : 'La inspección quedó pendiente y se enviará cuando haya señal.',
    });
  };

  // ── Render ───────────────────────────────────────────────────

  return (
      <div className="min-h-screen bg-[#F5F7FA]">
        {currentScreen.type === 'login' && (
            <Login onLoginSuccess={handleLoginSuccess} />
        )}

        {currentScreen.type === 'authCallback' && (
            <AuthCallback onSuccess={handleLoginSuccess} />
        )}

        {isAuthenticated && currentScreen.type === 'solicitudesDashboard' && (
            <>
              <SolicitudesDashboard
                  onSolicitudSelect={(id) => setCurrentScreen({ type: 'solicitudDetail', solicitudId: id })}
                  onLogout={handleLogout}
              />
              <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
            </>
        )}

        {isAuthenticated && currentScreen.type === 'solicitudDetail' && (
            <>
              <SolicitudDetail
                  solicitudId={currentScreen.solicitudId}
                  onBack={() => setCurrentScreen({ type: 'solicitudesDashboard' })}
                  onNewInspection={(solicitud, minimoAvance) => handleNewInspection(currentScreen.solicitudId, solicitud, minimoAvance)}
              />
              <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
            </>
        )}

        {isAuthenticated && currentScreen.type === 'profile' && (
            <>
              <Profile
                  onBack={handleBackToDashboard}
                  onLogout={handleLogout}
                  onChangePassword={() => setCurrentScreen({ type: 'changePassword' })}
              />
              <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
            </>
        )}

        {isAuthenticated && currentScreen.type === 'changePassword' && (
            <>
              <ChangePassword
                  onBack={currentScreen.mandatory ? undefined : () => setCurrentScreen({ type: 'profile' })}
                  onSuccess={handleChangePasswordSuccess}
                  mandatory={currentScreen.mandatory}
              />
              {!currentScreen.mandatory && (
                  <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
              )}
            </>
        )}

        {isAuthenticated && currentScreen.type === 'newInspection' && currentScreen.solicitud && (
            <NewInspection
                solicitud={currentScreen.solicitud}
                onBack={() => handleCancelNewInspection(currentScreen.solicitudId)}
                onSave={(inspection) => handleSaveInspection(currentScreen.solicitudId, inspection)}
                onAddPhoto={handleAddPhoto}
                isSaving={isSaving}
                minimoAvance={currentScreen.minimoAvance}
                tempPhotos={tempPhotos}
                onRemovePhoto={handleRemovePhoto}
                informeInicial={informeBorrador}
                onInformeChange={setInformeBorrador}
                accionesV2={inicio.getObra(currentScreen.solicitudId)?.AccionesHabilitadas ?? []}
            />
        )}

        {isAuthenticated && currentScreen.type === 'photoCapture' && (
            <PhotoCapture onBack={handleBackFromPhotoCapture} onPhotoConfirm={handlePhotoConfirm} />
        )}

        <Toast
            isOpen={toast.isOpen}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
  );
}

// ========================================
// APP ROOT
// ========================================

export default function App() {
  return (
      <ProgresoProvider>
        <InicioProvider>
          <AppContent />
        </InicioProvider>
      </ProgresoProvider>
  );
}
