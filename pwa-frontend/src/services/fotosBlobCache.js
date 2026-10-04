/**
 * Cache en memoria de fotos/informes descargados como blob (spec 13). El
 * gateway del cliente manda `Cross-Origin-Resource-Policy: same-origin`,
 * que bloquea un <img src> directo entre orígenes — por eso se descarga
 * con fetch() (que sí funciona, el servidor manda CORS abierto) y se arma
 * un object URL local. Compartido entre la precarga en segundo plano
 * (SolicitudDetail) y PhotosModal, para no descargar la misma foto dos
 * veces. Vive solo mientras dura la sesión de la pestaña.
 */
const cache = new Map(); // url -> Promise<string objectURL>

export const fotosBlobCache = {
  /** Devuelve el object URL (de cache o recién descargado). Nunca lanza silenciosamente sin avisar al llamador. */
  getOrFetch(url) {
    if (!url) return Promise.reject(new Error('URL vacía'));
    if (!cache.has(url)) {
      const promise = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then((blob) => URL.createObjectURL(blob))
        .catch((err) => {
          cache.delete(url); // no cachear fallos — permite reintentar más tarde
          throw err;
        });
      cache.set(url, promise);
    }
    return cache.get(url);
  },

  /** Vacía el caché y libera los object URLs (al cambiar de sesión). */
  limpiar() {
    for (const promesa of cache.values()) {
      promesa.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    }
    cache.clear();
  },

  /** Dispara la descarga en segundo plano, sin esperar ni propagar errores. */
  prefetch(url) {
    if (!url) return;
    void this.getOrFetch(url).catch(() => {});
  },
};
