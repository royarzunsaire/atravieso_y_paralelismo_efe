import { Home, ChartNoAxesCombined, Camera, User, MonitorCog } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'reports' | 'camera' | 'profile';
  onTabChange: (tab: 'home' | 'reports' | 'camera' | 'profile') => void;
}

const navItems = [
  { id: 'home' as const, label: 'Solicitudes', icon: Home },
  // { id: 'reports' as const, label: 'Proyectos', icon: FileText },
  { id: 'camera' as const, label: 'SIG', icon: MonitorCog },
  { id: 'profile' as const, label: 'Perfil', icon: User },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#003D7A]/10 shadow-lg z-40">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
                <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                        isActive ? 'text-[#0066CC]' : 'text-[#4A4A4A]'
                    } active:bg-[#F5F7FA]`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span className="text-xs">{item.label}</span>
                </button>
            );
          })}
        </div>
      </nav>
  );
}
