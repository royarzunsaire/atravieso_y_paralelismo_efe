const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { createInspeccionOutbox, getInspeccionOutboxById } = require('../database');
const { procesarInspeccion } = require('../syncJob');
const { obtenerInicio, obtenerDetalleSolicitud, obtenerInspeccion, obtenerObraInicio } = require('../apiEventos');
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

    const data = await obtenerInicio({ usuario, nombre: req.user?.nombre, catalogosVersion });
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
 * GET /api/v2/solicitudes/:id
 * Proxy a API_Detalle (GET /v1/solicitudes/{id}): inspecciones, fotos,
 * informes y documentos de una obra, con URLs de descarga directa a
 * SharePoint (válidas ~1h). Ver spec 13, Etapa B.
 */
router.get('/solicitudes/:id', verifyToken, async (req, res) => {
  try {
    const usuario = req.user?.email;
    const nombre = req.user?.nombre;
    const solicitudId = parseInt(req.params.id, 10);

    console.log(`📄 GET /api/v2/solicitudes/${solicitudId} - Usuario: ${usuario}`);

    if (!usuario) {
      return res.status(400).json({ success: false, error: 'Usuario no identificado en el token' });
    }

    const data = await obtenerDetalleSolicitud({ usuario, nombre, solicitudId });
    res.json(data);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, error: error.code || 'SOLICITUD_NO_ENCONTRADA' });
    }
    if (error.status === 403) {
      return res.status(403).json({ success: false, error: error.code || 'SIN_ACCESO', message: error.message });
    }
    console.error(`❌ Error en /api/v2/solicitudes/${req.params.id}:`, error.message);
    res.status(502).json({ success: false, error: 'Failed to fetch detalle', message: error.message });
  }
});

/**
 * GET /api/v2/inspecciones/:id
 * Proxy a GET /v1/inspecciones/{id}: detalle completo de una inspección
 * (comentario, lat/lng, paralización, fotos y documentos con URL de
 * descarga). El detalle de obra solo trae un resumen; el frontend pide
 * estas en segundo plano. Ver spec 13.
 */
router.get('/inspecciones/:id', verifyToken, async (req, res) => {
  try {
    const usuario = req.user?.email;
    const nombre = req.user?.nombre;
    const inspeccionId = parseInt(req.params.id, 10);

    if (!usuario) {
      return res.status(400).json({ success: false, error: 'Usuario no identificado en el token' });
    }
    if (!Number.isInteger(inspeccionId)) {
      return res.status(400).json({ success: false, error: 'ID de inspección inválido' });
    }

    const data = await obtenerInspeccion({ usuario, nombre, inspeccionId });
    res.json(data);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, error: error.code || 'INSPECCION_NO_ENCONTRADA' });
    }
    if (error.status === 403) {
      return res.status(403).json({ success: false, error: error.code || 'SIN_ACCESO', message: error.message });
    }
    console.error(`❌ Error en /api/v2/inspecciones/${req.params.id}:`, error.message);
    res.status(502).json({ success: false, error: 'Failed to fetch inspeccion', message: error.message });
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

    // Una inspección puede registrarse con fecha pasada, nunca futura (5 min de tolerancia por relojes desfasados).
    // Solo las inspecciones: el acta de inicio se ancla a mediodía y de mañana parecería «futura» sin serlo.
    if (fechaEventoUTC && (tipoEvento.startsWith('INSPECCION_') || tipoEvento === 'COMENTARIO_OBRA')
        && new Date(fechaEventoUTC).getTime() > Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        error: 'FECHA_FUTURA',
        message: 'La fecha de la inspección no puede ser futura: elige hoy o un día anterior.',
      });
    }

    // ── SEGURIDAD: re-validar la acción contra la fuente de verdad ──
    // El frontend muestra/oculta secciones por comodidad, pero es
    // manipulable. Antes de aceptar el evento, consultamos la API_Inicio
    // (según el usuario del token, no lo que diga el body) y verificamos
    // que la acción esté REALMENTE habilitada para esta obra en su estado
    // actual. Si no, se rechaza — así manipular la consola no sirve.
    // Ver spec 10, sección "Seguridad".
    let obraInicio;
    try {
      obraInicio = await obtenerObraInicio({
        usuario: userEmail,
        nombre: userNombre,
        solicitudId: parseInt(solicitudId, 10),
      });
      if (obraInicio === null) {
        return res.status(403).json({
          success: false,
          error: 'OBRA_NO_ACCESIBLE',
          message: 'No tienes acceso a esta obra o ya no está disponible.',
        });
      }
      const permitidas = Array.isArray(obraInicio.AccionesHabilitadas) ? obraInicio.AccionesHabilitadas : [];
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

    // ── Adjunto obligatorio: según la definición de la acción AHORA (API_Inicio, no el catálogo cacheado
    // del dispositivo). Se rechaza antes de guardar nada, con el motivo claro.
    const defAccion = obraInicio.AccionesDef?.[tipoEvento];
    const hayArchivos = ['Fotos', 'Informes', 'Documentos'].some((k) => Array.isArray(payload?.[k]) && payload[k].length > 0)
      || !!payload?.Documento;
    if (defAccion?.RequiereAdjunto && !hayArchivos) {
      // Si la acción define qué documentos se piden, el mensaje los nombra.
      const nombres = (Array.isArray(defAccion.TiposDocumento) ? defAccion.TiposDocumento : []).map((t) => t.Value || t.Id);
      return res.status(400).json({
        success: false,
        error: 'ADJUNTO_REQUERIDO',
        message: nombres.length > 0
          ? `Esta acción exige documentos adjuntos: ${nombres.join(' y ')}.`
          : 'Esta acción exige al menos un adjunto: agrega una foto o un archivo.',
      });
    }

    // Varios tipos de documento en la acción (ej. documentación del ITO): hay que subir uno por cada tipo.
    const tiposDoc = Array.isArray(defAccion?.TiposDocumento) ? defAccion.TiposDocumento : [];
    if (defAccion?.RequiereAdjunto && tiposDoc.length > 1) {
      const enviados = new Set((Array.isArray(payload?.Documentos) ? payload.Documentos : []).map((d) => Number(d?.TipoDocumentoId)));
      const faltan = tiposDoc.filter((t) => !enviados.has(Number(t.Id)));
      if (faltan.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'DOCUMENTOS_INCOMPLETOS',
          message: `Faltan documentos obligatorios: ${faltan.map((t) => t.Value || t.Id).join(', ')}.`,
        });
      }
    }

    // ── Finalizar obra: avance de la obra = 100 % y al menos una inspección al 100 % ──
    // (misma regla que la app; acá no se puede saltar manipulando el frontend). El evento
    // viaja con AvancePct 100.
    if (tipoEvento === 'OBRA_FINALIZADA') {
      try {
        const id = parseInt(solicitudId, 10);
        const avanceObra = Math.round(Number(obraInicio?.AvanceObraPct) || 0);
        if (avanceObra < 100) {
          return res.status(409).json({
            success: false,
            error: 'AVANCE_INSUFICIENTE',
            message: `El avance de la obra debe estar en 100 % para finalizarla (hoy está en ${avanceObra} %).`,
          });
        }
        const detalle = await obtenerDetalleSolicitud({ usuario: userEmail, nombre: userNombre, solicitudId: id });
        const hayInspeccion100 = (detalle?.Inspecciones || []).some((i) => Math.round(Number(i.PorcentajeAvance) || 0) >= 100);
        if (!hayInspeccion100) {
          return res.status(409).json({
            success: false,
            error: 'FALTA_INSPECCION_100',
            message: 'Para finalizar la obra falta al menos una inspección registrada con 100 % de avance.',
          });
        }
        payload.AvancePct = 100;
      } catch (validationError) {
        console.error('❌ Error validando finalización de obra:', validationError.message);
        return res.status(502).json({
          success: false,
          error: 'No se pudo validar la acción',
          message: 'No se pudo verificar el avance de la obra. Intenta de nuevo.',
        });
      }
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
      // La API rechazó el evento por una regla de negocio: reintentar no sirve, hay que decirle la causa al usuario.
      if (resultado.rechazada) {
        return res.status(422).json({
          success: false,
          error: 'EVENTO_RECHAZADO',
          message: resultado.mensaje,
          data: { id: oracleId },
        });
      }
      // No sincronizó ahora (red / plataforma caída), pero quedó guardado — el job reintentará.
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
