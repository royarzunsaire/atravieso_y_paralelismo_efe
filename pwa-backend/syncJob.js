const {
  getInspeccionesPendientes,
  marcarResultadoInspeccion,
} = require('./database');
const { registrarEvento } = require('./apiEventos');

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10);

let isRunning = false;

// Cada fila del outbox trae su payload_version. Desde el retiro de v1 (Power Automate) solo se
// sincroniza 'v2' (API directa del cliente). Una fila de otro formato no se puede enviar: se agota
// de una vez para que el job no la reintente y quede visible como error.
async function procesarInspeccion(inspeccion) {
  if (inspeccion.payloadVersion === 'v2') {
    return procesarInspeccionV2(inspeccion);
  }
  const mensaje = 'Formato de envío retirado (flows de Power Automate). Esta fila ya no se sincroniza.';
  const restantes = Math.max(1, 3 - (Number(inspeccion.intentos) || 0));
  for (let i = 0; i < restantes; i++) {
    await marcarResultadoInspeccion(inspeccion.id, { resultado: 'error', mensaje });
  }
  console.warn(`⚠️  Fila ${inspeccion.id} con formato '${inspeccion.payloadVersion}' descartada: ${mensaje}`);
  return { success: false, mensaje };
}

// ── v2: API de eventos unificada ─────────────────────────────
// El payload ya viene con el shape que espera API_Evento_Obra_v2
// (SolicitudId, EventoIdExterno, TipoEvento, Payload...). El
// EventoIdExterno se persistió en la fila del outbox y se reusa en
// cada reintento — la API deduplica por él.
async function procesarInspeccionV2(inspeccion) {
  const { id, payload, eventoIdExterno, solicitudId } = inspeccion;

  try {
    // Garantizamos que el EventoIdExterno que viaja sea el persistido en
    // la fila (fuente de verdad de la idempotencia), no uno del payload.
    const evento = { ...payload, EventoIdExterno: eventoIdExterno || payload.EventoIdExterno };
    // Usuario/UsuarioNombre viajaban en el payload para la API vieja; con
    // la nueva, van en el JWT, no en el body — los sacamos para no
    // reenviarlos dos veces.
    const { Usuario: usuario, UsuarioNombre: nombre, ...eventoSinIdentidad } = evento;

    const resultado = await registrarEvento({ usuario, nombre, solicitudId, evento: eventoSinIdentidad });

    if (resultado.accionNoPermitida) {
      // 403: otra persona movió la obra. No es reintentable — se marca
      // error terminal para que el frontend recargue (no reintentar).
      await marcarResultadoInspeccion(id, { resultado: 'error', mensaje: resultado.mensaje });
      console.warn(`⚠️  Evento ${id} rechazado (acción no permitida): ${resultado.mensaje}`);
      return { success: false, accionNoPermitida: true, mensaje: resultado.mensaje, data: resultado.data };
    }

    if (!resultado.ok) {
      // Rechazo de negocio de la API (4xx): reintentar no lo arregla. Se agotan los intentos de una vez
      // (tope de 3 en Oracle) para que el job no lo reenvíe en cada ciclo, y se devuelve la causa real.
      const restantes = Math.max(1, 3 - (Number(inspeccion.intentos) || 0));
      for (let i = 0; i < restantes; i++) {
        await marcarResultadoInspeccion(id, { resultado: 'error', mensaje: resultado.mensaje });
      }
      console.error(`❌ Evento ${id} rechazado por la API (no se reintenta):`, resultado.mensaje);
      return { success: false, rechazada: true, mensaje: resultado.mensaje };
    }

    // Éxito (incluye duplicado:true, que la API trata como ya registrado).
    const sharepointId = resultado.data?.EventoId ? String(resultado.data.EventoId) : null;
    const mensaje = resultado.duplicado ? 'Evento ya registrado (duplicado).' : resultado.mensaje;
    await marcarResultadoInspeccion(id, { resultado: 'exito', sharepointId, mensaje });
    console.log(`✅ Evento ${id} registrado → EventoId ${sharepointId}${resultado.duplicado ? ' (duplicado)' : ''}`);
    return { success: true, sharepointId, mensaje, data: resultado.data };
  } catch (error) {
    const mensaje = error.message || 'Error desconocido al registrar evento';
    await marcarResultadoInspeccion(id, { resultado: 'error', mensaje });
    console.error(`❌ Error registrando evento ${id}:`, mensaje);
    return { success: false, mensaje };
  }
}

async function runSyncCycle() {
  if (isRunning) {
    console.log('⏭️  Sync ya en curso, se salta este ciclo.');
    return;
  }
  isRunning = true;

  try {
    const pendientes = await getInspeccionesPendientes();
    if (pendientes.length > 0) {
      console.log(`🔄 Sync: ${pendientes.length} inspección(es) pendiente(s)`);
      for (const inspeccion of pendientes) {
        await procesarInspeccion(inspeccion);
      }
    }
  } catch (error) {
    console.error('❌ Error en ciclo de sincronización:', error.message);
  } finally {
    isRunning = false;
  }
}

function startSyncJob() {
  if (!process.env.SHAREPOINT_API_URL) {
    console.warn('⚠️  SHAREPOINT_API_URL no configurada — sync job no se inicia.');
    return;
  }
  console.log(`🔄 Sync job iniciado (cada ${SYNC_INTERVAL_MS / 1000}s)`);
  setInterval(runSyncCycle, SYNC_INTERVAL_MS);
}

module.exports = { startSyncJob, runSyncCycle, procesarInspeccion };
