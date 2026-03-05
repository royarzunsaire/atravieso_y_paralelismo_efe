/**
 * CatalogsContext.tsx
 * pwa-frontend/src/context/CatalogsContext.tsx  ← CARPETA NUEVA
 *
 * Contexto global para datos de catálogo que cambian rara vez.
 * Se carga UNA SOLA VEZ al montar la app en paralelo (Level 2).
 *
 * REGLA DE ORO:
 *   Los componentes NUNCA llaman servicios directamente.
 *   Solo leen del contexto con useCatalogs().
 *
 * CÓMO AGREGAR UN NUEVO CATÁLOGO:
 *   1. Agrega su interface aquí (export interface MiItem {...})
 *   2. Agrega su estado en CatalogsState
 *   3. Agrega sus acciones en el reducer
 *   4. Agrega su loader en loadAllCatalogs()
 *   5. Expónlo en el valor del contexto
 *   6. El servicio debe estar en src/services/miCatalogo.js
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

// ── Interfaces de catálogos ──────────────────────────────────

export interface TipoInspeccion {
    id: number;
    titulo: string;
}

// Agrega aquí futuras interfaces:
// export interface TipoObra { id: number; titulo: string }

// ── Estado del contexto ──────────────────────────────────────

interface CatalogsState {
    tiposInspeccion: TipoInspeccion[];
    tiposInspeccionLoading: boolean;
    tiposInspeccionError: string | null;
    // Agrega aquí el estado de futuros catálogos
}

// ── Acciones ─────────────────────────────────────────────────

type CatalogsAction =
    | { type: 'TIPOS_LOADING' }
    | { type: 'TIPOS_SUCCESS'; payload: TipoInspeccion[] }
    | { type: 'TIPOS_ERROR'; payload: string };

// ── Estado inicial ────────────────────────────────────────────

const initialState: CatalogsState = {
    tiposInspeccion: [],
    tiposInspeccionLoading: false,
    tiposInspeccionError: null,
};

// ── Reducer ───────────────────────────────────────────────────

function reducer(state: CatalogsState, action: CatalogsAction): CatalogsState {
    switch (action.type) {
        case 'TIPOS_LOADING':
            return { ...state, tiposInspeccionLoading: true, tiposInspeccionError: null };
        case 'TIPOS_SUCCESS':
            return { ...state, tiposInspeccion: action.payload, tiposInspeccionLoading: false, tiposInspeccionError: null };
        case 'TIPOS_ERROR':
            return { ...state, tiposInspeccionLoading: false, tiposInspeccionError: action.payload };
        default:
            return state;
    }
}

// ── Interfaz del contexto ─────────────────────────────────────

interface CatalogsContextValue extends CatalogsState {
    recargarTiposInspeccion: () => Promise<void>;
}

// ── Contexto ──────────────────────────────────────────────────

const CatalogsContext = createContext<CatalogsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function CatalogsProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // Loader de tipos de inspección
    const cargarTipos = useCallback(async (forceRefresh = false) => {
        dispatch({ type: 'TIPOS_LOADING' });
        try {
            const data = await tiposInspeccionService.getAll({ forceRefresh });
            dispatch({ type: 'TIPOS_SUCCESS', payload: data });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al cargar tipos de inspección';
            dispatch({ type: 'TIPOS_ERROR', payload: msg });
        }
    }, []);

    // Level 2: carga todos los catálogos en paralelo al montar la app
    // Añade aquí futuros catálogos: void cargarTiposObra(); etc.
    useEffect(() => {
        void cargarTipos();
    }, [cargarTipos]);

    const value: CatalogsContextValue = {
        ...state,
        recargarTiposInspeccion: () => cargarTipos(true),
    };

    return (
        <CatalogsContext.Provider value={value}>
            {children}
        </CatalogsContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────

export function useCatalogs(): CatalogsContextValue {
    const ctx = useContext(CatalogsContext);
    if (!ctx) throw new Error('useCatalogs debe usarse dentro de <CatalogsProvider>');
    return ctx;
}
