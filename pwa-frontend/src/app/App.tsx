import { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { authService } from '../services/auth';
import { Profile } from './components/Profile';
import { SolicitudesDashboard } from './components/SolicitudesDashboard';
import { SolicitudDetail } from './components/SolicitudDetail';
import { NewInspection } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';
import type { Solicitud, Inspection, InspectionPhoto, Photo } from '../types/solicitud';

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
  const [currentSolicitud, setCurrentSolicitud] = useState<Solicitud | null>(null);

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
    sessionStorage.setItem('currentSolicitud', JSON.stringify(currentScreen.solicitud));
  }
  
  // Limpiar al salir de nueva inspección
  return () => {
    if (currentScreen.type !== 'newInspection' && currentScreen.type !== 'photoCapture') {
      sessionStorage.removeItem('lastSolicitudScreen');
      sessionStorage.removeItem('currentSolicitud');
    }
  };
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

  const handleNewInspection = (solicitudId: number, solicitud: Solicitud) => { // ← CAMBIADO
    setCurrentSolicitud(solicitud);
    setTempPhotos([]);
    setCurrentScreen({ type: 'newInspection', solicitudId, solicitud }); // ← CAMBIADO
  };

  const handleBackFromInspection = (solicitudId: number) => {
    setCurrentScreen({ type: 'solicitudDetail', solicitudId });
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
    // Guardar el solicitudId actual antes de ir a la cámara
    if (currentScreen.type === 'newInspection') {
      sessionStorage.setItem('lastSolicitudScreen', currentScreen.solicitudId.toString());
      // NUEVO: Guardar también la solicitud completa
      sessionStorage.setItem('currentSolicitud', JSON.stringify(currentScreen.solicitud));
    }
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
      const solicitudData = sessionStorage.getItem('currentSolicitud');
      
      if (lastScreen && solicitudData) {
        try {
          const solicitudId = parseInt(lastScreen, 10);
          const solicitud: Solicitud = JSON.parse(solicitudData);
          
          if (!isNaN(solicitudId) && solicitud) {
            setCurrentScreen({ type: 'newInspection', solicitudId, solicitud });
          }
        } catch (error) {
          console.error('Error parsing solicitud data:', error);
          // Fallback: volver al dashboard si hay error
          setCurrentScreen({ type: 'solicitudesDashboard' });
        }
      }
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setTempPhotos(tempPhotos.filter(p => p.id !== photoId));
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
        }
      } catch (error) {
        console.error('Error parsing solicitud data:', error);
        // Fallback: volver al dashboard si hay error
        setCurrentScreen({ type: 'solicitudesDashboard' });
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
            onNewInspection={(solicitud) => handleNewInspection(currentScreen.solicitudId, solicitud)} // ← CAMBIADO
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
      {isAuthenticated && currentScreen.type === 'newInspection' && currentScreen.solicitud && ( // ← CAMBIADO
        <NewInspection
          solicitud={currentScreen.solicitud} // ← CAMBIADO: pasa toda la solicitud
          onBack={() => handleBackFromInspection(currentScreen.solicitudId)}
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
