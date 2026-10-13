import type { AccionCatalogo, CatalogoInicio, ObraInicio } from '@/types/eventos';

/**
 * Definición VIGENTE de una acción para una obra (contrato CU-35): las banderas (RequiereComentario,
 * RequiereAdjunto, RequiereAvance, TiposDocumento) salen SIEMPRE de `AccionesDef` de la obra, que es lo que la API
 * entrega fresco en cada carga; el catálogo solo completa lo que la obra no trae (etiqueta, ícono, grupo, orden).
 * `porDefecto` son valores de la app para una acción que ni el catálogo ni la obra describen.
 * Devuelve null si no hay ninguna definición.
 */
export function definicionVigente(
  obra: ObraInicio | null | undefined,
  catalogo: CatalogoInicio | null | undefined,
  codigo: string,
  porDefecto: Partial<AccionCatalogo> = {},
): AccionCatalogo | null {
  const def = catalogo?.TiposEvento?.find((t) => t.Codigo === codigo);
  const fresca = obra?.AccionesDef?.[codigo];
  if (!def && !fresca) return null;
  return {
    Codigo: codigo, Label: codigo, Icono: 'file-up', Grupo: '', Orden: 99,
    RequiereComentario: false, RequiereAdjunto: false, RequiereAvance: false, TiposDocumento: [],
    ...porDefecto, ...def, ...fresca,
  } as AccionCatalogo;
}
