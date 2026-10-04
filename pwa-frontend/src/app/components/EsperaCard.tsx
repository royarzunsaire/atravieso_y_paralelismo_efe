import { Clock } from 'lucide-react';

/** Tarjeta gris de la pestaña «Información» cuando no queda nada que hacer y se espera a otro (CU-18 / CU-19). */
export function EsperaCard({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-5 h-5 text-gray-600 flex-shrink-0" />
        <h3 className="text-base font-semibold text-[#1A1A1A]">{titulo}</h3>
      </div>
      <p className="text-base text-[#1A1A1A]">{texto}</p>
    </div>
  );
}
