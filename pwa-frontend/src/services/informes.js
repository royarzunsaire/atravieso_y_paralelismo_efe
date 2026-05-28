import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Extraer el base64 puro de un Data URL
 * "data:application/pdf;base64,JVBER..." → "JVBER..."
 */
function stripDataUrlPrefix(dataUrl) {
  if (!dataUrl) return '';
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
}

/**
 * Convertir un File a data URL usando FileReader
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export const informesService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  /**
   * Subir un informe PDF o Word asociado a una inspección
   *
   * @param {Object} params
   * @param {number}  params.solicitudId
   * @param {string}  params.codigoSolicitud
   * @param {string}  params.inspeccionId
   * @param {string}  params.fileName
   * @param {string}  params.fileContentBase64  – base64 puro (sin prefijo data:...)
   * @param {string}  params.contentType         – MIME type
   * @returns {Promise<Object>}
   */
  async upload({ solicitudId, codigoSolicitud, inspeccionId, fileName, fileContentBase64, contentType }) {
    const response = await fetch(`${API_URL}/api/informes/upload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        solicitudId,
        codigoSolicitud,
        inspeccionId,
        fileName,
        fileContentBase64,
        contentType,
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
      throw new Error(result.message || 'Error al subir el informe');
    }

    return result.data;
  },

  /**
   * Leer un File y devolver los datos listos para upload
   * @param {File} file
   * @returns {Promise<{ fileName: string, fileContentBase64: string, contentType: string, sizeKb: number }>}
   */
  async readFile(file) {
    const dataUrl = await fileToDataUrl(file);
    return {
      fileName:         file.name,
      fileContentBase64: stripDataUrlPrefix(dataUrl),
      contentType:      file.type,
      sizeKb:           Math.round(file.size / 1024),
    };
  },
};
