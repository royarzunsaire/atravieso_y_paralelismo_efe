import {
  MessageSquare, ClipboardList, TrendingUp, Package, PauseCircle,
  PlayCircle, FileCheck, FileText, CheckCircle, FileSignature,
  FileEdit, Camera, Wrench, ShieldCheck, Boxes, CircleHelp,
  Edit3, CheckSquare, Shield, Settings2, FileUp, ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AccionCatalogo, CatalogoInicio } from '@/types/eventos';

// El catálogo trae el ícono en kebab-case (set Lucide). Mapeamos solo los
// que usan las acciones configuradas hoy; cualquier otro cae al fallback
// (nunca un botón sin ícono, nunca un crash).
const ICONOS: Record<string, LucideIcon> = {
  'message-square': MessageSquare,
  'clipboard-list': ClipboardList,
  'trending-up': TrendingUp,
  'package': Package,
  'pause-circle': PauseCircle,
  'play-circle': PlayCircle,
  'file-check': FileCheck,
  'file-text': FileText,
  'check-circle': CheckCircle,
  'file-signature': FileSignature,
  'file-edit': FileEdit,
  'camera': Camera,
  'wrench': Wrench,
  'shield-check': ShieldCheck,
  'boxes': Boxes,
  // Ampliado spec 13 (Etapa C) — catálogo nuevo, 11 TiposEvento agregados.
  'edit-3': Edit3,
  'check-square': CheckSquare,
  'shield': Shield,
  'tool': Settings2, // Lucide no tiene ícono "Tool" — Settings2 (elegido por Rodrigo)
  'file-up': FileUp,
  'clipboard-check': ClipboardCheck,
};

function iconoDe(nombre: string): LucideIcon {
  return ICONOS[nombre] || CircleHelp;
}

// Orden de los grupos tal como conviene mostrarlos.
const ORDEN_GRUPOS = ['Registro', 'Inspecciones', 'Control de obra', 'Documentos'];

interface AccionesObraProps {
  /** Códigos de acciones habilitadas para esta obra (de AccionesHabilitadas). */
  acciones: string[];
  /** Catálogo cacheado para resolver cada código a su definición visual. */
  catalogo: CatalogoInicio | null;
  /** Se dispara al elegir una acción — abre el formulario correspondiente. */
  onAccion: (accion: AccionCatalogo) => void;
  disabled?: boolean;
}

export function AccionesObra({ acciones, catalogo, onAccion, disabled = false }: AccionesObraProps) {
  const tipos = catalogo?.TiposEvento ?? [];

  // Resolver cada código contra el catálogo; omitir los desconocidos
  // (catálogo desactualizado) — se loguea, no se rompe la pantalla.
  const resueltas: AccionCatalogo[] = [];
  for (const codigo of acciones) {
    const def = tipos.find((t) => t.Codigo === codigo);
    if (def) resueltas.push(def);
    else console.warn(`[AccionesObra] Código de acción desconocido, se omite: ${codigo}`);
  }

  if (resueltas.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 text-center text-sm text-[#4A4A4A]">
        No hay acciones disponibles en esta obra por ahora.
      </div>
    );
  }

  // Agrupar por Grupo, respetando el orden de aparición dentro de cada uno
  // (AccionesHabilitadas ya viene ordenada por el servidor).
  const porGrupo = new Map<string, AccionCatalogo[]>();
  for (const a of resueltas) {
    const g = a.Grupo || 'Otras';
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g)!.push(a);
  }

  const gruposOrdenados = [...porGrupo.keys()].sort((a, b) => {
    const ia = ORDEN_GRUPOS.indexOf(a);
    const ib = ORDEN_GRUPOS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="space-y-4">
      {gruposOrdenados.map((grupo) => (
        <div key={grupo}>
          <h3 className="text-xs font-semibold text-[#4A4A4A] uppercase tracking-wide mb-2">{grupo}</h3>
          <div className="grid grid-cols-1 gap-2">
            {porGrupo.get(grupo)!.map((accion) => {
              const Icono = iconoDe(accion.Icono);
              return (
                <button
                  key={accion.Codigo}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAccion(accion)}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#003D7A]/10 hover:border-[#0066CC] hover:bg-blue-50/50 active:bg-blue-100/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <div className="w-10 h-10 flex-shrink-0 bg-[#0066CC]/10 rounded-lg flex items-center justify-center">
                    <Icono className="w-5 h-5 text-[#0066CC]" />
                  </div>
                  <span className="text-sm font-medium text-[#003D7A]">{accion.Label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
