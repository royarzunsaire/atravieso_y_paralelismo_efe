import {
    createContext,
    useContext,
    useReducer,
    useCallback,
    type ReactNode,
} from 'react';
import type { Solicitud, InspeccionDetalle, Archivo, FotoInspeccion } from '@/types/solicitud';
import { solicitudesService } from '@/services/solicitudes';
import { inspeccionesService } from '@/services/inspecciones';
import { archivosService } from '@/services/archivos';
import { fotosService } from '@/services/fotos';

// ============================================================
// ESTADO
// ============================================================

interface SolicitudState {
    solicitudActual: Solicitud | null;
    inspecciones: Record<number, InspeccionDetalle[]>;
    archivos: Record<number, Archivo[]>;
    /**
     * Fotos indexadas por inspeccionId (string).
     * Una vez que una inspeccion tiene su entrada aquí, ya fue intentado
     * el fetch (puede ser array vacío si no tenía fotos o hubo error).
     */
    fotos: Record<string, FotoInspeccion[]>;
    /**
     * Set de inspeccionIds cuyas fotos aún están cargando.
     * Cuando está vacío y la solicitud ya cargó, todas las fotos
     * con cantidadFotos > 0 ya fueron procesadas.
     */
    fotosLoadingIds: Set<string>;
    loadingSolicitud: boolean;
    loadingInspecciones: boolean;
    loadingArchivos: boolean;
    errorSolicitud: string | null;
    errorInspecciones: string | null;
    errorArchivos: string | null;
}

const initialState: SolicitudState = {
    solicitudActual: null,
    inspecciones: {},
    archivos: {},
    fotos: {},
    fotosLoadingIds: new Set(),
    loadingSolicitud: false,
    loadingInspecciones: false,
    loadingArchivos: false,
    errorSolicitud: null,
    errorInspecciones: null,
    errorArchivos: null,
};

// ============================================================
// ACCIONES
// ============================================================

type SolicitudAction =
    | { type: 'SOLICITUD_LOADING' }
    | { type: 'SOLICITUD_SUCCESS'; payload: Solicitud }
    | { type: 'SOLICITUD_ERROR'; payload: string }
    | { type: 'INSPECCIONES_LOADING' }
    | { type: 'INSPECCIONES_SUCCESS'; payload: { solicitudId: number; data: InspeccionDetalle[] } }
    | { type: 'INSPECCIONES_ERROR'; payload: string }
    | { type: 'ARCHIVOS_LOADING' }
    | { type: 'ARCHIVOS_SUCCESS'; payload: { solicitudId: number; data: Archivo[] } }
    | { type: 'ARCHIVOS_ERROR'; payload: string }
    // Fotos — una acción por inspección para no bloquear entre sí
    | { type: 'FOTOS_LOADING'; payload: { inspeccionId: string } }
    | { type: 'FOTOS_SUCCESS'; payload: { inspeccionId: string; data: FotoInspeccion[] } }
    | { type: 'FOTOS_ERROR'; payload: { inspeccionId: string } };

// ============================================================
// REDUCER
// ============================================================

function solicitudReducer(state: SolicitudState, action: SolicitudAction): SolicitudState {
    switch (action.type) {
        // ── Solicitud ────────────────────────────────────────────
        case 'SOLICITUD_LOADING':
            return {
                ...state,
                loadingSolicitud: true,
                errorSolicitud: null,
                solicitudActual: null,
                // Limpiar fotos de la solicitud anterior para no mostrar datos stale
                fotos: {},
                fotosLoadingIds: new Set(),
            };

        case 'SOLICITUD_SUCCESS':
            return { ...state, loadingSolicitud: false, solicitudActual: action.payload };

        case 'SOLICITUD_ERROR':
            return { ...state, loadingSolicitud: false, errorSolicitud: action.payload };

        // ── Inspecciones ─────────────────────────────────────────
        case 'INSPECCIONES_LOADING':
            return { ...state, loadingInspecciones: true, errorInspecciones: null };

        case 'INSPECCIONES_SUCCESS':
            return {
                ...state,
                loadingInspecciones: false,
                inspecciones: {
                    ...state.inspecciones,
                    [action.payload.solicitudId]: action.payload.data,
                },
            };

        case 'INSPECCIONES_ERROR':
            return { ...state, loadingInspecciones: false, errorInspecciones: action.payload };

        // ── Archivos ─────────────────────────────────────────────
        case 'ARCHIVOS_LOADING':
            return { ...state, loadingArchivos: true, errorArchivos: null };

        case 'ARCHIVOS_SUCCESS':
            return {
                ...state,
                loadingArchivos: false,
                archivos: {
                    ...state.archivos,
                    [action.payload.solicitudId]: action.payload.data,
                },
            };

        case 'ARCHIVOS_ERROR':
            return { ...state, loadingArchivos: false, errorArchivos: action.payload };

        // ── Fotos ─────────────────────────────────────────────────
        case 'FOTOS_LOADING': {
            const next = new Set(state.fotosLoadingIds);
            next.add(action.payload.inspeccionId);
            return { ...state, fotosLoadingIds: next };
        }

        case 'FOTOS_SUCCESS': {
            const next = new Set(state.fotosLoadingIds);
            next.delete(action.payload.inspeccionId);
            return {
                ...state,
                fotosLoadingIds: next,
                fotos: {
                    ...state.fotos,
                    [action.payload.inspeccionId]: action.payload.data,
                },
            };
        }

        // En caso de error guardamos array vacío para no reintentar y
        // quitamos el id del set de loading
        case 'FOTOS_ERROR': {
            const next = new Set(state.fotosLoadingIds);
            next.delete(action.payload.inspeccionId);
            return {
                ...state,
                fotosLoadingIds: next,
                fotos: {
                    ...state.fotos,
                    [action.payload.inspeccionId]: [],
                },
            };
        }

        default:
            return state;
    }
}

// ============================================================
// TIPO DEL CONTEXTO
// ============================================================

interface SolicitudContextType extends SolicitudState {
    /**
     * Método padre que orquesta la carga:
     * 1. AWAIT solicitud  (crítico — pestaña Info)
     * 2. Promise independiente: inspecciones + archivos en paralelo
     * 3. Una vez resueltas las inspecciones, Promise por cada una
     *    con cantidadFotos > 0 (carga fotos sin bloquear nada)
     */
    cargarSolicitud: (solicitudId: number) => Promise<void>;
    /** Fuerza recarga de inspecciones y sus fotos (ej: nueva inspección guardada) */
    recargarInspecciones: (solicitudId: number) => void;
    /** Fuerza recarga de archivos (ej: nuevo documento subido) */
    recargarArchivos: (solicitudId: number) => void;
    /** Indica si las fotos de una inspección puntual ya terminaron de cargar */
    fotosListasParaInspeccion: (inspeccionId: string) => boolean;
}

// ============================================================
// CONTEXTO
// ============================================================

const SolicitudContext = createContext<SolicitudContextType | null>(null);

// ============================================================
// PROVIDER
// ============================================================

export function SolicitudProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(solicitudReducer, initialState);

    /**
     * Lanza el fetch de fotos para una sola inspección.
     * No bloquea — se llama con .then() encadenado o en Promise.all.
     */
    const cargarFotosDeInspeccion = useCallback(
        (inspeccionId: string, stateRef: SolicitudState): void => {
            // Evitar fetch duplicado si ya está en el mapa (cargado o en vuelo)
            if (
                stateRef.fotosLoadingIds.has(inspeccionId) ||
                inspeccionId in stateRef.fotos
            ) {
                return;
            }

            dispatch({ type: 'FOTOS_LOADING', payload: { inspeccionId } });

            fotosService
                .getByInspeccionId(inspeccionId)
                .then((data: unknown) => {
                    dispatch({
                        type: 'FOTOS_SUCCESS',
                        payload: {
                            inspeccionId,
                            data: Array.isArray(data) ? (data as FotoInspeccion[]) : [],
                        },
                    });
                })
                .catch(() => {
                    // Guardamos vacío para no reintentar en cada render
                    dispatch({ type: 'FOTOS_ERROR', payload: { inspeccionId } });
                });
        },
        []
    );

    /**
     * Método padre — orquesta los tres niveles de carga.
     */
    const cargarSolicitud = useCallback(
        async (solicitudId: number): Promise<void> => {
            dispatch({ type: 'SOLICITUD_LOADING' });
            dispatch({ type: 'INSPECCIONES_LOADING' });
            dispatch({ type: 'ARCHIVOS_LOADING' });

            // ── Nivel 1: AWAIT — dato crítico ───────────────────────
            try {
                const solicitud = (await solicitudesService.getById(solicitudId)) as Solicitud;
                dispatch({ type: 'SOLICITUD_SUCCESS', payload: solicitud });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Error al cargar la solicitud';
                dispatch({ type: 'SOLICITUD_ERROR', payload: message });
                return; // Sin solicitud no tiene sentido continuar
            }

            // ── Nivel 2: Promise independiente — inspecciones + archivos ──
            // Archivos no depende de inspecciones, se lanza solo
            archivosService
                .getBySolicitudId(solicitudId)
                .then((data: unknown) => {
                    dispatch({
                        type: 'ARCHIVOS_SUCCESS',
                        payload: { solicitudId, data: data as Archivo[] },
                    });
                })
                .catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Error al cargar archivos';
                    dispatch({ type: 'ARCHIVOS_ERROR', payload: message });
                });

            // Inspecciones: cuando resuelve, dispara nivel 3 (fotos)
            inspeccionesService
                .getBySolicitudId(solicitudId)
                .then((data: unknown) => {
                    const inspecciones = data as InspeccionDetalle[];
                    dispatch({
                        type: 'INSPECCIONES_SUCCESS',
                        payload: { solicitudId, data: inspecciones },
                    });

                    // ── Nivel 3: una Promise por cada inspección con fotos ──
                    // Se usa el estado actual al momento de la resolución.
                    // Cada fetch es completamente independiente de los demás.
                    inspecciones
                        .filter((i) => i.cantidadFotos > 0)
                        .forEach((i) => {
                            // Pasamos un snapshot del estado. Como useReducer es
                            // sincrónico en la actualización, usamos initialState
                            // como referencia vacía — cargarFotosDeInspeccion
                            // revisa el mapa de fotos en el reducer via dispatch,
                            // así que el guard real está dentro del reducer.
                            cargarFotosDeInspeccion(String(i.id), {
                                ...initialState,
                                fotos: {},
                                fotosLoadingIds: new Set(),
                            });
                        });
                })
                .catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Error al cargar inspecciones';
                    dispatch({ type: 'INSPECCIONES_ERROR', payload: message });
                });
        },
        [cargarFotosDeInspeccion]
    );

    /**
     * Recarga inspecciones (forceRefresh) y vuelve a lanzar las fotos
     * de las inspecciones que lleguen con cantidadFotos > 0.
     */
    const recargarInspecciones = useCallback(
        (solicitudId: number): void => {
            dispatch({ type: 'INSPECCIONES_LOADING' });

            inspeccionesService
                .getBySolicitudId(solicitudId, { forceRefresh: true })
                .then((data: unknown) => {
                    const inspecciones = data as InspeccionDetalle[];
                    dispatch({
                        type: 'INSPECCIONES_SUCCESS',
                        payload: { solicitudId, data: inspecciones },
                    });

                    // Re-lanzar fotos de inspecciones que las tienen
                    inspecciones
                        .filter((i) => i.cantidadFotos > 0)
                        .forEach((i) => {
                            cargarFotosDeInspeccion(String(i.id), {
                                ...initialState,
                                fotos: state.fotos,
                                fotosLoadingIds: state.fotosLoadingIds,
                            });
                        });
                })
                .catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Error al recargar inspecciones';
                    dispatch({ type: 'INSPECCIONES_ERROR', payload: message });
                });
        },
        [cargarFotosDeInspeccion, state.fotos, state.fotosLoadingIds]
    );

    /**
     * Recarga solo archivos forzando bypass de caché.
     */
    const recargarArchivos = useCallback((solicitudId: number): void => {
        dispatch({ type: 'ARCHIVOS_LOADING' });

        archivosService
            .getBySolicitudId(solicitudId, { forceRefresh: true })
            .then((data: unknown) => {
                dispatch({
                    type: 'ARCHIVOS_SUCCESS',
                    payload: { solicitudId, data: data as Archivo[] },
                });
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : 'Error al recargar archivos';
                dispatch({ type: 'ARCHIVOS_ERROR', payload: message });
            });
    }, []);

    /**
     * Helper para saber si las fotos de una inspección ya están listas.
     * "Listas" = ya tienen entrada en el mapa de fotos (éxito o error→vacío)
     * y no están en el set de loading.
     */
    const fotosListasParaInspeccion = useCallback(
        (inspeccionId: string): boolean => {
            return (
                !state.fotosLoadingIds.has(inspeccionId) &&
                inspeccionId in state.fotos
            );
        },
        [state.fotosLoadingIds, state.fotos]
    );

    return (
        <SolicitudContext.Provider
            value={{
                ...state,
                cargarSolicitud,
                recargarInspecciones,
                recargarArchivos,
                fotosListasParaInspeccion,
            }}
        >
            {children}
        </SolicitudContext.Provider>
    );
}

// ============================================================
// HOOK
// ============================================================

export function useSolicitudContext(): SolicitudContextType {
    const ctx = useContext(SolicitudContext);
    if (!ctx) {
        throw new Error('useSolicitudContext debe usarse dentro de <SolicitudProvider>');
    }
    return ctx;
}
