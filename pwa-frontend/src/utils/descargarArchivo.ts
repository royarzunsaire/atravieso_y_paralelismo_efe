// Descarga un archivo de la API del cliente y lo guarda con su nombre.
// El gateway permite fetch() cross-origin (Access-Control-Allow-Origin: *) pero
// bloquea <img>/<iframe> (CORP), por eso se baja como blob (contrato CU-12).

/** SharePoint antepone un hash de 8 caracteres al nombre ("4c14dc7f_acta.pdf"). */
export const limpiarNombreArchivo = (n: string): string => n.replace(/^[0-9a-f]{8}_/i, '');

export async function descargarArchivo(url: string, nombre: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Error ${r.status} al descargar el archivo.`);
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = objUrl;
  enlace.download = limpiarNombreArchivo(nombre) || 'archivo';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
}
