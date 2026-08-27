import { useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { authService } from '../../services/auth';
import { Train, Building2, HardHat } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  // Registro deshabilitado en el frontend: las cuentas se crean desde
  // la plataforma externa del cliente (client OAuth2 AYP_INTEGRACION_EXTERNA
  // contra /usuarios-actions/register), no desde esta app. El endpoint
  // /auth/register sigue existiendo en el backend (sin uso desde aquí).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.loginLocal(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  // Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
  // const handleMicrosoftLogin = () => {
  //   window.location.href = 'http://localhost:3001/auth/login/microsoft';
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003D7A] via-[#0066CC] to-[#003D7A]">
      <Header title="Sistema AyP - Ejecución de Obras" />
      
      <div className="p-4 max-w-md mx-auto mt-2">
        {/* Card de Bienvenida */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 mb-6">
          {/* Encabezado con icono */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="relative flex items-center justify-center w-30">
                <img 
                  src="/Imagen1-Photoroom.png"
                  alt="Logo app"
                />
              </div>
            </div>
          </div>

          {/* Título de Bienvenida */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-[#003D7A] mb-1">
              Bienvenido(a)
            </h1>
            <p className="text-[#4A4A4A] leading-relaxed">
              a la aplicación móvil del Sistema de Atraviesos y Paralelismos, módulo de  
              <span className="block mt-1 font-medium text-[#003D7A]">
                Ejecución de Obras
              </span>
            </p>
          </div>

          {/* Características destacadas
          <div className="grid grid-cols-1 gap-3 mb-8">
            <div className="flex items-start gap-3 p-3 bg-[#F5F7FA] rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-[#0066CC]/10 rounded-lg flex items-center justify-center">
                <HardHat className="w-5 h-5 text-[#0066CC]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#003D7A]">Gestión de Solicitudes</p>
                <p className="text-xs text-[#4A4A4A] mt-1">Seguimiento en tiempo real</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#F5F7FA] rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-[#0066CC]/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#0066CC]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#003D7A]">Control de Obras</p>
                <p className="text-xs text-[#4A4A4A] mt-1">Supervisión y documentación</p>
              </div>
            </div>
          </div> */}

          {/* Separador elegante antes del formulario */}
          <div className="my-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gradient-to-r from-transparent via-[#0066CC] to-transparent"></div>
              </div>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#0066CC] to-transparent rounded-full"></div>
          </div>

          {/* Título del formulario con icono */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-[#0066CC]/10 to-[#003D7A]/10 rounded-full mb-2">
              <div className="w-8 h-8 bg-[#0066CC] rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[#003D7A]">
                Iniciar Sesión
              </h2>
            </div>
            <p className="text-xs text-[#4A4A4A]">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 bg-white rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 transition-all"
                placeholder="usuario@efe.cl"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 bg-white rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 transition-all"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-[#E30613] rounded-lg p-4 flex items-start gap-3">
                <span className="text-[#E30613] text-lg flex-shrink-0">⚠️</span>
                <p className="text-sm text-[#E30613] leading-relaxed">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cargando...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          {/* Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-[#003D7A]/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-[#4A4A4A] font-medium">
                  o continuar con
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className="mt-6 w-full h-12 flex items-center justify-center gap-3 bg-white border-2 border-[#0066CC] rounded-lg text-[#0066CC] font-medium hover:bg-[#0066CC]/5 active:bg-[#0066CC]/10 transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Cuenta Microsoft
            </button>
          </div>
          */}

          {/* Registro deshabilitado — las cuentas se crean desde la
              plataforma externa del cliente, no desde esta app. */}
        </div>

        {/* Usuario de prueba (solo en desarrollo) */}
        {/* {import.meta.env.DEV && (
          <div className="bg-white/90 backdrop-blur-sm border-2 border-yellow-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-sm font-semibold text-yellow-800 mb-2">
                  Usuario de Prueba
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-yellow-700">
                    <span className="font-medium">Email:</span> admin@efe.cl
                  </p>
                  <p className="text-xs text-yellow-700">
                    <span className="font-medium">Password:</span> Admin123456
                  </p>
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Footer con logo EFE */}
        <div className="mt-8 text-center">
          <p className="text-white/90 text-sm font-medium">
            Empresa de los Ferrocarriles del Estado
          </p>
          <p className="text-white/70 text-xs mt-1">
            © 2026 EFE Chile - Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}