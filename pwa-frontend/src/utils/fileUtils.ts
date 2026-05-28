const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

/** Devuelve true si el archivo es una imagen por su extensión */
export function isImageFile(fileName: string): boolean {
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

/** Devuelve true si el archivo es un documento (PDF/Word) por su extensión */
export function isDocumentFile(fileName: string): boolean {
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? '';
  return DOCUMENT_EXTENSIONS.has(ext);
}

// Obtener información del icono según extensión
export const getFileIconInfo = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return { bg: 'bg-red-100', color: 'bg-red-600', text: 'PDF' };
    
    case 'doc':
    case 'docx':
      return { bg: 'bg-blue-100', color: 'bg-blue-600', text: 'DOC' };
    
    case 'xls':
    case 'xlsx':
      return { bg: 'bg-green-100', color: 'bg-green-600', text: 'XLS' };
    
    case 'ppt':
    case 'pptx':
      return { bg: 'bg-orange-100', color: 'bg-orange-600', text: 'PPT' };
    
    case 'png':
      return { bg: 'bg-purple-100', color: 'bg-purple-600', text: 'PNG' };
    
    case 'jpg':
    case 'jpeg':
      return { bg: 'bg-purple-100', color: 'bg-purple-600', text: 'JPG' };
    
    case 'gif':
      return { bg: 'bg-pink-100', color: 'bg-pink-600', text: 'GIF' };
    
    case 'bmp':
    case 'webp':
      return { bg: 'bg-pink-100', color: 'bg-pink-600', text: extension.toUpperCase() };
    
    case 'zip':
      return { bg: 'bg-yellow-100', color: 'bg-yellow-600', text: 'ZIP' };
    
    case 'rar':
      return { bg: 'bg-yellow-100', color: 'bg-yellow-600', text: 'RAR' };
    
    case '7z':
      return { bg: 'bg-yellow-100', color: 'bg-yellow-600', text: '7Z' };
    
    case 'txt':
      return { bg: 'bg-gray-100', color: 'bg-gray-600', text: 'TXT' };
    
    case 'md':
      return { bg: 'bg-gray-100', color: 'bg-gray-600', text: 'MD' };
    
    case 'csv':
      return { bg: 'bg-teal-100', color: 'bg-teal-600', text: 'CSV' };
    
    default:
      return { bg: 'bg-gray-100', color: 'bg-gray-600', text: '?' };
  }
};

// Sistema de colores detallado por tipo de documento
export const getTipoDocumentoColor = (tipoDocumento: string): string => {
  const tipo = tipoDocumento.toLowerCase();
  
  // Planos - Diferentes tonos de azul
  if (tipo.includes('planos planta')) return 'bg-blue-50 border-blue-300';
  if (tipo.includes('planos evaluaciones')) return 'bg-blue-100 border-blue-400';
  if (tipo.includes('planos planimetria')) return 'bg-blue-50 border-blue-300';
  if (tipo.includes('planos')) return 'bg-blue-50 border-blue-300';
  
  // Metodología - Naranja
  if (tipo.includes('metodolog')) return 'bg-orange-50 border-orange-300';
  
  // Certificados - Verde
  if (tipo.includes('certificado kilometraje')) return 'bg-green-50 border-green-300';
  if (tipo.includes('certificado título')) return 'bg-green-100 border-green-400';
  if (tipo.includes('certificado')) return 'bg-green-50 border-green-300';
  
  // Pagos y Comprobantes - Amarillo/Oro
  if (tipo.includes('comprobante pago')) return 'bg-yellow-50 border-yellow-300';
  if (tipo.includes('respaldo de pago')) return 'bg-yellow-100 border-yellow-400';
  if (tipo.includes('instructivo de pago')) return 'bg-yellow-50 border-yellow-300';
  if (tipo.includes('datos de transferencia')) return 'bg-yellow-50 border-yellow-300';
  
  // Contratos - Morado
  if (tipo.includes('contrato de revisión')) return 'bg-purple-50 border-purple-300';
  if (tipo.includes('contrato cobro')) return 'bg-purple-100 border-purple-400';
  if (tipo.includes('contrato organismo')) return 'bg-purple-50 border-purple-300';
  if (tipo.includes('contrato')) return 'bg-purple-50 border-purple-300';
  
  // Observaciones y Comunicaciones - Rojo/Rosa
  if (tipo.includes('observaciones')) return 'bg-red-50 border-red-300';
  if (tipo.includes('comunicación rechazo')) return 'bg-red-100 border-red-400';
  
  // Minutas y Oficios - Cyan
  if (tipo.includes('minuta')) return 'bg-cyan-50 border-cyan-300';
  if (tipo.includes('oficio')) return 'bg-cyan-100 border-cyan-400';
  
  // Presupuestos - Amarillo oscuro
  if (tipo.includes('elaboración presupuesto')) return 'bg-amber-50 border-amber-300';
  if (tipo.includes('presupuesto cobro')) return 'bg-amber-100 border-amber-400';
  if (tipo.includes('presupuesto')) return 'bg-amber-50 border-amber-300';
  
  // Escrituras y Documentos Legales - Índigo
  if (tipo.includes('escritura')) return 'bg-indigo-50 border-indigo-300';
  if (tipo.includes('vigencia')) return 'bg-indigo-100 border-indigo-400';
  if (tipo.includes('rut empresa')) return 'bg-indigo-50 border-indigo-300';
  if (tipo.includes('resolución') || tipo.includes('decreto')) return 'bg-indigo-100 border-indigo-400';
  
  // Antecedentes - Teal
  if (tipo.includes('antecedentes representantes')) return 'bg-teal-50 border-teal-300';
  if (tipo.includes('antecedentes administradores')) return 'bg-teal-100 border-teal-400';
  if (tipo.includes('antecedentes director')) return 'bg-teal-50 border-teal-300';
  
  // Boleta de Garantía - Verde oscuro
  if (tipo.includes('boleta de garantia')) return 'bg-emerald-50 border-emerald-300';
  
  // Excepción Normativa - Naranja oscuro
  if (tipo.includes('excepción normativa')) return 'bg-orange-100 border-orange-400';
  
  // Carta Gantt - Cyan oscuro
  if (tipo.includes('carta gantt')) return 'bg-sky-50 border-sky-300';
  
  // Memorias - Slate
  if (tipo.includes('memoria descriptiva')) return 'bg-slate-50 border-slate-300';
  if (tipo.includes('memoria de cálculo')) return 'bg-slate-100 border-slate-400';
  
  // Set Fotográfico - Rosa
  if (tipo.includes('set fotográfico')) return 'bg-pink-50 border-pink-300';
  
  // Apartados - Violet
  if (tipo.includes('apartado operacional')) return 'bg-violet-50 border-violet-300';
  if (tipo.includes('apartado de infraestructura')) return 'bg-violet-100 border-violet-400';
  
  // Adicionales - Lime
  if (tipo.includes('adicionales')) return 'bg-lime-50 border-lime-300';
  
  // Notificaciones - Fuchsia
  if (tipo.includes('notificación')) return 'bg-fuchsia-50 border-fuchsia-300';
  
  // Dirección y Datos de Contacto - Blue-gray
  if (tipo.includes('dirección comercial')) return 'bg-gray-50 border-gray-300';
  if (tipo.includes('correo') || tipo.includes('teléfono')) return 'bg-gray-100 border-gray-400';
  
  // Declaraciones - Purple oscuro
  if (tipo.includes('declaración')) return 'bg-purple-100 border-purple-400';
  
  // Otros Documentos - Gris
  if (tipo.includes('otros')) return 'bg-gray-50 border-gray-300';
  
  // Default
  return 'bg-gray-50 border-gray-200';
};

// Color del badge según tipo de documento (fondo y texto)
export const getTipoDocumentoBadgeColor = (tipoDocumento: string): string => {
  const tipo = tipoDocumento.toLowerCase();
  
  // Planos - Azul
  if (tipo.includes('planos')) return 'bg-blue-100 text-blue-700 border-blue-300';
  
  // Metodología - Naranja
  if (tipo.includes('metodolog')) return 'bg-orange-100 text-orange-700 border-orange-300';
  
  // Certificados - Verde
  if (tipo.includes('certificado')) return 'bg-green-100 text-green-700 border-green-300';
  
  // Pagos y Comprobantes - Amarillo
  if (tipo.includes('pago') || tipo.includes('comprobante') || tipo.includes('instructivo de pago') || tipo.includes('transferencia')) {
    return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  }
  
  // Contratos - Morado
  if (tipo.includes('contrato')) return 'bg-purple-100 text-purple-700 border-purple-300';
  
  // Observaciones - Rojo
  if (tipo.includes('observaciones') || tipo.includes('rechazo')) return 'bg-red-100 text-red-700 border-red-300';
  
  // Minutas y Oficios - Cyan
  if (tipo.includes('minuta') || tipo.includes('oficio')) return 'bg-cyan-100 text-cyan-700 border-cyan-300';
  
  // Presupuestos - Ámbar
  if (tipo.includes('presupuesto')) return 'bg-amber-100 text-amber-700 border-amber-300';
  
  // Escrituras - Índigo
  if (tipo.includes('escritura') || tipo.includes('vigencia') || tipo.includes('rut') || tipo.includes('resolución') || tipo.includes('decreto')) {
    return 'bg-indigo-100 text-indigo-700 border-indigo-300';
  }
  
  // Antecedentes - Teal
  if (tipo.includes('antecedentes')) return 'bg-teal-100 text-teal-700 border-teal-300';
  
  // Boleta de Garantía - Esmeralda
  if (tipo.includes('boleta')) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  
  // Excepción - Naranja oscuro
  if (tipo.includes('excepción')) return 'bg-orange-200 text-orange-800 border-orange-400';
  
  // Carta Gantt - Sky
  if (tipo.includes('gantt') || tipo.includes('cronograma')) return 'bg-sky-100 text-sky-700 border-sky-300';
  
  // Memorias - Slate
  if (tipo.includes('memoria')) return 'bg-slate-100 text-slate-700 border-slate-300';
  
  // Fotográfico - Rosa
  if (tipo.includes('fotográfico')) return 'bg-pink-100 text-pink-700 border-pink-300';
  
  // Apartados - Violeta
  if (tipo.includes('apartado')) return 'bg-violet-100 text-violet-700 border-violet-300';
  
  // Adicionales - Lima
  if (tipo.includes('adicional')) return 'bg-lime-100 text-lime-700 border-lime-300';
  
  // Notificaciones - Fucsia
  if (tipo.includes('notificación')) return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300';
  
  // Dirección y contacto - Gris
  if (tipo.includes('dirección') || tipo.includes('correo') || tipo.includes('teléfono')) {
    return 'bg-gray-100 text-gray-700 border-gray-300';
  }
  
  // Declaraciones - Púrpura oscuro
  if (tipo.includes('declaración')) return 'bg-purple-200 text-purple-800 border-purple-400';
  
  // Otros - Gris
  if (tipo.includes('otros')) return 'bg-gray-100 text-gray-600 border-gray-300';
  
  // Default
  return 'bg-gray-100 text-gray-600 border-gray-300';
};

// Descargar archivo desde SharePoint
export const downloadFileFromSharePoint = async (url: string, fileName: string) => {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error descargando archivo:', error);
    return false;
  }
};