import type { CatalogoInicio, ObraInicio } from '@/types/eventos';
import { esAccionInspeccion } from '@/utils/gruposAcciones';

/** Acción de la API para subir el acta de inicio (contrato CU-15). */
export const ACCION_ACTA_INICIO = 'ACTA_INICIO';

/** Acción de la API para subir el acta de entrega de terreno (contrato CU-16): paso previo al acta de inicio. */
export const ACCION_ACTA_ENTREGA_TERRENO = 'ACTA_ENTREGA_TERRENO';

/**
 * ¿La obra aún no se inicia? Sí cuando la API habilita ACTA_INICIO o ACTA_ENTREGA_TERRENO, o cuando
 * su sub-estado es «en entrega de terreno» / «por iniciar» (el usuario puede no tener permiso para
 * subir el acta, pero la obra igual sigue sin iniciar).
 * Mientras falte: sin Ctrl. Obra ni «+ Inspección».
 */
export function faltaActaInicio(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): boolean {
  if (!obra) return false;
  if (obra.AccionesHabilitadas.includes(ACCION_ACTA_INICIO) || obra.AccionesHabilitadas.includes(ACCION_ACTA_ENTREGA_TERRENO)) return true;
  const sinIniciar = (catalogo?.SubEstados ?? [])
    .filter((s) => s.Codigo === 'PorIniciar' || s.Codigo === 'EnEntregaTerreno')
    .map((s) => s.Label);
  return sinIniciar.includes(obra.SubEstado);
}

/**
 * Sub-estados (código del catálogo) en los que la obra acepta inspecciones: solo
 * mientras se ejecuta (o está detenida, donde la API deja registrar observaciones).
 * Antes del acta de inicio y desde la finalización («En recepción de obra» en
 * adelante) NO se aceptan, haya o no subido el acta de recepción firmada (CU-17).
 */
const ESTADOS_CON_INSPECCIONES = ['EnEjecucion', 'Detenida'];

/**
 * ¿El sub-estado de la obra permite registrar inspecciones? Si el sub-estado no se
 * puede resolver contra el catálogo se deja decidir a la API (`AccionesHabilitadas`).
 */
export function estadoPermiteInspecciones(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): boolean {
  if (!obra) return false;
  const codigo = catalogo?.SubEstados?.find((s) => s.Label === obra.SubEstado)?.Codigo;
  return !codigo || ESTADOS_CON_INSPECCIONES.includes(codigo);
}

/**
 * ¿La obra ya envió el acta de recepción y espera la aprobación del líder?
 * (sub-estado «Validación de recepción»: la API no habilita acciones para ITO ni
 * Supervisor; lo sigue el líder en la plataforma de escritorio — CU-18).
 */
export function esperaAprobacionRecepcion(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
): boolean {
  if (!obra) return false;
  const label = catalogo?.SubEstados?.find((s) => s.Codigo === 'ValidacionRecepcion')?.Label;
  return !!label && obra.SubEstado === label;
}

/** ¿La API habilita al menos un tipo de inspección para esta obra ahora? */
export function hayTipoInspeccionHabilitado(obra: ObraInicio | null | undefined, catalogo?: CatalogoInicio | null): boolean {
  if (!obra) return false;
  return obra.AccionesHabilitadas.some(
    (c) => esAccionInspeccion(c, catalogo) && !!obra.AccionesTipo?.[c],
  );
}
