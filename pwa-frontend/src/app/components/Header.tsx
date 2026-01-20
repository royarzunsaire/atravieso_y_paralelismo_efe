import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function Header({ title, showBackButton = false, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#003D7A] text-white shadow-md">
      <div className="flex items-center h-14 px-4">
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
    </header>
  );
}
