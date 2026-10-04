// Mensajes por etapa del indicador de pantalla (contrato CU-22).

export type CambiarEtapa = (mensaje: string) => void;

/** Pasado un rato de espera, el indicador pasa a decir que se espera a la plataforma. Devuelve cómo cancelarlo. */
export function avisarEsperaPlataforma(etapa: CambiarEtapa | undefined, ms = 3000): () => void {
  if (!etapa) return () => {};
  const t = setTimeout(() => etapa('Esperando la confirmación de la plataforma…'), ms);
  return () => clearTimeout(t);
}

/** Mensaje de envío según lo que se sube. */
export function mensajeEnvio(args: { fotos?: number; informes?: number; documentos?: number; porDefecto: string }): string {
  const { fotos = 0, informes = 0, documentos = 0, porDefecto } = args;
  if (fotos > 0 && informes > 0) return 'Subiendo fotos e informe…';
  if (fotos > 0) return fotos > 1 ? 'Subiendo fotos…' : 'Subiendo foto…';
  if (informes > 0) return 'Subiendo informe…';
  if (documentos > 0) return 'Subiendo documento…';
  return porDefecto;
}
