import { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { authService } from '../services/auth';
import { Profile } from './components/Profile';
import { SolicitudesDashboard } from './components/SolicitudesDashboard';
import { SolicitudDetail, Inspection } from './components/SolicitudDetail';
import { NewInspection } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';

// ========================================
// TYPES
// ========================================

type Screen = 
  | { type: 'login' }
  | { type: 'authCallback' }
  | { type: 'profile' }
  | { type: 'solicitudesDashboard' } 
  | { type: 'solicitudDetail'; solicitudId: number }
  | { type: 'newInspection'; solicitudId: number }
  | { type: 'photoCapture' };

interface InspectionPhoto {
  id: string;
  url: string;
  description: string;
}

interface Photo {
  id: string;
  url: string;
  description: string;
  date: string;
}

// ========================================
// COMPONENT
// ========================================

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'login' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bottomNavTab, setBottomNavTab] = useState<'home' | 'reports' | 'camera' | 'profile'>('home');
  const [tempPhotos, setTempPhotos] = useState<InspectionPhoto[]>([]);
  
  // Estados para almacenar inspecciones y fotos por solicitud
  const [inspections, setInspections] = useState<{ [solicitudId: number]: Inspection[] }>({});
  const [photos, setPhotos] = useState<{ [solicitudId: number]: Photo[] }>({});

  // ========================================
  // EFFECTS
  // ========================================

  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      if (window.location.pathname === '/auth/callback') {
        setCurrentScreen({ type: 'authCallback' });
        return;
      }

      const isAuth = authService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        setCurrentScreen({ type: 'solicitudesDashboard' });
      } else {
        setCurrentScreen({ type: 'login' });
      }
    };

    checkAuth();
  }, []);

  // Guardar el último solicitudId activo para la navegación de fotos
  useEffect(() => {
    if (currentScreen.type === 'newInspection') {
      sessionStorage.setItem('lastSolicitudScreen', currentScreen.solicitudId.toString());
    }
  }, [currentScreen]);

  // ========================================
  // HANDLERS - AUTHENTICATION
  // ========================================

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

  // ========================================
  // HANDLERS - NAVIGATION
  // ========================================

  const handleBackToDashboard = () => {
    setCurrentScreen({ type: 'solicitudesDashboard' });
    setBottomNavTab('home');
  };

  const handleSolicitudSelect = (solicitudId: number) => {
    setCurrentScreen({ type: 'solicitudDetail', solicitudId });
  };

  const handleBackToSolicitudes = () => {
    setCurrentScreen({ type: 'solicitudesDashboard' });
  };

  const handleNewInspection = (solicitudId: number) => {
    setTempPhotos([]);
    setCurrentScreen({ type: 'newInspection', solicitudId });
  };

  const handleBottomNavChange = (tab: 'home' | 'reports' | 'camera' | 'profile') => {
    setBottomNavTab(tab);
    
    if (tab === 'home') {
      setCurrentScreen({ type: 'solicitudesDashboard' });
      return;
    }

    if (tab === 'reports') {
      // Futuro: mostrar reportes
      setCurrentScreen({ type: 'solicitudesDashboard' });
      return;
    }
    
    if (tab === 'profile') {
      setCurrentScreen({ type: 'profile' });
      return;
    }

    if (tab === 'camera') {
      // Futuro: cámara rápida
      setCurrentScreen({ type: 'solicitudesDashboard' });
      return;
    }
  };

  // ========================================
  // HANDLERS - PHOTOS
  // ========================================

  const handleAddPhoto = () => {
    setCurrentScreen({ type: 'photoCapture' });
  };

  const handlePhotoConfirm = (photo: { url: string; description: string }) => {
    const newPhoto: InspectionPhoto = {
      id: Date.now().toString(),
      url: photo.url,
      description: photo.description,
    };
    setTempPhotos([...tempPhotos, newPhoto]);
    
    // Volver al formulario de inspección
    if (currentScreen.type === 'photoCapture') {
      const lastScreen = sessionStorage.getItem('lastSolicitudScreen');
      if (lastScreen) {
        const solicitudId = parseInt(lastScreen, 10);
        if (!isNaN(solicitudId)) {
          setCurrentScreen({ type: 'newInspection', solicitudId });
        }
      }
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setTempPhotos(tempPhotos.filter(p => p.id !== photoId));
  };

  const handleBackFromPhotoCapture = () => {
    const lastScreen = sessionStorage.getItem('lastSolicitudScreen');
    if (lastScreen) {
      const solicitudId = parseInt(lastScreen, 10);
      if (!isNaN(solicitudId)) {
        setCurrentScreen({ type: 'newInspection', solicitudId });
      }
    }
  };

  // ========================================
  // HANDLERS - INSPECTIONS
  // ========================================

  const handleSaveInspection = (solicitudId: number, inspection: {
    type: string;
    progress: number;
    observations: string;
    status: 'conforme' | 'observaciones' | 'no-conforme';
    photos: InspectionPhoto[];
  }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const newInspection: Inspection = {
      id: Date.now().toString(),
      date: `${dateStr} - ${timeStr}`,
      type: inspection.type,
      progress: inspection.progress,
      status: inspection.status,
      observations: inspection.observations,
    };
    
    // Agregar inspección
    setInspections(prev => ({
      ...prev,
      [solicitudId]: [newInspection, ...(prev[solicitudId] || [])],
    }));
    
    // Agregar fotos si existen
    if (inspection.photos.length > 0) {
      const newPhotos: Photo[] = inspection.photos.map(p => ({
        id: p.id,
        url: p.url,
        description: p.description,
        date: dateStr,
      }));
      
      setPhotos(prev => ({
        ...prev,
        [solicitudId]: [...newPhotos, ...(prev[solicitudId] || [])],
      }));
    }
    
    // Limpiar fotos temporales
    setTempPhotos([]);
    
    // Volver al detalle de la solicitud
    setCurrentScreen({ type: 'solicitudDetail', solicitudId });
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Login */}
      {currentScreen.type === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Callback Microsoft */}
      {currentScreen.type === 'authCallback' && (
        <AuthCallback onSuccess={handleLoginSuccess} />
      )}

      {/* Dashboard de Solicitudes */}
      {isAuthenticated && currentScreen.type === 'solicitudesDashboard' && (
        <>
          <SolicitudesDashboard
            onSolicitudSelect={handleSolicitudSelect}
            onLogout={handleLogout}
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}

      {/* Detalle de Solicitud */}
      {isAuthenticated && currentScreen.type === 'solicitudDetail' && (
        <>
          <SolicitudDetail
            solicitudId={currentScreen.solicitudId}
            inspections={inspections[currentScreen.solicitudId] || []}
            onBack={handleBackToSolicitudes}
            onNewInspection={() => handleNewInspection(currentScreen.solicitudId)}
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}

      {/* Profile */}
      {isAuthenticated && currentScreen.type === 'profile' && (
        <>
          <Profile 
            onBack={handleBackToDashboard}
            onLogout={handleLogout}
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}
      
      {/* Nueva Inspección */}
      {isAuthenticated && currentScreen.type === 'newInspection' && (
        <NewInspection
          projectName={`Solicitud #${currentScreen.solicitudId}`}
          onBack={handleBackToSolicitudes}
          onSave={(inspection) => handleSaveInspection(currentScreen.solicitudId, inspection)}
          onAddPhoto={handleAddPhoto}
          tempPhotos={tempPhotos}
          onRemovePhoto={handleRemovePhoto}
        />
      )}
      
      {/* Captura de Foto */}
      {isAuthenticated && currentScreen.type === 'photoCapture' && (
        <PhotoCapture
          onBack={handleBackFromPhotoCapture}
          onPhotoConfirm={handlePhotoConfirm}
        />
      )}
    </div>
  );
}
