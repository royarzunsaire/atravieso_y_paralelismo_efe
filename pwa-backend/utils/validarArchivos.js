// Validación en el SERVIDOR del Payload de POST /api/v2/eventos (hallazgo H-11).
// La validación del frontend (utils/prepararArchivos.ts) es solo comodidad: es manipulable. Acá se exige lo mismo
// y además la FIRMA real del archivo (magic bytes), para que un ejecutable renombrado a .pdf no pase.
// HEIC/HEIF no se admite a propósito: la app convierte las fotos a JPEG antes de enviarlas.

const MB = 1024 * 1024;

const LIMITES = {
  maxFotos: 20,
  maxInformes: 10,
  maxDocumentos: 10,
  maxFotoBytes: 1 * MB,
  maxArchivoBytes: 10 * MB,
  maxTotalBytes: 15 * MB,
  maxNombre: 200,
  maxComentario: 10000,
};

const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'webp'];
const EXT_DOCUMENTO = ['pdf', 'doc', 'docx', ...EXT_IMAGEN];

// Claves del Payload que el contrato admite; cualquier otra se descarta (no viaja a Oracle ni a SharePoint).
const CLAVES_PERMITIDAS = new Set([
  'Comentario', 'EstadoInspeccion', 'AvancePct', 'Latitud', 'Longitud', 'TipoInspeccionId',
  'Fotos', 'Informes', 'Documentos', 'Documento',
]);

class PayloadInvalidoError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'PayloadInvalidoError';
    this.codigo = codigo;
  }
}

const base64Valido = (s) => typeof s === 'string' && s.length >= 4 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
const bytesDeBase64 = (s) => Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

/** ¿Los primeros bytes del contenido corresponden a la extensión declarada? */
function firmaCoincide(ext, base64) {
  // Se decodifica solo el comienzo (1368 caracteres base64 = 1026 bytes), no el archivo completo.
  const ini = Buffer.from(base64.slice(0, 1368), 'base64');
  const empieza = (...bytes) => bytes.every((b, i) => ini[i] === b);
  switch (ext) {
    case 'pdf': return ini.subarray(0, 1024).includes('%PDF-');
    case 'jpg':
    case 'jpeg': return empieza(0xFF, 0xD8, 0xFF);
    case 'png': return empieza(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
    case 'webp': return ini.subarray(0, 4).toString('latin1') === 'RIFF' && ini.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'doc': return empieza(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
    case 'docx': return empieza(0x50, 0x4B, 0x03, 0x04);
    default: return false;
  }
}

/** Valida un archivo y devuelve su peso en bytes (lanza PayloadInvalidoError si algo no cuadra). */
function validarArchivo(a, { extensiones, maxBytes, canal }) {
  const nombre = typeof a?.Nombre === 'string' ? a.Nombre.trim() : '';
  const corto = nombre.slice(0, 60).replace(/[\u0000-\u001f\u007f]/g, '') || 'sin nombre';
  const falla = (motivo) => new PayloadInvalidoError('ARCHIVO_INVALIDO', `El archivo «${corto}» (${canal}) no es válido: ${motivo}.`);

  if (!nombre || nombre.length > LIMITES.maxNombre || /[\\/\u0000-\u001f\u007f]/.test(nombre)) throw falla('el nombre no es válido');
  const ext = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
  if (!extensiones.includes(ext)) throw falla(`solo se admiten ${extensiones.join(', ')}`);
  if (!base64Valido(a.Contenido)) throw falla('el contenido no es base64 válido');
  const bytes = bytesDeBase64(a.Contenido);
  if (bytes > maxBytes) throw falla(`pesa más de ${Math.round(maxBytes / MB)} MB`);
  if (!firmaCoincide(ext, a.Contenido)) throw falla('su contenido no corresponde a la extensión');
  return { ext, bytes, nombre };
}

function listaDe(valor, canal, max) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw new PayloadInvalidoError('PAYLOAD_INVALIDO', `${canal} debe ser una lista de archivos.`);
  if (valor.length > max) throw new PayloadInvalidoError('DEMASIADOS_ARCHIVOS', `${canal}: máximo ${max} archivos por envío.`);
  return valor;
}

/**
 * Valida y limpia el Payload de un evento. Devuelve un objeto NUEVO solo con las claves del contrato.
 * Lanza PayloadInvalidoError (400) ante cualquier incumplimiento.
 */
function validarPayloadEvento(payload) {
  const limpio = {};
  for (const k of Object.keys(payload)) if (CLAVES_PERMITIDAS.has(k)) limpio[k] = payload[k];

  // ── Campos escalares ──
  const { Comentario, EstadoInspeccion, AvancePct, Latitud, Longitud, TipoInspeccionId } = limpio;
  const invalido = (campo, regla) => new PayloadInvalidoError('PAYLOAD_INVALIDO', `${campo} no es válido: ${regla}.`);
  if (Comentario != null && (typeof Comentario !== 'string' || Comentario.length > LIMITES.maxComentario)) throw invalido('Comentario', `texto de hasta ${LIMITES.maxComentario} caracteres`);
  if (EstadoInspeccion != null && (typeof EstadoInspeccion !== 'string' || EstadoInspeccion.length > 50)) throw invalido('EstadoInspeccion', 'texto corto');
  if (AvancePct != null && (typeof AvancePct !== 'number' || !Number.isFinite(AvancePct) || AvancePct < 0 || AvancePct > 100)) throw invalido('AvancePct', 'número entre 0 y 100');
  if (Latitud != null && (typeof Latitud !== 'number' || !Number.isFinite(Latitud) || Math.abs(Latitud) > 90)) throw invalido('Latitud', 'número entre -90 y 90');
  if (Longitud != null && (typeof Longitud !== 'number' || !Number.isFinite(Longitud) || Math.abs(Longitud) > 180)) throw invalido('Longitud', 'número entre -180 y 180');
  if (TipoInspeccionId != null && (!Number.isInteger(TipoInspeccionId) || TipoInspeccionId <= 0)) throw invalido('TipoInspeccionId', 'número entero positivo');

  // ── Archivos ──
  const fotos = listaDe(limpio.Fotos, 'Fotos', LIMITES.maxFotos);
  const informes = listaDe(limpio.Informes, 'Informes', LIMITES.maxInformes);
  // «Documento» (uno solo) es el canal antiguo; se normaliza a la lista «Documentos».
  const docsBase = listaDe(limpio.Documentos, 'Documentos', LIMITES.maxDocumentos);
  if (limpio.Documento != null) {
    if (typeof limpio.Documento !== 'object' || Array.isArray(limpio.Documento)) throw new PayloadInvalidoError('PAYLOAD_INVALIDO', 'Documento debe ser un archivo.');
    docsBase.push(limpio.Documento);
    delete limpio.Documento;
    if (docsBase.length > LIMITES.maxDocumentos) throw new PayloadInvalidoError('DEMASIADOS_ARCHIVOS', `Documentos: máximo ${LIMITES.maxDocumentos} archivos por envío.`);
    limpio.Documentos = docsBase;
  }

  let total = 0;
  const limpiar = (lista, canal, opciones, conTipo) => lista.map((a) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new PayloadInvalidoError('PAYLOAD_INVALIDO', `${canal} contiene un elemento que no es un archivo.`);
    const { bytes, nombre } = validarArchivo(a, { ...opciones, canal });
    total += bytes;
    const salida = { Nombre: nombre, Contenido: a.Contenido };
    if (conTipo && a.TipoDocumentoId != null) {
      const t = Number(a.TipoDocumentoId);
      if (!Number.isInteger(t) || t <= 0) throw new PayloadInvalidoError('ARCHIVO_INVALIDO', `El archivo «${nombre.slice(0, 60)}» (${canal}) trae un tipo de documento inválido.`);
      salida.TipoDocumentoId = t;
    }
    return salida;
  });

  if (fotos.length) limpio.Fotos = limpiar(fotos, 'Fotos', { extensiones: EXT_IMAGEN, maxBytes: LIMITES.maxFotoBytes }, false);
  if (informes.length) limpio.Informes = limpiar(informes, 'Informes', { extensiones: EXT_DOCUMENTO, maxBytes: LIMITES.maxArchivoBytes }, false);
  if (limpio.Documentos?.length) limpio.Documentos = limpiar(limpio.Documentos, 'Documentos', { extensiones: EXT_DOCUMENTO, maxBytes: LIMITES.maxArchivoBytes }, true);

  if (total > LIMITES.maxTotalBytes) {
    throw new PayloadInvalidoError('ENVIO_DEMASIADO_GRANDE', `El envío completo pesa más de ${LIMITES.maxTotalBytes / MB} MB: divídelo en dos.`);
  }
  return limpio;
}

/** Los TipoDocumentoId enviados deben ser de los que la acción define HOY para la obra (si define alguno). */
function validarTiposDocumento(payload, tiposDefinidos) {
  const permitidos = new Set((Array.isArray(tiposDefinidos) ? tiposDefinidos : []).map((t) => Number(t?.Id)));
  if (permitidos.size === 0) return;
  for (const d of payload.Documentos ?? []) {
    if (d.TipoDocumentoId != null && !permitidos.has(d.TipoDocumentoId)) {
      throw new PayloadInvalidoError('ARCHIVO_INVALIDO', `El tipo de documento ${d.TipoDocumentoId} no está permitido para esta acción.`);
    }
  }
}

module.exports = { validarPayloadEvento, validarTiposDocumento, PayloadInvalidoError, LIMITES };
