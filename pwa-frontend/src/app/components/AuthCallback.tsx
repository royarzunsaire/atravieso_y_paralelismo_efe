import { useEffect } from 'react';

interface AuthCallbackProps {
  onSuccess: () => void;
}

export function AuthCallback({ onSuccess }: AuthCallbackProps) {
  useEffect(() => {
    // Obtener token de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Guardar token
      localStorage.setItem('token', token);
      
      // Limpiar URL
      window.history.replaceState({}, document.title, '/');
      
      // Redirigir al dashboard
      onSuccess();
    } else {
      // Error en autenticación
      window.location.href = '/';
    }
  }, [onSuccess]);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066CC] mx-auto mb-4"></div>
        <p className="text-[#003D7A]">Completando autenticación...</p>
      </div>
    </div>
  );
}