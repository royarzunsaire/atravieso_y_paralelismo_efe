// ========================================
// UTILIDADES PARA SOLICITUDES
// ========================================

/**
 * Obtiene el color CSS según la prioridad de la solicitud
 * @param prioridad - Prioridad de la solicitud (Alta, Media, Baja)
 * @returns Clases CSS de Tailwind para el color
 */
export const getPrioridadColor = (prioridad: string | null): string => {
  if (!prioridad) {
    return 'bg-gray-500 text-white';
  }

  switch (prioridad) {
    case 'Alta':
      return 'bg-red-500 text-white';
    case 'Media':
      return 'bg-yellow-500 text-white';
    case 'Baja':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

/**
 * Obtiene el color CSS según la etapa/estado de la solicitud
 * @param etapa - Etapa actual de la solicitud
 * @returns Clase CSS de Tailwind para el color del texto
 */
export const getEstadoColor = (etapa: string | null): string => {
  if (!etapa) {
    return 'text-[#4A4A4A]';
  }

  // Estados activos (en progreso)
  const estadosActivos = [
    'Análisis de Proyecto',
    'Asignación de Proyecto',
    'Recepción de Solicitud'
  ];

  // Estados completados (exitosos)
  const estadosCompletados = [
    'Inicio de Obra',
    'Contrato Firmado',
    'Aprobación y Contrato'
  ];

  // Estados rechazados (finalizados sin éxito)
  const estadosRechazados = [
    'Proyecto Rechazado',
    'Solicitud Devuelta'
  ];

  if (estadosActivos.includes(etapa)) {
    return 'text-[#0066CC]';
  } else if (estadosCompletados.includes(etapa)) {
    return 'text-green-600';
  } else if (estadosRechazados.includes(etapa)) {
    return 'text-red-600';
  }

  return 'text-[#4A4A4A]';
};

/**
 * Obtiene el color CSS según la prioridad (solo texto)
 * @param prioridad - Prioridad de la solicitud
 * @returns Clase CSS de Tailwind para el color del texto
 */
export const getPrioridadTextColor = (prioridad: string | null): string => {
  if (!prioridad) {
    return 'text-gray-600';
  }

  switch (prioridad) {
    case 'Alta':
      return 'text-red-600';
    case 'Media':
      return 'text-yellow-600';
    case 'Baja':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Formatea el código de solicitud para mostrar
 * @param codigo - Código de la solicitud
 * @param id - ID de la solicitud (fallback)
 * @returns String formateado
 */
export const formatSolicitudCodigo = (codigo: string | null, id: number): string => {
  return codigo ? `#${codigo}` : `#${id}`;
};

/**
 * Formatea la ubicación completa
 * @param comuna - Comuna
 * @param region - Región
 * @returns String formateado o null
 */
export const formatUbicacion = (
  comuna: string | null,
  region: string | null
): string | null => {
  if (comuna && region) {
    return `${comuna}, ${region}`;
  }
  return comuna || region || null;
};