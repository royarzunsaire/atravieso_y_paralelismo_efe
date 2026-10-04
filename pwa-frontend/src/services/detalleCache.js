/**
 * Cache en memoria del detalle de obra (API_Detalle, v2). Vive solo
 * mientras dura la sesión de la pestaña — no persiste en localStorage
 * porque las URLs de archivos que trae expiran ~1h (spec 13). Sirve para
 * que el dashboard "caliente" las obras más recientes en segundo plano y
 * el detalle abra instantáneo si ya está precargado.
 */
const cache = new Map();
const inspecciones = new Map();
// Motivo de la detención por obra (promesa cacheada; clave "id|fechaDetencion").
const motivos = new Map();
// Quien quiera enterarse de que llegó un detalle nuevo (ej. la etiqueta «ACTA RECHAZADA» del dashboard).
const oyentes = new Set();
// Obras a las que se les espera un documento recién subido (la API tarda en reflejarlo en el detalle).
const esperandoDocumentos = new Set();

// Las URLs de descarga de la API vencen en ~1 h: el caché se descarta antes
// para que nunca se muestre un archivo con el enlace vencido.
const TTL_MS = 45 * 60 * 1000;
const vigente = (entrada) => entrada && Date.now() - entrada.fetchedAt < TTL_MS;
// Ids ya intentados en esta sesión (éxito o error) — para que el prefetch
// del dashboard no reintente la misma obra en cada remount/navegación.
const intentados = new Set();

export const detalleCache = {
  get(solicitudId) {
    const e = cache.get(solicitudId);
    if (vigente(e)) return e;
    cache.delete(solicitudId);
    return null;
  },

  set(solicitudId, data) {
    cache.set(solicitudId, { data, fetchedAt: Date.now() });
    oyentes.forEach((f) => f());
  },

  esperaDocumentos(solicitudId) {
    return esperandoDocumentos.has(solicitudId);
  },

  marcarEsperaDocumentos(solicitudId, activo) {
    if (activo) esperandoDocumentos.add(solicitudId);
    else esperandoDocumentos.delete(solicitudId);
    oyentes.forEach((f) => f());
  },

  suscribir(fn) {
    oyentes.add(fn);
    return () => { oyentes.delete(fn); };
  },

  // Detalle completo de cada inspección (GET /inspecciones/{id}).
  getInspeccion(inspeccionId) {
    const e = inspecciones.get(inspeccionId);
    if (vigente(e)) return e;
    inspecciones.delete(inspeccionId);
    return null;
  },

  setInspeccion(inspeccionId, data) {
    inspecciones.set(inspeccionId, { data, fetchedAt: Date.now() });
  },

  // Tras un evento (inspección, detención...) el detalle de la obra ya no es
  // cierto y se descarta (contrato CU-05). Las inspecciones ya cargadas NO
  // cambian: se conservan, así solo se pide la nueva (no las N de nuevo).
  invalidarObra(solicitudId) {
    cache.delete(solicitudId);
    intentados.delete(solicitudId);
    for (const k of motivos.keys()) if (k.startsWith(`${solicitudId}|`)) motivos.delete(k);
  },

  // Botón "Actualizar": el usuario pide lo último del servidor → se descarta
  // todo el detalle cacheado (las obras se precargan de nuevo en segundo plano).
  limpiarTodo() {
    cache.clear();
    inspecciones.clear();
    motivos.clear();
    intentados.clear();
    esperandoDocumentos.clear();
  },

  getMotivo(clave) {
    return motivos.get(clave) ?? null;
  },

  setMotivo(clave, promesa) {
    motivos.set(clave, promesa);
  },

  borrarMotivo(clave) {
    motivos.delete(clave);
  },

  yaIntentado(solicitudId) {
    return intentados.has(solicitudId);
  },

  marcarIntentado(solicitudId) {
    intentados.add(solicitudId);
  },
};
