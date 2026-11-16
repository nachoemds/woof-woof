// src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { UserRole, Ticket, ToastNotification, Profile } from './types';
import { ticketsService, supabase, formatTicket, formatComment } from './lib/supabase';
import { Topbar } from './components/Topbar';
import { NotionTable } from './components/NotionTable';
import { NewTicketModal } from './components/NewTicketModal';
import { TicketDrawer } from './components/TicketDrawer';
import { ToastContainer } from './components/ToastContainer';
import { Login } from './components/Login';
import { WoofLogo } from './components/WoofLogo';
import { TeamManagementModal } from './components/TeamManagementModal';
import { UserColorPickerModal } from './components/UserColorPickerModal';
import { initPushServiceWorker, sendNativePushNotification } from './lib/pushNotifications';
import { Loader2 } from 'lucide-react';

type TeamBucket = 'CONTENIDOS' | 'GRAFICA' | 'SUPER_ADMIN';

// Obtiene la clave de bandeja de lectura independiente por equipo
function getTeamBucket(role: UserRole): TeamBucket {
  if (role === 'GRAFICA') return 'GRAFICA';
  if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return 'CONTENIDOS';
}

function getTeamReadKey(bucket: TeamBucket): string {
  return `ticketing_read_ids_${bucket}`;
}

function getTeamUnreadKey(bucket: TeamBucket): string {
  return `ticketing_unread_ids_${bucket}`;
}

export default function App() {
  // 🌓 Modo Claro / Oscuro (por defecto activo en modo Claro / Blanco)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const guardado = localStorage.getItem('woof_theme_mode');
      if (guardado) return guardado === 'dark';
      return false; // Por defecto siempre blanco (modo claro)
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('woof_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('woof_theme_mode', 'light');
    }
  }, [isDarkMode]);

  // 1. Estado de Sesión y Perfil de Usuario (RBAC)
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 2. Estado de Tickets y Vistas
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // 🔔 Estado de notificaciones visuales (Toasts)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Mapear rol activo para componentes hijos (TicketDrawer, NotionTable, etc.)
  const uiRole = useMemo<UserRole>(() => {
    if (!userProfile) return 'CONTENIDOS';
    if (userProfile.rol === 'superadmin') return 'SUPER_ADMIN';
    if (userProfile.rol === 'operador') {
      return userProfile.area === 'Gráfica' ? 'GRAFICA' : 'CONTENIDOS';
    }
    // solicitante actúa con permisos de creación y seguimiento (CONTENIDOS)
    return 'CONTENIDOS';
  }, [userProfile]);

  // 🔴 Lista de IDs de tickets con novedades no leídas (SEPARADA POR EQUIPO: CONTENIDOS vs GRÁFICA)
  const [unreadTicketIds, setUnreadTicketIds] = useState<string[]>([]);

  // Referencias mutables para que los callbacks en tiempo real siempre lean el estado actual
  const uiRoleRef = useRef<UserRole>(uiRole);
  const ticketsRef = useRef<Ticket[]>(tickets);
  const selectedTicketRef = useRef<Ticket | null>(selectedTicket);
  const sessionRef = useRef<Session | null>(session);

  useEffect(() => {
    uiRoleRef.current = uiRole;
  }, [uiRole]);

  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ============================================================================
  // 📬 SISTEMA DE LECTURA SEPARADO POR EQUIPO (CONTENIDOS vs GRÁFICA vs ADMIN)
  // ============================================================================
  const getReadTicketIdsForTeam = useCallback((bucket: TeamBucket): string[] => {
    try {
      const raw = localStorage.getItem(getTeamReadKey(bucket));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const getUnreadTicketIdsForTeam = useCallback((bucket: TeamBucket): string[] => {
    try {
      const raw = localStorage.getItem(getTeamUnreadKey(bucket));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Marca un ticket como "Nuevo" (No leído) para los equipos indicados sin afectar al otro si no corresponde
  const marcarTicketNoLeidoParaEquipos = useCallback(
    (id: string | number, targetBuckets: TeamBucket[] = ['CONTENIDOS', 'GRAFICA', 'SUPER_ADMIN']) => {
      const idStr = String(id);
      const currentBucket = getTeamBucket(uiRoleRef.current);

      targetBuckets.forEach((bucket) => {
        try {
          // 1. Quitar de la lista de leídos de ese equipo
          const readIds = getReadTicketIdsForTeam(bucket).filter((item) => item !== idStr);
          localStorage.setItem(getTeamReadKey(bucket), JSON.stringify(readIds));

          // 2. Agregar a la lista de no leídos de ese equipo
          const unreadIds = getUnreadTicketIdsForTeam(bucket);
          if (!unreadIds.includes(idStr)) {
            const actualizados = [idStr, ...unreadIds];
            localStorage.setItem(getTeamUnreadKey(bucket), JSON.stringify(actualizados));
          }
        } catch {}
      });

      // Si el equipo del usuario actual está entre los destinatarios, actualizar la vista en vivo
      if (targetBuckets.includes(currentBucket)) {
        setUnreadTicketIds((prev) => (prev.includes(idStr) ? prev : [idStr, ...prev]));
      }
    },
    [getReadTicketIdsForTeam, getUnreadTicketIdsForTeam]
  );

  // Marca un ticket como "Leído" ÚNICAMENTE para el equipo del usuario que lo abrió
  const marcarTicketComoLeido = useCallback(
    (id: string | number) => {
      const idStr = String(id);
      const currentBucket = getTeamBucket(uiRoleRef.current);

      try {
        // Guardar como leído solo en la bandeja de ESTE equipo
        const readIds = getReadTicketIdsForTeam(currentBucket);
        if (!readIds.includes(idStr)) {
          localStorage.setItem(getTeamReadKey(currentBucket), JSON.stringify([...readIds, idStr]));
        }

        // Quitar de no leídos solo en la bandeja de ESTE equipo
        const unreadIds = getUnreadTicketIdsForTeam(currentBucket).filter((item) => item !== idStr);
        localStorage.setItem(getTeamUnreadKey(currentBucket), JSON.stringify(unreadIds));
      } catch {}

      setUnreadTicketIds((prev) => prev.filter((item) => item !== idStr));
    },
    [getReadTicketIdsForTeam, getUnreadTicketIdsForTeam]
  );

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
    if (selectedTicket) {
      marcarTicketComoLeido(selectedTicket.id);
    }
  }, [selectedTicket, marcarTicketComoLeido]);

  // Cargar perfil desde la tabla 'perfiles' filtrando por id == user.id o por email
  const cargarPerfilUsuario = async (userId: string, userEmail?: string) => {
    try {
      setAuthLoading(true);
      let data: any = null;

      // 1. Intentar buscar por id (UUID de Supabase Auth)
      try {
        const resId = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (resId.data) data = resId.data;
      } catch {}

      // 2. Si no encontró por ID, buscar por email
      if (!data && userEmail) {
        try {
          const resEmail = await supabase
            .from('perfiles')
            .select('*')
            .ilike('email', userEmail.trim())
            .maybeSingle();
          if (resEmail.data) data = resEmail.data;
        } catch {}
      }

      // 3. Si no encontró, buscar por nombre de usuario (ej: coni)
      if (!data && userEmail) {
        try {
          const username = userEmail.split('@')[0];
          const resName = await supabase
            .from('perfiles')
            .select('*')
            .ilike('nombre', `%${username}%`)
            .maybeSingle();
          if (resName.data) data = resName.data;
        } catch {}
      }

      if (data) {
        setUserProfile(data as Profile);
      } else {
        // Fallback seguro con rol 'operador' y área 'Contenidos' para que nunca quede bloqueado sin ver tickets
        const fallback: Profile = {
          id: userId,
          email: userEmail || '',
          nombre: userEmail?.split('@')[0] || 'Coni',
          rol: 'operador',
          area: 'Contenidos'
        };

        try {
          await supabase.from('perfiles').insert([fallback]);
        } catch {}

        setUserProfile(fallback);
      }
    } catch (err) {
      console.error('Error al cargar perfil del usuario:', err);
      setUserProfile({
        id: userId,
        email: userEmail || '',
        nombre: userEmail?.split('@')[0] || 'Coni',
        rol: 'operador',
        area: 'Contenidos'
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // 🔐 Escuchar cambios de estado de autenticación en tiempo real
  useEffect(() => {
    let mounted = true;

    // Obtener sesión activa al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        cargarPerfilUsuario(session.user.id, session.user.email);
      } else {
        setAuthLoading(false);
      }
    });

    // Suscribirse al listener de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        if (currentSession?.user) {
          await cargarPerfilUsuario(currentSession.user.id, currentSession.user.email);
        } else {
          setUserProfile(null);
          setTickets([]);
          setUnreadTicketIds([]);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 🔔 Inicializar Service Worker para notificaciones Push nativas en segundo plano
  useEffect(() => {
    initPushServiceWorker();
  }, []);

  // 🔔 Escuchar clics en las notificaciones nativas del sistema operativo para abrir el ticket
  useEffect(() => {
    const handleOpenTicketFromPush = (e: Event) => {
      const customEvent = e as CustomEvent<{ ticketId?: string | number }>;
      const targetId = customEvent.detail?.ticketId;
      if (!targetId) return;

      const encontrado = ticketsRef.current.find((t) => String(t.id) === String(targetId));
      if (encontrado) {
        setSelectedTicket(encontrado);
        marcarTicketComoLeido(encontrado.id);
      }
    };

    window.addEventListener('woof_open_ticket', handleOpenTicketFromPush);
    return () => window.removeEventListener('woof_open_ticket', handleOpenTicketFromPush);
  }, [marcarTicketComoLeido]);

  // ⌨️ Atajos de teclado globales (Ctrl/Cmd + N o tecla 'N' para Nuevo Ticket, 'Esc' para cerrar modales/drawers)
  useEffect(() => {
    if (!session || !userProfile) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 1. Escape -> Cerrar el modal o drawer activo en orden de prioridad
      if (e.key === 'Escape') {
        if (isColorPickerOpen) {
          e.preventDefault();
          setIsColorPickerOpen(false);
          return;
        }
        if (isTeamModalOpen) {
          e.preventDefault();
          setIsTeamModalOpen(false);
          return;
        }
        if (isNewModalOpen) {
          e.preventDefault();
          setIsNewModalOpen(false);
          return;
        }
        if (selectedTicket) {
          e.preventDefault();
          setSelectedTicket(null);
          return;
        }
        return;
      }

      // 2. Nuevo Ticket -> Ctrl/Cmd + N, Alt + N, o tecla 'N' (cuando no se está escribiendo en un input)
      const isNewTicketShortcut =
        ((e.metaKey || e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'n') ||
        (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n');

      if (isNewTicketShortcut) {
        const canCreateTicket = uiRole === 'CONTENIDOS' || uiRole === 'SUPER_ADMIN';
        if (canCreateTicket && !isNewModalOpen && !isTeamModalOpen && !isColorPickerOpen) {
          e.preventDefault();
          setIsNewModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [session, userProfile, uiRole, isColorPickerOpen, isTeamModalOpen, isNewModalOpen, selectedTicket]);

  const agregarToast = useCallback((toast: ToastNotification) => {
    setToasts((prev) => [toast, ...prev.slice(0, 4)]);

    // Disparar alerta sonora y notificación nativa del navegador si la pestaña está en 2do plano
    sendNativePushNotification({
      title: toast.titulo,
      body: toast.mensaje,
      ticketId: toast.ticketId,
      tag: `woof-notif-${toast.ticketId || toast.id}`,
    });
  }, []);

  const removerToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Carga de tickets desde Supabase sincronizando la bandeja de lectura del EQUIPO activo
  const cargarTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ticketsService.fetchTickets();
      const ticketsCargados = Array.isArray(data) ? data : [];
      setTickets(ticketsCargados);

      const activeBucket = getTeamBucket(uiRoleRef.current);
      const idsNoLeidosGuardados = getUnreadTicketIdsForTeam(activeBucket);
      const readIds = getReadTicketIdsForTeam(activeBucket);
      const nuevosIds: string[] = [...idsNoLeidosGuardados];

      // Solo si el ticket NUNCA fue leído por ESTE EQUIPO antes, se marca como "Nuevo" para este equipo
      ticketsCargados.forEach((t) => {
        if (t.eliminado || (t.estado || '').toLowerCase() === 'eliminado') return;
        const idStr = String(t.id);
        if (!readIds.includes(idStr) && !nuevosIds.includes(idStr)) {
          nuevosIds.push(idStr);
        }
      });

      try {
        localStorage.setItem(getTeamUnreadKey(activeBucket), JSON.stringify(nuevosIds));
      } catch {}

      setUnreadTicketIds(nuevosIds);
    } catch (err) {
      console.error('Error al invocar ticketsService.fetchTickets():', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [getReadTicketIdsForTeam, getUnreadTicketIdsForTeam]);

  // Cache de claves de notificaciones recientes para evitar toasts duplicados en la misma acción
  const notificacionesRecientesRef = useRef<Map<string, number>>(new Map());

  // Registro de acciones originadas localmente en ESTA ventana para no auto-notificarnos
  const sentFromThisTabRef = useRef<{
    commentIds: Set<string>;
    recentTexts: { text: string; time: number }[];
  }>({
    commentIds: new Set(),
    recentTexts: [],
  });

  useEffect(() => {
    const handleLocalAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string | number; text?: string }>;
      if (customEvent.detail?.id) {
        sentFromThisTabRef.current.commentIds.add(String(customEvent.detail.id));
      }
      if (customEvent.detail?.text) {
        sentFromThisTabRef.current.recentTexts.push({
          text: customEvent.detail.text,
          time: Date.now(),
        });
        if (sentFromThisTabRef.current.recentTexts.length > 25) {
          sentFromThisTabRef.current.recentTexts.shift();
        }
      }
    };

    window.addEventListener('woof_local_action', handleLocalAction);
    return () => window.removeEventListener('woof_local_action', handleLocalAction);
  }, []);

  const yaFueNotificadoRecientemente = (clave: string): boolean => {
    const ahora = Date.now();
    const ultimo = notificacionesRecientesRef.current.get(clave);
    if (ultimo && ahora - ultimo < 3500) {
      return true;
    }
    notificacionesRecientesRef.current.set(clave, ahora);
    return false;
  };

  // Cargar tickets y suscripciones en tiempo real cuando el usuario está autenticado
  useEffect(() => {
    if (!session || !userProfile) return;

    cargarTickets();

    const miNombre = (userProfile.nombre || '').trim().toLowerCase();

    // ⚡ 1. Canal en tiempo real para TICKETS (nuevos pedidos, cambios de estado, asignaciones, entregas)
    const ticketsChannel = supabase
      .channel('realtime_tickets_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nuevo = formatTicket(payload.new, ticketsRef.current.length + 1);

            setTickets((prev) => {
              if (prev.some((t) => String(t.id) === String(nuevo.id))) return prev;
              return [nuevo, ...prev];
            });

            const numStr = nuevo.ticket_number || (nuevo.numero_ticket ? `#${String(nuevo.numero_ticket).padStart(3, '0')}` : '#001');

            // Marcar como novedad en las bandejas independientes de cada equipo
            marcarTicketNoLeidoParaEquipos(nuevo.id, ['CONTENIDOS', 'GRAFICA', 'SUPER_ADMIN']);

            // Alerta si el rol activo es Gráfica o Superadmin (o no es quien lo creó)
            const creadorTicket = (nuevo.creado_por || '').toLowerCase();
            const esCreadorMismo = miNombre && creadorTicket.includes(miNombre);

            if (!esCreadorMismo && (uiRoleRef.current === 'GRAFICA' || uiRoleRef.current === 'SUPER_ADMIN')) {
              agregarToast({
                id: `ticket-${nuevo.id}-${Date.now()}`,
                tipo: 'ticket',
                titulo: `✨ Nuevo ticket recibido ${numStr}`,
                mensaje: `${nuevo.titulo} — Solicitado por ${nuevo.area_solicitante || 'Contenidos'}`,
                ticketId: nuevo.id,
                ticketNumero: numStr,
                autorRol: 'CONTENIDOS',
                creadoEn: Date.now()
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const actualizado = formatTicket(payload.new);
            const ticketAnterior = ticketsRef.current.find((t) => String(t.id) === String(actualizado.id));

            setTickets((prev) =>
              prev.map((t) => (String(t.id) === String(actualizado.id) ? { ...t, ...actualizado } : t))
            );
            setSelectedTicket((prev) =>
              prev && String(prev.id) === String(actualizado.id) ? { ...prev, ...actualizado } : prev
            );

            const estNuevo = (actualizado.estado || '').toLowerCase();
            const estViejo = (ticketAnterior?.estado || '').toLowerCase();
            const numStr = actualizado.ticket_number || (actualizado.numero_ticket ? `#${String(actualizado.numero_ticket).padStart(3, '0')}` : '#001');
            const activeRole = uiRoleRef.current;

            const tieneNuevoLink = Boolean(
              actualizado.link_entrega &&
              (!ticketAnterior?.link_entrega || ticketAnterior?.link_entrega !== actualizado.link_entrega)
            );
            const cambioAsignado = Boolean(
              actualizado.asignado_a &&
              (!ticketAnterior?.asignado_a || ticketAnterior?.asignado_a !== actualizado.asignado_a)
            );

            // A) Si pasó a 'En Proceso' (Diseñador tomó el pedido o fue asignado) -> Novedad para CONTENIDOS
            if (estNuevo.includes('proceso') && !estViejo.includes('proceso')) {
              marcarTicketNoLeidoParaEquipos(actualizado.id, ['CONTENIDOS', 'SUPER_ADMIN']);
              if (activeRole === 'CONTENIDOS' || activeRole === 'SUPER_ADMIN') {
                if (!yaFueNotificadoRecientemente(`proceso-${actualizado.id}`)) {
                  agregarToast({
                    id: `proceso-${actualizado.id}-${Date.now()}`,
                    tipo: 'ticket',
                    titulo: `🚀 Pedido en proceso ${numStr}`,
                    mensaje: `${actualizado.titulo} — ${actualizado.asignado_a ? `${actualizado.asignado_a} comenzó a trabajar en los diseños.` : 'El equipo de Gráfica comenzó a trabajar.'}`,
                    ticketId: actualizado.id,
                    ticketNumero: numStr,
                    autorRol: 'GRAFICA',
                    creadoEn: Date.now()
                  });
                }
              }
            }

            // B) Si pasó a 'En Revisión' o se subió nuevo link de Drive -> Novedad para CONTENIDOS
            if ((estNuevo.includes('revis') && !estViejo.includes('revis')) || tieneNuevoLink) {
              marcarTicketNoLeidoParaEquipos(actualizado.id, ['CONTENIDOS', 'SUPER_ADMIN']);
              if (activeRole === 'CONTENIDOS' || activeRole === 'SUPER_ADMIN') {
                if (!yaFueNotificadoRecientemente(`entrega-${actualizado.id}`)) {
                  agregarToast({
                    id: `entrega-${actualizado.id}-${Date.now()}`,
                    tipo: 'entrega',
                    titulo: `🎨 Diseños listos para revisión en ${numStr}`,
                    mensaje: `${actualizado.titulo} — Gráfica subió las piezas a Google Drive.`,
                    ticketId: actualizado.id,
                    ticketNumero: numStr,
                    autorRol: 'GRAFICA',
                    creadoEn: Date.now()
                  });
                }
              }
            }

            // C) Si pasó a 'Correcciones' (Ajustes solicitados por Contenidos) -> Novedad para GRÁFICA
            if ((estNuevo.includes('correc') || estNuevo.includes('ajust')) && !estViejo.includes('correc')) {
              marcarTicketNoLeidoParaEquipos(actualizado.id, ['GRAFICA', 'SUPER_ADMIN']);
              if (activeRole === 'GRAFICA' || activeRole === 'SUPER_ADMIN') {
                const eraResuelto = estViejo.includes('resuelto') || estViejo.includes('aprob');
                if (!yaFueNotificadoRecientemente(`ajustes-${actualizado.id}`)) {
                  agregarToast({
                    id: `ajustes-${actualizado.id}-${Date.now()}`,
                    tipo: 'ticket',
                    titulo: `🟠 Ajustes solicitados en ${numStr}${eraResuelto ? ' (Reabierto)' : ''}`,
                    mensaje: `${actualizado.titulo} — Contenidos solicitó modificaciones en el diseño.`,
                    ticketId: actualizado.id,
                    ticketNumero: numStr,
                    autorRol: 'CONTENIDOS',
                    creadoEn: Date.now()
                  });
                }
              }
            }

            // D) Si pasó a 'Resuelto' (Aprobado por Contenidos) -> Novedad para GRÁFICA
            if ((estNuevo.includes('resuelto') || estNuevo.includes('aprob')) && !estViejo.includes('resuelto')) {
              marcarTicketNoLeidoParaEquipos(actualizado.id, ['GRAFICA', 'SUPER_ADMIN']);
              if (activeRole === 'GRAFICA' || activeRole === 'SUPER_ADMIN') {
                if (!yaFueNotificadoRecientemente(`resuelto-${actualizado.id}`)) {
                  agregarToast({
                    id: `resuelto-${actualizado.id}-${Date.now()}`,
                    tipo: 'ticket',
                    titulo: `🎉 Ticket ${numStr} Resuelto`,
                    mensaje: `${actualizado.titulo} — Diseños finales aprobados.`,
                    ticketId: actualizado.id,
                    ticketNumero: numStr,
                    autorRol: 'CONTENIDOS',
                    creadoEn: Date.now()
                  });
                }
              }
            }

            // E) Si se cambió el diseñador asignado -> Novedad para CONTENIDOS
            if (cambioAsignado && !estNuevo.includes('proceso')) {
              marcarTicketNoLeidoParaEquipos(actualizado.id, ['CONTENIDOS', 'SUPER_ADMIN']);
              if (activeRole === 'CONTENIDOS' || activeRole === 'SUPER_ADMIN') {
                if (!yaFueNotificadoRecientemente(`asig-${actualizado.id}-${actualizado.asignado_a}`)) {
                  agregarToast({
                    id: `asig-${actualizado.id}-${Date.now()}`,
                    tipo: 'ticket',
                    titulo: `👤 Diseñador asignado en ${numStr}`,
                    mensaje: `${actualizado.titulo} — Asignado a ${actualizado.asignado_a}.`,
                    ticketId: actualizado.id,
                    ticketNumero: numStr,
                    autorRol: 'GRAFICA',
                    creadoEn: Date.now()
                  });
                }
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const eliminadoId = payload.old?.id;
            if (eliminadoId) {
              setTickets((prev) => prev.filter((t) => String(t.id) !== String(eliminadoId)));
              setSelectedTicket((prev) => (prev && String(prev.id) === String(eliminadoId) ? null : prev));
              marcarTicketComoLeido(eliminadoId);
            }
          }
        }
      )
      .subscribe();

    // ⚡ 2. Canal en tiempo real para COMENTARIOS y CONVERSACIÓN (Incluso en tickets Resueltos)
    const comentariosChannel = supabase
      .channel('realtime_comentarios_global_toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comentarios' },
        (payload) => {
          if (!payload?.new) return;
          const nuevoComentario = formatComment(payload.new);
          const commentTicketId = nuevoComentario.ticket_id;
          if (!commentTicketId) return;

          const commId = String(nuevoComentario.id || '');
          const commText = (nuevoComentario.mensaje || nuevoComentario.contenido || '').trim();
          const commentRole = nuevoComentario.autor_rol;

          // Cuando comenta Gráfica -> Es novedad para Contenidos (y SuperAdmin)
          // Cuando comenta Contenidos -> Es novedad para Gráfica (y SuperAdmin)
          if (commentRole === 'GRAFICA') {
            marcarTicketNoLeidoParaEquipos(commentTicketId, ['CONTENIDOS', 'SUPER_ADMIN']);
          } else if (commentRole === 'CONTENIDOS') {
            marcarTicketNoLeidoParaEquipos(commentTicketId, ['GRAFICA', 'SUPER_ADMIN']);
          } else {
            marcarTicketNoLeidoParaEquipos(commentTicketId, ['CONTENIDOS', 'GRAFICA']);
          }

          // Verificar si este comentario se originó en ESTA MISMA ventana
          const esDeEstaVentana =
            sentFromThisTabRef.current.commentIds.has(commId) ||
            sentFromThisTabRef.current.recentTexts.some(
              (item) => item.text === commText && Date.now() - item.time < 12000
            );

          // Si se envió desde ESTA misma ventana, no mostramos el toast a nosotros mismos
          if (esDeEstaVentana) {
            return;
          }

          const ticketAsociado = ticketsRef.current.find(
            (t) => String(t.id) === String(commentTicketId)
          );
          const numStr = ticketAsociado?.ticket_number || 
            (ticketAsociado?.numero_ticket ? `#${String(ticketAsociado.numero_ticket).padStart(3, '0')}` : '');

          const textoPlano = (nuevoComentario.mensaje || nuevoComentario.contenido || '')
            .replace(/<[^>]*>/g, '')
            .replace(/<!--rol:[^>]+-->/g, '')
            .replace(/🎨|\[(GRÁFICA|GRAFICA|CONTENIDOS|SUPER_ADMIN|ADMIN)\]/g, '')
            .trim();

          const esEntrega = Boolean(
            nuevoComentario.link_adjunto ||
            (nuevoComentario.mensaje && nuevoComentario.mensaje.includes('Google Drive'))
          );

          const esTicketResuelto = Boolean(
            ticketAsociado && (ticketAsociado.estado || '').toLowerCase().includes('resuelto')
          );
          const sufijoResuelto = esTicketResuelto ? ' (Resuelto)' : '';

          const dedupKey = `comm-${nuevoComentario.id}`;
          if (!yaFueNotificadoRecientemente(dedupKey)) {
            agregarToast({
              id: `comment-${nuevoComentario.id}-${Date.now()}`,
              tipo: esEntrega ? 'entrega' : 'comentario',
              titulo: esEntrega
                ? `🎨 Diseños listos en ${numStr || 'ticket'}${sufijoResuelto}`
                : `💬 Nuevo mensaje en ${numStr || 'ticket'}${sufijoResuelto}`,
              mensaje: textoPlano 
                ? `${nuevoComentario.autor_nombre || 'Compañero'}: ${textoPlano}`
                : (esEntrega ? 'Se han subido las piezas finales a Google Drive.' : 'Tienes una nueva respuesta en el ticket.'),
              ticketId: commentTicketId,
              ticketNumero: numStr,
              autorRol: commentRole,
              creadoEn: Date.now()
            });
          }

          // Subir al tope de la lista actualizando la fecha de última actividad (como casilla de mails)
          setTickets((prev) =>
            prev.map((t) =>
              String(t.id) === String(commentTicketId)
                ? { ...t, actualizado_en: nuevoComentario.creado_en || new Date().toISOString() }
                : t
            )
          );
        }
      )
      .subscribe();

    // ⚡ 3. Canal en tiempo real para HISTORIAL DE MOVIMIENTOS Y CAMBIOS
    const movimientosChannel = supabase
      .channel('realtime_movimientos_global_toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_movimientos' },
        (payload) => {
          if (!payload?.new) return;
          const mov = payload.new as any;
          const ticketId = mov.ticket_id;
          if (!ticketId) return;

          const movId = String(mov.id || '');
          const movAction = (mov.accion || '').trim();

          // Verificar si esta acción se originó en esta misma ventana
          const esDeEstaVentana =
            sentFromThisTabRef.current.commentIds.has(movId) ||
            sentFromThisTabRef.current.recentTexts.some(
              (item) => item.text === movAction && Date.now() - item.time < 12000
            );

          if (esDeEstaVentana) {
            return;
          }

          const ticketAsociado = ticketsRef.current.find((t) => String(t.id) === String(ticketId));
          const numStr = ticketAsociado?.ticket_number || (ticketAsociado?.numero_ticket ? `#${String(ticketAsociado.numero_ticket).padStart(3, '0')}` : '#001');

          const dedupKey = `mov-${ticketId}-${mov.accion}`;
          if (!yaFueNotificadoRecientemente(dedupKey)) {
            agregarToast({
              id: `mov-${mov.id || Date.now()}-${Date.now()}`,
              tipo: 'ticket',
              titulo: `📋 Novedad en ${numStr}`,
              mensaje: `${mov.accion} (Por: ${mov.usuario_nombre || 'Equipo'})`,
              ticketId: ticketId,
              ticketNumero: numStr,
              creadoEn: Date.now()
            });
          }

          marcarTicketNoLeidoParaEquipos(ticketId, ['CONTENIDOS', 'GRAFICA', 'SUPER_ADMIN']);

          // Subir al tope de la lista actualizando la fecha de última actividad
          setTickets((prev) =>
            prev.map((t) =>
              String(t.id) === String(ticketId)
                ? { ...t, actualizado_en: mov.creado_en || new Date().toISOString() }
                : t
            )
          );
        }
      )
      .subscribe();

    // 🛡️ Fallback de resiliencia: Si el WebSocket se cae o el usuario regresa a la pestaña, sincronizar datos frescos
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarTickets();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // Sondeo de respaldo cada 60 segundos por si hay firewalls corporativos
    const pollingInterval = setInterval(() => {
      cargarTickets();
    }, 60000);

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(comentariosChannel);
      supabase.removeChannel(movimientosChannel);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(pollingInterval);
    };
  }, [session, userProfile, cargarTickets, agregarToast, marcarTicketComoLeido, marcarTicketNoLeidoParaEquipos]);

  // 🛡️ Lógica de visualización de tickets para el tablero colaborativo interno
  const ticketsFiltradosPorRBAC = useMemo(() => {
    if (!userProfile) return [];
    // En el gestor colaborativo entre Contenidos y Gráfica, todo el equipo visualiza los tickets
    return tickets;
  }, [tickets, userProfile]);

  // Cantidad total de tickets con novedades activas para el equipo del rol activo
  const totalNovedades = useMemo(() => {
    return ticketsFiltradosPorRBAC.filter((t) => {
      if (t.eliminado || (t.estado || '').toLowerCase() === 'eliminado') return false;
      return unreadTicketIds.some((id) => String(id) === String(t.id));
    }).length;
  }, [ticketsFiltradosPorRBAC, unreadTicketIds]);

  // Actualizar el título de la pestaña con el contador de novedades en segundo plano
  useEffect(() => {
    if (totalNovedades > 0) {
      document.title = `(${totalNovedades}) Nuevos • Woof Woof`;
    } else {
      document.title = 'Woof Woof — Gestión de Tickets';
    }
  }, [totalNovedades]);

  // Manejador de cierre de sesión
  const handleCerrarSesion = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUserProfile(null);
      setTickets([]);
      setSelectedTicket(null);
      setUnreadTicketIds([]);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // Manejador cuando se crea un nuevo ticket localmente
  const handleTicketCreado = (nuevo: Ticket) => {
    if (!nuevo) return;
    setTickets((prev) => {
      if (prev.some((t) => String(t.id) === String(nuevo.id))) return prev;
      return [nuevo, ...prev];
    });
    // Marcar como novedad en las bandejas independientes de ambos equipos
    marcarTicketNoLeidoParaEquipos(nuevo.id, ['CONTENIDOS', 'GRAFICA', 'SUPER_ADMIN']);
  };

  // Manejador cuando se actualiza un ticket localmente (título, estado, entrega)
  const handleTicketActualizado = (actualizado: Ticket) => {
    if (!actualizado) return;
    const conFecha = {
      ...actualizado,
      actualizado_en: actualizado.actualizado_en || new Date().toISOString(),
      updated_at: actualizado.updated_at || new Date().toISOString()
    };
    setTickets((prev) =>
      prev.map((t) => (String(t.id) === String(conFecha.id) ? conFecha : t))
    );
    setSelectedTicket((prev) => (prev && String(prev.id) === String(conFecha.id) ? conFecha : prev));

    // Si Gráfica actualiza un ticket (ej: sube entrega o cambia estado), encender "Nuevo" para Contenidos
    // Si Contenidos actualiza un ticket (ej: pide correcciones o aprueba), encender "Nuevo" para Gráfica
    if (uiRole === 'GRAFICA') {
      marcarTicketNoLeidoParaEquipos(conFecha.id, ['CONTENIDOS', 'SUPER_ADMIN']);
    } else if (uiRole === 'CONTENIDOS') {
      marcarTicketNoLeidoParaEquipos(conFecha.id, ['GRAFICA', 'SUPER_ADMIN']);
    } else {
      marcarTicketNoLeidoParaEquipos(conFecha.id, ['CONTENIDOS', 'GRAFICA']);
    }
  };

  // Manejador cuando se elimina un ticket (Soft Delete)
  const handleTicketEliminado = (ticketId: string | number, motivo: string) => {
    const fecha = new Date().toISOString();
    const motivoFinal = motivo || 'Error en la carga de datos';
    const idStr = String(ticketId);

    setTickets((prev) =>
      prev.map((t) => 
        String(t.id) === idStr 
          ? { 
              ...t, 
              eliminado: true, 
              estado: 'eliminado', 
              motivo_eliminacion: motivoFinal,
              eliminado_en: fecha 
            } 
          : t
      )
    );
    if (selectedTicket && String(selectedTicket.id) === idStr) {
      setSelectedTicket(null);
    }
    marcarTicketComoLeido(ticketId);

    agregarToast({
      id: `delete-${ticketId}-${Date.now()}`,
      tipo: 'ticket',
      titulo: '🗑️ Ticket movido a Eliminados',
      mensaje: `El ticket se archivó en el Registro de Eliminados. Motivo: "${motivoFinal}".`,
      creadoEn: Date.now()
    });
  };

  // Manejador cuando se restaura un ticket eliminado
  const handleTicketRestaurado = async (ticketId: string | number) => {
    try {
      const usuarioNombre = userProfile?.nombre || (uiRole === 'SUPER_ADMIN' ? 'Super Administrador' : 'Equipo de Contenidos');
      await ticketsService.restoreTicket(ticketId, usuarioNombre);
      const idStr = String(ticketId);

      setTickets((prev) =>
        prev.map((t) => 
          String(t.id) === idStr 
            ? { 
                ...t, 
                eliminado: false, 
                estado: 'pendiente', 
                motivo_eliminacion: undefined, 
                eliminado_en: undefined 
              } 
            : t
        )
      );

      marcarTicketNoLeidoParaEquipos(ticketId, ['CONTENIDOS', 'GRAFICA', 'SUPER_ADMIN']);

      agregarToast({
        id: `restore-${ticketId}-${Date.now()}`,
        tipo: 'ticket',
        titulo: '✓ Ticket restaurado con éxito',
        mensaje: 'El pedido volvió a la lista de solicitudes activas con estado Pendiente.',
        ticketId: ticketId,
        creadoEn: Date.now()
      });
    } catch (err) {
      console.error('Error restaurando ticket:', err);
    }
  };

  // Manejador para eliminación definitiva (Hard delete) solo para Super Admin
  const handleHardDeleteTicket = async (ticketId: string | number) => {
    try {
      const idStr = String(ticketId);
      await ticketsService.hardDeleteTicket(ticketId);
      setTickets((prev) => prev.filter((t) => String(t.id) !== idStr));
      if (selectedTicket && String(selectedTicket.id) === idStr) setSelectedTicket(null);
      marcarTicketComoLeido(ticketId);

      agregarToast({
        id: `hard-delete-${ticketId}-${Date.now()}`,
        tipo: 'ticket',
        titulo: 'Ticket purgado definitivamente',
        mensaje: 'El registro y sus comentarios fueron eliminados de la base de datos.',
        creadoEn: Date.now()
      });
    } catch (err) {
      console.error('Error purgando ticket:', err);
    }
  };

  // Manejador para vaciar todo el registro de eliminados (Super Admin)
  const handleEmptyTrash = async () => {
    try {
      await ticketsService.emptyEliminatedTickets();
      setTickets((prev) => prev.filter((t) => !t.eliminado && (t.estado || '').toLowerCase() !== 'eliminado'));
      if (selectedTicket && (selectedTicket.eliminado || (selectedTicket.estado || '').toLowerCase() === 'eliminado')) {
        setSelectedTicket(null);
      }
      agregarToast({
        id: `empty-trash-${Date.now()}`,
        tipo: 'ticket',
        titulo: '🗑️ Registro de eliminados vaciado',
        mensaje: 'Todos los tickets archivados fueron purgados definitivamente.',
        creadoEn: Date.now()
      });
    } catch (err) {
      console.error('Error vaciando registro:', err);
    }
  };

  // Manejador para actualizar estado rápido (usado en Drag & Drop de Kanban o menú de tarjeta)
  const handleUpdateTicketStatus = async (ticketId: string | number, newStatus: string) => {
    const usuarioNombre = userProfile?.nombre || (uiRole === 'SUPER_ADMIN' ? 'Super Administrador' : uiRole === 'GRAFICA' ? 'Diseñador Gráfica' : 'Equipo de Contenidos');
    const ahora = new Date().toISOString();

    // Actualización optimista inmediata en estado local
    setTickets((prev) =>
      prev.map((t) =>
        String(t.id) === String(ticketId)
          ? { ...t, estado: newStatus, actualizado_en: ahora, updated_at: ahora }
          : t
      )
    );
    setSelectedTicket((prev) =>
      prev && String(prev.id) === String(ticketId)
        ? { ...prev, estado: newStatus, actualizado_en: ahora, updated_at: ahora }
        : prev
    );

    // Notificar como "Nuevo" al otro equipo
    if (uiRole === 'GRAFICA') {
      marcarTicketNoLeidoParaEquipos(ticketId, ['CONTENIDOS', 'SUPER_ADMIN']);
    } else if (uiRole === 'CONTENIDOS') {
      marcarTicketNoLeidoParaEquipos(ticketId, ['GRAFICA', 'SUPER_ADMIN']);
    } else {
      marcarTicketNoLeidoParaEquipos(ticketId, ['CONTENIDOS', 'GRAFICA']);
    }

    try {
      await ticketsService.updateTicketStatus(ticketId, newStatus, usuarioNombre);
    } catch (err) {
      console.error('Error al actualizar estado en Supabase:', err);
    }
  };

  // Manejador para tomar pedido directamente desde la tarjeta del Kanban
  const handleTakeTicket = async (ticketId: string | number) => {
    const nombreDisenador = userProfile?.nombre || (uiRole === 'SUPER_ADMIN' ? 'Super Administrador' : 'Diseñador Gráfica');
    const ahora = new Date().toISOString();

    // Actualización optimista inmediata en estado local
    setTickets((prev) =>
      prev.map((t) =>
        String(t.id) === String(ticketId)
          ? { 
              ...t, 
              estado: 'en_proceso', 
              asignado_a: nombreDisenador, 
              asignado_nombre: nombreDisenador,
              actualizado_en: ahora, 
              updated_at: ahora 
            }
          : t
      )
    );
    setSelectedTicket((prev) =>
      prev && String(prev.id) === String(ticketId)
        ? { 
            ...prev, 
            estado: 'en_proceso', 
            asignado_a: nombreDisenador, 
            asignado_nombre: nombreDisenador,
            actualizado_en: ahora, 
            updated_at: ahora 
          }
        : prev
    );

    // Al tomarlo un diseñador, es novedad para Contenidos y queda leído para Gráfica
    marcarTicketNoLeidoParaEquipos(ticketId, ['CONTENIDOS', 'SUPER_ADMIN']);
    marcarTicketComoLeido(ticketId);

    try {
      await ticketsService.assignTicket(ticketId, nombreDisenador, nombreDisenador, true);
      agregarToast({
        id: `take-${ticketId}-${Date.now()}`,
        tipo: 'ticket',
        titulo: '⚡ Pedido tomado con éxito',
        mensaje: `Has tomado el pedido. Ahora está "En Proceso" y asignado a ti.`,
        ticketId: ticketId,
        creadoEn: Date.now()
      });
    } catch (err) {
      console.error('Error al tomar ticket en Supabase:', err);
    }
  };

  // Abrir ticket directamente al hacer clic en el toast
  const handleOpenTicketFromToast = useCallback((ticketId: string | number) => {
    const encontrado = tickets.find((t) => String(t.id) === String(ticketId));
    if (encontrado) {
      setSelectedTicket(encontrado);
      marcarTicketComoLeido(encontrado.id);
    }
  }, [tickets, marcarTicketComoLeido]);

  // 1. Loader central mientras se valida la sesión o el perfil
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#151515] flex flex-col items-center justify-center space-y-4 transition-colors">
        <div className="p-3 rounded-2xl bg-amber-400/10 dark:bg-amber-400/20 border border-amber-400/30 dark:border-amber-400/40 shadow-sm animate-pulse">
          <WoofLogo size={52} animated />
        </div>
        <div className="flex items-center space-x-2 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>Iniciando Woof Woof Workspace...</span>
        </div>
      </div>
    );
  }

  // 2. Si no hay sesión, se muestra la pantalla de inicio de sesión
  if (!session || !userProfile) {
    return <Login onSuccess={() => {}} />;
  }

  // 3. Si hay sesión activa, se renderiza el Workspace con filtrado RBAC
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#151515] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans selection:bg-amber-200 dark:selection:bg-amber-900/40 transition-colors duration-200">
      
      {/* Barra Superior con datos de perfil, badge de rol y botón Cerrar Sesión */}
      <Topbar
        currentRole={uiRole}
        onRoleChange={() => {}}
        userProfile={userProfile}
        onSignOut={handleCerrarSesion}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
        onOpenColorPicker={() => setIsColorPickerOpen(true)}
      />

      {/* Contenido Principal estilo Notion */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Cabecera del Workspace con contexto de usuario */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
          <div>
            <div className="flex items-center space-x-2.5 text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
              <h1>Espacio de trabajo</h1>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
              Bienvenido, <strong>{userProfile.nombre}</strong>. 
              {userProfile.rol === 'superadmin' && ' Tienes acceso y visibilidad total sobre todos los tickets del sistema.'}
              {userProfile.rol === 'operador' && ` Visualizando tickets correspondientes al sector: ${userProfile.area}.`}
              {userProfile.rol === 'solicitante' && ' Visualizando únicamente los tickets creados desde tu cuenta.'}
            </p>
          </div>

          {/* Tarjetas de estadísticas estilo Notion */}
          <div className="flex items-center space-x-2 text-xs flex-wrap">
            {totalNovedades > 0 && (
              <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-2xs flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-rose-700 dark:text-rose-300 font-medium">Novedades:</span>
                <strong className="text-rose-900 dark:text-rose-100 font-bold">
                  {totalNovedades}
                </strong>
              </div>
            )}
            <div className="px-3 py-2 bg-white dark:bg-[#202020] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-neutral-500 dark:text-neutral-400">Pendientes:</span>
              <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
                {ticketsFiltradosPorRBAC.filter((t) => !t.eliminado && (t.estado || '').toLowerCase().includes('pendiente')).length}
              </strong>
            </div>
            <div className="px-3 py-2 bg-white dark:bg-[#202020] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-neutral-500 dark:text-neutral-400">En Proceso:</span>
              <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
                {ticketsFiltradosPorRBAC.filter((t) => !t.eliminado && (t.estado || '').toLowerCase().includes('proceso')).length}
              </strong>
            </div>
            <div className="px-3 py-2 bg-white dark:bg-[#202020] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-neutral-500 dark:text-neutral-400">Listos:</span>
              <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
                {ticketsFiltradosPorRBAC.filter((t) => !t.eliminado && (t.estado || '').toLowerCase().includes('resuelto')).length}
              </strong>
            </div>
            {ticketsFiltradosPorRBAC.some((t) => t.eliminado) && (
              <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex items-center space-x-2 text-neutral-600 dark:text-neutral-400">
                <span>🗑️</span>
                <span>Eliminados:</span>
                <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
                  {ticketsFiltradosPorRBAC.filter((t) => t.eliminado).length}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Tabla estilo Notion filtrada por RBAC */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-7 h-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-neutral-500">Sincronizando tickets con Supabase...</span>
          </div>
        ) : (
          <NotionTable
            {...({
              tickets: ticketsFiltradosPorRBAC,
              currentRole: uiRole,
              userProfile: userProfile,
              unreadTicketIds: unreadTicketIds,
              onOpenNewTicketModal: () => setIsNewModalOpen(true),
              onSelectTicket: (ticket: Ticket) => {
                setSelectedTicket(ticket);
                marcarTicketComoLeido(ticket.id);
              },
              onDeleteTicket: handleTicketEliminado,
              onRestoreTicket: handleTicketRestaurado,
              onHardDeleteTicket: handleHardDeleteTicket,
              onEmptyTrash: handleEmptyTrash,
              onUpdateTicketStatus: handleUpdateTicketStatus,
              onTakeTicket: handleTakeTicket,
            } as any)}
          />
        )}

      </main>

      {/* Modal / Formulario "+ NUEVA ENTRADA" */}
      <NewTicketModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onTicketCreated={handleTicketCreado}
        currentRole={uiRole}
        userProfile={userProfile}
        existingTickets={tickets}
      />

      {/* Panel Lateral / Drawer (Detalle del Ticket & Comentarios Gmail) */}
      <TicketDrawer
        {...({
          ticket: selectedTicket,
          isOpen: !!selectedTicket,
          onClose: () => setSelectedTicket(null),
          currentRole: uiRole,
          userProfile: userProfile,
          onTicketUpdated: handleTicketActualizado,
          onTicketDeleted: handleTicketEliminado,
          onTicketRestored: handleTicketRestaurado,
          onHardDeleteTicket: handleHardDeleteTicket,
        } as any)}
      />

      {/* Sistema de Notificaciones Visuales Flotantes (Toasts) */}
      <ToastContainer
        toasts={toasts}
        onDismiss={removerToast}
        onOpenTicket={handleOpenTicketFromToast}
      />

      {/* Modal de Gestión de Equipo & Creación de Usuarios (Super Admin) */}
      <TeamManagementModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        currentUserProfile={userProfile}
        onUserCreated={(newProfile) => {
          agregarToast({
            id: `usr-${newProfile.id}-${Date.now()}`,
            tipo: 'ticket',
            titulo: '👤 Usuario creado con éxito',
            mensaje: `${newProfile.nombre} (${newProfile.area}) habilitado en Woof Woof.`,
            creadoEn: Date.now()
          });
        }}
        onUserUpdated={(updatedProfile) => {
          if (userProfile && updatedProfile.id === userProfile.id) {
            setUserProfile(updatedProfile);
          }
          agregarToast({
            id: `usr-upd-${updatedProfile.id}-${Date.now()}`,
            tipo: 'ticket',
            titulo: '👤 Usuario actualizado',
            mensaje: `Los datos de ${updatedProfile.nombre} fueron actualizados.`,
            creadoEn: Date.now()
          });
        }}
        onUserDeleted={(deletedUserId) => {
          agregarToast({
            id: `usr-del-${deletedUserId}-${Date.now()}`,
            tipo: 'ticket',
            titulo: '👤 Usuario eliminado',
            mensaje: 'El usuario fue eliminado del equipo y su acceso revocado.',
            creadoEn: Date.now()
          });
        }}
      />

      {/* Modal de Personalización de Color de Etiqueta */}
      {userProfile && (
        <UserColorPickerModal
          isOpen={isColorPickerOpen}
          onClose={() => setIsColorPickerOpen(false)}
          userName={userProfile.nombre}
          userEmail={userProfile.email}
          userId={userProfile.id}
          currentColor={userProfile.color}
          onColorChanged={(newColor) => {
            setUserProfile((prev) => (prev ? { ...prev, color: newColor } : prev));
            agregarToast({
              id: `col-${Date.now()}`,
              tipo: 'ticket',
              titulo: '🎨 Etiqueta personalizada',
              mensaje: 'Has actualizado el color de tu etiqueta con éxito.',
              creadoEn: Date.now()
            });
          }}
        />
      )}

    </div>
  );
}
