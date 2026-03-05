import { Header } from './Header';
import { Button } from './Button';
import { LogOut, User, Shield, Mail, Calendar } from 'lucide-react';
import { authService } from '../../services/auth';

interface ProfileProps {
  onBack: () => void;
  onLogout: () => void;
}

export function Profile({ onBack, onLogout }: ProfileProps) {
  const user = authService.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <Header title="Mi Perfil" showBackButton onBack={onBack} />
        <div className="p-4">
          <p className="text-[#4A4A4A]">No se pudo cargar la información del usuario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <Header title="Mi Perfil" showBackButton onBack={onBack} />
      
      <div className="p-4 space-y-4">
        {/* Card de información del usuario */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0066CC] to-[#003D7A] rounded-full flex items-center justify-center shadow-md">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl text-[#003D7A] font-medium">{user.nombre}</h2>
              <p className="text-sm text-[#4A4A4A] flex items-center gap-1 mt-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#0066CC]" />
                <span className="text-sm text-[#4A4A4A]">Rol</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.rol === 'admin' 
                  ? 'bg-[#0066CC] text-white' 
                  : 'bg-[#7BA5D6] text-[#003D7A]'
              }`}>
                {user.rol === 'admin' ? 'Administrador' : 'Usuario'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0066CC]" />
                <span className="text-sm text-[#4A4A4A]">Tipo de cuenta</span>
              </div>
              <span className="text-sm text-[#003D7A] font-medium capitalize">
                {user.auth_type === 'local' ? 'Local' : 'Microsoft'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#0066CC]" />
                <span className="text-sm text-[#4A4A4A]">ID de usuario</span>
              </div>
              <span className="text-sm text-[#003D7A] font-medium">
                #{user.id}
              </span>
            </div>
          </div>
        </div>

        {/* Información de la sesión */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm text-[#003D7A] font-medium mb-3">Información de sesión</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#4A4A4A]">Estado</span>
              <span className="flex items-center gap-2 text-green-600">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                Activa
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#4A4A4A]">Token</span>
              <span className="text-[#003D7A]">Válido</span>
            </div>
          </div>
        </div>

        {/* Botón de logout */}
        <div className="pt-4">
          <Button
            variant="danger"
            size="lg"
            fullWidth
            onClick={onLogout}
            icon={<LogOut className="w-5 h-5" />}
          >
            Cerrar Sesión
          </Button>
        </div>

        {/* Información adicional */}
        <div className="bg-[#F5F7FA] rounded-lg p-4 border border-[#003D7A]/10">
          <p className="text-xs text-[#4A4A4A] text-center">
            EFE Supervisión v1.0.0
          </p>
          <p className="text-xs text-[#4A4A4A] text-center mt-1">
            © 2025 Empresa de los Ferrocarriles del Estado
          </p>
        </div>
      </div>
    </div>
  );
}