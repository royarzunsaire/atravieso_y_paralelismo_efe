import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail, Inspection, Photo } from './components/ProjectDetail';
import { NewInspection } from './components/NewInspection';
import { PhotoCapture } from './components/PhotoCapture';
import { BottomNav } from './components/BottomNav';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { Project } from './components/ProjectCard';
import { authService } from '../services/auth';
import { Profile } from './components/Profile';

type Screen = 
  | { type: 'login' }
  | { type: 'authCallback' }
  | { type: 'dashboard' }
  | { type: 'profile' }
  | { type: 'projectDetail'; projectId: string }
  | { type: 'newInspection'; projectId: string }
  | { type: 'photoCapture' };

  

interface InspectionPhoto {
  id: string;
  url: string;
  description: string;
}

// Mock data
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Extensión Línea 1 Metro Valparaíso',
    location: 'Valparaíso, Región de Valparaíso',
    status: 'active',
    progress: 67,
  },
  {
    id: '2',
    name: 'Modernización Vía Férrea Rancagua-Talca',
    location: 'Rancagua - Talca, Región del Maule',
    status: 'active',
    progress: 42,
  },
  {
    id: '3',
    name: 'Restauración Puente Ferroviario Malleco',
    location: 'Collipulli, Región de La Araucanía',
    status: 'paused',
    progress: 28,
  },
  {
    id: '4',
    name: 'Ampliación Estación Central Santiago',
    location: 'Santiago, Región Metropolitana',
    status: 'active',
    progress: 85,
  },
  {
    id: '5',
    name: 'Construcción Terminal de Carga Puerto Montt',
    location: 'Puerto Montt, Región de Los Lagos',
    status: 'completed',
    progress: 100,
  },
];

const mockInspections: { [projectId: string]: Inspection[] } = {
  '1': [
    {
      id: '1',
      date: '05/01/2026 - 10:30',
      type: 'Inspección General',
      progress: 65,
      status: 'conforme',
      observations: 'Se observa avance conforme al cronograma. Trabajos de tendido de rieles en progreso normal. Condiciones climáticas favorables.',
    },
    {
      id: '2',
      date: '30/12/2025 - 14:15',
      type: 'Control de Calidad',
      progress: 60,
      status: 'observaciones',
      observations: 'Se detectaron algunas irregularidades menores en el nivelado de balasto en sector km 2.5. Se solicitó corrección inmediata al contratista.',
    },
  ],
  '2': [
    {
      id: '3',
      date: '03/01/2026 - 09:00',
      type: 'Seguridad',
      progress: 42,
      status: 'conforme',
      observations: 'Revisión de protocolos de seguridad. Todo el personal cuenta con EPP adecuado. Señalética correctamente instalada en toda el área de trabajo.',
    },
  ],
};

const mockPhotos: { [projectId: string]: Photo[] } = {
  '1': [
    {
      id: '1',
      url: 'https://images.unsplash.com/photo-1699740085489-ed33b4ba6ee3?w=800&h=600&fit=crop',
      description: 'Vista general del avance en el sector norte',
      date: '05/01/2026',
    },
    {
      id: '2',
      url: 'https://images.unsplash.com/photo-1725234839695-3b5f9af28a1d?w=800&h=600&fit=crop',
      description: 'Detalle de instalación de rieles nuevos',
      date: '05/01/2026',
    },
    {
      id: '3',
      url: 'https://images.unsplash.com/photo-1630050668512-799363304546?w=800&h=600&fit=crop',
      description: 'Estructura de puente en construcción',
      date: '30/12/2025',
    },
  ],
  '2': [
    {
      id: '4',
      url: 'https://images.unsplash.com/photo-1699740085489-ed33b4ba6ee3?w=800&h=600&fit=crop',
      description: 'Inicio de trabajos de modernización',
      date: '03/01/2026',
    },
  ],
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'login' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bottomNavTab, setBottomNavTab] = useState<'home' | 'reports' | 'camera' | 'profile'>('home');
  const [tempPhotos, setTempPhotos] = useState<InspectionPhoto[]>([]);
  const [inspections, setInspections] = useState(mockInspections);
  const [photos, setPhotos] = useState(mockPhotos);

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
        setCurrentScreen({ type: 'dashboard' });
      } else {
        setCurrentScreen({ type: 'login' });
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentScreen({ type: 'dashboard' });
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentScreen({ type: 'login' });
    setBottomNavTab('home');
  };
  
  const handleProjectSelect = (projectId: string) => {
    setCurrentScreen({ type: 'projectDetail', projectId });
  };
  
  const handleBackToDashboard = () => {
    setCurrentScreen({ type: 'dashboard' });
    setBottomNavTab('home');
  };
  
  const handleBackToProject = (projectId: string) => {
    setCurrentScreen({ type: 'projectDetail', projectId });
  };
  
  const handleNewInspection = (projectId: string) => {
    setTempPhotos([]);
    setCurrentScreen({ type: 'newInspection', projectId });
  };
  
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
      // Recuperar el último proyecto activo
      const lastScreen = sessionStorage.getItem('lastProjectScreen');
      if (lastScreen) {
        setCurrentScreen({ type: 'newInspection', projectId: lastScreen });
      }
    }
  };
  
  const handleRemovePhoto = (photoId: string) => {
    setTempPhotos(tempPhotos.filter(p => p.id !== photoId));
  };
  
  const handleSaveInspection = (projectId: string, inspection: {
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
      [projectId]: [newInspection, ...(prev[projectId] || [])],
    }));
    
    // Agregar fotos
    if (inspection.photos.length > 0) {
      const newPhotos: Photo[] = inspection.photos.map(p => ({
        id: p.id,
        url: p.url,
        description: p.description,
        date: dateStr,
      }));
      
      setPhotos(prev => ({
        ...prev,
        [projectId]: [...newPhotos, ...(prev[projectId] || [])],
      }));
    }
    
    // Limpiar fotos temporales
    setTempPhotos([]);
    
    // Volver al detalle del proyecto
    setCurrentScreen({ type: 'projectDetail', projectId });
  };
  
  const handleBottomNavChange = (tab: 'home' | 'reports' | 'camera' | 'profile') => {
  setBottomNavTab(tab);
  
  if (tab === 'home') {
    setCurrentScreen({ type: 'dashboard' });
  } else if (tab === 'profile') {
    // Mostrar pantalla de perfil con logout
    setCurrentScreen({ type: 'profile' });
  }
};
  
  // Guardar el último proyecto activo para la navegación
  if (currentScreen.type === 'newInspection') {
    sessionStorage.setItem('lastProjectScreen', currentScreen.projectId);
  }
  
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

      {/* Dashboard */}
      {isAuthenticated && currentScreen.type === 'dashboard' && (
        <>
          <Dashboard
            projects={mockProjects}
            onProjectSelect={handleProjectSelect}
            onLogout={handleLogout} // ← Agregar
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}

      {/* Profile - AGREGAR */}
      {isAuthenticated && currentScreen.type === 'profile' && (
        <>
          <Profile 
            onBack={handleBackToDashboard}
            onLogout={handleLogout}
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}
      
      {/* Project Detail */}
      {isAuthenticated && currentScreen.type === 'projectDetail' && (
        <>
          <ProjectDetail
            project={mockProjects.find(p => p.id === currentScreen.projectId)!}
            inspections={inspections[currentScreen.projectId] || []}
            photos={photos[currentScreen.projectId] || []}
            onBack={handleBackToDashboard}
            onNewInspection={() => handleNewInspection(currentScreen.projectId)}
          />
          <BottomNav activeTab={bottomNavTab} onTabChange={handleBottomNavChange} />
        </>
      )}
      
      {/* New Inspection */}
      {isAuthenticated && currentScreen.type === 'newInspection' && (
        <NewInspection
          projectName={mockProjects.find(p => p.id === currentScreen.projectId)?.name || ''}
          onBack={() => handleBackToProject(currentScreen.projectId)}
          onSave={(inspection) => handleSaveInspection(currentScreen.projectId, inspection)}
          onAddPhoto={handleAddPhoto}
          tempPhotos={tempPhotos}
          onRemovePhoto={handleRemovePhoto}
        />
      )}
      
      {/* Photo Capture */}
      {isAuthenticated && currentScreen.type === 'photoCapture' && (
        <PhotoCapture
          onBack={() => {
            const lastScreen = sessionStorage.getItem('lastProjectScreen');
            if (lastScreen) {
              setCurrentScreen({ type: 'newInspection', projectId: lastScreen });
            }
          }}
          onPhotoConfirm={handlePhotoConfirm}
        />
      )}
    </div>
  );
}
