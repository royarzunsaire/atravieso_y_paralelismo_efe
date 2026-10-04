/**
 * ProgresoContext.tsx — espera visible y errores explicados (contrato CU-22).
 *
 * Una sola forma de hacer cualquier operación lenta (guardar una inspección, subir una foto o un
 * informe, enviar una acción de la obra…):
 *
 *   await conProgreso({ mensaje: 'Guardando inspección…' }, async (etapa) => {
 *     etapa('Subiendo fotos…');
 *     ...
 *   });
 *
 * - Muestra un indicador de PANTALLA COMPLETA (no solo en el botón) con el mensaje de la etapa.
 * - SIEMPRE lo oculta (try/catch/finally), aunque la operación falle.
 * - Si falla, abre un popup que explica el motivo en lenguaje simple (nunca un aviso genérico).
 * - Pasados 15 s avisa que la plataforma está lenta. No se puede cancelar (evita envíos duplicados).
 */
import {
  createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode,
} from 'react';
import { ProgresoOverlay } from '@/app/components/ProgresoOverlay';
import { ErrorPopup } from '@/app/components/ErrorPopup';
import { traducirError, type ErrorParaUsuario } from '@/utils/mensajesError';

const UMBRAL_LENTO_MS = 15000;

type CambiarEtapa = (mensaje: string) => void;

interface OpcionesProgreso {
  /** Mensaje inicial del indicador (se puede cambiar con `etapa(...)`). */
  mensaje: string;
  /** Título del popup si la operación falla y el error no tiene una traducción conocida. */
  tituloError?: string;
  /** Si se indica, el popup ofrece «Reintentar» y vuelve a ejecutar esto. */
  alReintentar?: () => void;
  /** Botón extra del popup, ej. «Continuar con los datos guardados». */
  accionAlternativa?: { texto: string; alElegir: () => void };
  /** true: además de mostrar el popup, relanza el error (para quien necesita reaccionar). */
  propagarError?: boolean;
}

interface ProgresoValue {
  /** Ejecuta `tarea` con el indicador de pantalla; devuelve su resultado o `undefined` si falló. */
  conProgreso: <T>(opciones: OpcionesProgreso, tarea: (etapa: CambiarEtapa) => Promise<T>) => Promise<T | undefined>;
  /** Abre el popup de error para cualquier error ya capturado. */
  mostrarError: (
    error: unknown,
    tituloError?: string,
    alReintentar?: () => void,
    accionAlternativa?: { texto: string; alElegir: () => void },
  ) => void;
}

interface Operacion {
  id: number;
  mensaje: string;
}

interface ErrorAbierto {
  info: ErrorParaUsuario;
  alReintentar?: () => void;
  accionAlternativa?: { texto: string; alElegir: () => void };
}

const ProgresoContext = createContext<ProgresoValue | null>(null);

export function ProgresoProvider({ children }: { children: ReactNode }) {
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [lento, setLento] = useState(false);
  const [error, setError] = useState<ErrorAbierto | null>(null);
  const contador = useRef(0);

  // Aviso de lentitud: arranca cuando empieza la primera operación y se apaga cuando no queda ninguna.
  const hayOperaciones = operaciones.length > 0;
  useEffect(() => {
    if (!hayOperaciones) {
      setLento(false);
      return;
    }
    const t = setTimeout(() => setLento(true), UMBRAL_LENTO_MS);
    return () => clearTimeout(t);
  }, [hayOperaciones]);

  const mostrarError = useCallback((
    e: unknown,
    tituloError?: string,
    alReintentar?: () => void,
    accionAlternativa?: { texto: string; alElegir: () => void },
  ) => {
    setError({ info: traducirError(e, tituloError), alReintentar, accionAlternativa });
  }, []);

  const conProgreso = useCallback(
    async <T,>(opciones: OpcionesProgreso, tarea: (etapa: CambiarEtapa) => Promise<T>): Promise<T | undefined> => {
      const id = ++contador.current;
      setOperaciones((o) => [...o, { id, mensaje: opciones.mensaje }]);
      const etapa: CambiarEtapa = (mensaje) =>
        setOperaciones((o) => o.map((x) => (x.id === id ? { ...x, mensaje } : x)));
      try {
        return await tarea(etapa);
      } catch (e) {
        mostrarError(e, opciones.tituloError, opciones.alReintentar, opciones.accionAlternativa);
        if (opciones.propagarError) throw e;
        return undefined;
      } finally {
        // Siempre se apaga el indicador, pase lo que pase.
        setOperaciones((o) => o.filter((x) => x.id !== id));
      }
    },
    [mostrarError],
  );

  // Solo en desarrollo: permite probar el indicador y el popup desde la consola del navegador.
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __aypProgreso: { conProgreso, mostrarError } });
  }, [conProgreso, mostrarError]);

  const ultima = operaciones[operaciones.length - 1];

  return (
    <ProgresoContext.Provider value={{ conProgreso, mostrarError }}>
      {children}
      {ultima && <ProgresoOverlay mensaje={ultima.mensaje} lento={lento} />}
      {error && (
        <ErrorPopup
          error={error.info}
          onCerrar={() => setError(null)}
          textoAlternativa={error.accionAlternativa?.texto}
          onAlternativa={
            error.accionAlternativa
              ? () => {
                  const f = error.accionAlternativa?.alElegir;
                  setError(null);
                  f?.();
                }
              : undefined
          }
          onReintentar={
            error.alReintentar
              ? () => {
                  const f = error.alReintentar;
                  setError(null);
                  f?.();
                }
              : undefined
          }
        />
      )}
    </ProgresoContext.Provider>
  );
}

export function useProgreso(): ProgresoValue {
  const ctx = useContext(ProgresoContext);
  if (!ctx) throw new Error('useProgreso debe usarse dentro de <ProgresoProvider>');
  return ctx;
}
