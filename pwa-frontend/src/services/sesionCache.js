import { detalleCache } from './detalleCache';
import { fotosBlobCache } from './fotosBlobCache';

/** Evento que escucha el InicioContext para vaciar las obras en memoria. */
export const EVENTO_SESION_REINICIADA = 'ayp:sesion-reiniciada';

/**
 * Reinicia todo lo que la app guarda de una sesión (contrato CU-20): obras del dashboard,
 * detalles precargados, fotos descargadas y el catálogo guardado. Se llama al iniciar y al
 * cerrar sesión, así cada login parte de cero y nunca se ven datos de otro usuario ni hay
 * que presionar «Actualizar» para ver los cambios.
 */
export function reiniciarCachesDeSesion() {
  detalleCache.limpiarTodo();
  fotosBlobCache.limpiar();
  try {
    localStorage.removeItem('ayp.catalogo');
    localStorage.removeItem('ayp.catalogoVersion');
  } catch {
    // Sin almacenamiento disponible: no hay nada que limpiar.
  }
  window.dispatchEvent(new Event(EVENTO_SESION_REINICIADA));
}
