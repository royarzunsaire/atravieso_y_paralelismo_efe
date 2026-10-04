import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { useProgreso } from '@/context/ProgresoContext';
import { ahoraCLParaInput, esFechaFutura } from '@/utils/fechas';
import { Header } from './Header';
import { Button } from './Button';
import {
  AlertCircle,
  AlertOctagon,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { Solicitud, InspectionPhoto } from '../../types/solicitud';
import { useCatalogs } from '@/context/CatalogsContext';
import { useInicio } from '@/context/InicioContext';
import { esAccionInspeccion } from '@/utils/gruposAcciones';
import { usuariosService } from '@/services/usuarios';

// ── Tipo local de usuario ─────────────────────────────────────
interface Usuario {
  id: number;
  nombre: string;
  correo: string;
}

function getLocalDateTimeString(): string {
  return ahoraCLParaInput();
}

export interface InformeAdjunto {
  fileName: string;
  fileContentBase64: string;
  contentType: string;
  sizeKb: number;
}

interface NewInspectionProps {
  /** Informe ya elegido (guardado por la app): se conserva al ir a la cámara y volver (CU-02). */
  informeInicial?: InformeAdjunto | null;
  /** Avisa a la app cada vez que cambia el informe adjunto. */
  onInformeChange?: (informe: InformeAdjunto | null) => void;
  solicitud: Solicitud;
  onBack: () => void;
  isSaving?: boolean;
  minimoAvance?: number;   // avance de la última inspección — no puede retroceders
  onSave: (inspection: {
    type: string;
    /** Solo modo v2 — id del catálogo TiposInspeccion de la API (spec 13). */
    tipoInspeccionId?: number;
    /** Solo modo v2 — acción/evento asociado al tipo elegido (ej. INSPECCION_AVANCE). */
    tipoEvento?: string;
    progress: number;
    comentariosAvance: string;
    observacionesInspeccion: string;
    status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[];
    solicitarParalizacion?: boolean;
    fechaInspeccion?: string;
    usuariosNotificar: { id: number; nombre: string; correo: string }[];
    informe?: { fileName: string; fileContentBase64: string; contentType: string; sizeKb: number } | null;
  }) => void;
  onAddPhoto: () => void;
  tempPhotos: InspectionPhoto[];
  onRemovePhoto: (photoId: string) => void;
  /**
   * Modo v2 (API de eventos): las acciones INSPECCION_* habilitadas para
   * esta obra. Si viene, el form muestra/oculta secciones según ellas.
   * Si es undefined, el form se comporta como siempre (modo viejo).
   */
  accionesV2?: string[];
}

export function NewInspection({
                                solicitud,
                                onBack,
                                onSave,
                                isSaving = false,
                                minimoAvance = 0,
                                onAddPhoto,
                                tempPhotos,
                                onRemovePhoto,
                                accionesV2,
                                informeInicial = null,
                                onInformeChange,
                              }: NewInspectionProps) {
  const draftKey = useMemo(() => `newInspectionDraft:${solicitud.id}`, [solicitud.id]);

  // ── Modo v2: qué secciones mostrar según las acciones habilitadas ──
  // Si accionesV2 es undefined, es modo viejo: se muestra todo (v1).
  const esV2 = Array.isArray(accionesV2);
  const inspecciones = esV2 ? accionesV2! : [];

  const { tiposInspeccion, tiposInspeccionLoading, tiposInspeccionError, recargarTiposInspeccion } =
      useCatalogs();
  const inicio = useInicio();

  // En v2 cada acción habilitada trae el tipo de inspección que le
  // corresponde (spec 13). El selector ofrece SOLO esos tipos — con la obra
  // paralizada, por ejemplo, queda uno solo (Registro de Observación) — y
  // el evento a registrar sale de la acción del tipo elegido. Es el
  // catálogo de la API, no el viejo de Oracle (ids distintos).
  const opcionesTipoV2 = useMemo(() => {
    if (!esV2) return [];
    const accionesTipo = inicio.getObra(solicitud.id)?.AccionesTipo ?? {};
    return inspecciones
        .filter((codigo) => esAccionInspeccion(codigo, inicio.catalogo) && accionesTipo[codigo])
        .map((codigo) => ({
          codigo,
          tipoInspeccionId: accionesTipo[codigo].TipoInspeccionId,
          nombre: accionesTipo[codigo].TipoInspeccionNombre,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esV2, inicio.obras, solicitud.id, accionesV2]);

  // Todas las inspecciones reportan avance, sin importar el tipo (cliente).
  const muestraAvance = true;
  // Alguna inspección habilitada (aceptan adjunto/fotos).
  const hayInspeccion = !esV2 || opcionesTipoV2.length > 0;
  const muestraFotos = hayInspeccion;
  const muestraInforme = hayInspeccion;

  // ── Form state ────────────────────────────────────────────
  const [type, setType] = useState('');
  const [tipoInspeccionId, setTipoInspeccionId] = useState('');

  // Un solo tipo permitido (ej. obra paralizada) → queda preseleccionado.
  useEffect(() => {
    if (esV2 && opcionesTipoV2.length === 1) {
      setTipoInspeccionId(String(opcionesTipoV2[0].tipoInspeccionId));
    }
  }, [esV2, opcionesTipoV2]);
  const [fechaInspeccion, setFechaInspeccion] = useState(getLocalDateTimeString);
  const [progress, setProgress] = useState(() => minimoAvance);
  const [progressInput, setProgressInput] = useState(() => String(minimoAvance));
  const [comentariosAvance, setComentariosAvance] = useState('');
  const [observacionesInspeccion, setObservacionesInspeccion] = useState('');
  const [status, setStatus] = useState<'conforme' | 'no-conforme'>('conforme');
  const [solicitarParalizacion, setSolicitarParalizacion] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // ── Informe adjunto ───────────────────────────────────────
  const [informe, setInforme] = useState<InformeAdjunto | null>(informeInicial);
  useEffect(() => { onInformeChange?.(informe); }, [informe]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loadingInforme, setLoadingInforme] = useState(false);
  const { mostrarError } = useProgreso();
  const informeInputRef = useRef<HTMLInputElement>(null);

  // ── CU-23: avance bloqueado y adjunto obligatorio (v2) ───────────────
  const refAdjuntos = useRef<HTMLDivElement>(null);
  const obraActual = esV2 ? inicio.getObra(solicitud.id) : null;
  const tipoSeleccionado = esV2 ? opcionesTipoV2.find((o) => String(o.tipoInspeccionId) === tipoInspeccionId) : undefined;
  const obraDetenida = !!obraActual?.Detencion?.FechaDetencionActual;
  // Con la obra detenida ninguna inspección cambia el avance (queda en el avance actual). Con la obra en ejecución
  // el avance es editable en todos los tipos, incluido «Registro de Observación».
  const avanceBloqueado = esV2 && obraDetenida;
  useEffect(() => {
    if (avanceBloqueado) {
      setProgress(minimoAvance);
      setProgressInput(String(minimoAvance));
      setErrors((p) => ({ ...p, progress: '' }));
    }
  }, [avanceBloqueado, minimoAvance]);

  // Si el tipo elegido exige adjunto (dato de la API: AccionesDef), debe haber una foto o un informe.
  const definicionTipo = tipoSeleccionado
    ? (obraActual?.AccionesDef?.[tipoSeleccionado.codigo]
        ?? inicio.catalogo?.TiposEvento?.find((t) => t.Codigo === tipoSeleccionado.codigo))
    : undefined;
  const requiereAdjunto = esV2 && !!definicionTipo?.RequiereAdjunto;
  const faltaAdjunto = requiereAdjunto && tempPhotos.length === 0 && !informe;
  useEffect(() => {
    if (!faltaAdjunto) setErrors((p) => (p.adjunto ? { ...p, adjunto: '' } : p));
  }, [faltaAdjunto]);

  // ── Usuarios a notificar ──────────────────────────────────
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [busquedaUsuario, setBusquedaUsuario] = useState('');

  // ── Refs para scroll a error ──────────────────────────────
  const refFecha = useRef<HTMLDivElement>(null);
  const refTipo = useRef<HTMLDivElement>(null);
  const refComentarios = useRef<HTMLDivElement>(null);
  const refObservaciones = useRef<HTMLDivElement>(null);

  // ── Cargar usuarios al montar ─────────────────────────────
  useEffect(() => {
    // CU-21: en v2 «Notificar a» está oculto (la API no soporta notificaciones) → NO se llama al flow
    // de usuarios de Power Automate (tardaba ~3,7 s en abrir el formulario).
    if (esV2) { setLoadingUsuarios(false); return; }
    setLoadingUsuarios(true);
    usuariosService
        .getAll()
        .then((data: Usuario[]) => setUsuarios(data))
        .catch(() => setUsuarios([]))
        .finally(() => setLoadingUsuarios(false));
  }, []);

  // ── Recuperar draft ───────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.type === 'string') setType(draft.type);
      // El tipo de la API (v2) también va en el borrador; solo se restaura si sigue permitido.
      if (typeof draft.tipoInspeccionId === 'string' && draft.tipoInspeccionId
          && (!esV2 || opcionesTipoV2.some((o) => String(o.tipoInspeccionId) === draft.tipoInspeccionId))) {
        setTipoInspeccionId(draft.tipoInspeccionId);
      }
      if (typeof draft.fechaInspeccion === 'string') setFechaInspeccion(draft.fechaInspeccion);
      if (typeof draft.progress === 'number') { setProgress(draft.progress); setProgressInput(String(draft.progress)); }
      if (typeof draft.comentariosAvance === 'string') setComentariosAvance(draft.comentariosAvance);
      if (typeof draft.observacionesInspeccion === 'string') setObservacionesInspeccion(draft.observacionesInspeccion);
      if (draft.status === 'conforme' || draft.status === 'no-conforme') setStatus(draft.status);
      if (typeof draft.solicitarParalizacion === 'boolean') setSolicitarParalizacion(draft.solicitarParalizacion);
    } catch { /* ignorar */ }
  }, [draftKey]);

  const saveDraftToSession = () => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        type, tipoInspeccionId, fechaInspeccion, progress, comentariosAvance,
        observacionesInspeccion, status, solicitarParalizacion,
      }));
    } catch { /* ignorar */ }
  };

  // ── Selección de usuarios ─────────────────────────────────
  const toggleUsuario = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const usuariosFiltrados = usuarios.filter(u =>
      u.nombre.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
      u.correo.toLowerCase().includes(busquedaUsuario.toLowerCase())
  );

  // ── Handler: seleccionar informe ─────────────────────────
  const handleInformeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tiposPermitidos = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    ];
    if (!tiposPermitidos.includes(file.type)) {
      mostrarError(new Error('Solo se permiten archivos PDF, Word o fotos (JPG, PNG).'), 'Archivo no permitido');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      mostrarError(new Error('El archivo no debe superar los 10 MB. Elige uno más liviano.'), 'Archivo demasiado pesado');
      e.target.value = '';
      return;
    }

    setLoadingInforme(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) { setLoadingInforme(false); return; }
      const idx = dataUrl.indexOf(',');
      const base64 = idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
      setInforme({
        fileName:          file.name,
        fileContentBase64: base64,
        contentType:       file.type,
        sizeKb:            Math.round(file.size / 1024),
      });
      setLoadingInforme(false);
    };
    reader.onerror = () => {
      mostrarError(new Error('No se pudo leer el archivo. Vuelve a elegirlo e inténtalo de nuevo.'), 'No se pudo leer el archivo');
      setLoadingInforme(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Validación ────────────────────────────────────────────
  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!fechaInspeccion) newErrors.fechaInspeccion = 'La fecha es obligatoria';
    else if (esFechaFutura(fechaInspeccion)) newErrors.fechaInspeccion = 'La fecha de la inspección no puede ser futura: elige hoy o un día anterior.';
    if (!esV2 && !type) newErrors.type = 'Debe seleccionar un tipo de inspección';
    if (esV2 && !tipoInspeccionId) newErrors.type = 'Debe seleccionar un tipo de inspección';
    if (!comentariosAvance.trim()) newErrors.comentariosAvance = esV2 ? 'El comentario es obligatorio' : 'Los comentarios de avance son obligatorios';
    // v2: el único texto es el Comentario, así que "No Conforme" exige mínimo 10 caracteres ahí.
    else if (esV2 && status === 'no-conforme' && comentariosAvance.trim().length < 10)
      newErrors.comentariosAvance = 'Para No Conforme el comentario es obligatorio (mínimo 10 caracteres)';
    // El avance solo se valida si su sección está visible (v2: INSPECCION_AVANCE).
    if (muestraAvance && progress < minimoAvance)
      newErrors.progress = `El avance no puede ser menor al registrado anteriormente (${minimoAvance}%)`;
    if (!esV2 && status === 'no-conforme' && observacionesInspeccion.trim().length < 10)
      newErrors.observacionesInspeccion = 'Las observaciones son obligatorias para "No Conforme" (mínimo 10 caracteres)';
    if (faltaAdjunto) newErrors.adjunto = 'Este tipo de inspección exige al menos un adjunto: una foto O un informe o archivo (con uno basta).';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
          ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!fechaInspeccion || esFechaFutura(fechaInspeccion)) { scrollTo(refFecha); return; }
      if (!esV2 && !type) { scrollTo(refTipo); return; }
      if (esV2 && !tipoInspeccionId) { scrollTo(refTipo); return; }
      if (!comentariosAvance.trim()) { scrollTo(refComentarios); return; }
      if (esV2 && status === 'no-conforme' && comentariosAvance.trim().length < 10) { scrollTo(refComentarios); return; }
      if (faltaAdjunto) { scrollTo(refAdjuntos); return; }
      if (!esV2 && status === 'no-conforme' && observacionesInspeccion.trim().length < 10) { scrollTo(refObservaciones); }
      return;
    }

    saveDraftToSession();

    const usuariosNotificar = usuarios
        .filter(u => seleccionados.has(u.id))
        .map(u => ({ id: u.id, nombre: u.nombre, correo: u.correo }));

    onSave({
      type,
      tipoInspeccionId: esV2 && tipoInspeccionId ? Number(tipoInspeccionId) : undefined,
      tipoEvento: esV2
          ? opcionesTipoV2.find((o) => String(o.tipoInspeccionId) === tipoInspeccionId)?.codigo
          : undefined,
      fechaInspeccion,
      progress,
      comentariosAvance,
      observacionesInspeccion,
      status,
      photos: tempPhotos,
      solicitarParalizacion,
      usuariosNotificar,
      informe,
    });
  };

  const statusOptions = [
    {
      value: 'conforme' as const,
      label: 'Conforme',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'border-green-600 bg-green-50 text-green-700',
      activeColor: 'border-green-600 bg-green-600 text-white',
    },
    {
      value: 'no-conforme' as const,
      label: 'No Conforme',
      icon: <XCircle className="w-5 h-5" />,
      color: 'border-[#E30613] bg-red-50 text-[#E30613]',
      activeColor: 'border-[#E30613] bg-[#E30613] text-white',
    },
  ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <Header title="Nueva Inspección" showBackButton onBack={onBack} />

        <form noValidate onSubmit={handleSubmit} className="p-4 space-y-4">

          {/* Proyecto */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-[#4A4A4A] mb-1">Proyecto</p>
            <p className="text-[#003D7A]">Solicitud #{solicitud.codigo}</p>
          </div>

          {/* Fecha y hora */}
          <div ref={refFecha} className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-2">
              Fecha y Hora de Inspección <span className="text-[#E30613]">*</span>
            </label>
            <input
                type="datetime-local"
                value={fechaInspeccion}
                max={ahoraCLParaInput()}
                onChange={(e) => { setFechaInspeccion(e.target.value); setErrors(p => ({ ...p, fechaInspeccion: '' })); }}
                className={`w-full h-11 px-3 bg-white rounded-lg border ${errors.fechaInspeccion ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC]`}
            />
            {errors.fechaInspeccion && <p className="mt-1 text-sm text-[#E30613]">{errors.fechaInspeccion}</p>}
          </div>

          {/* Tipo de inspección */}
          <div ref={refTipo} className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-2">
              Tipo de Inspección <span className="text-[#E30613]">*</span>
            </label>
            {esV2 ? (
                // v2: catálogo de la API nueva (TipoInspeccionId), distinto del viejo de Oracle.
                <select
                    value={tipoInspeccionId}
                    onChange={(e) => { setTipoInspeccionId(e.target.value); setErrors(p => ({ ...p, type: '' })); }}
                    className={`w-full h-11 px-3 bg-white rounded-lg border ${errors.type ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC]`}
                >
                  <option value="">Seleccionar tipo...</option>
                  {opcionesTipoV2.map(o => (
                      <option key={o.codigo} value={o.tipoInspeccionId}>{o.nombre}</option>
                  ))}
                </select>
            ) : tiposInspeccionLoading ? (
                <div className="flex items-center gap-2 h-11 px-3 bg-[#F5F7FA] rounded-lg border border-[#003D7A]/20">
                  <Loader2 className="w-4 h-4 text-[#0066CC] animate-spin" />
                  <span className="text-sm text-[#4A4A4A]">Cargando tipos...</span>
                </div>
            ) : tiposInspeccionError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 mb-2">{tiposInspeccionError}</p>
                  <button type="button" onClick={recargarTiposInspeccion} className="flex items-center gap-1.5 text-sm text-[#0066CC]">
                    <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                  </button>
                </div>
            ) : (
                <select
                    value={type}
                    onChange={(e) => { setType(e.target.value); setErrors(p => ({ ...p, type: '' })); }}
                    className={`w-full h-11 px-3 bg-white rounded-lg border ${errors.type ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC]`}
                >
                  <option value="">Seleccionar tipo...</option>
                  {tiposInspeccion.map(t => (
                      <option key={t.id} value={t.titulo}>{t.titulo}</option>
                  ))}
                </select>
            )}
            {errors.type && <p className="mt-1 text-sm text-[#E30613]">{errors.type}</p>}
          </div>

          {/* Slider de avance — v2: solo si INSPECCION_AVANCE está habilitada */}
          {muestraAvance && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm text-[#4A4A4A]">% Avance de Obra</label>
                {avanceBloqueado ? (
                    <p className="text-sm font-medium text-[#4A4A4A] mt-0.5">
                      El avance no se puede cambiar con la obra detenida: queda en {minimoAvance}%.
                    </p>
                ) : minimoAvance > 0 && (
                    <p className="text-xs text-[#4A4A4A] mt-0.5">Mínimo: {minimoAvance}% (avance actual de la obra)</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                    type="number" min={minimoAvance} max="100"
                    disabled={avanceBloqueado}
                    value={progressInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProgressInput(val);
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 0 && num <= 100) {
                        setProgress(num);
                        setErrors(p => ({ ...p, progress: '' }));
                      }
                    }}
                    onBlur={() => {
                      const clamped = Math.max(minimoAvance, Math.min(100, parseInt(progressInput, 10) || minimoAvance));
                      setProgress(clamped);
                      setProgressInput(String(clamped));
                    }}
                    className={`w-16 h-9 px-2 text-center bg-white border-2 ${errors.progress ? 'border-[#E30613]' : 'border-[#0066CC]'} rounded-lg text-[#0066CC] font-bold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                <span className="text-xl text-[#0066CC] font-bold">%</span>
              </div>
            </div>
            <input
                type="range" min="0" max="100" step="1" value={progress}
                disabled={avanceBloqueado}
                onChange={(e) => {
                  const val = Math.max(minimoAvance, Number(e.target.value));
                  setProgress(val);
                  setProgressInput(String(val));
                }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0066CC] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#0066CC] [&::-moz-range-thumb]:border-0"
                style={{
                  background: `linear-gradient(to right, #0066CC 0%, #0066CC ${progress}%, #F5F7FA ${progress}%, #F5F7FA 100%)`,
                }}
            />
            <div className="flex justify-between mt-2 text-xs text-[#4A4A4A]">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
            {errors.progress && <p className="mt-1.5 text-sm text-[#E30613]">{errors.progress}</p>}
          </div>
          )}

          {/* Comentario — v2: único campo de texto (la API solo guarda Comentario, contrato CU-02) */}
          <div ref={refComentarios} className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-2">
              {esV2 ? 'Comentario' : 'Comentarios de Avance'} <span className="text-[#E30613]">*</span>
              {esV2 && status === 'no-conforme' && (
                  <span className="text-xs text-[#E30613] ml-1">(Obligatorio para No Conforme, mínimo 10 caracteres)</span>
              )}
            </label>
            <textarea
                value={comentariosAvance ?? ''}
                onChange={(e) => { setComentariosAvance(e.target.value); setErrors(p => ({ ...p, comentariosAvance: '' })); }}
                placeholder={
                  esV2
                      ? (status === 'no-conforme'
                          ? 'Describa los problemas detectados en la inspección...'
                          : 'Escriba su comentario sobre la inspección...')
                      : 'Agregue cualquier comentario respecto al avance...'
                }
                rows={esV2 ? 4 : 3}
                className={`w-full px-3 py-2 bg-white rounded-lg border ${errors.comentariosAvance ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none`}
            />
            {errors.comentariosAvance && <p className="mt-1 text-sm text-[#E30613]">{errors.comentariosAvance}</p>}
            <p className="mt-2 text-xs text-[#4A4A4A]">{comentariosAvance.length} caracteres</p>
          </div>

          {/* Estado general */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-3">Estado General</label>
            <div className="grid grid-cols-1 gap-2">
              {statusOptions.map(option => (
                  <button
                      key={option.value}
                      type="button"
                      onClick={() => { setStatus(option.value); if (option.value === 'conforme') setSolicitarParalizacion(false); }}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${status === option.value ? option.activeColor : option.color}`}
                  >
                    {option.icon}<span>{option.label}</span>
                  </button>
              ))}
            </div>
          </div>

          {/* Solicitud de Paralización — v2: se oculta (va a la pestaña Control de obra) */}
          {!esV2 && status === 'no-conforme' && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-[#003D7A] font-medium mb-1">Solicitar Paralización de Obra</h3>
                    <p className="text-sm text-[#4A4A4A] mb-3">
                      Si la situación requiere detener la obra, el supervisor será notificado para su revisión.
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                          type="checkbox"
                          checked={solicitarParalizacion}
                          onChange={(e) => setSolicitarParalizacion(e.target.checked)}
                          className="w-5 h-5 text-orange-600 border-2 border-orange-400 rounded focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-[#003D7A]">Solicitar paralización de esta obra</span>
                    </label>
                    {solicitarParalizacion && (
                        <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                          <p className="text-xs text-orange-800">
                            <strong>Importante:</strong> Esta solicitud será enviada al supervisor para su revisión. La obra no se paralizará automáticamente.
                          </p>
                        </div>
                    )}
                  </div>
                </div>
              </div>
          )}

          {/* Observaciones de Inspección — solo v1 (en v2 la API guarda un único Comentario) */}
          {!esV2 && (
          <div ref={refObservaciones} className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-2">
              Observaciones de Inspección
              {status === 'no-conforme' && (
                  <>
                    <span className="text-[#E30613]"> *</span>
                    <span className="text-xs text-[#E30613] ml-1">(Obligatorio para No Conforme)</span>
                  </>
              )}
            </label>
            <textarea
                value={observacionesInspeccion ?? ''}
                onChange={(e) => { setObservacionesInspeccion(e.target.value); setErrors(p => ({ ...p, observacionesInspeccion: '' })); }}
                placeholder={
                  status === 'no-conforme'
                      ? 'Describa los problemas detectados en la inspección...'
                      : 'Describa los detalles de la inspección (opcional)...'
                }
                rows={4}
                className={`w-full px-3 py-2 bg-white rounded-lg border ${errors.observacionesInspeccion ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none`}
            />
            {errors.observacionesInspeccion && (
                <p className="mt-1 text-sm text-[#E30613]">{errors.observacionesInspeccion}</p>
            )}
            <p className="mt-2 text-xs text-[#4A4A4A]">
              {observacionesInspeccion.length} caracteres
              {status === 'no-conforme' && ' (mínimo 10 requerido)'}
            </p>
          </div>
          )}

          {/* Adjuntos — una sola tarjeta: foto O informe/archivo (CU-23) */}
          {(muestraFotos || muestraInforme) && (
          <div ref={refAdjuntos} className={`bg-white rounded-lg p-4 shadow-sm ${errors.adjunto ? 'border-2 border-[#E30613]' : ''}`}>
            <h3 className="text-base font-semibold text-[#003D7A] mb-1">Adjuntos{requiereAdjunto ? '' : ' (opcionales)'}</h3>
            {requiereAdjunto && (
              <div className={`flex items-start gap-2 rounded-lg border p-3 mb-3 ${errors.adjunto ? 'bg-red-50 border-[#E30613]/40 text-[#B0000F]' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-base font-medium">
                  {errors.adjunto || 'Obligatorio: una foto O un informe o archivo. Con uno basta.'}
                </p>
              </div>
            )}
            {muestraFotos && (
            <div className={`rounded-lg p-3 border-2 ${errors.adjunto ? 'border-[#E30613] bg-red-50/40' : 'border-[#003D7A]/10'}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-[#4A4A4A]">Foto</label>
              <span className="text-sm text-[#0066CC]">{tempPhotos.length}</span>
            </div>
            <button
                type="button"
                onClick={() => { saveDraftToSession(); onAddPhoto(); }}
                className="w-full h-11 flex items-center justify-center gap-2 border-2 border-dashed border-[#0066CC] rounded-lg text-[#0066CC] active:bg-[#0066CC]/5 transition-colors mb-3"
            >
              <Camera className="w-5 h-5" /> Agregar Foto
            </button>
            {tempPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {tempPhotos.map(photo => (
                      <div key={photo.id} className="relative aspect-square">
                        <img src={photo.url} alt={photo.description} className="w-full h-full object-cover rounded-lg" />
                        <button
                            type="button"
                            onClick={() => onRemovePhoto(photo.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-[#E30613] rounded-full text-white shadow-lg active:scale-95"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                  ))}
                </div>
            )}
            </div>
            )}
            {muestraFotos && muestraInforme && (
            <div className="flex items-center gap-3 my-3" aria-hidden="true">
              <div className="flex-1 h-px bg-[#003D7A]/15" />
              <span className="text-base font-semibold text-[#003D7A]">O</span>
              <div className="flex-1 h-px bg-[#003D7A]/15" />
            </div>
            )}
            {muestraInforme && (
            <div className={`rounded-lg p-3 border-2 ${errors.adjunto ? 'border-[#E30613] bg-red-50/40' : 'border-[#003D7A]/10'}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-[#4A4A4A] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0066CC]" />
                Informe o archivo adjunto
              </label>
              <span className="text-xs text-[#4A4A4A]">PDF, Word o foto</span>
            </div>

            {/* Input oculto */}
            <input
                ref={informeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={handleInformeSelect}
                className="hidden"
            />

            {informe ? (
                /* Preview del archivo seleccionado */
                <div className="flex items-center gap-3 p-3 bg-[#F5F7FA] rounded-lg border border-[#003D7A]/10">
                  <FileText className="w-8 h-8 text-[#0066CC] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">{informe.fileName}</p>
                    <p className="text-xs text-[#4A4A4A]">
                      {informe.sizeKb < 1024
                          ? `${informe.sizeKb} KB`
                          : `${(informe.sizeKb / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <button
                      type="button"
                      onClick={() => {
                        setInforme(null);
                        if (informeInputRef.current) informeInputRef.current.value = '';
                      }}
                      className="w-7 h-7 flex items-center justify-center bg-[#E30613]/10 text-[#E30613] rounded-full active:scale-95 transition-transform flex-shrink-0"
                      aria-label="Quitar informe"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
            ) : loadingInforme ? (
                /* Estado cargando */
                <div className="flex items-center gap-2 h-11 px-3 bg-[#F5F7FA] rounded-lg border border-[#003D7A]/10">
                  <Loader2 className="w-4 h-4 text-[#0066CC] animate-spin" />
                  <span className="text-sm text-[#4A4A4A]">Procesando archivo...</span>
                </div>
            ) : (
                /* Botón adjuntar */
                <button
                    type="button"
                    onClick={() => informeInputRef.current?.click()}
                    className="w-full h-11 flex items-center justify-center gap-2 border-2 border-dashed border-[#003D7A]/25 rounded-lg text-[#4A4A4A] active:bg-[#F5F7FA] transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                  Adjuntar informe o archivo
                </button>
            )}
            </div>
            )}
          </div>
          )}

          {/* ── Usuarios a notificar ──────────────────────────────── */}
          {/* CU-21: solo v1. En v2 la API no tiene campo para notificar → la sección se oculta. */}
          {!esV2 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-[#003D7A] mb-1">
              <Users className="w-4 h-4 text-[#0066CC]" />
              Notificar a
              <span className="ml-auto text-xs font-normal text-[#4A4A4A]">
              {seleccionados.size > 0
                  ? `${seleccionados.size} seleccionado${seleccionados.size > 1 ? 's' : ''}`
                  : 'Opcional'}
            </span>
            </label>
            <p className="text-xs text-[#4A4A4A] mb-3">
              Selecciona los usuarios que recibirán notificación de esta inspección.
            </p>

            {loadingUsuarios ? (
                <div className="flex items-center gap-2 py-4 text-[#4A4A4A]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0066CC]" />
                  <span className="text-sm">Cargando usuarios...</span>
                </div>
            ) : (
                <>
                  {/* Buscador */}
                  <div className="relative mb-2">
                    <input
                        type="text"
                        placeholder="Buscar usuario..."
                        value={busquedaUsuario}
                        onChange={e => setBusquedaUsuario(e.target.value)}
                        className="w-full h-9 pl-3 pr-8 text-sm bg-[#F5F7FA] rounded-lg border border-[#003D7A]/15 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                    />
                    {busquedaUsuario && (
                        <button
                            type="button"
                            onClick={() => setBusquedaUsuario('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A4A4A]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                    )}
                  </div>

                  {/* Lista */}
                  <div className="border border-[#003D7A]/10 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    {usuariosFiltrados.length === 0 ? (
                        <div className="py-4 text-center text-sm text-[#4A4A4A]">
                          {usuarios.length === 0 ? 'No hay usuarios disponibles' : 'No se encontraron usuarios'}
                        </div>
                    ) : (
                        usuariosFiltrados.map((usuario, index) => {
                          const isSelected = seleccionados.has(usuario.id);
                          return (
                              <button
                                  key={usuario.id}
                                  type="button"
                                  onClick={() => toggleUsuario(usuario.id)}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-[#003D7A]/5 last:border-b-0 active:scale-[0.99] ${
                                      isSelected
                                          ? 'bg-[#0066CC]/8'
                                          : index % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]/50'
                                  }`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                                    isSelected ? 'bg-[#0066CC] text-white' : 'bg-[#003D7A]/10 text-[#003D7A]'
                                }`}>
                                  {usuario.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{usuario.nombre}</p>
                                  <p className="text-xs text-[#4A4A4A] truncate">{usuario.correo}</p>
                                </div>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSelected ? 'bg-[#0066CC] border-[#0066CC]' : 'border-[#003D7A]/25 bg-white'
                                }`}>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                              </button>
                          );
                        })
                    )}
                  </div>

                  {/* Chips seleccionados */}
                  {seleccionados.size > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {usuarios
                            .filter(u => seleccionados.has(u.id))
                            .map(u => (
                                <span
                                    key={u.id}
                                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#0066CC]/10 text-[#003D7A] rounded-full text-xs font-medium"
                                >
                        {u.nombre.split(' ')[0]}
                                  <button
                                      type="button"
                                      onClick={() => toggleUsuario(u.id)}
                                      className="w-4 h-4 rounded-full bg-[#003D7A]/15 flex items-center justify-center hover:bg-[#E30613]/20 transition-colors"
                                  >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                            ))}
                      </div>
                  )}
                </>
            )}
          </div>
          )}

          {/* Guardar */}
          <div className="pt-4">
            {faltaAdjunto && (
              <div className="flex items-start gap-2 rounded-lg border bg-amber-50 border-amber-300 text-amber-900 p-3 mb-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-base">
                  Para guardar falta: <strong>un adjunto: una foto O un informe o archivo (con uno basta)</strong>.
                </p>
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSaving}>
              Guardar Inspección
            </Button>
          </div>
        </form>
      </div>
  );
}
