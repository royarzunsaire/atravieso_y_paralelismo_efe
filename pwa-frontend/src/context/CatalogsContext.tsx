/**
 * CatalogsContext.tsx
 *
 * Contexto global para datos de catálogo: listas que cambian rara vez y
 * que deben estar disponibles en toda la app sin volver a cargarse.
 *
 * PATRÓN ASYNC DEL PROYECTO:
 * ─────────────────────────────────────────────────────────────
 *  Level 1 (AWAIT crítico):   datos sin los cuales la UI no puede renderizar
 *  Level 2 (Promise paralelo): catálogos independientes que se cargan en paralelo
 *  Level 3 (Cascade):         datos que dependen de Level 1 (ej: fotos por inspección)
 *
 * Los catálogos son Level 2: se cargan en paralelo al montar la app,
 * no bloquean nada, y los componentes simplemente los leen cuando los necesitan.
 *
 * CÓMO EXTENDER:
 *  1. Agrega la interfaz del nuevo catálogo en este archivo.
 *  2. Agrega su estado en CatalogsState.
 *  3. Agrega su acción en el reducer.
 *  4. Llama su servicio en loadAllCatalogs().
 *  5. Exponlo en el valor del contexto.
 *
 * Los componentes NUNCA llaman servicios directamente.
 * ─────────────────────────────────────────────────────────────
 */

import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import { tiposInspeccionService } from '@/services/tiposInspeccion';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

export interface TipoInspeccion {
    id: number;
    titulo: string;
}

// Agrega aquí futuros catálogos:
// export interface TipoEstado { ... }
// export interface Localidad { ... }

interface CatalogsState {
    // Tipos de inspección
    tiposInspeccion: TipoInspeccion[];
    tiposInspeccionLoading: boolean;
    tiposInspeccionError: string | null;

    // Agrega aquí el estado de futuros catálogos
    // localidades: Localidad[];
    // localidadesLoading: boolean;
    // localidadesError: string | null;
}

// ══════════════════════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════════════════════

type CatalogsAction =
    | { type: 'TIPOS_INSPECCION_LOADING' }
    | { type: 'TIPOS_INSPECCION_SUCCESS'; payload: TipoInspeccion[] }
    | { type: 'TIPOS_INSPECCION_ERROR'; payload: string }
// Agrega aquí acciones de futuros catálogos:
// | { type: 'LOCALIDADES_LOADING' }
// | { type: 'LOCALIDADES_SUCCESS'; payload: Localidad[] }
// | { type: 'LOCALIDADES_ERROR'; payload: string }
    ;

// ══════════════════════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════════════════════

const initialState: CatalogsState = {
    tiposInspeccion: [],
    tiposInspeccionLoading: false,
    tiposInspeccionError: null,
};

// ══════════════════════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════════════════════

function catalogsReducer(state: CatalogsState, action: CatalogsAction): CatalogsState {
    switch (action.type) {
        case 'TIPOS_INSPECCION_LOADING':
            return { ...state, tiposInspeccionLoading: true, tiposInspeccionError: null };
        case 'TIPOS_INSPECCION_SUCCESS':
            return {
                ...state,
                tiposInspeccion: action.payload,
                tiposInspeccionLoading: false,
                tiposInspeccionError: null,
            };
        case 'TIPOS_INSPECCION_ERROR':
            return { ...state, tiposInspeccionLoading: false, tiposInspeccionError: action.payload };

        default:
            return state;
    }
}

// ══════════════════════════════════════════════════════════════
// CONTEXT INTERFACE
// ══════════════════════════════════════════════════════════════

interface CatalogsContextValue extends CatalogsState {
    /** Recarga un catálogo específico forzando bypass de caché. */
    recargarTiposInspeccion: () => Promise<void>;
    // recargarLocalidades: () => Promise<void>;
}

// ══════════════════════════════════════════════════════════════
// CONTEXT & PROVIDER
// ══════════════════════════════════════════════════════════════

const CatalogsContext = createContext<CatalogsContextValue | null>(null);

export function CatalogsProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(catalogsReducer, initialState);

    // ── Loaders individuales ────────────────────────────────────

    const cargarTiposInspeccion = useCallback(
        async (forceRefresh = false) => {
            dispatch({ type: 'TIPOS_INSPECCION_LOADING' });
            try {
                const data = await tiposInspeccionService.getAll({ forceRefresh });
                dispatch({ type: 'TIPOS_INSPECCION_SUCCESS', payload: data });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error al cargar tipos de inspección';
                dispatch({ type: 'TIPOS_INSPECCION_ERROR', payload: msg });
            }
        },
        []
    );

    // ── Carga paralela de todos los catálogos ──────────────────
    //
    // PATRÓN Level 2: todos los catálogos se lanzan en paralelo con Promise.
    // Cada uno gestiona su propio loading/error de forma independiente;
    // si uno falla, los demás siguen cargando normalmente.
    //
    const loadAllCatalogs = useCallback(() => {
        // No await — fire and forget en paralelo
        void cargarTiposInspeccion();
        // void cargarLocalidades();   ← agrega futuros catálogos aquí
    }, [cargarTiposInspeccion]);

    // ── Montar: cargar catálogos una sola vez ──────────────────
    useEffect(() => {
        loadAllCatalogs();
    }, [loadAllCatalogs]);

    // ── Métodos públicos de recarga ────────────────────────────
    const recargarTiposInspeccion = useCallback(
        () => cargarTiposInspeccion(true),
        [cargarTiposInspeccion]
    );

    // ── Valor del contexto ────────────────────────────────────
    const value: CatalogsContextValue = {
        ...state,
        recargarTiposInspeccion,
    };

    return (
        <CatalogsContext.Provider value={value}>
            {children}
        </CatalogsContext.Provider>
    );
}

// ══════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════

export function useCatalogs(): CatalogsContextValue {
    const ctx = useContext(CatalogsContext);
    if (!ctx) {
        throw new Error('useCatalogs debe usarse dentro de <CatalogsProvider>');
    }
    return ctx;
}
