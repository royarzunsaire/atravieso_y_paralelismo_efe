const axios = require('axios');
const {
  getInspeccionesPendientes,
  marcarResultadoInspeccion,
  getArchivosPendientes,
  marcarResultadoArchivo,
} = require('./database');

const FLOW_INSPECCIONES_CREAR_URL = process.env.FLOW_INSPECCIONES_CREAR_URL;
const FLOW_SUBIR_ARCHIVOS_URL = process.env.FLOW_SUBIR_ARCHIVOS_URL;
const FLOW_DOCUMENTOS_SUBIR_URL = process.env.FLOW_DOCUMENTOS_SUBIR_URL;
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10);

let isRunning = false;

async function callFlow(flowUrl, data) {
  const response = await axios.post(flowUrl, data, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
    maxBodyLength: 15 * 1024 * 1024,
    maxContentLength: 15 * 1024 * 1024,
  });
  return response.data;
}

async function subirArchivo(archivo, inspeccionSharePointId, { solicitudId, codigoSolicitud, inspectorEmail, inspectorNombre }) {
  const flowUrl = archivo.tipo === 'foto' ? FLOW_SUBIR_ARCHIVOS_URL : FLOW_DOCUMENTOS_SUBIR_URL;
  if (!flowUrl) {
    throw new Error(`Flow no configurado para archivos tipo "${archivo.tipo}"`);
  }

  const archivoPayload = {
    solicitudId,
    codigoSolicitud: codigoSolicitud || '',
    inspeccionId: String(inspeccionSharePointId),
    fileName: archivo.fileName,
    fileContentBase64: archivo.fileBase64,
    inspectorEmail: inspectorEmail || '',
    inspectorNombre: inspectorNombre || '',
  };

  if (archivo.tipo === 'documento') {
    archivoPayload.contentType = archivo.contentType || 'application/pdf';
  } else {
    archivoPayload.description = '';
  }

  await callFlow(flowUrl, archivoPayload);
}

async function procesarInspeccion(inspeccion) {
  const { id, payload, archivos } = inspeccion;

  try {
    const resultadoFlow = await callFlow(FLOW_INSPECCIONES_CREAR_URL, payload);
    const sharepointId = resultadoFlow?.data?.id ? String(resultadoFlow.data.id) : null;

    if (!sharepointId) {
      throw new Error('El flow de inspecciones no devolvió un id de SharePoint');
    }

    const erroresArchivos = [];
    for (const archivo of archivos) {
      try {
        await subirArchivo(archivo, sharepointId, {
          solicitudId: payload.solicitudId,
          codigoSolicitud: payload.codigoSolicitud,
          inspectorEmail: payload.inspectorEmail,
          inspectorNombre: payload.inspectorNombre,
        });
      } catch (archivoError) {
        erroresArchivos.push(`${archivo.fileName}: ${archivoError.message}`);
      }
    }

    if (erroresArchivos.length > 0) {
      // La inspección sí quedó en SharePoint — se marca éxito, pero se deja traza del archivo fallido.
      const mensaje = `Inspección sincronizada. Archivos con error: ${erroresArchivos.join(' | ')}`;
      await marcarResultadoInspeccion(id, { resultado: 'exito', sharepointId, mensaje });
      console.warn(`⚠️  Inspección ${id} sincronizada con archivos fallidos: ${erroresArchivos.join(' | ')}`);
      return { success: true, sharepointId, mensaje };
    }

    const mensaje = `Sincronizado correctamente${archivos.length > 0 ? ` con ${archivos.length} archivo(s)` : ''}.`;
    await marcarResultadoInspeccion(id, { resultado: 'exito', sharepointId, mensaje });
    console.log(`✅ Inspección ${id} sincronizada → SharePoint id ${sharepointId}`);
    return { success: true, sharepointId, mensaje };
  } catch (error) {
    const mensaje = error.message || 'Error desconocido al sincronizar';
    await marcarResultadoInspeccion(id, { resultado: 'error', mensaje });
    console.error(`❌ Error sincronizando inspección ${id}:`, error.message);
    return { success: false, mensaje };
  }
}

// Archivo subido en su propio POST (separado de la inspección), vía
// /api/fotos/upload o /api/informes/upload. Solo llega aquí cuando ya
// tiene un sharepoint_inspeccion_id resuelto (ver acción ORDS
// archivos-pendientes) — o sea, su inspección padre ya está en SharePoint.
async function procesarArchivo(archivo) {
  const { id, sharepointInspeccionId, solicitudId, inspectorEmail, inspectorNombre } = archivo;

  try {
    await subirArchivo(archivo, sharepointInspeccionId, {
      solicitudId,
      codigoSolicitud: '',
      inspectorEmail,
      inspectorNombre,
    });
    await marcarResultadoArchivo(id, { resultado: 'exito' });
    console.log(`✅ Archivo ${id} (${archivo.fileName}) sincronizado → Inspección SharePoint ${sharepointInspeccionId}`);
    return { success: true };
  } catch (error) {
    await marcarResultadoArchivo(id, { resultado: 'error' });
    console.error(`❌ Error sincronizando archivo ${id} (${archivo.fileName}):`, error.message);
    return { success: false, mensaje: error.message };
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

    // Archivos subidos por separado (no inline con la inspección) — solo
    // se procesan una vez que su inspección padre ya tiene sharepoint_id,
    // por eso corre después del bloque de arriba.
    const archivosPendientes = await getArchivosPendientes();
    if (archivosPendientes.length > 0) {
      console.log(`🔄 Sync: ${archivosPendientes.length} archivo(s) pendiente(s)`);
      for (const archivo of archivosPendientes) {
        await procesarArchivo(archivo);
      }
    }
  } catch (error) {
    console.error('❌ Error en ciclo de sincronización:', error.message);
  } finally {
    isRunning = false;
  }
}

function startSyncJob() {
  if (!FLOW_INSPECCIONES_CREAR_URL) {
    console.warn('⚠️  FLOW_INSPECCIONES_CREAR_URL no configurado — sync job no se inicia.');
    return;
  }
  console.log(`🔄 Sync job iniciado (cada ${SYNC_INTERVAL_MS / 1000}s)`);
  setInterval(runSyncCycle, SYNC_INTERVAL_MS);
}

module.exports = { startSyncJob, runSyncCycle, procesarInspeccion, procesarArchivo };
