import { MapPin, TrendingUp } from 'lucide-react';

export interface Project {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'paused' | 'completed';
  progress: number;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

const statusConfig = {
  active: { label: 'En Ejecución', color: 'bg-[#0066CC]', textColor: 'text-[#0066CC]' },
  paused: { label: 'Pausado', color: 'bg-orange-500', textColor: 'text-orange-600' },
  completed: { label: 'Completado', color: 'bg-green-600', textColor: 'text-green-600' },
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const config = statusConfig[project.status];
  
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-lg shadow-md p-4 text-left transition-all active:scale-[0.98] active:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="flex-1 text-[#003D7A] leading-snug">
          {project.name}
        </h3>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs ${config.color} text-white`}>
          {config.label}
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 text-sm text-[#4A4A4A] mb-3">
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{project.location}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[#4A4A4A]">
            <TrendingUp className="w-4 h-4" />
            Avance
          </span>
          <span className={`${config.textColor}`}>{project.progress}%</span>
        </div>
        <div className="w-full bg-[#F5F7FA] rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${config.color} transition-all duration-300 rounded-full`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}
