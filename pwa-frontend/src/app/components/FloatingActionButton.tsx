import { ReactNode } from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
}

export function FloatingActionButton({ onClick, icon, label }: FloatingActionButtonProps) {
  return (
      <button
          onClick={onClick}
          className="fixed bottom-20 right-4 flex items-center gap-2 h-14 px-5 bg-[#0066CC] text-white rounded-full shadow-lg active:scale-95 transition-transform z-30"
          aria-label={label}
      >
        <span className="flex-shrink-0">{icon}</span>
        {label && <span className="sm:inline">{label}</span>}
      </button>
  );
}
