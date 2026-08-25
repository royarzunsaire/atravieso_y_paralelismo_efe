const axios = require('axios');
const {
  getInspeccionesPendientes,
  marcarResultadoInspeccion,
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

async function subirArchivo(archivo, inspeccionSharePointId, payload) {
  const flowUrl = archivo.tipo === 'foto' ? FLOW_SUBIR_ARCHIVOS_URL : FLOW_DOCUMENTOS_SUBIR_URL;
  if (!flowUrl) {
    throw new Error(`Flow no configurado para archivos tipo "${archivo.tipo}"`);
  }

  const archivoPayload = {
    solicitudId: payload.solicitudId,
    codigoSolicitud: payload.codigoSolicitud || '',
    inspeccionId: String(inspeccionSharePointId),
    fileName: archivo.fileName,
    fileContentBase64: archivo.fileBase64,
    inspectorEmail: payload.inspectorEmail || '',
    inspectorNombre: payload.inspectorNombre || '',
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
        await subirArchivo(archivo, sharepointId, payload);
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

async function runSyncCycle() {
  if (isRunning) {
    console.log('⏭️  Sync ya en curso, se salta este ciclo.');
    return;
  }
  isRunning = true;

  try {
    const pendientes = await getInspeccionesPendientes();
    if (pendientes.length === 0) return;

    console.log(`🔄 Sync: ${pendientes.length} inspección(es) pendiente(s)`);

    for (const inspeccion of pendientes) {
      await procesarInspeccion(inspeccion);
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

module.exports = { startSyncJob, runSyncCycle, procesarInspeccion };
