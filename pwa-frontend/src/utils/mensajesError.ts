// Traduce un error técnico a un mensaje que el usuario entienda (contrato CU-22).
// Regla: SIEMPRE se informa la causa; nunca un aviso genérico ni una pantalla colgada.

export interface ErrorParaUsuario {
  /** Título corto del popup. */
  titulo: string;
  /** Qué pasó y qué hacer, en lenguaje simple. */
  mensaje: string;
  /** Texto técnico original (se puede desplegar, útil para soporte). */
  detalle?: string;
}

const incluye = (texto: string, ...pistas: string[]) => pistas.some((p) => texto.includes(p));

/** Extrae el texto de cualquier cosa que se haya lanzado (Error, string, objeto). */
function textoDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function traducirError(e: unknown, tituloPorDefecto = 'No se pudo completar la operación'): ErrorParaUsuario {
  const original = textoDe(e).trim();
  const t = original.toLowerCase();

  if (!navigator.onLine || incluye(t, 'failed to fetch', 'networkerror', 'load failed', 'network request failed')) {
    return {
      titulo: 'Sin conexión',
      mensaje: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
      detalle: original,
    };
  }
  if (incluye(t, 'sesión expirada', 'sesion expirada', 'token', 'unauthorized', ' 401')) {
    return {
      titulo: 'Tu sesión venció',
      mensaje: 'Por seguridad tu sesión se cerró. Vuelve a iniciar sesión para continuar.',
      detalle: original,
    };
  }
  if (incluye(t, 'timeout', 'timed out', 'tiempo de espera', 'tardó demasiado')) {
    return {
      titulo: 'La plataforma tardó demasiado',
      mensaje:
        'La plataforma del cliente no respondió a tiempo. Es posible que lo enviado SÍ se haya registrado: ' +
        'actualiza la obra y revisa antes de volver a enviarlo.',
      detalle: original,
    };
  }
  if (incluye(t, 'no está permitida', 'no esta permitida', 'accion_no_permitida', 'no corresponde al estado', 'cambió de estado')) {
    return {
      titulo: 'La obra cambió de estado',
      mensaje: 'Alguien más movió la obra mientras trabajabas, así que esta acción ya no corresponde. Actualiza para ver su estado actual.',
      detalle: original,
    };
  }
  if (incluye(t, 'adjunto', 'documento adjunto', 'al menos un')) {
    return {
      titulo: 'Falta un adjunto',
      mensaje: original.length > 0 ? original : 'Esta acción exige adjuntar al menos un archivo o una foto.',
    };
  }
  if (incluye(t, '413', 'too large', 'demasiado grande', 'demasiado pesado', 'payload too large')) {
    return {
      titulo: 'El archivo es demasiado pesado',
      mensaje: 'Lo que intentas enviar supera el tamaño permitido (fotos hasta 1 MB, documentos hasta 10 MB). Usa un archivo más liviano.',
      detalle: original,
    };
  }
  if (incluye(t, '502', 'sharepoint', 'bad gateway')) {
    return {
      titulo: 'La plataforma del cliente no respondió',
      mensaje: 'SharePoint no respondió en este momento. Espera un momento e inténtalo de nuevo.',
      detalle: original,
    };
  }
  if (original.length > 0) {
    // Sin una traducción conocida: se muestra el motivo tal cual (mejor eso que un aviso genérico).
    return { titulo: tituloPorDefecto, mensaje: original };
  }
  return {
    titulo: tituloPorDefecto,
    mensaje: 'Ocurrió un problema inesperado y no se recibió más información. Inténtalo de nuevo; si se repite, avisa a soporte.',
  };
}
