const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

// URLs de los flows desde variables de entorno
const FLOW_SOLICITUD_READ_ALL_URL = process.env.FLOW_SOLICITUD_READ_ALL_URL;
const FLOW_SOLICITUD_READ_ONE_URL = process.env.FLOW_SOLICITUD_READ_ONE_URL;
const SOLICITUDES_CACHE_TTL_MS = parseInt(process.env.SOLICITUDES_CACHE_TTL_MS || '15000', 10);
const solicitudesCache = {
  rawData: null,
  mappedData: null,
  expiresAt: 0,
  inFlightRequest: null,
};

/**
 * Función para llamar a Power Automate Flow
 */
async function callFlow(flowUrl, data = {}) {
  try {
    const response = await axios.post(flowUrl, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 segundos
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error calling flow:', error.message);
    throw new Error(`Flow error: ${error.message}`);
  }
}

function invalidateSolicitudesCache() {
  solicitudesCache.rawData = null;
  solicitudesCache.mappedData = null;
  solicitudesCache.expiresAt = 0;
}

async function getSolicitudesRawData() {
  const now = Date.now();

  if (solicitudesCache.rawData && now < solicitudesCache.expiresAt) {
    return solicitudesCache.rawData;
  }

  if (solicitudesCache.inFlightRequest) {
    return solicitudesCache.inFlightRequest;
  }

  solicitudesCache.inFlightRequest = callFlow(FLOW_SOLICITUD_READ_ALL_URL)
      .then((rawData) => {
        if (Array.isArray(rawData)) {
          solicitudesCache.rawData = rawData;
          solicitudesCache.mappedData = rawData.map(mapSolicitudItem);
          solicitudesCache.expiresAt = Date.now() + SOLICITUDES_CACHE_TTL_MS;
        } else {
          invalidateSolicitudesCache();
        }

        return rawData;
      })
      .finally(() => {
        solicitudesCache.inFlightRequest = null;
      });

  return solicitudesCache.inFlightRequest;
}

async function getSolicitudesMappedData() {
  const now = Date.now();

  if (solicitudesCache.mappedData && now < solicitudesCache.expiresAt) {
    return solicitudesCache.mappedData;
  }

  const rawData = await getSolicitudesRawData();

  if (!Array.isArray(rawData)) {
    return rawData;
  }

  solicitudesCache.mappedData = rawData.map(mapSolicitudItem);
  return solicitudesCache.mappedData;
}

/**
 * Mapear item de SharePoint a formato limpio
 */
function mapSolicitudItem(item) {
  return {
    id: item.ID,
    title: item.Title,
    codigo: item.Codigo || null,
    observacion: item.Observacion || null,
    descripcion: item.DescripcionObra || null,
    etapa: item.EtapaTexto || null,
    kilometraje: item.Kilometraje || null,
    
    // Campos de lookup (solo valor de texto)
    rolAsignado: item.RolAsignado?.Value || null,
    rolAsignadoId: item.RolAsignado?.Id || null,
    
    estadoSolicitud: item.EstadoSolicitud?.Value || null,
    estadoSolicitudId: item.EstadoSolicitud?.Id || null,
    
    cliente: item.Cliente?.Value || null,
    clienteId: item.Cliente?.Id || null,
    
    comuna: item.Comuna?.Value || null,
    comunaId: item.Comuna?.Id || null,
    
    consultor: item.Consultor?.Value || null,
    consultorId: item.Consultor?.Id || null,
    
    tipoObra: item.TipoObra?.Value || null,
    tipoObraId: item.TipoObra?.Id || null,
    
    tipoProyecto: item.TipoProyecto?.Value || null,
    tipoProyectoId: item.TipoProyecto?.Id || null,
    
    ramal: item.Ramal?.Value || null,
    ramalId: item.Ramal?.Id || null,
    
    tipoServicio: item.TipoServicio?.Value || null,
    tipoServicioId: item.TipoServicio?.Id || null,
    
    region: item.Region?.Value || null,
    regionId: item.Region?.Id || null,
    
    prioridad: item.Prioridad?.Value || null,
    prioridadId: item.Prioridad?.Id || null,
    
    // Campos booleanos
    esExcepcion: item.EsExcepcion || false,
    finalizada: item.Finalizada || false,
    
    // Campos de usuario (Responsable)
    responsable: item.Responsable ? {
      nombre: item.Responsable.DisplayName,
      email: item.Responsable.Email,
      departamento: item.Responsable.Department,
      cargo: item.Responsable.JobTitle,
      foto: item.Responsable.Picture,
    } : null,
    
    // Campos de usuario (Autor)
    autor: item.Autor ? {
      nombre: item.Autor.DisplayName,
      email: item.Autor.Email,
      departamento: item.Autor.Department,
      cargo: item.Autor.JobTitle,
      foto: item.Autor.Picture,
    } : null,
    
    // Metadatos
    hasAttachments: item['{HasAttachments}'] || false,
    link: item['{Link}'] || null,
    versionNumber: item['{VersionNumber}'] || null,
    
    // OData etag para optimistic concurrency
    etag: item['@odata.etag'] || null,
  };
}

/**
 * GET /api/solicitudes/stats/summary
 * Obtener estadísticas resumidas
 * IMPORTANTE: Esta ruta debe ir ANTES de /:id
 */
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    
    console.log(`📊 GET /api/solicitudes/stats/summary - Usuario: ${userEmail}`);
    
    // Obtener todas las solicitudes
    const solicitudes = await getSolicitudesMappedData();
    
    if (!Array.isArray(solicitudes)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response from SharePoint flow',
      });
    }

    
    // Filtrar solo las asignadas al usuario
    const misSolicitudes = solicitudes.filter(s => 
      s.responsable && s.responsable.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    // Calcular estadísticas
    const stats = {
      total: misSolicitudes.length,
      porEstado: {},
      porPrioridad: {
        Alta: 0,
        Media: 0,
        Baja: 0,
      },
      conAdjuntos: misSolicitudes.filter(s => s.hasAttachments).length,
      finalizadas: misSolicitudes.filter(s => s.finalizada).length,
    };
    
    // Contar por estado
    misSolicitudes.forEach(s => {
      if (s.estadoSolicitud) {
        stats.porEstado[s.estadoSolicitud] = (stats.porEstado[s.estadoSolicitud] || 0) + 1;
      }
      
      if (s.prioridad) {
        stats.porPrioridad[s.prioridad] = (stats.porPrioridad[s.prioridad] || 0) + 1;
      }
    });
    
    console.log(`✅ Estadísticas calculadas: ${stats.total} solicitudes asignadas`);
    
    res.json({
      success: true,
      data: stats,
    });
    
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/solicitudes
 * Obtener todas las solicitudes (con filtro opcional por usuario)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { filterByUser } = req.query;
    const userEmail = req.user?.email; // Email del usuario logueado desde el token JWT
    
    console.log(`📥 GET /api/solicitudes - Usuario: ${userEmail}, Filtrar: ${filterByUser}`);
    
    // Llamar al flow para obtener todas las solicitudes
    const solicitudesData = await getSolicitudesMappedData();
    
    // Verificar que sea un array
    if (!Array.isArray(solicitudesData)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response from SharePoint flow',
        message: 'Expected array of items',
      });
    }
    
    // Mapear los items
    let solicitudes = solicitudesData;
    
    console.log(`📋 Total de solicitudes en SharePoint: ${solicitudes.length}`);
    
    // Filtrar por usuario si se solicita
    if (filterByUser === 'true' && userEmail) {
      solicitudes = solicitudes.filter(s => {
        // Solo mostrar las que tienen Responsable asignado Y coincide con el email del usuario
        return s.responsable && s.responsable.email.toLowerCase() === userEmail.toLowerCase();
      });
      console.log(`🔍 Solicitudes filtradas para ${userEmail}: ${solicitudes.length}`);
    }
    
    res.json({
      success: true,
      count: solicitudes.length,
      data: solicitudes,
    });
    
  } catch (error) {
    console.error('❌ Error fetching solicitudes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch solicitudes',
      message: error.message,
    });
  }
});

/**
 * GET /api/solicitudes/:id
 * Obtener una solicitud por ID
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 GET /api/solicitudes/${id}`);
    
    // Validar que ID sea un número
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID',
        message: 'ID must be a number',
      });
    }

    // Optimización: intentar resolver desde caché de listado primero
    const cachedSolicitudes = await getSolicitudesMappedData();
    if (Array.isArray(cachedSolicitudes)) {
      const cachedSolicitud = cachedSolicitudes.find((item) => item.id === parseInt(id));
      if (cachedSolicitud) {
        return res.json({
          success: true,
          data: cachedSolicitud,
          source: 'cache',
        });
      }
    }

    // Si no está en caché, llamar al flow para obtener un item específico
    const rawData = await callFlow(FLOW_SOLICITUD_READ_ONE_URL, {
      id: parseInt(id),
    });
    
    // Verificar que se obtuvo data
    if (!rawData || !rawData.ID) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud not found',
        message: `No solicitud found with ID ${id}`,
      });
    }
    
    // Mapear el item
    const solicitud = mapSolicitudItem(rawData);
    
    console.log(`✅ Solicitud ${id} obtenida correctamente`);
    
    res.json({
      success: true,
      data: solicitud,
    });
    
  } catch (error) {
    console.error(`❌ Error fetching solicitud ${req.params.id}:`, error);
    
    // Si es un error 404 del flow
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud not found',
        message: `No solicitud found with ID ${req.params.id}`,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch solicitud',
      message: error.message,
    });
  }
});

module.exports = router;