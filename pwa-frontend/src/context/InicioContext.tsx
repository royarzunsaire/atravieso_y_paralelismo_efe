/**
 * InicioContext.tsx
 *
 * Estado compartido de la carga inicial de la API de eventos (spec 10).
 * Carga API_Inicio UNA vez por sesión y la reutiliza en todas las
 * pantallas — cero re-cargas al navegar. Pensado para el flujo de terreno
 * (señal mala, API lenta de 6-7s): el usuario refresca a propósito con
 * refrescar(), y tras escribir un evento se actualiza SOLO la obra tocada
 * con la respuesta, sin re-llamar a la API.
 *
 * Solo se usa en modo v2 (flag VITE_USE_API_V2). Los componentes leen de
 * aquí con useInicio(); no llaman a inicioService directamente.
 */
import {
  createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode,
} from 'react';
import { inicioService } from '@/services/inicioService';
import { EVENTO_SESION_REINICIADA } from '@/services/sesionCache';
import type { ObraInicio, CatalogoInicio } from '@/types/eventos';

interface InicioContextValue {
  obras: ObraInicio[];
  catalogo: CatalogoInicio | null;
  usuario: { Id: number; Nombre: string; Email: string } | null;
  loading: boolean;
  error: string | null;
  /** true una vez que se cargó al menos una vez (para no re-cargar al navegar). */
  cargado: boolean;
  /** Carga inicial — idempotente: si ya se cargó, no vuelve a llamar (salvo force). */
  cargar: (force?: boolean) => Promise<void>;
  /** Botón "Actualizar" — fuerza recarga completa desde la API. */
  refrescar: () => Promise<void>;
  /** Vacía todo (obras, catálogo, usuario): cada inicio de sesión parte de cero (CU-20). */
  reiniciar: () => void;
  /**
   * Vuelve a pedir la lista a la API y actualiza SOLO esta obra (tipos de inspección habilitados, estado,
   * avance…). Devuelve la obra fresca, o null si ya no figura para este usuario (CU-23).
   */
  actualizarObraDesdeApi: (id: number) => Promise<ObraInicio | null>;
  /** Una obra por id, desde el caché en memoria. */
  getObra: (id: number) => ObraInicio | null;
  /**
   * Actualiza SOLO una obra en el caché con lo que devuelve un evento
   * (SubEstado / AvanceObraPct / AccionesHabilitadas) — sin re-llamar a la API.
   */
  actualizarObra: (id: number, cambios: Partial<ObraInicio>) => void;
}

const InicioContext = createContext<InicioContextValue | null>(null);

export function InicioProvider({ children }: { children: ReactNode }) {
  const [obras, setObras] = useState<ObraInicio[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoInicio | null>(null);
  const [usuario, setUsuario] = useState<InicioContextValue['usuario']>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  // Evita cargas concurrentes (dos pantallas montando a la vez).
  const enVuelo = useRef<Promise<void> | null>(null);
  // Se incrementa al reiniciar: una carga que venía en camino de la sesión anterior no pisa la nueva.
  const generacion = useRef(0);

  const reiniciar = useCallback(() => {
    generacion.current += 1;
    enVuelo.current = null;
    setObras([]);
    setCatalogo(null);
    setUsuario(null);
    setError(null);
    setLoading(false);
    setCargado(false);
  }, []);

  useEffect(() => {
    window.addEventListener(EVENTO_SESION_REINICIADA, reiniciar);
    return () => window.removeEventListener(EVENTO_SESION_REINICIADA, reiniciar);
  }, [reiniciar]);

  const cargar = useCallback(async (force = false) => {
    // Si ya se cargó y no es refresco forzado, reutilizar lo que hay.
    if (cargado && !force) return;
    if (enVuelo.current && !force) return enVuelo.current;

    setLoading(true);
    setError(null);

    const gen = generacion.current;
    const promesa = (async () => {
      try {
        const { obras: obrasApi, catalogo: cat, usuario: usr } = await inicioService.getInicio({ forzarCatalogo: force });
        if (gen !== generacion.current) return; // se cerró/cambió la sesión mientras cargaba
        setObras(obrasApi);
        // El catálogo puede venir null (cacheado) — conservar el que ya teníamos.
        if (cat) setCatalogo(cat);
        else if (!catalogo) setCatalogo(inicioService.getCatalogoCacheado());
        setUsuario(usr);
        setCargado(true);
      } catch (err: any) {
        setError(err?.code === 'USUARIO_NO_ENCONTRADO'
          ? 'No tienes obras asignadas en el sistema de obras. Si debería tenerlas, pide que te asignen una (o que registren tu correo en el sitio).'
          : (err?.message || 'No se pudo cargar la información inicial.'));
      } finally {
        setLoading(false);
        enVuelo.current = null;
      }
    })();

    enVuelo.current = promesa;
    return promesa;
  }, [cargado, catalogo]);

  const refrescar = useCallback(() => cargar(true), [cargar]);

  const actualizarObraDesdeApi = useCallback(async (id: number): Promise<ObraInicio | null> => {
    const { obras: obrasApi } = await inicioService.getInicio({ forzarCatalogo: false });
    const fresca: ObraInicio | null = (obrasApi as ObraInicio[]).find((o) => o.Id === id) ?? null;
    if (fresca) setObras((prev) => prev.map((o) => (o.Id === id ? { ...o, ...fresca } : o)));
    return fresca;
  }, []);

  const getObra = useCallback(
    (id: number) => obras.find((o) => o.Id === id) || null,
    [obras]
  );

  const actualizarObra = useCallback((id: number, cambios: Partial<ObraInicio>) => {
    setObras((prev) => prev.map((o) => (o.Id === id ? { ...o, ...cambios } : o)));
  }, []);

  return (
    <InicioContext.Provider
      value={{ obras, catalogo, usuario, loading, error, cargado, cargar, refrescar, reiniciar, actualizarObraDesdeApi, getObra, actualizarObra }}
    >
      {children}
    </InicioContext.Provider>
  );
}

export function useInicio(): InicioContextValue {
  const ctx = useContext(InicioContext);
  if (!ctx) throw new Error('useInicio debe usarse dentro de <InicioProvider>');
  return ctx;
}
