// src/components/ToastContainer.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ToastNotification } from '../types';
import { 
  X, 
  MessageSquare, 
  Sparkles, 
  FolderCheck, 
  ArrowRight,
} from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onOpenTicket: (ticketId: string | number) => void;
}

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onOpenTicket: (ticketId: string | number) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onOpenTicket }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const dismissedRef = useRef(false);
  const remainingTimeRef = useRef(6500); // 6.5 segundos
  const lastTickRef = useRef<number | null>(null);

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (isPaused) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();
    const totalDuration = 6500;
    const intervalTime = 50; // cada 50ms

    const timer = setInterval(() => {
      const now = Date.now();
      const delta = lastTickRef.current ? now - lastTickRef.current : intervalTime;
      lastTickRef.current = now;

      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - delta);
      const newPct = (remainingTimeRef.current / totalDuration) * 100;
      setProgress(newPct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(timer);
        handleDismiss();
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, handleDismiss]);

  const esTicket = toast.tipo === 'ticket';
  const esEntrega = toast.tipo === 'entrega';
  const esComentario = toast.tipo === 'comentario';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="pointer-events-auto w-full bg-white dark:bg-[#202020] border border-neutral-200/90 dark:border-neutral-700/90 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden transition-all duration-300 transform translate-y-0 hover:shadow-2xl hover:border-neutral-300 dark:hover:border-neutral-600 animate-in fade-in slide-in-from-bottom-3"
      role="alert"
    >
      <div className="p-3.5 flex items-start space-x-3">
        {/* Ícono temático según el tipo de novedad */}
        <div className="shrink-0 mt-0.5">
          {esTicket && (
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
          {esEntrega && (
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <FolderCheck className="w-4 h-4" />
            </div>
          )}
          {esComentario && (
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs">
              <MessageSquare className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Contenido textual */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-1.5 truncate">
              {toast.autorRol && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    toast.autorRol === 'CONTENIDOS'
                      ? 'bg-blue-100/80 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                      : 'bg-purple-100/80 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                  }`}
                >
                  {toast.autorRol}
                </span>
              )}
              {toast.ticketNumero && (
                <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {toast.ticketNumero}
                </span>
              )}
            </div>

            {/* Botón cerrar X */}
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded transition cursor-pointer"
              title="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Título de la alerta */}
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mt-1 line-clamp-1 flex items-center gap-1">
            <span>{toast.titulo}</span>
            <span className="text-[11px]">🐾</span>
          </h4>

          {/* Extracto del mensaje */}
          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">
            {toast.mensaje}
          </p>

          {/* Botón de acción para abrir el ticket */}
          {toast.ticketId && (
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-neutral-100 dark:border-neutral-750">
              <button
                onClick={() => {
                  onDismiss(toast.id);
                  onOpenTicket(toast.ticketId!);
                }}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer group"
              >
                <span>Ver en Woof Woof</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Ahora mismo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Barra de progreso de auto-cierre */}
      <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full transition-all duration-75 ${
            esTicket ? 'bg-amber-500' : esEntrega ? 'bg-emerald-500' : 'bg-purple-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onOpenTicket,
}) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside aria-label="Notificaciones" className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onOpenTicket={onOpenTicket}
        />
      ))}
    </aside>
  );
};
