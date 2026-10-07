import { ArrowLeft, LogOut, RefreshCw } from 'lucide-react';
import { authService } from '../../services/auth';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  showLogout?: boolean;
  onLogout?: () => void;
  /** Botón «Actualizar» (detalle de una obra, CU-38). Si no se pasa, no se muestra. */
  onRefresh?: () => void;
  /** true mientras se actualiza: el ícono gira. */
  refreshing?: boolean;
  /** true para bloquear el botón (actualizando o en espera para no saturar la API). */
  refreshDisabled?: boolean;
}

export function Header({ 
  title, 
  showBackButton = false, 
  onBack,
  showLogout = false,
  onLogout,
  onRefresh,
  refreshing = false,
  refreshDisabled = false
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
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded">
                <img 
                  src="/Logo_EFE.png"
                  alt="Logo app"
                  className="w-8 h-8 object-contain"
                />
              </div>
            </div>
          )}
          
          <h1 className="ml-3 text-lg tracking-tight">
            {title || 'Sistema AyP - Ejecución de Obras'}
          </h1>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label="Actualizar los datos de esta obra"
            className="flex items-center justify-center gap-2 min-h-10 px-3 rounded-lg bg-white/10 active:bg-white/20 transition-colors disabled:opacity-60 text-base font-medium"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
        )}

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