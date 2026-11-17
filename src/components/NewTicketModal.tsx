// src/components/NewTicketModal.tsx
import React, { useState, useMemo } from 'react';
import { Ticket, UserRole, Profile } from '../types';
import { ticketsService } from '../lib/supabase';
import { RichTextEditor } from './RichTextEditor';
import { htmlHasImages } from '../lib/imageStorage';
import { 
  X, 
  Send, 
  Building2, 
  Sparkles, 
  Clock, 
  Link2 
} from 'lucide-react';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (newTicket: Ticket) => void;
  currentRole: UserRole;
  userProfile?: Profile | null;
  existingTickets?: Ticket[];
}

// Lista base de áreas estándar de la empresa
const DEFAULT_AREAS = [
  'Prensa',
  'Marketing',
  'Audiovisual',
  'Redes Sociales',
  'Institucional',
  'Diseño UI/UX',
  'Eventos y Producción'
];

function normalizeUrlInput(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
  currentRole,
  userProfile,
  existingTickets = []
}) => {
  const [titulo, setTitulo] = useState('');
  const [areaSolicitante, setAreaSolicitante] = useState('');
  const [brief, setBrief] = useState('');
  const [linkReferencia, setLinkReferencia] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener sugerencias dinámicas ordenadas por frecuencia de uso en tickets reales
  const areasSugeridas = useMemo(() => {
    const conteo: Record<string, number> = {};
    DEFAULT_AREAS.forEach((a) => {
      conteo[a] = 1;
    });

    try {
      const guardadas = localStorage.getItem('ticketing_recent_areas');
      if (guardadas) {
        const parsed: string[] = JSON.parse(guardadas);
        parsed.forEach((a) => {
          conteo[a] = (conteo[a] || 0) + 5;
        });
      }
    } catch {}

    existingTickets.forEach((t) => {
      if (t.area_solicitante) {
        conteo[t.area_solicitante] = (conteo[t.area_solicitante] || 0) + 2;
      }
    });

    const ordenReciente = Object.keys(conteo);
    return ordenReciente.sort((a, b) => (conteo[b] || 0) - (conteo[a] || 0)).slice(0, 8);
  }, [existingTickets]);

  if (!isOpen) return null;

  // Guardar nueva área en memoria local para que aparezca entre las recientes
  const guardarAreaReciente = (nuevaArea: string) => {
    const limpia = nuevaArea.trim();
    if (!limpia) return;
    try {
      const prev = localStorage.getItem('ticketing_recent_areas');
      const lista: string[] = prev ? JSON.parse(prev) : [];
      const actualizada = [limpia, ...lista.filter((a) => a.toLowerCase() !== limpia.toLowerCase())].slice(0, 15);
      localStorage.setItem('ticketing_recent_areas', JSON.stringify(actualizada));
    } catch {}
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      setError('Por favor indica un título para el pedido.');
      return;
    }

    const areaLimpia = areaSolicitante.trim();
    if (!areaLimpia) {
      setError('Por favor indica el área solicitante (puedes escribir una nueva o elegir una sugerida).');
      return;
    }

    const briefPlano = brief.replace(/<[^>]*>/g, '').trim();
    const tieneImagenes = htmlHasImages(brief);
    if (!briefPlano && !tieneImagenes) {
      setError('Por favor agrega el brief, especificaciones o adjunta al menos una imagen de referencia.');
      return;
    }

    const nombreCreador = userProfile?.nombre?.trim() || userProfile?.email?.split('@')[0] || (
      currentRole === 'SUPER_ADMIN' ? 'Super Administrador' : 'Equipo de Contenidos'
    );

    const linkNormalizado = normalizeUrlInput(linkReferencia);

    try {
      setLoading(true);
      setError(null);

      guardarAreaReciente(areaLimpia);

      const nuevoTicket = await ticketsService.createTicket({
        titulo: titulo.trim(),
        area_solicitante: areaLimpia,
        brief: brief.trim(),
        links_referencia: linkNormalizado || undefined,
        estado: 'pendiente',
        creado_por: nombreCreador,
        user_id: userProfile?.id,
        creador_rol: currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CONTENIDOS'
      });

      // Disparar evento de acción local y notificar creación
      if (nuevoTicket) {
        window.dispatchEvent(
          new CustomEvent('woof_local_action', {
            detail: { id: nuevoTicket.id, text: nuevoTicket.titulo, ticketId: nuevoTicket.id }
          })
        );
        onTicketCreated(nuevoTicket);
      }

      // Limpiar formulario y cerrar
      setTitulo('');
      setAreaSolicitante('');
      setBrief('');
      setLinkReferencia('');
      onClose();
    } catch (err: any) {
      console.error('Error al crear ticket:', err);
      setError(err.message || 'No se pudo crear el ticket. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const nombreCreador = userProfile?.nombre?.trim() || userProfile?.email?.split('@')[0] || (
    currentRole === 'SUPER_ADMIN' ? 'Super Administrador' : 'Equipo de Contenidos'
  );

  const esAreaNueva = areaSolicitante.trim() !== '' && !areasSugeridas.some(
    (a) => a.toLowerCase() === areaSolicitante.trim().toLowerCase()
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Contenedor del Modal con estética Notion */}
      <div 
        className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-[#252525]">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📄</span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Nuevo Pedido a Gráfica
                </h2>
                <span className="text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md font-medium">
                  Solicitante: <strong>{nombreCreador}</strong>
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                El equipo de diseño recibirá la notificación para iniciar la producción.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}

          {/* Título del pedido */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Título del pedido *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej. Banners promocionales para Instagram y Web - Campaña Invierno"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50/60 dark:bg-[#191919] border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-[#191919] focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent transition"
            />
          </div>

          {/* Área Solicitante: Input editable para crear nuevas áreas + sugerencias más utilizadas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span>Área solicitante *</span>
              </label>
              {esAreaNueva && (
                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full animate-in fade-in">
                  <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Creará una nueva área</span>
                </span>
              )}
            </div>

            {/* Input de texto para escribir o crear cualquier área */}
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Escribe el nombre del área (ej. Prensa, Marketing, Logística, Legales...)"
                value={areaSolicitante}
                onChange={(e) => setAreaSolicitante(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50/60 dark:bg-[#191919] border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-[#191919] focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent transition font-medium"
              />
            </div>

            {/* Chips de sugerencias: Más utilizadas o recientes */}
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center space-x-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                <Clock className="w-3 h-3" />
                <span>Áreas más utilizadas o recientes:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {areasSugeridas.map((area) => {
                  const isSelected = areaSolicitante.toLowerCase() === area.toLowerCase();
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setAreaSolicitante(area)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 border-neutral-900 dark:border-neutral-100 font-medium shadow-2xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Editor Enriquecido para Brief y Especificaciones (Estilo Gmail) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Brief y Especificaciones Técnicas *
            </label>
            <RichTextEditor
              value={brief}
              onChange={setBrief}
              placeholder="Detalla dimensiones, formatos (PNG, Reels, Stories, PDF), copies y cualquier instrucción importante para el diseñador, o pega capturas con Ctrl+V..."
              minHeight="140px"
              storageFolder="briefs"
              onSubmitShortcut={handleSubmit}
            />
          </div>

          {/* Insumos / Links de Referencia */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Link2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span>Carpeta de Referencias (Google Drive / Figma)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://drive.google.com/drive/folders/..."
                value={linkReferencia}
                onChange={(e) => setLinkReferencia(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-neutral-50/60 dark:bg-[#191919] border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-[#191919] focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent transition"
              />
              <span className="absolute right-3 top-3 text-neutral-400 dark:text-neutral-500">
                📁
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              Asegúrate de que la carpeta de Drive tenga permisos de visualización o edición habilitados.
            </p>
          </div>

        </div>

        {/* Pie de página con Acciones */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-[#202020] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white dark:text-neutral-950 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Enviando...' : 'Enviar Ticket a Gráfica'}</span>
          </button>
        </div>

      </div>

    </div>
  );
};

