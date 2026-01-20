import { useState } from 'react';
import { Search } from 'lucide-react';
import { Header } from './Header';
import { ProjectCard, Project } from './ProjectCard';

interface DashboardProps {
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
}

export function Dashboard({ projects, onProjectSelect }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.location.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 md:pb-8">
      <Header title="Mis Obras" />
      
      <div className="p-4 space-y-4">
        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A4A4A]" />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border border-[#003D7A]/10 focus:outline-none focus:ring-2 focus:ring-[#0066CC] transition-shadow"
          />
        </div>
        
        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-3 gap-3 hidden">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-2xl text-[#0066CC] mb-1">{projects.length}</p>
            <p className="text-xs text-[#4A4A4A]">Total Obras</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-2xl text-[#0066CC] mb-1">
              {projects.filter(p => p.status === 'active').length}
            </p>
            <p className="text-xs text-[#4A4A4A]">En Ejecución</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-2xl text-green-600 mb-1">
              {projects.filter(p => p.status === 'completed').length}
            </p>
            <p className="text-xs text-[#4A4A4A]">Completadas</p>
          </div>
        </div>
        
        {/* Lista de proyectos */}
        <div className="space-y-3">
          <h2 className="text-[#003D7A] px-1">Proyectos Asignados</h2>
          {filteredProjects.length > 0 ? (
            filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onProjectSelect(project.id)}
              />
            ))
          ) : (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-[#4A4A4A]">No se encontraron proyectos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
