import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { Header } from './Header';
import { Button } from './Button';
import {
  AlertOctagon,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { Solicitud, InspectionPhoto } from '../../types/solicitud';
import { useCatalogs } from '@/context/CatalogsContext';
import { usuariosService } from '@/services/usuarios';

// ── Tipo local de usuario ─────────────────────────────────────
interface Usuario {
  id: number;
  nombre: string;
  correo: string;
}

function getLocalDateTimeString(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

interface NewInspectionProps {
  solicitud: Solicitud;
  onBack: () => void;
  isSaving?: boolean;
  minimoAvance?: number;   // avance de la última inspección — no puede retroceders
  onSave: (inspection: {
    type: string;
    progress: number;
    comentariosAvance: string;
    observacionesInspeccion: string;
    status: 'conforme' | 'no-conforme';
    photos: InspectionPhoto[];
    solicitarParalizacion?: boolean;
    fechaInspeccion?: string;
    usuariosNotificar: { id: number; nombre: string; correo: string }[];
  }) => void;
  onAddPhoto: () => void;
  tempPhotos: InspectionPhoto[];
  onRemovePhoto: (photoId: string) => void;
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
                              }: NewInspectionProps) {
  const draftKey = useMemo(() => `newInspectionDraft:${solicitud.id}`, [solicitud.id]);

  const { tiposInspeccion, tiposInspeccionLoading, tiposInspeccionError, recargarTiposInspeccion } =
      useCatalogs();

  // ── Form state ────────────────────────────────────────────
  const [type, setType] = useState('');
  const [fechaInspeccion, setFechaInspeccion] = useState(getLocalDateTimeString);
  const [progress, setProgress] = useState(() => minimoAvance);
  const [comentariosAvance, setComentariosAvance] = useState('');
  const [observacionesInspeccion, setObservacionesInspeccion] = useState('');
  const [status, setStatus] = useState<'conforme' | 'no-conforme'>('conforme');
  const [solicitarParalizacion, setSolicitarParalizacion] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
      if (typeof draft.fechaInspeccion === 'string') setFechaInspeccion(draft.fechaInspeccion);
      if (typeof draft.progress === 'number') setProgress(draft.progress);
      if (typeof draft.comentariosAvance === 'string') setComentariosAvance(draft.comentariosAvance);
      if (typeof draft.observacionesInspeccion === 'string') setObservacionesInspeccion(draft.observacionesInspeccion);
      if (draft.status === 'conforme' || draft.status === 'no-conforme') setStatus(draft.status);
      if (typeof draft.solicitarParalizacion === 'boolean') setSolicitarParalizacion(draft.solicitarParalizacion);
    } catch { /* ignorar */ }
  }, [draftKey]);

  const saveDraftToSession = () => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        type, fechaInspeccion, progress, comentariosAvance,
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

  // ── Validación ────────────────────────────────────────────
  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!fechaInspeccion) newErrors.fechaInspeccion = 'La fecha es obligatoria';
    if (!type) newErrors.type = 'Debe seleccionar un tipo de inspección';
    if (!comentariosAvance.trim()) newErrors.comentariosAvance = 'Los comentarios de avance son obligatorios';
    if (progress < minimoAvance)
      newErrors.progress = `El avance no puede ser menor al registrado anteriormente (${minimoAvance}%)`;
    if (status === 'no-conforme' && observacionesInspeccion.trim().length < 10)
      newErrors.observacionesInspeccion = 'Las observaciones son obligatorias para "No Conforme" (mínimo 10 caracteres)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
          ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!fechaInspeccion) { scrollTo(refFecha); return; }
      if (!type) { scrollTo(refTipo); return; }
      if (!comentariosAvance.trim()) { scrollTo(refComentarios); return; }
      if (status === 'no-conforme' && observacionesInspeccion.trim().length < 10) { scrollTo(refObservaciones); }
      return;
    }

    saveDraftToSession();

    const usuariosNotificar = usuarios
        .filter(u => seleccionados.has(u.id))
        .map(u => ({ id: u.id, nombre: u.nombre, correo: u.correo }));

    onSave({
      type,
      fechaInspeccion,
      progress,
      comentariosAvance,
      observacionesInspeccion,
      status,
      photos: tempPhotos,
      solicitarParalizacion,
      usuariosNotificar,
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">

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
            {tiposInspeccionLoading ? (
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

          {/* Slider de avance */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm text-[#4A4A4A]">% Avance de Obra</label>
                {minimoAvance > 0 && (
                    <p className="text-xs text-[#4A4A4A] mt-0.5">Mínimo: {minimoAvance}% (última inspección)</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                    type="number" min={minimoAvance} max="100" value={progress}
                    onChange={(e) => setProgress(Math.max(minimoAvance, Math.min(100, parseInt(e.target.value) || minimoAvance)))}
                    className={`w-16 h-9 px-2 text-center bg-white border-2 ${errors.progress ? 'border-[#E30613]' : 'border-[#0066CC]'} rounded-lg text-[#0066CC] font-bold focus:outline-none`}
                />
                <span className="text-xl text-[#0066CC] font-bold">%</span>
              </div>
            </div>
            <input
                type="range" min="0" max="100" step="1" value={progress}
                onChange={(e) => setProgress(Math.max(minimoAvance, Number(e.target.value)))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0066CC] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#0066CC] [&::-moz-range-thumb]:border-0"
                style={{
                  background: `linear-gradient(to right, #0066CC 0%, #0066CC ${progress}%, #F5F7FA ${progress}%, #F5F7FA 100%)`,
                }}
            />
            <div className="flex justify-between mt-2 text-xs text-[#4A4A4A]">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
            {errors.progress && <p className="mt-1.5 text-sm text-[#E30613]">{errors.progress}</p>}
          </div>

          {/* Comentarios de Avance */}
          <div ref={refComentarios} className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm text-[#4A4A4A] mb-2">
              Comentarios de Avance <span className="text-[#E30613]">*</span>
            </label>
            <textarea
                value={comentariosAvance}
                onChange={(e) => { setComentariosAvance(e.target.value); setErrors(p => ({ ...p, comentariosAvance: '' })); }}
                placeholder="Agregue cualquier comentario respecto al avance..."
                rows={3}
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

          {/* Solicitud de Paralización */}
          {status === 'no-conforme' && (
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

          {/* Observaciones de Inspección */}
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
                value={observacionesInspeccion}
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

          {/* Fotos */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-[#4A4A4A]">Fotos Adjuntas</label>
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

          {/* ── Usuarios a notificar ──────────────────────────────── */}
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

          {/* Guardar */}
          <div className="pt-4">
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSaving}>
              {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </span>
              ) : 'Guardar Inspección'}
            </Button>
          </div>
        </form>
      </div>
  );
}
