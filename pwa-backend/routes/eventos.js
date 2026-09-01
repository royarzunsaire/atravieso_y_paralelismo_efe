const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { createInspeccionOutbox, getInspeccionOutboxById } = require('../database');
const { procesarInspeccion } = require('../syncJob');
const { obtenerInicio } = require('../apiEventos');

// ============================================================
// Rutas v2 — API de eventos unificada (nuevo contrato)
// Conviven con las rutas viejas (/api/inspecciones, etc.) durante la
// migración. Ver spec 10-migracion-api-eventos.md.
// ============================================================

/**
 * GET /api/v2/inicio
 * Proxy a API_Mobile_Inicio: obras del usuario ya filtradas + catálogo +
 * acciones habilitadas. El frontend nunca llama a la API directo (la
 * clave va en la URL, debe quedar del lado del servidor).
 */
router.get('/inicio', verifyToken, async (req, res) => {
  try {
    const usuario = req.user?.email;
    const catalogosVersion = req.query.catalogosVersion || '';

    console.log(`📲 GET /api/v2/inicio - Usuario: ${usuario}`);

    if (!usuario) {
      return res.status(400).json({ success: false, error: 'Usuario no identificado en el token' });
    }

    const data = await obtenerInicio({ usuario, catalogosVersion });
    res.json(data);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, error: 'USUARIO_NO_ENCONTRADO' });
    }
    console.error('❌ Error en /api/v2/inicio:', error.message);
    res.status(502).json({ success: false, error: 'Failed to fetch inicio', message: error.message });
  }
});

/**
 * POST /api/v2/eventos
 * Registra un evento sobre una obra (escritura). Sigue el patrón outbox:
 * guarda en Oracle (SIN SINCRONIZAR) y responde al instante; el sync job
 * lo envía a API_Evento_Obra_v2 después. Opcionalmente sincroniza inline
 * si el cliente lo pide (sync=true), para el flujo interactivo.
 *
 * Body (armado por el frontend según el catálogo):
 * {
 *   solicitudId, eventoIdExterno (UUID), tipoEvento,
 *   payload: { Comentario, AvancePct, Fotos, Informes, Documento, ... }
 * }
 */
router.post('/eventos', verifyToken, async (req, res) => {
  try {
    const { solicitudId, eventoIdExterno, tipoEvento, payload = {}, fechaEvento } = req.body;
    const userEmail = req.user?.email;
    const userNombre = req.user?.nombre;

    console.log(`📝 POST /api/v2/eventos - Solicitud ${solicitudId}, Tipo ${tipoEvento}, Evento ${eventoIdExterno} - Usuario: ${userEmail}`);

    // Los 5 obligatorios del contrato de la API (menos Origen, que ponemos acá).
    if (!solicitudId || !eventoIdExterno || !tipoEvento) {
      return res.status(400).json({
        success: false,
        error: 'Campos obligatorios faltantes',
        message: 'solicitudId, eventoIdExterno y tipoEvento son requeridos',
      });
    }

    // Este es el shape EXACTO que espera API_Evento_Obra_v2 — se guarda tal
    // cual en payload_json para que el sync job lo reenvíe sin transformar.
    const eventoPayload = {
      SolicitudId: parseInt(solicitudId, 10),
      EventoIdExterno: eventoIdExterno,
      TipoEvento: tipoEvento,
      Origen: 'Mobile',
      Usuario: userEmail || '',
      UsuarioNombre: userNombre || '',
      FechaEvento: fechaEvento || new Date().toISOString(),
      Payload: payload,
    };

    const oracleId = await createInspeccionOutbox({
      solicitudId: parseInt(solicitudId, 10),
      payload: eventoPayload,
      payloadVersion: 'v2',
      eventoIdExterno,
    });

    console.log(`✅ Evento guardado en Oracle (pendiente de sync) con ID: ${oracleId}`);

    // Sincronización inline opcional: el flujo interactivo quiere la
    // respuesta de la API (SubEstado, AccionesHabilitadas) de inmediato,
    // sin esperar al ciclo de 30s. Si falla, no rompe: queda en la cola.
    if (req.body.sync === true) {
      const inspeccion = await getInspeccionOutboxById(oracleId);
      const resultado = await procesarInspeccion(inspeccion);
      if (resultado.success) {
        return res.status(201).json({
          success: true,
          data: { id: oracleId, estadoSync: 'sincronizado', ...resultado.data },
        });
      }
      // No sincronizó ahora, pero quedó guardado — el job reintentará.
      return res.status(202).json({
        success: true,
        data: { id: oracleId, estadoSync: 'pendiente' },
        message: resultado.mensaje,
        accionNoPermitida: resultado.accionNoPermitida || false,
      });
    }

    res.status(201).json({
      success: true,
      data: { id: oracleId, estadoSync: 'pendiente' },
    });
  } catch (error) {
    console.error('❌ Error creando evento:', error);
    res.status(500).json({ success: false, error: 'Failed to create event', message: error.message });
  }
});

module.exports = router;
