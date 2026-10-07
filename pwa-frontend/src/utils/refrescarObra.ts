import { detalleService } from '@/services/detalleService';
import { detalleCache } from '@/services/detalleCache';
import type { ObraInicio } from '@/types/eventos';

/**
 * Lo que el detalle de una obra (GET /solicitudes/{id}) dice sobre su estado, en el formato de
 * la obra del InicioContext. Lo usan el refresco posterior a un evento y el detalle cuando
 * llega uno más reciente que lo que la pantalla sabe (CU-05).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cambiosDesdeDetalle(data: any): Partial<ObraInicio> {
  const s = data?.Solicitud ?? {};
  const cambios: Partial<ObraInicio> = {};
  if (s.Detencion) cambios.Detencion = s.Detencion;
  if (typeof s.AvanceObraPct === 'number') cambios.AvanceObraPct = s.AvanceObraPct;
  if (s.SubEstado) cambios.SubEstado = s.SubEstado;
  if (s.FechaUltimoEvento) cambios.FechaUltimoEvento = s.FechaUltimoEvento;
  // El acta de inicio fija la fecha de inicio de la obra (= su FechaEvento): se copia para
  // que «Inicio de obra / Días de obra» y el dashboard se vean sin recargar.
  if (s.FechaInicioObra) cambios.FechaInicioObra = s.FechaInicioObra;
  if (Array.isArray(data?.AccionesHabilitadas)) cambios.AccionesHabilitadas = data.AccionesHabilitadas;
  if (data?.AccionesTipo) cambios.AccionesTipo = data.AccionesTipo;
  if (data?.AccionesDef) cambios.AccionesDef = data.AccionesDef;
  return cambios;
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Tras un evento que sube un documento, la API tarda en incluirlo en el detalle. Se vuelve a pedir en
// segundo plano (sin bloquear nada) hasta que aparezca; al llegar se guarda en el caché y la pestaña
// «Documentos» se completa sola.
const ESPERAS_DOCUMENTO_MS = [3000, 5000, 8000, 12000, 20000];
type DetalleDocs = { Documentos?: { DriveItemId?: string; Nombre?: string }[] } | undefined;
const claveDoc = (d: { DriveItemId?: string; Nombre?: string }) => d.DriveItemId ?? d.Nombre ?? '';

function esperarDocumentoEnSegundoPlano(
  actualizarObra: (id: number, cambios: Partial<ObraInicio>) => void,
  solicitudId: number,
  previos: Set<string>,
): void {
  detalleCache.marcarEsperaDocumentos(solicitudId, true);
  void (async () => {
    try {
      for (const ms of ESPERAS_DOCUMENTO_MS) {
        await esperar(ms);
        const data = await detalleService.getDetalle(solicitudId, { fresco: true });
        if (((data as DetalleDocs)?.Documentos ?? []).some((d) => !previos.has(claveDoc(d)))) {
          detalleCache.set(solicitudId, data);
          actualizarObra(solicitudId, cambiosDesdeDetalle(data));
          return;
        }
      }
    } catch {
      // Sin red u otro fallo: queda el botón «Actualizar» del usuario.
    } finally {
      detalleCache.marcarEsperaDocumentos(solicitudId, false);
    }
  })();
}

// Una inspección recién creada aparece en el detalle antes que sus fotos e informe: la API los indexa con retraso, igual
// que los documentos. Se vuelve a pedir SU detalle en segundo plano hasta que lleguen los adjuntos enviados y la tarjeta se
// completa sola (CU-37). Mientras tanto la pantalla muestra «cargando» en vez de un 0 engañoso.
const ESPERAS_ADJUNTOS_MS = [2000, 4000, 7000, 12000, 20000];

function esperarAdjuntosInspeccionEnSegundoPlano(
  inspeccionId: number,
  esperados: { fotos: number; informes: number },
): void {
  detalleCache.marcarEsperaInspeccion(inspeccionId, true);
  void (async () => {
    try {
      for (const ms of ESPERAS_ADJUNTOS_MS) {
        await esperar(ms);
        const d = (await detalleService.getInspeccion(inspeccionId, { forzar: true })) as
          { Fotos?: unknown[]; Documentos?: unknown[]; Informes?: unknown[] } | undefined;
        detalleCache.notificar();
        const fotos = (d?.Fotos ?? []).length;
        const informes = (d?.Documentos ?? d?.Informes ?? []).length;
        if (fotos >= esperados.fotos && informes >= esperados.informes) return;
      }
    } catch {
      // Sin red u otro fallo: queda lo ya mostrado y el botón «Actualizar» del usuario.
    } finally {
      detalleCache.marcarEsperaInspeccion(inspeccionId, false);
    }
  })();
}

interface OpcionesRefresco {
  /** Fotos e informes que subió el evento: se espera en segundo plano a que la inspección nueva los muestre (CU-37). */
  esperaAdjuntosInspeccion?: { fotos: number; informes: number };
  /** FechaUltimoEvento de la obra ANTES del evento. */
  fechaUltimoEventoPrevia?: string | null;
  /** false para eventos que no crean inspección (ej. el acta de inicio). Por defecto true. */
  creaInspeccion?: boolean;
  /** Tipo de la inspección que crea el evento (ej. «Paralización de Obra»), para no confundirla con la de otro usuario. */
  tipoInspeccionEsperado?: string;
  /** El evento sube un documento: la API tarda en mostrarlo, se espera en segundo plano (sin bloquear la pantalla). */
  esperaDocumento?: boolean;
}

/**
 * Contrato CU-05: después de CUALQUIER evento exitoso (inspección,
 * detención, reactivación) se descarta el caché de la obra y se actualizan
 * Detencion, avance, sub-estado y acciones desde el detalle fresco. La
 * respuesta del propio evento es parcial (no trae Detencion) y por eso la
 * pantalla seguía mostrando la obra "no detenida" o sin el avance nuevo.
 *
 * La API tarda un instante en reflejar el evento en el detalle: verificado con
 * pruebas reales, `FechaUltimoEvento` cambia apenas se escribe el evento pero la
 * inspección nueva y el avance aparecen segundos después. Por eso el detalle
 * cuenta como «al día» solo si cambió `FechaUltimoEvento` Y trae más
 * inspecciones que antes (si el evento crea una). Se reintenta hasta 3 veces
 * (1,5 / 3 / 4,5 s). Si no llega a estar al día NO se cachea ni se aplica: se
 * conserva lo que dijo la respuesta del evento en vez de pisarlo con datos viejos.
 */
export async function refrescarObraTrasEvento(
  actualizarObra: (id: number, cambios: Partial<ObraInicio>) => void,
  solicitudId: number,
  opciones: OpcionesRefresco = {},
): Promise<void> {
  const cacheado = detalleCache.get(solicitudId)?.data;
  const fechaUltimoEventoPrevia = opciones.fechaUltimoEventoPrevia
    ?? cacheado?.Solicitud?.FechaUltimoEvento
    ?? null;
  const idsPrevios = new Set<number>(
    Array.isArray(cacheado?.Inspecciones) ? (cacheado.Inspecciones as { Id: number }[]).map((i) => i.Id) : [],
  );
  const hayReferencia = Array.isArray(cacheado?.Inspecciones);
  const creaInspeccion = opciones.creaInspeccion !== false;
  const tipoEsperado = opciones.tipoInspeccionEsperado;
  const docsPrevios = new Set<string>(((cacheado as DetalleDocs)?.Documentos ?? []).map(claveDoc));

  type Detalle = { Solicitud?: { FechaUltimoEvento?: string }; Inspecciones?: { Id: number; Tipo?: string }[] } | undefined;
  const cambioFecha = (d: Detalle) =>
    !fechaUltimoEventoPrevia || (d?.Solicitud?.FechaUltimoEvento ?? null) !== fechaUltimoEventoPrevia;
  const nuevas = (d: Detalle) => (d?.Inspecciones ?? []).filter((i) => !idsPrevios.has(i.Id));
  // Estricto: trae la inspección nueva del tipo que crea este evento (otro usuario
  // puede haber creado una inspección en el intermedio: no debe engañar al refresco).
  const alDia = (d: Detalle): boolean => {
    if (!cambioFecha(d)) return false;
    if (!creaInspeccion || !hayReferencia) return true;
    return tipoEsperado ? nuevas(d).some((i) => i.Tipo === tipoEsperado) : nuevas(d).length > 0;
  };
  // Tras los reintentos se acepta cualquier inspección nueva (por si el nombre del tipo no coincide exacto).
  const aceptable = (d: Detalle): boolean =>
    cambioFecha(d) && (!creaInspeccion || !hayReferencia || nuevas(d).length > 0);

  detalleCache.invalidarObra(solicitudId);
  try {
    let data = await detalleService.getDetalle(solicitudId, { fresco: true });
    for (let intento = 1; intento <= 3 && !alDia(data); intento++) {
      await esperar(1500 * intento);
      data = await detalleService.getDetalle(solicitudId, { fresco: true });
    }
    if (!alDia(data) && !aceptable(data)) {
      // sigue atrasado: no se cachea ni se pisa lo que dijo el evento
      if (opciones.esperaDocumento) esperarDocumentoEnSegundoPlano(actualizarObra, solicitudId, docsPrevios);
      return;
    }

    detalleCache.set(solicitudId, data);
    const cambios = cambiosDesdeDetalle(data);
    actualizarObra(solicitudId, cambios);
    const esperadosAdj = opciones.esperaAdjuntosInspeccion;
    if (esperadosAdj && (esperadosAdj.fotos > 0 || esperadosAdj.informes > 0) && creaInspeccion && hayReferencia) {
      const candidatas = nuevas(data);
      const delTipo = tipoEsperado ? candidatas.filter((i) => i.Tipo === tipoEsperado) : candidatas;
      const elegida = [...(delTipo.length ? delTipo : candidatas)].sort((a, b) => b.Id - a.Id)[0];
      if (elegida) esperarAdjuntosInspeccionEnSegundoPlano(elegida.Id, esperadosAdj);
    }
    if (opciones.esperaDocumento && !((data as DetalleDocs)?.Documentos ?? []).some((d) => !docsPrevios.has(claveDoc(d)))) {
      esperarDocumentoEnSegundoPlano(actualizarObra, solicitudId, docsPrevios);
    }
  } catch {
    // Si falla, el caché queda invalidado: la próxima vez que se abra el
    // detalle se pide fresco.
  }
}
