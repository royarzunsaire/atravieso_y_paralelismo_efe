import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Extraer el base64 puro de un Data URL
 * "data:image/jpeg;base64,/9j/4A..." → "/9j/4A..."
 */
function stripDataUrlPrefix(dataUrl) {
  if (!dataUrl) return '';
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
}

export const fotosService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  /**
   * Subir una sola foto
   * @param {Object} params
   * @param {number}  params.solicitudId
   * @param {string}  params.codigoSolicitud
   * @param {string}  params.inspeccionId
   * @param {string}  params.photoDataUrl    – data:image/jpeg;base64,...
   * @param {string}  params.description
   * @param {number}  params.index           – índice para generar nombre
   * @returns {Promise<Object>}
   */
  async uploadOne({ solicitudId, codigoSolicitud, inspeccionId, photoDataUrl, description, index }) {
    const fileContentBase64 = stripDataUrlPrefix(photoDataUrl);

    const timestamp = Date.now();
    const fileName = `foto_${String(index + 1).padStart(3, '0')}_${timestamp}.jpg`;

    const response = await fetch(`${API_URL}/api/fotos/upload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        solicitudId,
        codigoSolicitud,
        inspeccionId,
        fileName,
        fileContentBase64,
        description: description || '',
      }),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Error del servidor: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Error al subir foto');
    }

    return result.data;
  },

  /**
   * Subir múltiples fotos secuencialmente
   * Retorna un resumen con éxitos y errores
   *
   * @param {Object}   params
   * @param {number}   params.solicitudId
   * @param {string}   params.codigoSolicitud
   * @param {string}   params.inspeccionId
   * @param {Array}    params.photos – [{ id, url (dataUrl), description }]
   * @param {Function} [params.onProgress] – callback(uploaded, total)
   * @returns {Promise<{ uploaded: number, failed: number, errors: string[] }>}
   */
  async uploadAll({ solicitudId, codigoSolicitud, inspeccionId, photos, onProgress }) {
    const results = { uploaded: 0, failed: 0, errors: [] };

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        await this.uploadOne({
          solicitudId,
          codigoSolicitud,
          inspeccionId,
          photoDataUrl: photo.url,
          description: photo.description,
          index: i,
        });
        results.uploaded++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Foto ${i + 1}: ${err.message}`);
        console.error(`Error subiendo foto ${i + 1}:`, err);
      }

      if (onProgress) {
        onProgress(i + 1, photos.length);
      }
    }

    return results;
  },

  /**
   * Obtener fotos de una inspección
   */
  async getByInspeccionId(inspeccionId) {
    const response = await fetch(`${API_URL}/api/fotos/inspeccion/${inspeccionId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada.');
    }

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  },
};
