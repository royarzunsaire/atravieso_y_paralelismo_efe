import { useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { authService } from '../../services/auth';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await authService.loginLocal(email, password);
      } else {
        await authService.register(email, password, nombre);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    // Redireccionar a la ruta de Microsoft
    window.location.href = 'http://localhost:3001/auth/login/microsoft';
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Header title="EFE Supervisión" />
      
      <div className="p-4 max-w-md mx-auto mt-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl text-[#003D7A] mb-6 text-center">
            {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm text-[#4A4A4A] mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full h-11 px-3 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-[#4A4A4A] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#4A4A4A] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 bg-white rounded-lg border border-[#003D7A]/20 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                required
                minLength={6}
              />
              {!isLogin && (
                <p className="text-xs text-[#4A4A4A] mt-1">
                  Mínimo 8 caracteres
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-[#E30613] rounded-lg p-3">
                <p className="text-sm text-[#E30613]">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
            </Button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#003D7A]/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#4A4A4A]">o</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className="mt-4 w-full h-11 flex items-center justify-center gap-2 bg-white border-2 border-[#0066CC] rounded-lg text-[#0066CC] active:bg-[#0066CC]/5 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Iniciar con Microsoft
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-[#0066CC] hover:underline"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>

        {/* Usuario de prueba (solo en desarrollo) */}
        {import.meta.env.DEV && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800 mb-1">👤 Usuario de prueba:</p>
            <p className="text-xs text-yellow-700">Email: admin@efe.cl</p>
            <p className="text-xs text-yellow-700">Password: Admin123456</p>
          </div>
        )}
      </div>
    </div>
  );
}