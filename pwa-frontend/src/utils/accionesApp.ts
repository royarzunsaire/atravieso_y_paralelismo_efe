// Ctrl. Obra (contrato CU-04 / CU-28): muestra TODAS las acciones habilitadas cuyo grupo del catálogo
// sea «Control de obra» (ver `gruposAcciones.ts`); una acción nueva de ese grupo aparece sola.
// Los trámites documentales, las inspecciones y la validación del informe tienen su propia pantalla.

export const GRUPOS_CTRL_OBRA: readonly string[] = ['Control de obra'];

/** Aviso que se muestra en el formulario antes de enviar (acciones sin vuelta atrás). */
export const AVISO_CONFIRMACION: Record<string, string> = {
  OBRA_FINALIZADA: 'Vas a declarar la obra como finalizada. Esta acción no se puede deshacer.',
  VALIDAR_INFORME: 'Vas a aprobar el informe final.',
  RECHAZAR_INFORME: 'Vas a rechazar el informe final. El ITO deberá corregirlo: explica el motivo.',
};
