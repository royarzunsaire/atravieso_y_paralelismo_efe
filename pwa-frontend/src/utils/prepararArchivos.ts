// ========================================
// Preparación de archivos para API_Evento_Obra_v2 (spec 10)
// Reglas del MD: nombres únicos, validación de peso ANTES de enviar,
// y los 3 canales (Fotos / Informes / Documento) que no son intercambiables.
// ========================================

/** Un archivo listo para viajar en el Payload. */
export interface ArchivoBase64 {
  Nombre: string;
  Contenido: string; // base64 SIN el prefijo data:...
}

export interface DocumentoBase64 extends ArchivoBase64 {
  TipoDocumentoId?: number;
}

// Límites del MD (con margen deliberado bajo el techo real de la plataforma).
const MAX_FOTO_MB = 1;
const MAX_DOCUMENTO_MB = 10;
const MAX_PAYLOAD_MB = 15;

/** "data:image/jpeg;base64,/9j/4A..." → "/9j/4A..." */
export function stripDataUrl(dataUrl: string): string {
  if (!dataUrl) return '';
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.substring(i + 1) : dataUrl;
}

/** Peso aproximado en MB de un contenido base64 (base64 infla ~33%). */
export function pesoBase64MB(base64: string): number {
  if (!base64) return 0;
  return (base64.length * 3) / 4 / (1024 * 1024);
}

/**
 * Nombre único: antepone parte del EventoIdExterno + índice al nombre
 * original. Evita que dos archivos con el mismo nombre se pisen en silencio
 * en SharePoint (la falla más difícil de detectar, según el MD), y permite
 * rastrear el archivo hasta el evento que lo generó.
 */
export function nombreUnico(eventoIdExterno: string, indice: number, nombreOriginal: string): string {
  const prefijo = (eventoIdExterno || '').slice(0, 8) || 'evt';
  const limpio = (nombreOriginal || 'archivo').replace(/[^\w.\-]/g, '_');
  return `${prefijo}_${indice}_${limpio}`;
}

export class ArchivoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchivoInvalidoError';
  }
}

/**
 * Valida el peso de un conjunto de archivos ANTES de enviar. Lanza
 * ArchivoInvalidoError con un mensaje accionable si algo se pasa — para
 * que la app avise al usuario en vez de dejar fallar la llamada (que
 * perdería el evento completo, no solo el archivo pesado).
 */
export function validarPesos({
  fotos = [],
  informes = [],
  documento = null,
  documentos = [],
}: {
  fotos?: ArchivoBase64[];
  informes?: ArchivoBase64[];
  documento?: DocumentoBase64 | null;
  /** Varios documentos formales en un mismo envío (una acción con varios tipos de documento, CU-30). */
  documentos?: DocumentoBase64[];
}): void {
  for (const f of fotos) {
    const mb = pesoBase64MB(f.Contenido);
    if (mb > MAX_FOTO_MB) {
      throw new ArchivoInvalidoError(
        `La foto "${f.Nombre}" pesa ${mb.toFixed(1)} MB y el máximo es ${MAX_FOTO_MB} MB. ` +
        `Vuelve a tomarla con la cámara de la app, que la comprime automáticamente.`
      );
    }
  }

  for (const inf of informes) {
    const mb = pesoBase64MB(inf.Contenido);
    if (mb > MAX_DOCUMENTO_MB) {
      throw new ArchivoInvalidoError(
        `El archivo "${inf.Nombre}" pesa ${mb.toFixed(1)} MB y el máximo es ${MAX_DOCUMENTO_MB} MB. ` +
        `Vuelve a escanearlo en calidad media, o sácale una foto con la cámara de la app.`
      );
    }
  }

  for (const doc of documento ? [documento, ...documentos] : documentos) {
    const mb = pesoBase64MB(doc.Contenido);
    if (mb > MAX_DOCUMENTO_MB) {
      throw new ArchivoInvalidoError(
        `El documento "${doc.Nombre}" pesa ${mb.toFixed(1)} MB y el máximo es ${MAX_DOCUMENTO_MB} MB. ` +
        `Vuelve a escanearlo en calidad media, o sácale una foto con la cámara de la app.`
      );
    }
  }

  const totalMB =
    fotos.reduce((s, f) => s + pesoBase64MB(f.Contenido), 0) +
    informes.reduce((s, i) => s + pesoBase64MB(i.Contenido), 0) +
    (documento ? pesoBase64MB(documento.Contenido) : 0) +
    documentos.reduce((sum, d) => sum + pesoBase64MB(d.Contenido), 0);

  if (totalMB > MAX_PAYLOAD_MB) {
    throw new ArchivoInvalidoError(
      `El envío completo pesa ${totalMB.toFixed(1)} MB y el máximo es ${MAX_PAYLOAD_MB} MB. ` +
      `Divide el envío en dos: manda algunas fotos ahora y el resto en un segundo registro.`
    );
  }
}

/**
 * Arma el arreglo de Fotos con nombres únicos, desde data URLs. Las fotos
 * ya vienen comprimidas de PhotoCapture (1600px). No incluye documentos —
 * esos van en su propio canal.
 */
export function armarFotos(eventoIdExterno: string, dataUrls: string[]): ArchivoBase64[] {
  return dataUrls.map((url, i) => ({
    Nombre: nombreUnico(eventoIdExterno, i + 1, `foto_${i + 1}.jpg`),
    Contenido: stripDataUrl(url),
  }));
}

/** Arma el arreglo de Informes (adjuntos de inspección que no son fotos). */
export function armarInformes(
  eventoIdExterno: string,
  archivos: Array<{ nombre: string; dataUrl: string }>
): ArchivoBase64[] {
  return archivos.map((a, i) => ({
    Nombre: nombreUnico(eventoIdExterno, i + 1, a.nombre),
    Contenido: stripDataUrl(a.dataUrl),
  }));
}

/** Arma el Documento formal de la obra (acta, informe final). */
export function armarDocumento(
  eventoIdExterno: string,
  archivo: { nombre: string; dataUrl: string; tipoDocumentoId?: number },
  indice = 1,
): DocumentoBase64 {
  return {
    Nombre: nombreUnico(eventoIdExterno, indice, archivo.nombre),
    Contenido: stripDataUrl(archivo.dataUrl),
    ...(archivo.tipoDocumentoId != null ? { TipoDocumentoId: archivo.tipoDocumentoId } : {}),
  };
}
