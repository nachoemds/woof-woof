// src/components/TicketDrawer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Ticket, Comentario, HistorialMovimiento, UserRole, Profile } from '../types';
import { ticketsService, supabase, formatComment } from '../lib/supabase';
import {
  htmlHasImages,
  countImagesInHtml,
  purgeImagesFromSingleTicket,
  stripImagesFromHtmlWithNotice,
} from '../lib/imageStorage';
import { RichTextEditor } from './RichTextEditor';
import { UserTagBadge } from './UserTagBadge';
import { 
  X, 
  ExternalLink, 
  Send, 
  Paperclip, 
  Clock, 
  FolderCheck,
  FolderOpen,
  MessageSquare,
  AlertTriangle,
  Pencil,
  Check,
  Trash2,
  RotateCcw,
  Copy,
  CheckCircle2,
  Sparkles,
  UploadCloud,
  User,
  UserCheck,
  AlertCircle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

interface TicketDrawerProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  userProfile?: Profile | null;
  onTicketUpdated: (updatedTicket: Ticket) => void;
  onTicketDeleted?: (ticketId: string | number, motivo: string) => void;
  onTicketRestored?: (ticketId: string | number) => void;
  onHardDeleteTicket?: (ticketId: string | number) => void;
}

export const TicketDrawer: React.FC<TicketDrawerProps> = ({
  ticket,
  isOpen,
  onClose,
  currentRole,
  userProfile,
  onTicketUpdated,
  onTicketDeleted,
  onTicketRestored,
  onHardDeleteTicket
}) => {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [movimientos, setMovimientos] = useState<HistorialMovimiento[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [nuevoLinkAdjunto, setNuevoLinkAdjunto] = useState('');
  const [nuevoLinkEntrega, setNuevoLinkEntrega] = useState('');
  const [editandoEntrega, setEditandoEntrega] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [errorComentario, setErrorComentario] = useState<string | null>(null);

  // Estados para Edición de Título
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [guardandoTitulo, setGuardandoTitulo] = useState(false);

  // Estados para Modal de Eliminación (Soft Delete)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [motivoEliminar, setMotivoEliminar] = useState('Error en la carga de datos');
  const [eliminandoTicket, setEliminandoTicket] = useState(false);
  const [restaurandoTicket, setRestaurandoTicket] = useState(false);

  // Estados para Eliminación Definitiva / Purgar para siempre (Hard Delete Super Admin)
  const [mostrarModalPurgar, setMostrarModalPurgar] = useState(false);
  const [purgandoTicket, setPurgandoTicket] = useState(false);

  // Estados para Modal de "Solicitar Ajustes" (Nuevo Estado: Correcciones en Naranja)
  const [mostrarModalAjustes, setMostrarModalAjustes] = useState(false);
  const [detalleAjustes, setDetalleAjustes] = useState('');
  const [enviandoAjustes, setEnviandoAjustes] = useState(false);

  // Estados para Asignación de Diseñador
  const [disenadoresDisponibles, setDisenadoresDisponibles] = useState<Profile[]>([]);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  // Estados para visor ampliado de imágenes (Lightbox) y depuración de imágenes (Super Admin)
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [mostrarModalDepurarImgs, setMostrarModalDepurarImgs] = useState(false);
  const [depurandoImgs, setDepurandoImgs] = useState(false);

  // Nombre del usuario activo (usando su nombre real si está autenticado)
  const nombreUsuarioActivo = userProfile?.nombre?.trim() || userProfile?.email?.split('@')[0] || (
    currentRole === 'SUPER_ADMIN'
      ? 'Super Administrador'
      : currentRole === 'CONTENIDOS'
      ? 'Equipo de Contenidos'
      : 'Equipo de Gráfica'
  );

  // ⚡ Feed Único Unificado: Combina comentarios y eventos del sistema cronológicamente (Gmail + Notion)
  const feedUnificado = useMemo(() => {
    type TimelineItem = 
      | { tipo: 'comentario'; id: string | number; data: Comentario; timestamp: number }
      | { tipo: 'movimiento'; id: string | number; data: HistorialMovimiento; timestamp: number };

    const items: TimelineItem[] = [];
    const listaComms = Array.isArray(comentarios) ? comentarios.filter(Boolean) : [];
    const listaMovs = Array.isArray(movimientos) ? movimientos.filter(Boolean) : [];

    // 1. Agregar comentarios (mensajes de usuarios y avisos destacados)
    listaComms.forEach((c) => {
      const fecha = c.creado_en || c.created_at || new Date().toISOString();
      items.push({
        tipo: 'comentario',
        id: `comm-${c.id}`,
        data: c,
        timestamp: new Date(fecha).getTime() || 0
      });
    });

    // 2. Agregar movimientos del sistema, deduplicando los que ya tienen una tarjeta de comentario
    listaMovs.forEach((m, idx) => {
      const accion = m.accion || '';
      
      const yaExisteEnComentario = listaComms.some((c) => {
        const txt = c.mensaje || c.contenido || '';
        if (accion.includes('Se solicitaron ajustes') && txt.includes('Ajustes Solicitados')) return true;
        if (accion.includes('Entrega aprobada') && txt.includes('¡Entrega aprobada!')) return true;
        if (accion.includes('tomó este pedido') && txt.includes('tomó este pedido')) return true;
        return false;
      });

      if (!yaExisteEnComentario) {
        const fecha = m.creado_en || m.created_at || new Date().toISOString();
        items.push({
          tipo: 'movimiento',
          id: `mov-${m.id || idx}`,
          data: m,
          timestamp: new Date(fecha).getTime() || 0
        });
      }
    });

    // Ordenar cronológicamente (los más antiguos primero, los más recientes al final)
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [comentarios, movimientos]);

  useEffect(() => {
    if (!ticket || !isOpen) return;

    setErrorComentario(null);
    cargarDatos(ticket.id);
    const linkActual = ticket.link_entrega || ticket.links_entrega || '';
    setNuevoLinkEntrega(linkActual);
    setEditandoEntrega(false);
    setCopiadoLink(false);
    setNuevoTitulo(ticket.titulo || '');
    setEditandoTitulo(false);
    setMostrarModalEliminar(false);
    setMostrarModalAjustes(false);
    setDetalleAjustes('');

    // Cargar diseñadores de forma estricta (Solo equipo de Diseño / Gráfica)
    const svc = ticketsService as any;
    const fetchDesignersFn = svc.fetchDesigners || svc.getDesigners;
    if (typeof fetchDesignersFn === 'function') {
      fetchDesignersFn.call(ticketsService).then((lista: Profile[]) => {
        const soloDiseno = (lista || []).filter((p: Profile) => {
          const area = (p.area || '').toLowerCase();
          const rol = (p.rol || '').toLowerCase();
          const nombre = (p.nombre || '').toLowerCase();
          return (
            area.includes('gr') || 
            area.includes('dise') || 
            rol.includes('graf') || 
            rol.includes('dise') ||
            nombre.includes('dise') ||
            area === 'todas'
          );
        });
        setDisenadoresDisponibles(soloDiseno.length > 0 ? soloDiseno : (lista || []));
      }).catch(() => {
        setDisenadoresDisponibles([]);
      });
    }

    // ⚡ CANAL EN TIEMPO REAL: Escucha comentarios y actualizaciones del ticket
    const drawerChannel = supabase
      .channel(`ticket_realtime_${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comentarios',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          if (!payload?.new) return;
          const nuevo = formatComment(payload.new);

          setComentarios((prev) => {
            const lista = Array.isArray(prev) ? prev.filter(Boolean) : [];
            if (lista.some((c) => c && (c.id === nuevo.id || String(c.id).startsWith('temp-')))) {
              return lista.map((c) => (c && (c.id === nuevo.id || String(c.id).startsWith('temp-')) ? nuevo : c));
            }
            return [...lista, nuevo];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'historial_movimientos',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          if (!payload?.new) return;
          const nuevoMov = payload.new as HistorialMovimiento;
          setMovimientos((prev) => {
            const lista = Array.isArray(prev) ? prev.filter(Boolean) : [];
            if (lista.some((m) => m && m.id === nuevoMov.id)) return lista;
            return [...lista, nuevoMov];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(drawerChannel);
    };
  }, [ticket?.id, isOpen]);

  const cargarDatos = async (ticketId: string | number) => {
    setLoadingComentarios(true);
    try {
      const svc = ticketsService as any;
      const getCommentsFn = svc.fetchComments || svc.getComments;
      const getMovementsFn = svc.fetchMovements || svc.getMovements;

      const commsPromise = typeof getCommentsFn === 'function' 
        ? getCommentsFn.call(ticketsService, ticketId).catch(() => []) 
        : Promise.resolve([]);
      const movsPromise = typeof getMovementsFn === 'function' 
        ? getMovementsFn.call(ticketsService, ticketId).catch(() => []) 
        : Promise.resolve([]);

      const [comms, movs] = await Promise.all([commsPromise, movsPromise]);
      setComentarios((comms || []).filter(Boolean));
      setMovimientos((movs || []).filter(Boolean));
    } catch (err) {
      console.error('Error al cargar datos del ticket:', err);
      setComentarios([]);
      setMovimientos([]);
    } finally {
      setLoadingComentarios(false);
    }
  };

  if (!isOpen || !ticket) return null;

  const puedeEditarTitulo = currentRole === 'CONTENIDOS' || currentRole === 'SUPER_ADMIN';
  const puedeEliminar = currentRole === 'CONTENIDOS' || currentRole === 'SUPER_ADMIN';
  const puedeGestionarEntrega = currentRole === 'GRAFICA' || currentRole === 'SUPER_ADMIN';
  const puedeAsignar = currentRole === 'GRAFICA' || currentRole === 'SUPER_ADMIN';
  const estaEliminado = Boolean(ticket.eliminado || (ticket.estado || '').toLowerCase() === 'eliminado');
  const linkEntregaFinal = ticket.link_entrega || ticket.links_entrega;
  const asignadoActual = ticket.asignado_a || ticket.asignado_nombre;

  const estLower = (ticket.estado || '').toLowerCase();
  const esPendiente = estLower.includes('pendiente');
  const esEnProceso = estLower.includes('proceso');
  const esEnRevision = estLower.includes('revis');
  const esCorrecciones = estLower.includes('correc') || estLower.includes('ajust');
  const esResuelto = estLower.includes('resuelto') || estLower.includes('aprob');

  // Copiar link de entrega al portapapeles
  const handleCopiarEntrega = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2200);
  };

  // Guardar cambio de título
  const handleGuardarTitulo = async () => {
    if (!nuevoTitulo.trim()) return;
    setGuardandoTitulo(true);
    try {
      const ok = await ticketsService.updateTicketTitle(ticket.id, nuevoTitulo.trim(), nombreUsuarioActivo);
      if (ok) {
        const actualizado = { ...ticket, titulo: nuevoTitulo.trim(), actualizado_en: new Date().toISOString() };
        onTicketUpdated(actualizado);
        setEditandoTitulo(false);
        cargarDatos(ticket.id);
      }
    } catch (err) {
      console.error('Error guardando título:', err);
    } finally {
      setGuardandoTitulo(false);
    }
  };

  // Mover ticket al Registro de Eliminados (Soft Delete)
  const handleConfirmarEliminar = async () => {
    setEliminandoTicket(true);
    const motivoFinal = motivoEliminar.trim() || 'Error en la carga de datos';
    try {
      await ticketsService.deleteTicket(ticket.id, motivoFinal, nombreUsuarioActivo);
      setMostrarModalEliminar(false);
      if (onTicketDeleted) {
        onTicketDeleted(ticket.id, motivoFinal);
      }
      onClose();
    } catch (err) {
      console.error('Aviso al procesar eliminación:', err);
      setMostrarModalEliminar(false);
      if (onTicketDeleted) {
        onTicketDeleted(ticket.id, motivoFinal);
      }
      onClose();
    } finally {
      setEliminandoTicket(false);
    }
  };

  // Restaurar ticket eliminado
  const handleRestaurar = async () => {
    setRestaurandoTicket(true);
    try {
      const ok = await ticketsService.restoreTicket(ticket.id, nombreUsuarioActivo);
      if (ok) {
        if (onTicketRestored) {
          onTicketRestored(ticket.id);
        }
        const restaurado = { 
          ...ticket, 
          eliminado: false, 
          estado: 'pendiente', 
          motivo_eliminacion: undefined,
          eliminado_en: undefined 
        };
        onTicketUpdated(restaurado);
        cargarDatos(ticket.id);
      }
    } catch (err) {
      console.error('Error restaurando ticket:', err);
    } finally {
      setRestaurandoTicket(false);
    }
  };

  // Eliminación definitiva para siempre (Hard delete - Super Admin)
  const handleConfirmarPurgar = async () => {
    setPurgandoTicket(true);
    try {
      await ticketsService.hardDeleteTicket(ticket.id);
      if (onHardDeleteTicket) {
        onHardDeleteTicket(ticket.id);
      }
      onClose();
    } catch (err) {
      console.error('Error purgando ticket definitivamente:', err);
    } finally {
      setPurgandoTicket(false);
      setMostrarModalPurgar(false);
    }
  };

  // Cambiar estado directo desde los botones de acción rápida
  const handleCambiarEstado = async (nuevoEstado: string) => {
    const rolAutor = currentRole === 'SUPER_ADMIN' 
      ? 'SUPER_ADMIN' 
      : (currentRole === 'GRAFICA' ? 'GRAFICA' : 'CONTENIDOS');

    let textoEvento = `🔄 **Estado cambiado a: ${nuevoEstado}**`;
    if (nuevoEstado === 'en_revision') {
      textoEvento = `📤 **Estado cambiado a En Revisión**: El equipo de diseño envió el pedido para revisión y aprobación de Contenidos.`;
    } else if (nuevoEstado === 'resuelto') {
      textoEvento = `✓ **Ticket marcado como Resuelto**: Diseños finalizados y aprobados.`;
    } else if (nuevoEstado === 'en_proceso') {
      textoEvento = `🚀 **Estado cambiado a En Proceso**: El equipo de diseño comenzó a trabajar en este pedido.`;
    } else if (nuevoEstado === 'pendiente') {
      textoEvento = `⏳ **Estado cambiado a Pendiente**.`;
    } else if (nuevoEstado === 'correcciones') {
      textoEvento = `🟠 **Estado cambiado a Correcciones**: Se requieren ajustes en las piezas gráficas.`;
    }

    // 1. Actualizar el estado en Supabase
    await ticketsService.updateTicketStatus(ticket.id, nuevoEstado, nombreUsuarioActivo);

    // 2. Publicar en el feed unificado (comentarios) para registrar en el historial y disparar la alerta toast y el puntito rojo al otro área en tiempo real
    await ticketsService.addComment(
      ticket.id,
      textoEvento,
      nombreUsuarioActivo,
      undefined,
      rolAutor
    );

    // 3. Actualizar estado local del ticket con timestamp de última actividad
    const updated = { 
      ...ticket, 
      estado: nuevoEstado, 
      actualizado_en: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    onTicketUpdated(updated);
    cargarDatos(ticket.id);
  };

  // ⚡ Acción: Tomar pedido (Diseñador se auto-asigna y pasa a 'en_proceso')
  const handleTomarPedido = async () => {
    const disenador = nombreUsuarioActivo;
    await ticketsService.assignTicket(ticket.id, disenador, nombreUsuarioActivo, true);
    await ticketsService.addComment(
      ticket.id,
      `🚀 **${disenador}** tomó este pedido y comenzó a trabajar en los diseños. (Estado: En Proceso)`,
      disenador,
      undefined,
      currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'GRAFICA'
    );
    const updated = {
      ...ticket,
      asignado_a: disenador,
      asignado_nombre: disenador,
      estado: 'en_proceso',
      actualizado_en: new Date().toISOString()
    };
    onTicketUpdated(updated);
    cargarDatos(ticket.id);
  };

  // 👤 Acción: Asignar diseñador a este ticket mediante <select>
  const handleSeleccionarDisenador = async (nombreElegido: string) => {
    const elegido = (nombreElegido || '').trim();
    setGuardandoAsignacion(true);
    try {
      if (!elegido) {
        // Opción de desasignar
        await ticketsService.assignTicket(ticket.id, '', nombreUsuarioActivo, false);
        const updated = {
          ...ticket,
          asignado_a: undefined,
          asignado_nombre: undefined,
          actualizado_en: new Date().toISOString()
        };
        onTicketUpdated(updated);
        cargarDatos(ticket.id);
        return;
      }

      // Si el ticket estaba en 'pendiente', pasa automáticamente a 'en_proceso'
      const debePasarAEnProceso = esPendiente;
      await ticketsService.assignTicket(ticket.id, elegido, nombreUsuarioActivo, debePasarAEnProceso);
      await ticketsService.addComment(
        ticket.id,
        `👤 Pedido asignado a **${elegido}** para su ejecución gráfica.${debePasarAEnProceso ? ' (Pasa a En Proceso)' : ''}`,
        nombreUsuarioActivo,
        undefined,
        currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'GRAFICA'
      );

      const updated = {
        ...ticket,
        asignado_a: elegido,
        asignado_nombre: elegido,
        estado: debePasarAEnProceso ? 'en_proceso' : ticket.estado,
        actualizado_en: new Date().toISOString()
      };
      onTicketUpdated(updated);
      cargarDatos(ticket.id);
    } catch (err) {
      console.error('Error asignando diseñador:', err);
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  // 🟠 Acción: Contenidos Solicita Ajustes (Pasa a 'correcciones' en Naranja)
  const handleConfirmarAjustes = async () => {
    if (!detalleAjustes.trim()) return;

    setEnviandoAjustes(true);
    try {
      await ticketsService.requestCorrections(
        ticket.id,
        detalleAjustes.trim(),
        nombreUsuarioActivo,
        currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CONTENIDOS'
      );

      const updated = {
        ...ticket,
        estado: 'correcciones',
        actualizado_en: new Date().toISOString()
      };
      onTicketUpdated(updated);
      setMostrarModalAjustes(false);
      setDetalleAjustes('');
      cargarDatos(ticket.id);
    } catch (err) {
      console.error('Error solicitando ajustes:', err);
    } finally {
      setEnviandoAjustes(false);
    }
  };

  // ✓ Acción: Aprobar Entrega (Pasa a 'resuelto')
  const handleAprobarEntrega = async () => {
    await ticketsService.approveTicket(
      ticket.id,
      nombreUsuarioActivo,
      currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CONTENIDOS'
    );
    const updated = {
      ...ticket,
      estado: 'resuelto',
      actualizado_en: new Date().toISOString()
    };
    onTicketUpdated(updated);
    cargarDatos(ticket.id);
  };

  // Guardar link de entrega en Drive y cambiar a 'en_revision' automáticamente
  const handleGuardarLinkEntrega = async () => {
    if (!nuevoLinkEntrega.trim()) return;
    const linkLimpio = nuevoLinkEntrega.trim();

    await ticketsService.updateDeliveryLink(ticket.id, linkLimpio, true);
    await ticketsService.updateTicketStatus(ticket.id, 'en_revision', nombreUsuarioActivo);
    
    await ticketsService.addComment(
      ticket.id,
      esCorrecciones 
        ? `🎨 **¡Nueva versión de diseños subida a Google Drive!** Las correcciones solicitadas fueron aplicadas. Pasa a En Revisión.`
        : `🎨 **¡Diseños subidos a la carpeta de entrega de Google Drive!** El pedido pasó a En Revisión para su aprobación.`,
      nombreUsuarioActivo,
      linkLimpio,
      currentRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'GRAFICA'
    );

    const updated: Ticket = { 
      ...ticket, 
      links_entrega: linkLimpio, 
      link_entrega: linkLimpio,
      estado: 'en_revision',
      actualizado_en: new Date().toISOString() 
    };
    onTicketUpdated(updated);
    setEditandoEntrega(false);
    cargarDatos(ticket.id);
  };

  // Enviar comentario con el nombre del usuario autenticado (acepta texto, imagen o link)
  const handleEnviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    const textoPlano = nuevoMensaje.replace(/<[^>]*>/g, '').trim();
    const tieneImagen = htmlHasImages(nuevoMensaje);
    if (!textoPlano && !tieneImagen && !nuevoLinkAdjunto.trim()) return;

    setErrorComentario(null);
    setEnviandoComentario(true);

    const textoMensaje = nuevoMensaje;
    const linkAdjunto = nuevoLinkAdjunto.trim();

    const idTemporal = `temp-${Date.now()}`;
    const comentarioOptimista: Comentario = {
      id: idTemporal,
      ticket_id: ticket.id,
      mensaje: textoMensaje,
      contenido: textoMensaje,
      usuario: nombreUsuarioActivo,
      autor_nombre: nombreUsuarioActivo,
      autor_rol: currentRole,
      link_adjunto: linkAdjunto || undefined,
      creado_en: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Registrar acción local para evitar auto-notificación en esta misma ventana
    window.dispatchEvent(
      new CustomEvent('woof_local_action', {
        detail: { text: textoMensaje.trim(), ticketId: ticket.id }
      })
    );

    try {
      const guardado = await ticketsService.addComment(
        ticket.id,
        textoMensaje,
        nombreUsuarioActivo,
        linkAdjunto || undefined,
        currentRole
      );

      if (guardado) {
        window.dispatchEvent(
          new CustomEvent('woof_local_action', {
            detail: { id: guardado.id, text: textoMensaje.trim(), ticketId: ticket.id }
          })
        );
        setComentarios((prev) =>
          prev.map((c) => (c && c.id === idTemporal ? guardado : c))
        );
      }
      setNuevoMensaje('');
      setNuevoLinkAdjunto('');
      cargarDatos(ticket.id);
    } catch (err: any) {
      console.error('Error al enviar comentario:', err);
      setErrorComentario(err.message || 'No se pudo enviar el comentario.');
      setComentarios((prev) => prev.filter((c) => c && c.id !== idTemporal));
    } finally {
      setEnviandoComentario(false);
    }
  };

  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return '';
    try {
      const d = new Date(fechaStr);
      return d.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return fechaStr;
    }
  };

  const badgeEstado = (estado?: string) => {
    const est = (estado || '').toLowerCase();
    if (est.includes('eliminad')) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60 font-semibold';
    if (est.includes('correc') || est.includes('ajust')) return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-700/60 font-bold';
    if (est.includes('pendiente')) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60 font-semibold';
    if (est.includes('proceso')) return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/60 font-semibold';
    if (est.includes('revis')) return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-700/60 font-semibold';
    if (est.includes('resuelto') || est.includes('aprob')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60 font-semibold';
    if (est.includes('rechaz')) return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60';
    return 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      
      {/* Fondo interactivo para cerrar */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel Lateral Deslizante */}
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-neutral-100 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800 animate-in slide-in-from-right duration-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabecera del Drawer */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-[#252525]">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-200/90 dark:bg-neutral-800 px-2.5 py-0.5 rounded">
              {ticket.ticket_number || (ticket.numero_ticket ? `#${String(ticket.numero_ticket).padStart(3, '0')}` : '#001')}
            </span>
            <span className={`px-2.5 py-0.5 text-xs rounded-full border capitalize inline-flex items-center space-x-1.5 ${badgeEstado(ticket.estado)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                esCorrecciones ? 'bg-orange-600' :
                esResuelto ? 'bg-emerald-600' :
                esEnProceso ? 'bg-blue-600' :
                esEnRevision ? 'bg-purple-600' : 'bg-amber-600'
              }`} />
              <span>{esCorrecciones ? 'Correcciones' : ticket.estado}</span>
            </span>
            {estaEliminado && (
              <span className="text-[11px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                En Papelera
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!estaEliminado && puedeEliminar && (
              <button
                type="button"
                onClick={() => setMostrarModalEliminar(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition cursor-pointer"
                title="Mover este ticket al registro de eliminados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}

            {estaEliminado && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleRestaurar}
                  disabled={restaurandoTicket}
                  className="inline-flex items-center space-x-1 px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-xs transition cursor-pointer"
                  title="Restaurar este ticket a la lista de activos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{restaurandoTicket ? 'Restaurando...' : 'Restaurar'}</span>
                </button>

                {currentRole === 'SUPER_ADMIN' && (
                  <button
                    onClick={() => setMostrarModalPurgar(true)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded font-semibold transition cursor-pointer"
                    title="Eliminar definitivamente para siempre de la base de datos"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Purgar</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🟠 Banner de Alerta cuando está en CORRECCIONES */}
        {!estaEliminado && esCorrecciones && (
          <div className="px-6 py-2.5 bg-orange-50 dark:bg-orange-950/40 border-b border-orange-200 dark:border-orange-800/60 flex items-center justify-between text-xs text-orange-900 dark:text-orange-200">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>
                <strong>Correcciones solicitadas:</strong> El equipo de Contenidos revisó el material y requiere ajustes en las piezas.
              </span>
            </div>
            {puedeGestionarEntrega && (
              <button
                onClick={() => setEditandoEntrega(true)}
                className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[11px] font-bold transition cursor-pointer shrink-0 ml-2"
              >
                Subir nueva entrega
              </button>
            )}
          </div>
        )}

        {/* Alerta de Ticket Eliminado si aplica */}
        {estaEliminado && (
          <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <span className="font-semibold">Ticket en papelera:</span> {ticket.motivo_eliminacion || 'Error en la carga de datos'}.
              </div>
            </div>
          </div>
        )}

        {/* 🚀 Barra de Acciones Rápidas del Flujo de Trabajo */}
        {!estaEliminado && (
          <div className="px-6 py-2.5 bg-neutral-50 dark:bg-[#202020] border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Flujo ({currentRole}):
              </span>

              {/* 🎯 ASIGNACIÓN DE DISEÑADOR CON <SELECT> (Solo levanta usuarios de Diseño) */}
              {puedeAsignar && (
                <div className="inline-flex items-center space-x-1.5 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 shadow-2xs hover:border-blue-400 transition">
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <label htmlFor="select-disenador-flujo" className="text-xs text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                    Diseñador:
                  </label>
                  <select
                    id="select-disenador-flujo"
                    value={asignadoActual || ''}
                    onChange={(e) => handleSeleccionarDisenador(e.target.value)}
                    disabled={guardandoAsignacion}
                    className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer pr-1"
                  >
                    <option value="" className="bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200">-- Sin asignar --</option>
                    {disenadoresDisponibles.map((p) => {
                      const nombre = p.nombre || p.email.split('@')[0];
                      return (
                        <option key={p.id} value={nombre} className="bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200">
                          {nombre}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* BOTONES SEGÚN ROL Y ESTADO */}
            <div className="flex items-center space-x-1.5 flex-wrap">
              {currentRole === 'SUPER_ADMIN' ? (
                <>
                  <button
                    onClick={() => handleCambiarEstado('pendiente')}
                    className={`px-2 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      esPendiente
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    Pendiente
                  </button>
                  <button
                    onClick={() => handleCambiarEstado('en_proceso')}
                    className={`px-2 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      esEnProceso
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    En Proceso
                  </button>
                  <button
                    onClick={() => handleCambiarEstado('en_revision')}
                    className={`px-2 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      esEnRevision
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    En Revisión
                  </button>
                  <button
                    onClick={() => setMostrarModalAjustes(true)}
                    className={`px-2 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      esCorrecciones
                        ? 'bg-orange-600 text-white font-bold'
                        : 'bg-white dark:bg-[#1a1a1a] text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-orange-300 dark:border-orange-800/60'
                    }`}
                  >
                    🟠 Solicitar Ajustes
                  </button>
                  <button
                    onClick={() => handleCambiarEstado('resuelto')}
                    className={`px-2 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      esResuelto
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    ✓ Resuelto
                  </button>
                </>
              ) : currentRole === 'GRAFICA' ? (
                <>
                  {esPendiente && (
                    <button
                      onClick={handleTomarPedido}
                      className="px-3 py-1 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer flex items-center space-x-1"
                    >
                      <span>⚡ Tomar pedido (En Proceso)</span>
                    </button>
                  )}

                  {(esEnProceso || esCorrecciones) && (
                    <button
                      onClick={() => handleCambiarEstado('en_revision')}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition cursor-pointer"
                    >
                      📤 Enviar a Revisión
                    </button>
                  )}

                  {!esResuelto && (
                    <button
                      onClick={() => handleCambiarEstado('resuelto')}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                    >
                      ✓ Marcar Resuelto
                    </button>
                  )}
                </>
              ) : (
                /* ROL CONTENIDOS */
                <>
                  {!esResuelto && (
                    <button
                      onClick={handleAprobarEntrega}
                      className="px-3 py-1 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprobar Entrega</span>
                    </button>
                  )}

                  {/* 🟠 Botón Solicitar Ajustes: Disponible siempre, incluso si ya está Resuelto */}
                  <button
                    onClick={() => setMostrarModalAjustes(true)}
                    className="px-3 py-1 text-xs font-bold rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-400 transition cursor-pointer shadow-2xs flex items-center space-x-1"
                    title="Solicitar modificaciones o correcciones al equipo de diseño"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>Solicitar Ajustes</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-neutral-100">
          
          {/* ✏️ Título del Ticket */}
          <div>
            {editandoTitulo ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">
                  Editar título del pedido:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nuevoTitulo}
                    onChange={(e) => setNuevoTitulo(e.target.value)}
                    placeholder="Título del pedido..."
                    className="flex-1 text-lg font-bold border border-blue-400 dark:border-blue-500 bg-white dark:bg-[#191919] text-neutral-900 dark:text-neutral-100 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleGuardarTitulo}
                    disabled={guardandoTitulo}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>{guardandoTitulo ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                  <button
                    onClick={() => setEditandoTitulo(false)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                    title="Cancelar edición"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                  {ticket.titulo}
                </h1>
                {puedeEditarTitulo && !estaEliminado && (
                  <button
                    onClick={() => setEditandoTitulo(true)}
                    className="opacity-60 group-hover:opacity-100 text-neutral-400 hover:text-blue-600 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer shrink-0"
                    title="Hacer clic para editar el título del pedido"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Metadatos: Área, Creador (asignado por quien lo crea), Asignado a Diseñador y Fecha */}
            <div className="flex items-center space-x-2.5 mt-2.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
              <span>Área: <strong className="text-neutral-700 dark:text-neutral-300">{ticket.area_solicitante}</strong></span>
              <span>•</span>
              <span>
                Solicitado por:{" "}
                <strong className="text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                  👤 {ticket.creado_por || "Equipo de Contenidos"}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span>Asignado a:</span>
                {puedeAsignar && !estaEliminado ? (
                  <select
                    value={asignadoActual || ''}
                    onChange={(e) => handleSeleccionarDisenador(e.target.value)}
                    disabled={guardandoAsignacion}
                    className="text-xs font-semibold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200">Sin asignar</option>
                    {disenadoresDisponibles.map((p) => {
                      const nombre = p.nombre || p.email.split('@')[0];
                      return (
                        <option key={p.id} value={nombre} className="bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200">
                          {nombre}
                        </option>
                      );
                    })}
                  </select>
                ) : asignadoActual ? (
                  <UserTagBadge name={asignadoActual} size="xs" />
                ) : (
                  <span className="text-neutral-400 dark:text-neutral-500 italic">
                    Sin asignar
                  </span>
                )}
              </span>
              <span>•</span>
              <span>{formatearFecha(ticket.created_at || ticket.creado_en)}</span>
            </div>
          </div>

          {/* 🌟 SECCIÓN ULTRA VISIBLE: ENTREGA DE DISEÑOS EN GOOGLE DRIVE 🌟 */}
          <div className="rounded-xl border transition-all duration-200 overflow-hidden shadow-xs">
            {linkEntregaFinal ? (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/30 border-2 border-emerald-400 dark:border-emerald-600/80 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center space-x-1.5">
                      <FolderCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Diseños Terminados Listos en Google Drive</span>
                    </span>
                  </div>

                  {puedeGestionarEntrega && !estaEliminado && (
                    <button
                      onClick={() => setEditandoEntrega(!editandoEntrega)}
                      className="text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-semibold underline cursor-pointer"
                    >
                      {editandoEntrega ? 'Cancelar' : '✏️ Cambiar link'}
                    </button>
                  )}
                </div>

                {editandoEntrega ? (
                  <div className="space-y-2 bg-white dark:bg-[#1a1a1a] p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                      Actualizar enlace de Google Drive con las piezas:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={nuevoLinkEntrega}
                        onChange={(e) => setNuevoLinkEntrega(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#151515] rounded-md px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleGuardarLinkEntrega}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 dark:bg-[#1e1e1e] p-3.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                        <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          Carpeta de Entrega del Pedido
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-sm">
                          {linkEntregaFinal}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleCopiarEntrega(linkEntregaFinal)}
                        className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold transition cursor-pointer"
                        title="Copiar enlace al portapapeles"
                      >
                        {copiadoLink ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <a
                        href={linkEntregaFinal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95"
                      >
                        <span>Abrir en Google Drive</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : puedeGestionarEntrega && !estaEliminado ? (
              <div className="bg-purple-50/70 dark:bg-purple-950/30 border-2 border-dashed border-purple-300 dark:border-purple-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center space-x-1.5">
                    <UploadCloud className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Entregar Diseños Terminados (Google Drive)</span>
                  </span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    Cambiará automáticamente a "En Revisión"
                  </span>
                </div>
                
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Pega aquí el enlace de la carpeta o archivo de Drive con las piezas terminadas para que Contenidos pueda revisarlas:
                </p>

                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={nuevoLinkEntrega}
                    onChange={(e) => setNuevoLinkEntrega(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 text-xs border border-purple-200 dark:border-purple-800 bg-white dark:bg-[#151515] rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleGuardarLinkEntrega}
                    disabled={!nuevoLinkEntrega.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Guardar y Entregar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 p-3.5 rounded-xl flex items-center space-x-3 text-neutral-500 dark:text-neutral-400">
                <FolderOpen className="w-5 h-5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-neutral-700 dark:text-neutral-200">Esperando entrega de diseños</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    El equipo de diseño adjuntará el enlace de Google Drive con las piezas terminadas en esta sección.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 📋 Brief del Pedido (con soporte de clic en imágenes para ampliar y botón Super Admin para depurar fotos) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Brief del Pedido
              </h3>

              {/* Botón Super Admin: Borrar imágenes/miniaturas de este ticket sin borrar el ticket */}
              {currentRole === 'SUPER_ADMIN' &&
                (countImagesInHtml(ticket.brief) > 0 ||
                  comentarios.some((c) => countImagesInHtml(c.mensaje || c.contenido) > 0)) && (
                  <button
                    type="button"
                    onClick={() => setMostrarModalDepurarImgs(true)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                    title="Eliminar las imágenes de referencia y miniaturas de este ticket para liberar espacio en el servidor (conservando el ticket y todo su texto)"
                  >
                    <Trash2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>
                      Borrar imágenes del ticket (
                      {countImagesInHtml(ticket.brief) +
                        comentarios.reduce(
                          (acc, c) => acc + countImagesInHtml(c.mensaje || c.contenido),
                          0
                        )}
                      )
                    </span>
                  </button>
                )}
            </div>
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target && target.tagName === 'IMG') {
                  const src = (target as HTMLImageElement).src;
                  if (src) setLightboxImageUrl(src);
                }
              }}
              className="p-4 bg-neutral-50 dark:bg-[#252525] rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans"
            >
              <div 
                className="prose prose-sm max-w-none text-neutral-800 dark:text-neutral-200"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.brief || 'Sin detalles adicionales.') }}
              />
            </div>
          </div>

          {/* 🔗 Enlace de Referencia original de Contenidos */}
          {(ticket.link_referencia || ticket.links_referencia) && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Material de Referencia / Insumos
              </h3>
              <a
                href={ticket.link_referencia || ticket.links_referencia}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-xs text-blue-600 hover:text-blue-800 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-200 px-3 py-2 rounded-lg transition"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-md font-medium">
                  {ticket.link_referencia || ticket.links_referencia}
                </span>
              </a>
            </div>
          )}

          {/* 💬 Feed Único: Actividad y Conversación en Tiempo Real (Estilo Gmail + Notion) */}
          <div className="pt-2">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-neutral-500" />
                <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  Actividad y Conversación ({feedUnificado.length})
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">
                Historial unificado
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {loadingComentarios ? (
                <div className="py-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
                  <span>Cargando actividad...</span>
                </div>
              ) : feedUnificado.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-lg border border-neutral-200">
                  No hay mensajes ni eventos registrados en este ticket aún. ¡Inicia la conversación abajo!
                </div>
              ) : (
                feedUnificado.map((item) => {
                  if (item.tipo === 'movimiento') {
                    const m = item.data;
                    const accion = m.accion || '';
                    const autorMov = m.usuario_nombre || m.usuario || 'Sistema';

                    // Seleccionar icono y color del evento
                    let IconComponent = Clock;
                    let iconColor = 'text-neutral-500';
                    let bgColor = 'bg-neutral-100 border-neutral-200 text-neutral-700';

                    if (accion.toLowerCase().includes('asignad')) {
                      IconComponent = UserCheck;
                      iconColor = 'text-blue-600';
                      bgColor = 'bg-blue-50/80 border-blue-200 text-blue-900';
                    } else if (accion.toLowerCase().includes('título')) {
                      IconComponent = Pencil;
                      iconColor = 'text-amber-600';
                      bgColor = 'bg-amber-50/80 border-amber-200 text-amber-900';
                    } else if (accion.toLowerCase().includes('eliminad') || accion.toLowerCase().includes('papelera')) {
                      IconComponent = Trash2;
                      iconColor = 'text-rose-600';
                      bgColor = 'bg-rose-50/80 border-rose-200 text-rose-900';
                    } else if (accion.toLowerCase().includes('restaurad')) {
                      IconComponent = RotateCcw;
                      iconColor = 'text-emerald-600';
                      bgColor = 'bg-emerald-50/80 border-emerald-200 text-emerald-900';
                    } else if (accion.toLowerCase().includes('estado')) {
                      IconComponent = RefreshCw;
                      iconColor = 'text-purple-600';
                      bgColor = 'bg-purple-50/80 border-purple-200 text-purple-900';
                    }

                    return (
                      <div key={item.id} className="flex items-center space-x-2 my-2 py-0.5 text-xs">
                        <div className="h-px bg-neutral-200 flex-1" />
                        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[11px] shadow-2xs shrink-0 ${bgColor}`}>
                          <IconComponent className={`w-3.5 h-3.5 ${iconColor}`} />
                          <span className="font-bold text-neutral-900">{autorMov}:</span>
                          <span>{accion}</span>
                          <span className="text-neutral-400 font-normal">• {formatearFecha(m.creado_en || m.created_at)}</span>
                        </div>
                        <div className="h-px bg-neutral-200 flex-1" />
                      </div>
                    );
                  }

                  // Renderizar comentario (Tarjeta enriquecida)
                  const c = item.data;
                  const autorLimpio = c.autor_nombre || c.usuario || 'Usuario';
                  const inicial = (autorLimpio.charAt(0) || 'U').toUpperCase();
                  const esGrafica = c.autor_rol === 'GRAFICA' || autorLimpio.toLowerCase().includes('gr') || autorLimpio.toLowerCase().includes('dise');
                  const esAdmin = c.autor_rol === 'SUPER_ADMIN';
                  const esAjuste = (c.mensaje || c.contenido || '').includes('Ajustes Solicitados');

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all text-xs space-y-2 ${
                        esAjuste
                          ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 shadow-2xs'
                          : esAdmin
                          ? 'bg-neutral-900/5 dark:bg-neutral-800/40 border-neutral-300 dark:border-neutral-700'
                          : esGrafica
                          ? 'bg-purple-50/50 dark:bg-purple-950/25 border-purple-200/80 dark:border-purple-800/60'
                          : 'bg-blue-50/40 dark:bg-blue-950/25 border-blue-200/80 dark:border-blue-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] text-white shadow-2xs ${
                            esAjuste
                              ? 'bg-orange-600'
                              : esAdmin
                              ? 'bg-neutral-800'
                              : esGrafica
                              ? 'bg-purple-600'
                              : 'bg-blue-600'
                          }`}>
                            {inicial}
                          </div>

                          <span className="font-bold text-neutral-900 dark:text-neutral-100 text-[13px]">
                            {autorLimpio}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                            esAjuste
                              ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                              : esAdmin
                              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'
                              : esGrafica
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}>
                            {esAjuste ? 'Ajustes' : esAdmin ? 'Super Admin' : esGrafica ? 'Gráfica' : 'Contenidos'}
                          </span>
                        </div>

                        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          {formatearFecha(c.creado_en || c.created_at)}
                        </span>
                      </div>

                      <div 
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target && target.tagName === 'IMG') {
                            const src = (target as HTMLImageElement).src;
                            if (src) setLightboxImageUrl(src);
                          }
                        }}
                        className="prose prose-xs max-w-none text-neutral-800 dark:text-neutral-200 pl-8"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.mensaje || c.contenido || '') }}
                      />

                      {c.link_adjunto && (
                        <div className="pl-8 pt-1">
                          <a
                            href={c.link_adjunto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold bg-white dark:bg-neutral-800 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                            <span className="truncate max-w-xs">{c.link_adjunto}</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ✍️ Formulario para Enviar Comentarios (Fondo Fijo) */}
        {!estaEliminado && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1e1e1e]">
            {errorComentario && (
              <div className="mb-2 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>{errorComentario}</span>
                <button onClick={() => setErrorComentario(null)} className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleEnviarComentario} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                  Escribiendo como: <strong className="text-neutral-800 dark:text-neutral-200">{nombreUsuarioActivo}</strong>
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  Enter para enviar • Shift+Enter para salto
                </span>
              </div>

              <RichTextEditor
                value={nuevoMensaje}
                onChange={setNuevoMensaje}
                storageFolder={`ticket_${ticket.id}`}
                placeholder={`Responder o pegar captura/miniatura como ${nombreUsuarioActivo}...`}
              />

              <div className="flex items-center justify-between pt-1 gap-2">
                <div className="flex-1 flex items-center space-x-2">
                  <Paperclip className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
                  <input
                    type="url"
                    value={nuevoLinkAdjunto}
                    onChange={(e) => setNuevoLinkAdjunto(e.target.value)}
                    placeholder="Adjuntar enlace adicional (opcional)..."
                    className="w-full text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#191919] text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    enviandoComentario ||
                    (!nuevoMensaje.replace(/<[^>]*>/g, '').trim() &&
                      !htmlHasImages(nuevoMensaje) &&
                      !nuevoLinkAdjunto.trim())
                  }
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 disabled:opacity-50 text-white dark:text-neutral-950 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{enviandoComentario ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* 🟠 MODAL: SOLICITAR AJUSTES / CORRECCIONES */}
      {mostrarModalAjustes && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-orange-200 dark:border-orange-800/60 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/70 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Solicitar Ajustes (Correcciones)
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    El ticket pasará a estado <span className="font-bold text-orange-600 dark:text-orange-400">Correcciones (Naranja)</span>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMostrarModalAjustes(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                ¿Qué modificaciones o ajustes requiere el diseño?
              </label>
              <textarea
                value={detalleAjustes}
                onChange={(e) => setDetalleAjustes(e.target.value)}
                rows={4}
                placeholder="Detalla los cambios puntuales: colores, tipografías, orden de diapositivas, textos a corregir..."
                className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg p-3 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Se publicará automáticamente como comentario y el equipo de diseño recibirá la alerta de ajustes pendientes.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMostrarModalAjustes(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAjustes}
                disabled={enviandoAjustes || !detalleAjustes.trim()}
                className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg transition cursor-pointer shadow-xs"
              >
                {enviandoAjustes ? 'Guardando...' : 'Confirmar Ajustes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {mostrarModalEliminar && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Mover Ticket al Registro de Eliminados
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  El ticket se archivará en la papelera y podrá ser restaurado o auditado.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                Motivo de eliminación:
              </label>
              <select
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
                className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Error en la carga de datos" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">Error en la carga de datos</option>
                <option value="Pedido duplicado" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">Pedido duplicado</option>
                <option value="Cancelado por Contenidos" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">Cancelado por Contenidos</option>
                <option value="Ya no es necesario" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">Ya no es necesario</option>
                <option value="Otro motivo" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">Otro motivo</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMostrarModalEliminar(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={eliminandoTicket}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer shadow-xs"
              >
                {eliminandoTicket ? 'Eliminando...' : 'Sí, eliminar ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ MODAL DE CONFIRMACIÓN DE PURGADO DEFINITIVO (SUPER ADMIN) */}
      {mostrarModalPurgar && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-800/60 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ¿Eliminar ticket para siempre?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Esta acción no se puede deshacer. Se borrará permanentemente de la base de datos.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200">
              <span className="font-bold">Ticket:</span> "{ticket.titulo}"
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMostrarModalPurgar(false)}
                disabled={purgandoTicket}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarPurgar}
                disabled={purgandoTicket}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {purgandoTicket ? (
                  <span>Eliminando...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, eliminar para siempre</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧹 MODAL SUPER ADMIN: DEPURAR IMÁGENES DEL TICKET (CONSERVANDO EL REGISTRO) */}
      {mostrarModalDepurarImgs && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 dark:border-amber-800/60 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/70 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ¿Borrar imágenes de este ticket?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Se eliminarán las referencias visuales del brief y las miniaturas en los comentarios para liberar espacio en el servidor.
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200">
              ✓ <strong>El registro del ticket NO se borra</strong>: el título, el texto del brief, el historial de conversación y los links de Google Drive se conservarán intactos.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMostrarModalDepurarImgs(false)}
                disabled={depurandoImgs}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDepurandoImgs(true);
                  try {
                    await purgeImagesFromSingleTicket(ticket);
                    const updatedBrief = ticket.brief
                      ? stripImagesFromHtmlWithNotice(ticket.brief)
                      : ticket.brief;
                    onTicketUpdated({
                      ...ticket,
                      brief: updatedBrief,
                    });
                    await cargarDatos(ticket.id);
                    setMostrarModalDepurarImgs(false);
                  } catch (err) {
                    console.error('Error depurando imágenes del ticket:', err);
                  } finally {
                    setDepurandoImgs(false);
                  }
                }}
                disabled={depurandoImgs}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{depurandoImgs ? 'Liberando espacio...' : 'Sí, borrar solo las imágenes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 VISOR DE IMAGEN A PANTALLA COMPLETA (LIGHTBOX) */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="max-w-5xl max-h-[88vh] relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="mb-3 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cerrar vista previa (Esc)</span>
            </button>
            <img
              src={lightboxImageUrl}
              alt="Vista previa ampliada"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/15 cursor-default"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default TicketDrawer;
