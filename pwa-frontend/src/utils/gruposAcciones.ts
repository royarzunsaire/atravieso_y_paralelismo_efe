// Detección automática de acciones (contrato CU-28): la app NO necesita conocer cada acción de antemano.
// Cada acción del catálogo de la API trae un `Grupo`; con eso se decide dónde aparece:
//   «Control de obra» → pestaña Ctrl. Obra · «Inspecciones»/«Registro» → tipos de «+ Inspección» ·
//   cualquier otro grupo (ej. «Documentos») o acción nueva → tarjeta de trámite en Información.
import type { AccionCatalogo, CatalogoInicio } from '@/types/eventos';

/** Grupos del catálogo cuyas acciones van en la pestaña Ctrl. Obra. */
export const GRUPOS_CTRL = ['Control de obra'];
/** Grupos del catálogo cuyas acciones se registran desde «+ Inspección». */
export const GRUPOS_FORM_INSPECCION = ['Inspecciones', 'Registro'];
/** Acciones que a propósito NO se muestran en la app (se hacen en escritorio). */
export const ACCIONES_OCULTAS = ['ACTA_RECEPCION_DATOS', 'CORREGIR_ACTA'];
/** Acciones con pantalla propia (validación del informe final, CU-19; devolver documentación, CU-32). */
export const ACCIONES_CON_PANTALLA_PROPIA = ['VALIDAR_INFORME', 'RECHAZAR_INFORME', 'DEVOLVER_DOCUMENTACION'];

export function definicionDe(codigo: string, catalogo: CatalogoInicio | null | undefined): AccionCatalogo | undefined {
  return catalogo?.TiposEvento?.find((t) => t.Codigo === codigo);
}

/** ¿La acción se registra desde «+ Inspección»? Por su grupo; sin catálogo, por su nombre. */
export function esAccionInspeccion(codigo: string, catalogo: CatalogoInicio | null | undefined): boolean {
  const grupo = definicionDe(codigo, catalogo)?.Grupo;
  return grupo ? GRUPOS_FORM_INSPECCION.includes(grupo) : (codigo.startsWith('INSPECCION_') || codigo === 'COMENTARIO_OBRA');
}

/** Claves que la app ya sabe interpretar de una acción. */
const CLAVES_CONOCIDAS = new Set([
  'Codigo', 'Label', 'Icono', 'Grupo', 'Orden', 'Activo',
  'RequiereComentario', 'RequiereAdjunto', 'RequiereAvance', 'TiposDocumento',
]);

/** Requisitos nuevos (`Requiere…`) que la API agregó y la app aún no sabe pedir. */
export function banderasDesconocidas(accion: object): string[] {
  return Object.keys(accion).filter((k) => k.startsWith('Requiere') && !CLAVES_CONOCIDAS.has(k));
}
