/**
 * Qué campos del formulario soporta HOY la API directa a SharePoint (spec 13).
 * Es la ÚNICA fuente de verdad para los carteles "Pendiente en la API":
 * un cartel se muestra solo si el campo está en `false` acá. Cuando el
 * cliente habilite un campo, se cambia a `true` y el cartel desaparece solo.
 * Ver references/contrato-ui.md.
 */
export const API_SOPORTA = {
  fechaInspeccion: true, // FechaEvento en la raíz del evento (confirmado 28-09-2026)
  tipoInspeccion: true, // Payload.TipoInspeccionId (confirmado 28-09-2026)
  comentario: true, // Payload.Comentario — único texto que guarda la API
  notificarUsuarios: false, // no existe campo en la API
} as const;

export type CampoApi = keyof typeof API_SOPORTA;
