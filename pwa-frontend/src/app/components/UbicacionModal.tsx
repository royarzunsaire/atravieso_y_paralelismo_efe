import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { X, MapPin, ExternalLink, WifiOff } from 'lucide-react';

// Con Vite, Leaflet no encuentra solo las imágenes del marcador: se indican a mano.
const iconoMarcador = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface UbicacionModalProps {
  latitud: number;
  longitud: number;
  titulo: string;
  onClose: () => void;
}

/**
 * Pop-up con el mapa (OpenStreetMap) del lugar donde se registró la inspección (contrato CU-34).
 * Sin internet los mosaicos no cargan: se avisa y quedan las coordenadas y el enlace a Google Maps.
 */
export default function UbicacionModal({ latitud, longitud, titulo, onClose }: UbicacionModalProps) {
  const [sinMapa, setSinMapa] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const alPerder = () => setSinMapa(true);
    const alVolver = () => setSinMapa(false);
    window.addEventListener('offline', alPerder);
    window.addEventListener('online', alVolver);
    return () => { window.removeEventListener('offline', alPerder); window.removeEventListener('online', alVolver); };
  }, []);

  const posicion: [number, number] = [latitud, longitud];
  const enlace = `https://www.google.com/maps?q=${latitud},${longitud}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ubicación de la inspección"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-5 h-5 text-[#0066CC] flex-shrink-0" />
            <h3 className="text-base font-semibold text-[#003D7A] truncate">Ubicación · {titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-w-12 min-h-12 flex items-center justify-center rounded-lg text-gray-600 active:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {sinMapa ? (
          <div className="flex items-center gap-2 m-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-base">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            Mapa no disponible sin conexión. Puedes ver las coordenadas abajo.
          </div>
        ) : (
          <div className="h-72 w-full">
            <MapContainer center={posicion} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{ tileerror: () => setSinMapa(true) }}
              />
              <Marker position={posicion} icon={iconoMarcador} />
            </MapContainer>
          </div>
        )}

        <div className="p-4 space-y-3">
          <p className="text-base text-[#1A1A1A]">
            <span className="font-semibold">Coordenadas:</span> {latitud.toFixed(6)}, {longitud.toFixed(6)}
          </p>
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-12 flex items-center justify-center gap-2 rounded-lg bg-[#0066CC] text-white text-base font-semibold active:bg-[#003D7A]"
          >
            <ExternalLink className="w-5 h-5" />
            Abrir en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
