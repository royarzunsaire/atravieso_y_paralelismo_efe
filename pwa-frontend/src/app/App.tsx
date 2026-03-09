import { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { authService } from '@/services/auth';
import { Profile } from './components/Profile';
import { SolicitudesDashboard } from './components/SolicitudesDashboard';
import { SolicitudDetail } from './components/SolicitudDetail';
import { NewInspection } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';
import { inspeccionesService } from '@/services/inspecciones';
import { Toast } from './components/Toast';
import type { Solicitud, Inspection, InspectionPhoto, Photo } from '../types/solicitud';
import { fotosService } from '@/services/fotos';
import { CatalogsProvider } from '@/context/CatalogsContext';
import { SolicitudProvider } from '@/context/SolicitudContext';

// ========================================
// TYPES
// ========================================

type Screen =
    | { type: 'login' }
    | { type: 'authCallback' }
    | { type: 'profile' }
    | { type: 'solicitudesDashboard' }
    | { type: 'solicitudDetail'; solicitudId: number }
    | { type: 'newInspection'; solicitudId: number; solicitud: Solicitud }
    | { type: 'photoCapture' };

// ========================================
// APP CONTENT (lógica y UI)
// ========================================

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'login' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bottomNavTab, setBottomNavTab] = useState<'home' | 'reports' | 'camera' | 'profile'>('home');
  const [tempPhotos, setTempPhotos] = useState<InspectionPhoto[]>([]);
  const [inspections, setInspections] = useState<{ [solicitudId: number]: Inspection[] }>({});
  const [photos, setPhotos] = useState<{ [solicitudId: number]: Photo[] }>({});
  const [currentSolicitud, setCurrentSolicitud] = useState<Solicitud | null>(null);
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
    setCurrentScreen(isAuth ? { type: 'solicitudesDashboard' } : { type: 'login' });
  }, []);

  useEffect(() => {
    if (currentScreen.type === 'newInspection') {
      sessionStorage.setItem('lastSolicitudScreen', currentScreen.solicitudId.toString());
      sessionStorage.setItem('currentSolicitud', JSON.stringify(currentScreen.solicitud));
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
    setIsAuthenticated(true);
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentScreen({ type: 'login' });
    setBottomNavTab('home');
  };

  // ── Handlers: nav ────────────────────────────────────────────

  const handleBackToDashboard = () => {
    setCurrentScreen({ type: 'solicitudesDashboard' });
    setBottomNavTab('home');
  };

  const handleNewInspection = (solicitudId: number, solicitud: Solicitud) => {
    setCurrentSolicitud(solicitud);
    setTempPhotos([]);
    setCurrentScreen({ type: 'newInspection', solicitudId, solicitud });
  };

  const handleCancelNewInspection = (solicitudId: number) => {
    try { sessionStorage.removeItem(`newInspectionDraft:${solicitudId}`); } catch {}
    setTempPhotos([]);
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
        if (!isNaN(solicitudId) && solicitud) {
          setCurrentScreen({ type: 'newInspection', solicitudId, solicitud });
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
        if (!isNaN(solicitudId) && solicitud) {
          setCurrentScreen({ type: 'newInspection', solicitudId, solicitud });
          return;
        }
      } catch {}
    }
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  // ── Handler: guardar inspección ──────────────────────────────

  const handleSaveInspection = async (solicitudId: number, inspection: {
    type: string;
    progress: number;
    comentariosAvance: string;
    observacionesInspeccion: string;
    status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[];
    solicitarParalizacion?: boolean;
    fechaInspeccion?: string;
  }) => {
    setIsSaving(true);
    try {
      const solicitud = currentSolicitud;

      let latitud = '';
      let longitud = '';
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 0 });
          });
          latitud = position.coords.latitude.toString();
          longitud = position.coords.longitude.toString();
        } catch { /* no disponible */ }
      }

      const inspeccionData = {
        solicitudId,
        codigoSolicitud: solicitud?.codigo || null,
        tipoInspeccion: inspection.type,
        fechaInspeccion: inspection.fechaInspeccion || new Date().toISOString(),
        porcentajeAvance: inspection.progress,
        estadoInspeccion: inspection.status === 'conforme' ? 'Conforme' : 'No Conforme',
        observacionesAvance: inspection.comentariosAvance,
        observacionesInspeccion: inspection.observacionesInspeccion,
        solicitarParalizacion: inspection.solicitarParalizacion || false,
        motivoParalizacion: '',
        cantidadFotos: 0,
        latitud,
        longitud,
      };

      const result = await inspeccionesService.create(inspeccionData);
      const inspeccionId = result?.id ? String(result.id) : '';

      if (inspection.photos.length > 0) {
        if (!inspeccionId) throw new Error('No se pudo obtener el ID de la inspección para asociar las fotos.');
        const uploadSummary = await fotosService.uploadAll({
          solicitudId,
          codigoSolicitud: solicitud?.codigo || `SOL-${solicitudId}`,
          inspeccionId,
          photos: inspection.photos,
        });
        if (uploadSummary.failed > 0) {
          setToast({ isOpen: true, type: 'warning', title: 'Inspección guardada (con advertencias)', message: uploadSummary.errors.slice(0, 2).join(' | ') || 'Algunas fotos no se pudieron subir.' });
        }
      }

      const fechaDisplay = inspection.fechaInspeccion ? new Date(inspection.fechaInspeccion) : new Date();
      const dateStr = fechaDisplay.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = fechaDisplay.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

      const newInspection: Inspection = {
        id: result.id?.toString() || Date.now().toString(),
        date: `${dateStr} - ${timeStr}`,
        type: inspection.type,
        progress: inspection.progress,
        status: inspection.status,
        observations: inspection.observacionesInspeccion,
      };

      setInspections(prev => ({ ...prev, [solicitudId]: [newInspection, ...(prev[solicitudId] || [])] }));

      if (inspection.photos.length > 0) {
        const newPhotos: Photo[] = inspection.photos.map(p => ({
          id: p.id, url: p.url, description: p.description, date: dateStr,
        }));
        setPhotos(prev => ({ ...prev, [solicitudId]: [...newPhotos, ...(prev[solicitudId] || [])] }));
      }

      setTempPhotos([]);
      setCurrentScreen({ type: 'solicitudDetail', solicitudId });
      try { sessionStorage.removeItem(`newInspectionDraft:${solicitudId}`); } catch {}

      setToast(prev => {
        if (prev.isOpen && prev.type === 'warning') return prev;
        return {
          isOpen: true,
          type: inspection.solicitarParalizacion ? 'warning' : 'success',
          title: 'Inspección guardada',
          message: inspection.solicitarParalizacion
              ? 'La solicitud de paralización fue enviada al supervisor para revisión.'
              : `${inspection.type} registrada correctamente.`,
        };
      });

    } catch (error: any) {
      console.error('❌ Error guardando inspección:', error);
      setToast({ isOpen: true, type: 'error', title: 'Error al guardar', message: error.message });
    } finally {
      setIsSaving(false);
    }
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
                  onNewInspection={(solicitud) => handleNewInspection(currentScreen.solicitudId, solicitud)}
              />
              <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
            </>
        )}

        {isAuthenticated && currentScreen.type === 'profile' && (
            <>
              <Profile onBack={handleBackToDashboard} onLogout={handleLogout} />
              <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
            </>
        )}

        {isAuthenticated && currentScreen.type === 'newInspection' && currentScreen.solicitud && (
            <NewInspection
                solicitud={currentScreen.solicitud}
                onBack={() => handleCancelNewInspection(currentScreen.solicitudId)}
                onSave={(inspection) => handleSaveInspection(currentScreen.solicitudId, inspection)}
                onAddPhoto={handleAddPhoto}
                isSaving={isSaving}
                tempPhotos={tempPhotos}
                onRemovePhoto={handleRemovePhoto}
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
//
// Jerarquía de providers (de afuera hacia adentro):
//   CatalogsProvider  — tipos de inspección y futuros catálogos (carga 1 vez al iniciar)
//   SolicitudProvider — datos de la solicitud activa (solicitud, inspecciones, archivos, fotos)
//   AppContent        — toda la UI
// ========================================

export default function App() {
  return (
      <CatalogsProvider>
        <SolicitudProvider>
          <AppContent />
        </SolicitudProvider>
      </CatalogsProvider>
  );
}
