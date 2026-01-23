import { ArrowLeft, LogOut } from 'lucide-react';
import { authService } from '../../services/auth';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  showLogout?: boolean;
  onLogout?: () => void;
}

export function Header({ 
  title, 
  showBackButton = false, 
  onBack,
  showLogout = false,
  onLogout
}: HeaderProps) {
  const user = authService.getUser();

  return (
    <header className="sticky top-0 z-50 w-full bg-[#003D7A] text-white shadow-md">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center flex-1">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-lg active:bg-white/10 transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          
          {!showBackButton && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-white rounded">
                <svg viewBox="0 0 32 32" className="w-6 h-6" fill="#003D7A">
                  <path d="M4 8 L28 8 L28 10 L4 10 Z M4 15 L28 15 L28 17 L4 17 Z M4 22 L28 22 L28 24 L4 24 Z" />
                  <circle cx="7" cy="9" r="1.5" fill="#E30613" />
                  <circle cx="25" cy="16" r="1.5" fill="#E30613" />
                </svg>
              </div>
            </div>
          )}
          
          <h1 className="ml-3 text-lg tracking-tight">
            {title || 'EFE Supervisión'}
          </h1>
        </div>

        {/* Usuario y Logout */}
        {showLogout && user && (
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:inline">{user.nombre}</span>
            <button
              onClick={onLogout}
              className="flex items-center justify-center w-10 h-10 rounded-lg active:bg-white/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}