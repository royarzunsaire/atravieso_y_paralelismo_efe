import { PauseCircle } from 'lucide-react';

// Contrato CU-07: única forma de mostrar "obra detenida". Color naranja + texto
// (nunca solo color). Los días vienen de calcularDiasDetencion (mapInicio.ts).

function textoDias(dias: number): string {
  return `${dias} día${dias !== 1 ? 's' : ''}`;
}

/** Banner grande bajo el título del detalle. */
export function BannerDetencion({ dias }: { dias: number }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-orange-100 border-b-2 border-orange-400 px-4 py-3"
    >
      <PauseCircle className="w-7 h-7 text-orange-600 flex-shrink-0" />
      <div className="leading-tight min-w-0">
        <p className="text-base font-bold tracking-wide text-orange-800">OBRA DETENIDA</p>
        <p className="text-base text-orange-800">Lleva {textoDias(dias)} detenida</p>
      </div>
    </div>
  );
}

/** Etiqueta compacta para la tarjeta del dashboard. */
export function EtiquetaDetenida({ dias }: { dias: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-100 border border-orange-400 text-xs font-bold text-orange-800 whitespace-nowrap">
      <PauseCircle className="w-3.5 h-3.5" />
      OBRA DETENIDA · {textoDias(dias)}
    </span>
  );
}
