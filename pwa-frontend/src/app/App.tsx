/**
 * App.tsx
 *
 * ARQUITECTURA DE PROVIDERS (orden de afuera hacia adentro):
 *
 *   <CatalogsProvider>       ← catálogos globales (tiposInspeccion, etc.)
 *     <SolicitudProvider>    ← datos de la solicitud activa
 *       <AppContent />       ← UI + routing
 *     </SolicitudProvider>
 *   </CatalogsProvider>
 *
 * CatalogsProvider carga sus datos EN PARALELO al montar la app (Level 2).
 * SolicitudProvider carga sus datos cuando el usuario abre una solicitud.
 * Los componentes solo leen del contexto — NUNCA llaman servicios directamente.
 */

import { useState } from 'react';
import { CatalogsProvider } from '@/context/CatalogsContext';
import { SolicitudProvider, useSolicitud } from '@/context/SolicitudContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SolicitudesDashboard } from './components/SolicitudesDashboard';
import { SolicitudDetail } from './components/SolicitudDetail';
import { NewInspection } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';
import { Profile } from './components/Profile';
import { BottomNav } from './components/BottomNav';
import type { User, Solicitud, InspectionPhoto } from '../types/solicitud';

type Screen =
    | 'login' | 'dashboard' | 'solicitudes'
    | 'solicitud-detail' | 'new-inspection' | 'photo-capture' | 'profile';

// ══════════════════════════════════════════════════════════════
// APP CONTENT
// ══════════════════════════════════════════════════════════════

function AppContent() {
  const { solicitudActual, inspecciones, cargarSolicitud, recargarInspecciones } = useSolicitud();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('dashboard');
  const [activeTab, setActiveTab] = useState<'home' | 'solicitudes' | 'profile'>('home');
  const [tempPhotos, setTempPhotos] = useState<InspectionPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const navigate = (screen: Screen) => {
    setPreviousScreen(currentScreen);
    setCurrentScreen(screen);
  };

  const handleLogin = (user: User) => { setCurrentUser(user); navigate('dashboard'); };

  const handleTabChange = (tab: 'home' | 'solicitudes' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'home') navigate('dashboard');
    else if (tab === 'solicitudes') navigate('solicitudes');
    else navigate('profile');
  };

  const handleOpenSolicitud = (solicitud: Solicitud) => {
    void cargarSolicitud(solicitud.id);
    navigate('solicitud-detail');
  };

  const handleNewInspection = () => { setTempPhotos([]); navigate('new-inspection'); };

  const handleSaveInspection = async (inspectionData: {
    type: string; progress: number; comentariosAvance: string;
    observacionesInspeccion: string; status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[]; solicitarParalizacion?: boolean; fechaInspeccion: string;
  }) => {
    if (!solicitudActual || !currentUser) return;
    setIsSaving(true);
    try {
      const { inspeccionesService } = await import('@/services/inspecciones');
      await inspeccionesService.create({
        solicitudId: solicitudActual.id,
        codigoSolicitud: solicitudActual.codigo,
        tipoInspeccion: inspectionData.type,
        fechaInspeccion: inspectionData.fechaInspeccion,
        porcentajeAvance: inspectionData.progress,
        estadoInspeccion: inspectionData.status === 'conforme' ? 'Conforme' : 'No Conforme',
        observacionesAvance: inspectionData.comentariosAvance,
        observacionesInspeccion: inspectionData.observacionesInspeccion,
        solicitarParalizacion: inspectionData.solicitarParalizacion,
        cantidadFotos: inspectionData.photos.length,
      });
      void recargarInspecciones(solicitudActual.id);
      navigate('solicitud-detail');
    } catch (err) {
      console.error('Error guardando inspección:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoCapture = (photo: InspectionPhoto) => {
    setTempPhotos(prev => [...prev, photo]);
    navigate('new-inspection');
  };

  if (currentScreen === 'login') return <Login onLogin={handleLogin} />;

  return (
      <div className="min-h-screen bg-[#F5F7FA]">
        {currentScreen === 'dashboard' && (
            <Dashboard currentUser={currentUser} onOpenSolicitud={handleOpenSolicitud} />
        )}
        {currentScreen === 'solicitudes' && (
            <SolicitudesDashboard onOpenSolicitud={handleOpenSolicitud} />
        )}
        {currentScreen === 'solicitud-detail' && solicitudActual && (
            <SolicitudDetail
                solicitud={solicitudActual}
                inspecciones={inspecciones}
                onBack={() => navigate(previousScreen === 'solicitudes' ? 'solicitudes' : 'dashboard')}
                onNewInspection={handleNewInspection}
            />
        )}
        {currentScreen === 'new-inspection' && solicitudActual && (
            <NewInspection
                solicitud={solicitudActual}
                onBack={() => navigate('solicitud-detail')}
                isSaving={isSaving}
                onSave={handleSaveInspection}
                onAddPhoto={() => navigate('photo-capture')}
                tempPhotos={tempPhotos}
                onRemovePhoto={(id) => setTempPhotos(prev => prev.filter(p => p.id !== id))}
            />
        )}
        {currentScreen === 'photo-capture' && (
            <PhotoCapture onBack={() => navigate('new-inspection')} onPhotoCapture={handlePhotoCapture} />
        )}
        {currentScreen === 'profile' && currentUser && (
            <Profile currentUser={currentUser} onBack={() => navigate('dashboard')} />
        )}
        {currentScreen !== 'login' && (
            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        )}
      </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════

export default function App() {
  return (
      <CatalogsProvider>
        <SolicitudProvider>
          <AppContent />
        </SolicitudProvider>
      </CatalogsProvider>
  );
}
