import { useEffect, useState } from 'react';
import { detalleService } from '@/services/detalleService';
import { detalleCache } from '@/services/detalleCache';
import { limpiarNombreArchivo } from '@/utils/descargarArchivo';

/** Motivo de la detención vigente (contrato CU-10). */
export interface MotivoDetencion {
  /** Descripción que escribió quien detuvo la obra. */
  comentario: string;
  /** Nombre del acta adjunta, sin el prefijo interno de SharePoint; '' si no hay. */
  acta: string;
  /** Inspección de paralización que contiene el acta (para pedir un enlace vigente). */
  inspeccionId: number;
  /** Id del acta en SharePoint; '' si no hay. */
  actaDriveItemId: string;
}

interface InspeccionResumen { Id: number; Fecha?: string; Tipo?: string }
interface DocumentoApi { Nombre?: string; TipoDocumento?: string; DriveItemId?: string; UrlDescarga?: string; Url?: string }

const esParalizacion = (tipo?: string) => /paraliz/i.test(tipo ?? '');

const limpiarNombre = limpiarNombreArchivo;

const encontrarActa = (docs: unknown): DocumentoApi | undefined =>
  ((docs ?? []) as DocumentoApi[]).find((d) => /acta/i.test(d.TipoDocumento ?? ''));

/**
 * Descarga el acta de detención. Las URLs de la API vencen en ~1 h, así que se
 * pide la inspección de nuevo (sin caché) para tener un enlace vigente. El
 * gateway permite fetch() cross-origin; se guarda con el nombre limpio.
 * Lanza Error si no se puede descargar (el llamador muestra el aviso).
 */
export async function descargarActaDetencion(m: MotivoDetencion): Promise<void> {
  const resp = await detalleService.getInspeccion(m.inspeccionId, { forzar: true });
  const insp = resp?.Inspeccion ?? resp;
  const doc = encontrarActa(insp?.Documentos);
  const url = doc?.UrlDescarga ?? doc?.Url;
  if (!url) throw new Error('El acta no está disponible.');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Error ${r.status} al descargar el acta.`);
  const blob = await r.blob();
  const enlace = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  enlace.href = objUrl;
  enlace.download = m.acta || 'acta-de-detencion';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
}

/**
 * Carga el motivo de la detención vigente: comentario y acta de la inspección
 * de tipo "Paralización de Obra" más reciente. Usa el detalle y
 * GET /inspecciones/{id} con sus cachés y pedidos compartidos, y la promesa
 * queda cacheada por obra+fecha de detención → el dashboard puede precargarlo
 * y el hook lo encuentra listo. Devuelve null si no hay motivo (Sad Path).
 */
export function cargarMotivoDetencion(
  solicitudId: number,
  fechaDetencionActual: string,
): Promise<MotivoDetencion | null> {
  const clave = `${solicitudId}|${fechaDetencionActual}`;
  const existente = detalleCache.getMotivo(clave) as Promise<MotivoDetencion | null> | null;
  if (existente) return existente;

  // Un intento: busca la inspección de paralización más reciente y lee su comentario y acta.
  // `fresco` = ignora los cachés (la API tarda en reflejar el evento recién enviado).
  const intentar = async (fresco: boolean): Promise<MotivoDetencion | null> => {
    let data = fresco ? undefined : detalleCache.get(solicitudId)?.data;
    if (!data) {
      data = await detalleService.getDetalle(solicitudId, { fresco });
      detalleCache.set(solicitudId, data);
    }
    const paralizaciones = ((data?.Inspecciones ?? []) as InspeccionResumen[])
      .filter((i) => esParalizacion(i.Tipo))
      .sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
    if (paralizaciones.length === 0) return null;

    const resp = await detalleService.getInspeccion(paralizaciones[0].Id, { forzar: fresco });
    const insp = resp?.Inspeccion ?? resp;
    const doc = encontrarActa(insp?.Documentos);
    const acta = doc?.Nombre ?? '';
    const comentario = String(insp?.Comentario ?? '').trim();
    if (!comentario && !acta) return null;
    return {
      comentario,
      acta: acta ? limpiarNombre(acta) : '',
      inspeccionId: paralizaciones[0].Id,
      actaDriveItemId: doc?.DriveItemId ?? '',
    };
  };

  const promesa = (async (): Promise<MotivoDetencion | null> => {
    let m = await intentar(false);
    // Vacío: puede ser el retraso de la API tras la detención → 2 reintentos con datos frescos.
    for (const espera of [2000, 4000]) {
      if (m) break;
      await new Promise((r) => setTimeout(r, espera));
      m = await intentar(true);
    }
    // Un motivo vacío NO se deja cacheado: la próxima vez se vuelve a buscar.
    if (!m) detalleCache.borrarMotivo(clave);
    return m;
  })().catch(() => {
    // Si falló, no se deja cacheado el fallo: la próxima vez se reintenta.
    detalleCache.borrarMotivo(clave);
    return null;
  });

  detalleCache.setMotivo(clave, promesa);
  return promesa;
}

/**
 * Motivo de la detención vigente para la pantalla. `cargando` es true mientras
 * llega (Ctrl. Obra muestra «Cargando motivo…»). Se recalcula si cambia
 * FechaDetencionActual (nueva detención).
 */
export function useMotivoDetencion(
  solicitudId: number,
  fechaDetencionActual: string | null | undefined,
): { motivo: MotivoDetencion | null; cargando: boolean } {
  const [estado, setEstado] = useState<{ motivo: MotivoDetencion | null; cargando: boolean }>({
    motivo: null,
    cargando: !!fechaDetencionActual,
  });

  useEffect(() => {
    if (!fechaDetencionActual) { setEstado({ motivo: null, cargando: false }); return; }
    let vigente = true;
    setEstado((prev) => ({ ...prev, cargando: true }));
    cargarMotivoDetencion(solicitudId, fechaDetencionActual).then((motivo) => {
      if (vigente) setEstado({ motivo, cargando: false });
    });
    return () => { vigente = false; };
  }, [solicitudId, fechaDetencionActual]);

  return estado;
}
