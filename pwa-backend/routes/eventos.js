const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { createInspeccionOutbox, getInspeccionOutboxById } = require('../database');
const { procesarInspeccion } = require('../syncJob');
const { obtenerInicio, obtenerAccionesHabilitadas } = require('../apiEventos');
const { parseFechaEventoOpcional, FechaInvalidaError } = require('../utils/fechas');

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

    // fechaEvento es opcional (cola offline). Si viene, debe ser ISO con
    // zona (Z u offset); si no, el servidor pone el sello de recepción en
    // now() UTC más abajo — eso es intencional (spec 11).
    let fechaEventoUTC;
    try {
      fechaEventoUTC = parseFechaEventoOpcional(fechaEvento);
    } catch (err) {
      if (err instanceof FechaInvalidaError) {
        return res.status(400).json({ success: false, error: 'fechaEvento inválida', message: err.message });
      }
      throw err;
    }

    // ── SEGURIDAD: re-validar la acción contra la fuente de verdad ──
    // El frontend muestra/oculta secciones por comodidad, pero es
    // manipulable. Antes de aceptar el evento, consultamos la API_Inicio
    // (según el usuario del token, no lo que diga el body) y verificamos
    // que la acción esté REALMENTE habilitada para esta obra en su estado
    // actual. Si no, se rechaza — así manipular la consola no sirve.
    // Ver spec 10, sección "Seguridad".
    try {
      const permitidas = await obtenerAccionesHabilitadas({
        usuario: userEmail,
        solicitudId: parseInt(solicitudId, 10),
      });
      if (permitidas === null) {
        return res.status(403).json({
          success: false,
          error: 'OBRA_NO_ACCESIBLE',
          message: 'No tienes acceso a esta obra o ya no está disponible.',
        });
      }
      if (!permitidas.includes(tipoEvento)) {
        console.warn(`🚫 Acción no permitida: ${tipoEvento} en solicitud ${solicitudId} para ${userEmail}. Permitidas: ${permitidas.join(', ')}`);
        return res.status(403).json({
          success: false,
          error: 'ACCION_NO_PERMITIDA',
          message: 'Esta acción no está permitida en el estado actual de la obra.',
        });
      }
    } catch (validationError) {
      console.error('❌ Error validando acción contra API_Inicio:', validationError.message);
      return res.status(502).json({
        success: false,
        error: 'No se pudo validar la acción',
        message: 'No se pudo verificar los permisos de la obra. Intenta de nuevo.',
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
      FechaEvento: fechaEventoUTC || new Date().toISOString(),
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
