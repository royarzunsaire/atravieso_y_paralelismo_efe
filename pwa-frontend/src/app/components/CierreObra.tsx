import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Header } from './Header';
import {
    Calendar,
    CheckCircle2,
    FileUp,
    Loader2,
    Lock,
    MessageSquare,
    Paperclip,
    Users,
    X,
} from 'lucide-react';
import type { Solicitud } from '../../types/solicitud';
import { usuariosService } from '@/services/usuarios';

// ============================================================
// TYPES
// ============================================================

export interface Usuario {
    id: number;
    nombre: string;
    correo: string;
}

export interface CierreObraData {
    solicitudId: number;
    codigoSolicitud: string | null;
    fechaCierre: string;
    comentarios: string;
    archivoInforme: {
        fileName: string;
        fileContentBase64: string;
        mimeType: string;
    } | null;
    usuariosNotificar: { id: number; nombre: string; correo: string }[];
}

interface CierreObraProps {
    solicitud: Solicitud;
    onBack: () => void;
    onSave: (data: CierreObraData) => Promise<void>;
    isSaving?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

function getLocalDateString(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
};

const ACCEPTED_MIME = Object.keys(MIME_LABELS).join(',');
const MAX_FILE_MB = 10;

// ============================================================
// COMPONENT
// ============================================================

export function CierreObra({ solicitud, onBack, onSave, isSaving = false }: CierreObraProps) {

    // ── Form state ────────────────────────────────────────────
    const [fechaCierre, setFechaCierre] = useState(getLocalDateString);
    const [comentarios, setComentarios] = useState('');
    const [archivo, setArchivo] = useState<CierreObraData['archivoInforme']>(null);
    const [archivoNombre, setArchivoNombre] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Usuarios ──────────────────────────────────────────────
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loadingUsuarios, setLoadingUsuarios] = useState(true);
    const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
    const [busquedaUsuario, setBusquedaUsuario] = useState('');

    // ── Refs para scroll a error ──────────────────────────────
    const refFecha = useRef<HTMLDivElement>(null);
    const refComentarios = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Cargar usuarios ───────────────────────────────────────
    useEffect(() => {
        setLoadingUsuarios(true);
        usuariosService
            .getAll()
            .then((data: Usuario[]) => setUsuarios(data))
            .catch(() => setUsuarios([]))
            .finally(() => setLoadingUsuarios(false));
    }, []);

    // ── Manejo de archivo ─────────────────────────────────────
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_FILE_MB) {
            setErrors(prev => ({ ...prev, archivo: `El archivo supera el límite de ${MAX_FILE_MB} MB` }));
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;
            const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
            setArchivo({ fileName: file.name, fileContentBase64: base64, mimeType: file.type });
            setArchivoNombre(file.name);
            setErrors(prev => ({ ...prev, archivo: '' }));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const removeArchivo = () => {
        setArchivo(null);
        setArchivoNombre('');
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
        const newErrors: Record<string, string> = {};
        if (!fechaCierre) newErrors.fechaCierre = 'La fecha de cierre es obligatoria';
        if (comentarios.trim().length < 10)
            newErrors.comentarios = 'Los comentarios son obligatorios (mínimo 10 caracteres)';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            if (!fechaCierre) { refFecha.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            if (comentarios.trim().length < 10) { refComentarios.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            return;
        }

        const usuariosNotificar = usuarios
            .filter(u => seleccionados.has(u.id))
            .map(u => ({ id: u.id, nombre: u.nombre, correo: u.correo }));

        onSave({
            solicitudId: solicitud.id,
            codigoSolicitud: solicitud.codigo,
            fechaCierre,
            comentarios,
            archivoInforme: archivo,
            usuariosNotificar,
        });
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-[#F5F7FA] pb-24">
            <Header title="Cierre de Obra" showBackButton onBack={onBack} />

            {/* Banner de aviso — obra completada */}
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <p className="text-white text-sm font-semibold">Obra al 100% — Lista para cerrar</p>
                    <p className="text-white/80 text-xs">Solicitud #{solicitud.codigo}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">

                {/* ── Fecha de cierre ──────────────────────────────── */}
                <div ref={refFecha} className="bg-white rounded-xl shadow-sm p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#003D7A] mb-3">
                        <Calendar className="w-4 h-4 text-[#0066CC]" />
                        Fecha de Cierre <span className="text-[#E30613]">*</span>
                    </label>
                    <input
                        type="datetime-local"
                        value={fechaCierre}
                        onChange={e => { setFechaCierre(e.target.value); setErrors(p => ({ ...p, fechaCierre: '' })); }}
                        className={`w-full h-11 px-3 bg-white rounded-lg border-2 ${errors.fechaCierre ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC] transition-shadow`}
                    />
                    {errors.fechaCierre && <p className="mt-1.5 text-sm text-[#E30613]">{errors.fechaCierre}</p>}
                </div>

                {/* ── Comentarios ──────────────────────────────────── */}
                <div ref={refComentarios} className="bg-white rounded-xl shadow-sm p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#003D7A] mb-3">
                        <MessageSquare className="w-4 h-4 text-[#0066CC]" />
                        Comentarios del Cierre <span className="text-[#E30613]">*</span>
                    </label>
                    <textarea
                        value={comentarios}
                        onChange={e => { setComentarios(e.target.value); setErrors(p => ({ ...p, comentarios: '' })); }}
                        placeholder="Describa el estado final de la obra, trabajos realizados, observaciones relevantes del cierre..."
                        rows={5}
                        className={`w-full px-3 py-2 bg-white rounded-lg border-2 ${errors.comentarios ? 'border-[#E30613]' : 'border-[#003D7A]/20'} focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none transition-shadow`}
                    />
                    <div className="flex justify-between mt-1.5">
                        {errors.comentarios
                            ? <p className="text-sm text-[#E30613]">{errors.comentarios}</p>
                            : <span />}
                        <span className="text-xs text-[#4A4A4A]">{comentarios.length} caracteres</span>
                    </div>
                </div>

                {/* ── Informe final ─────────────────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#003D7A] mb-3">
                        <Paperclip className="w-4 h-4 text-[#0066CC]" />
                        Informe Final de Obra
                        <span className="ml-1 text-xs text-[#4A4A4A] font-normal">(opcional)</span>
                    </label>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_MIME}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {archivo ? (
                        /* Archivo adjunto — vista previa */
                        <div className="flex items-center gap-3 p-3 bg-[#F5F7FA] rounded-lg border-2 border-[#0066CC]/30">
                            <div className="w-10 h-12 bg-[#0066CC]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-[#0066CC]">
                  {MIME_LABELS[archivo.mimeType] ?? 'DOC'}
                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#003D7A] truncate">{archivoNombre}</p>
                                <p className="text-xs text-[#4A4A4A] mt-0.5">Listo para adjuntar</p>
                            </div>
                            <button
                                type="button"
                                onClick={removeArchivo}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-[#E30613] active:scale-95 transition-transform flex-shrink-0"
                                aria-label="Quitar archivo"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        /* Zona de carga */
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-[#0066CC]/40 rounded-lg text-[#0066CC] bg-[#0066CC]/5 active:bg-[#0066CC]/10 transition-colors"
                        >
                            <FileUp className="w-7 h-7" />
                            <span className="text-sm font-medium">Adjuntar informe final</span>
                            <span className="text-xs text-[#4A4A4A]">PDF, Word, Excel — máx. {MAX_FILE_MB} MB</span>
                        </button>
                    )}

                    {errors.archivo && <p className="mt-1.5 text-sm text-[#E30613]">{errors.archivo}</p>}
                </div>

                {/* ── Usuarios a notificar ──────────────────────────── */}
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
                        Selecciona los usuarios que recibirán notificación del cierre de obra.
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

                            {/* Lista de usuarios */}
                            <div className="border border-[#003D7A]/10 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                {usuariosFiltrados.length === 0 ? (
                                    <div className="py-4 text-center text-sm text-[#4A4A4A]">
                                        No se encontraron usuarios
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
                                                {/* Avatar con inicial */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                                                    isSelected ? 'bg-[#0066CC] text-white' : 'bg-[#003D7A]/10 text-[#003D7A]'
                                                }`}>
                                                    {usuario.nombre.charAt(0).toUpperCase()}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-[#1A1A1A] truncate">{usuario.nombre}</p>
                                                    <p className="text-xs text-[#4A4A4A] truncate">{usuario.correo}</p>
                                                </div>

                                                {/* Checkbox visual */}
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    isSelected
                                                        ? 'bg-[#0066CC] border-[#0066CC]'
                                                        : 'border-[#003D7A]/25 bg-white'
                                                }`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Chips de seleccionados */}
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

                {/* ── Aviso de acción irreversible ──────────────────── */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-semibold">Esta acción es definitiva.</span> Al cerrar la obra se
                        registrará la fecha y comentarios de cierre y se notificará a los usuarios seleccionados.
                    </p>
                </div>

                {/* ── Botón guardar ─────────────────────────────────── */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Guardando cierre...
                            </>
                        ) : (
                            <>
                                <Lock className="w-5 h-5" />
                                Confirmar Cierre de Obra
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
