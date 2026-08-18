import { useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import { authService } from '../../services/auth';
import { KeyRound } from 'lucide-react';

interface ChangePasswordProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function ChangePassword({ onBack, onSuccess }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y la confirmación no coinciden');
      setNewPassword('');
      setConfirmPassword('');
      return;
    }

    setLoading(true);

    try {
      await authService.changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar la contraseña, intenta de nuevo');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <Header title="Cambiar Contraseña" showBackButton onBack={onBack} />

      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#0066CC] to-[#003D7A] rounded-full flex items-center justify-center shadow-md">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-2">
                Contraseña actual
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-12 px-4 bg-white rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-2">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 px-4 bg-white rounded-lg border-2 border-[#003D7A]/20 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 transition-all"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-[#4A4A4A] mt-2 flex items-center gap-1">
                <span className="text-[#0066CC]">ℹ️</span>
                Mínimo 8 caracteres
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#003D7A] mb-2">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Cambiando...
                </span>
              ) : (
                'Cambiar Contraseña'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
