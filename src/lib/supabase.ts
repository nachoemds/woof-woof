// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import {
  Ticket,
  Comentario,
  HistorialMovimiento,
  TicketStatus,
} from "../types";

// Tipos estrictos para Control de Acceso basado en Roles (RBAC) y vistas UI
import { saveLocalUserColor } from "./tagColors";

export type UserRole =
  | "superadmin"
  | "operador"
  | "solicitante"
  | "SUPER_ADMIN"
  | "CONTENIDOS"
  | "GRAFICA";
export type UserArea = "Contenidos" | "Gráfica" | "Todas";

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: "superadmin" | "operador" | "solicitante";
  area: UserArea;
  color?: string;
  created_at?: string;
}

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY
) {
  console.warn(
    "Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helpers para persistencia y sincronización local resiliente
export function getLocalDeletedMetadata(): Record<
  string,
  {
    eliminado: boolean;
    eliminado_en?: string;
    motivo_eliminacion?: string;
    eliminado_por?: string;
  }
> {
  try {
    const raw = localStorage.getItem("ticketing_deleted_metadata");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalDeletedMetadata(
  id: string | number,
  meta: {
    eliminado: boolean;
    eliminado_en?: string;
    motivo_eliminacion?: string;
    eliminado_por?: string;
  },
) {
  try {
    const current = getLocalDeletedMetadata();
    current[String(id)] = meta;
    localStorage.setItem("ticketing_deleted_metadata", JSON.stringify(current));
  } catch {}
}

export function removeLocalDeletedMetadata(id: string | number) {
  try {
    const current = getLocalDeletedMetadata();
    delete current[String(id)];
    localStorage.setItem("ticketing_deleted_metadata", JSON.stringify(current));
  } catch {}
}

export function getLocalCustomTitles(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ticketing_custom_titles");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalCustomTitle(id: string | number, title: string) {
  try {
    const current = getLocalCustomTitles();
    current[String(id)] = title;
    localStorage.setItem("ticketing_custom_titles", JSON.stringify(current));
  } catch {}
}

export function getLocalDeliveryLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ticketing_delivery_links");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalDeliveryLink(id: string | number, link: string) {
  try {
    const current = getLocalDeliveryLinks();
    current[String(id)] = link;
    localStorage.setItem("ticketing_delivery_links", JSON.stringify(current));
  } catch {}
}

export function getLocalTicketStatuses(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ticketing_ticket_statuses");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalTicketStatus(id: string | number, estado: string) {
  try {
    const current = getLocalTicketStatuses();
    current[String(id)] = estado;
    localStorage.setItem("ticketing_ticket_statuses", JSON.stringify(current));
  } catch {}
}

export function getLocalAssignedDesigners(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ticketing_assigned_designers");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalAssignedDesigner(
  id: string | number,
  asignadoA: string,
) {
  try {
    const current = getLocalAssignedDesigners();
    current[String(id)] = asignadoA;
    localStorage.setItem(
      "ticketing_assigned_designers",
      JSON.stringify(current),
    );
  } catch {}
}

export function getLocalCreators(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ticketing_creators");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalCreator(id: string | number, creator: string) {
  try {
    const current = getLocalCreators();
    current[String(id)] = creator;
    localStorage.setItem("ticketing_creators", JSON.stringify(current));
  } catch {}
}

export function getLocalTeamMembers(): Profile[] {
  try {
    const raw = localStorage.getItem("woof_team_members");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTeamMember(profile: Profile): void {
  try {
    const current = getLocalTeamMembers();
    const idx = current.findIndex(
      (p) => p.id === profile.id || p.email.toLowerCase() === profile.email.toLowerCase()
    );
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...profile };
    } else {
      current.push(profile);
    }
    localStorage.setItem("woof_team_members", JSON.stringify(current));
  } catch {}
}


/**
 * Normaliza y formatea un ticket para que el número de ticket SIEMPRE sea #001, #002, etc.
 * Mantiene intacto el estado de borrado suave (eliminado) y sus motivos.
 */
export function formatTicket(t: any, indexFallback?: number): Ticket {
  if (!t) return t;

  let num: number | null = null;

  // 1. Si existe columna 'numero_ticket' numérica
  if (
    t.numero_ticket !== undefined &&
    t.numero_ticket !== null &&
    !isNaN(Number(t.numero_ticket))
  ) {
    num = Number(t.numero_ticket);
  } else if (
    t.numero !== undefined &&
    t.numero !== null &&
    !isNaN(Number(t.numero))
  ) {
    num = Number(t.numero);
  } else if (!isNaN(Number(t.id))) {
    num = Number(t.id);
  }

  let formattedNumber = "";
  if (num !== null && num > 0) {
    formattedNumber = `#${String(num).padStart(3, "0")}`;
  } else if (t.ticket_number && /^#\d+$/.test(t.ticket_number)) {
    formattedNumber = t.ticket_number;
  } else if (
    indexFallback !== undefined &&
    indexFallback !== null &&
    indexFallback > 0
  ) {
    formattedNumber = `#${String(indexFallback).padStart(3, "0")}`;
  } else {
    // Si no hay número asignado, extraer dígitos del id o fallback limpio
    const digits = String(t.id).replace(/\D/g, "");
    formattedNumber = digits ? `#${digits.slice(-3).padStart(3, "0")}` : "#001";
  }

  // Comprobar metadatos locales de borrado suave
  const idStr = String(t.id);
  const localMeta = getLocalDeletedMetadata()[idStr];

  const esEliminado = Boolean(
    t.eliminado === true ||
    t.eliminado === "true" ||
    String(t.estado || "").toLowerCase() === "eliminado" ||
    (localMeta && localMeta.eliminado),
  );

  // Comprobar título editado: la base de datos de Supabase siempre prevalece
  const localTitle = getLocalCustomTitles()[idStr];
  const tituloFinal = t.titulo || localTitle || "Sin título";

  // Comprobar link de entrega, estado y asignado: la base de datos de Supabase siempre prevalece
  const localDelivery = getLocalDeliveryLinks()[idStr];
  const localStatus = getLocalTicketStatuses()[idStr];
  const localAssigned = getLocalAssignedDesigners()[idStr];

  const linkEntregaFinal =
    t.link_entrega || t.links_entrega || localDelivery || undefined;
  const linkRefFinal = t.link_referencia || t.links_referencia || undefined;
  const asignadoFinal =
    t.asignado_a || t.asignado_nombre || localAssigned || undefined;
  const rawDbEstado = (t.estado || "").trim();
  const estadoFinal = esEliminado
    ? "eliminado"
    : rawDbEstado || localStatus || "pendiente";

  const localCreator = getLocalCreators()[idStr];
  const creadorFinal = t.creado_por || localCreator || undefined;

  return {
    ...t,
    titulo: tituloFinal,
    numero_ticket: num || t.numero_ticket || indexFallback || undefined,
    ticket_number: formattedNumber,
    creado_por: creadorFinal,
    created_at: t.creado_en || t.created_at || new Date().toISOString(),
    creado_en: t.creado_en || t.created_at || new Date().toISOString(),
    actualizado_en:
      t.actualizado_en ||
      t.updated_at ||
      t.creado_en ||
      t.created_at ||
      new Date().toISOString(),
    updated_at:
      t.updated_at ||
      t.actualizado_en ||
      t.creado_en ||
      t.created_at ||
      new Date().toISOString(),
    eliminado: esEliminado,
    estado: estadoFinal,
    asignado_a: asignadoFinal,
    asignado_nombre: asignadoFinal,
    link_entrega: linkEntregaFinal,
    links_entrega: linkEntregaFinal,
    link_referencia: linkRefFinal,
    links_referencia: linkRefFinal,
    eliminado_en:
      t.eliminado_en ||
      localMeta?.eliminado_en ||
      (esEliminado ? t.actualizado_en || new Date().toISOString() : undefined),
    motivo_eliminacion:
      t.motivo_eliminacion ||
      localMeta?.motivo_eliminacion ||
      (esEliminado ? "Error en la carga de datos" : undefined),
    eliminado_por: t.eliminado_por || localMeta?.eliminado_por || undefined,
  };
}

/**
 * Función normalizadora que formatea cualquier comentario venido de Supabase o Realtime.
 * Elimina 'USUARIO' genérico y detecta con precisión si es de CONTENIDOS, GRÁFICA o SUPER_ADMIN.
 */
export function formatComment(c: any): Comentario {
  if (!c) {
    return {
      id: Math.random(),
      ticket_id: "",
      mensaje: "",
      contenido: "",
      usuario: "Equipo de Contenidos",
      autor_nombre: "Equipo de Contenidos",
      autor_rol: "CONTENIDOS",
      created_at: new Date().toISOString(),
      creado_en: new Date().toISOString(),
    };
  }

  const rawTexto = c.mensaje || c.contenido || c.texto || c.comentario || "";

  // 1. Detección de rol por marca oculta <!--rol:ROL--> o prefijo
  let rolDetectado: UserRole | null = null;
  let textoLimpio = rawTexto;

  if (rawTexto.includes("<!--rol:SUPER_ADMIN-->")) {
    rolDetectado = "SUPER_ADMIN";
    textoLimpio = rawTexto.replace(/<!--rol:SUPER_ADMIN-->/g, "").trim();
  } else if (rawTexto.includes("<!--rol:GRAFICA-->")) {
    rolDetectado = "GRAFICA";
    textoLimpio = rawTexto.replace(/<!--rol:GRAFICA-->/g, "").trim();
  } else if (rawTexto.includes("<!--rol:CONTENIDOS-->")) {
    rolDetectado = "CONTENIDOS";
    textoLimpio = rawTexto.replace(/<!--rol:CONTENIDOS-->/g, "").trim();
  } else if (/^\[(SUPER_ADMIN|ADMIN)\]/i.test(rawTexto)) {
    rolDetectado = "SUPER_ADMIN";
    textoLimpio = rawTexto.replace(/^\[(SUPER_ADMIN|ADMIN)\]\s*/i, "").trim();
  } else if (/^\[(GRÁFICA|GRAFICA)\]/i.test(rawTexto)) {
    rolDetectado = "GRAFICA";
    textoLimpio = rawTexto.replace(/^\[(GRÁFICA|GRAFICA)\]\s*/i, "").trim();
  } else if (/^\[CONTENIDOS\]/i.test(rawTexto)) {
    rolDetectado = "CONTENIDOS";
    textoLimpio = rawTexto.replace(/^\[CONTENIDOS\]\s*/i, "").trim();
  }

  // 2. Si no viene en el texto, inferir por columnas de la base de datos
  const nombreRaw = String(c.autor_nombre || c.usuario || c.autor || "").trim();
  const rolRaw = String(c.autor_rol || c.rol || "").toUpperCase();

  if (!rolDetectado) {
    if (
      rolRaw === "SUPER_ADMIN" ||
      rolRaw === "ADMIN" ||
      nombreRaw.toUpperCase().includes("ADMIN")
    ) {
      rolDetectado = "SUPER_ADMIN";
    } else if (rolRaw === "GRAFICA" || rolRaw === "DISEÑO") {
      rolDetectado = "GRAFICA";
    } else if (rolRaw === "CONTENIDOS") {
      rolDetectado = "CONTENIDOS";
    } else if (
      nombreRaw.toUpperCase().includes("GRAF") ||
      nombreRaw.toUpperCase().includes("DISE") ||
      textoLimpio.includes("🎨") ||
      textoLimpio.toLowerCase().includes("diseños") ||
      textoLimpio.toLowerCase().includes("drive.google.com") ||
      Boolean(c.link_adjunto)
    ) {
      rolDetectado = "GRAFICA";
    } else {
      rolDetectado = "CONTENIDOS";
    }
  }

  // 3. Normalizar nombre del autor: eliminar "USUARIO", "Usuario", "null" genéricos
  const esGenerico =
    !nombreRaw ||
    nombreRaw.toUpperCase() === "USUARIO" ||
    nombreRaw.toLowerCase() === "anon" ||
    nombreRaw.toLowerCase() === "null" ||
    nombreRaw.toLowerCase() === "undefined";

  let autorFinal = nombreRaw;
  if (esGenerico) {
    if (rolDetectado === "SUPER_ADMIN") autorFinal = "Super Administrador";
    else if (rolDetectado === "GRAFICA") autorFinal = "Equipo de Gráfica";
    else autorFinal = "Equipo de Contenidos";
  }

  const fechaFinal = c.creado_en || c.created_at || new Date().toISOString();

  return {
    ...c,
    id: c.id || Math.random(),
    ticket_id: c.ticket_id,
    mensaje: textoLimpio,
    contenido: textoLimpio,
    usuario: autorFinal,
    autor_nombre: autorFinal,
    autor_rol: rolDetectado,
    link_adjunto: c.link_adjunto || undefined,
    created_at: fechaFinal,
    creado_en: fechaFinal,
  };
}

// Helper para consultar perfil por id de usuario en tabla 'perfiles'
export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Aviso consultando tabla perfiles:", error.message);
      return null;
    }
    return data as Profile;
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    return null;
  }
}

// Helper para movimientos: en la arquitectura de Feed Único, todos los eventos y cambios
// se registran directamente en la tabla 'comentarios', que cuenta con soporte en tiempo real y alertas.
export async function safeInsertMovement(
  _ticketId: string | number,
  _accion: string,
  _usuario?: string,
): Promise<void> {
  // Evita llamadas fallidas a tablas inexistentes o sin RLS en Supabase
  return;
}

export const ticketsService = {
  // 1. Obtener todos los tickets garantizando números secuenciales #001, #002...
  async fetchTickets(): Promise<Ticket[]> {
    let res = await supabase
      .from("tickets")
      .select("*")
      .order("creado_en", { ascending: false });

    if (res.error) {
      res = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
    }

    if (res.error) {
      res = await supabase.from("tickets").select("*");
    }

    if (res.error) {
      console.error("Error cargando tickets de Supabase:", res.error.message);
      return [];
    }

    const rawTickets = res.data || [];
    const total = rawTickets.length;

    // Si la base de datos se vació a cero, limpiar automáticamente cualquier caché local de tickets viejos
    // para que el nuevo #001 (id=1) arranque 100% limpio sin heredar estados ni lecturas anteriores
    if (total === 0) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("ticketing_")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      return [];
    }

    // Asignar número ordenado para que los más antiguos comiencen en #001 y los más nuevos continúen la serie
    return rawTickets.map((ticket, index) => {
      const fallbackSeq = total - index;
      return formatTicket(ticket, fallbackSeq);
    });
  },

  // 2. Crear un nuevo ticket con correlativo secuencial y user_id
  async createTicket(payload: any): Promise<Ticket | null> {
    let proximoNumero = 1;
    try {
      const { data: ultimos } = await supabase
        .from("tickets")
        .select("numero_ticket, id")
        .order("numero_ticket", { ascending: false, nullsFirst: false })
        .limit(1);

      if (
        ultimos &&
        ultimos.length > 0 &&
        ultimos[0].numero_ticket &&
        !isNaN(Number(ultimos[0].numero_ticket))
      ) {
        proximoNumero = Number(ultimos[0].numero_ticket) + 1;
      } else {
        const { count } = await supabase
          .from("tickets")
          .select("*", { count: "exact", head: true });
        proximoNumero = (count || 0) + 1;
      }
    } catch {
      proximoNumero = 1;
    }

    // Obtener sesión activa para enlazar automáticamente user_id si no vino en el payload
    let userId = payload.user_id;
    let usuarioCreador = payload.creado_por || "Equipo de Contenidos";
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        if (!userId) userId = authData.user.id;
        if (!payload.creado_por) {
          usuarioCreador =
            authData.user.user_metadata?.nombre ||
            authData.user.email?.split("@")[0] ||
            "Equipo de Contenidos";
        }
      }
    } catch {}

    // Intento 1: Guardar incluyendo el campo 'numero_ticket', 'user_id' y 'creado_por'
    let res = await supabase
      .from("tickets")
      .insert([
        {
          numero_ticket: proximoNumero,
          user_id: userId,
          titulo: payload.titulo,
          area_solicitante: payload.area_solicitante,
          brief: payload.brief,
          link_referencia: payload.links_referencia || payload.link_referencia,
          estado: "pendiente",
          eliminado: false,
          creado_por: usuarioCreador,
        },
      ])
      .select()
      .single();

    // Intento 2: Si falla por columnas adicionales no migradas aún, fallback con numero_ticket
    if (res.error) {
      res = await supabase
        .from("tickets")
        .insert([
          {
            numero_ticket: proximoNumero,
            titulo: payload.titulo,
            area_solicitante: payload.area_solicitante,
            brief: payload.brief,
            link_referencia:
              payload.links_referencia || payload.link_referencia,
            estado: "pendiente",
            eliminado: false,
          },
        ])
        .select()
        .single();
    }

    // Intento 3: Guardar campos mínimos base si la tabla en Supabase es básica
    if (res.error) {
      res = await supabase
        .from("tickets")
        .insert([
          {
            titulo: payload.titulo,
            area_solicitante: payload.area_solicitante,
            brief: payload.brief,
            link_referencia:
              payload.links_referencia || payload.link_referencia,
            estado: "pendiente",
          },
        ])
        .select()
        .single();
    }

    if (res.error || !res.data) {
      console.error("Error creando ticket:", res.error?.message);
      return null;
    }

    if (usuarioCreador && res.data?.id) {
      saveLocalCreator(res.data.id, usuarioCreador);
    }

    return formatTicket(
      { ...res.data, creado_por: usuarioCreador },
      proximoNumero,
    );
  },

  // 3. Editar el título de un pedido / ticket
  async updateTicketTitle(
    ticketId: string | number,
    nuevoTitulo: string,
    usuario: string = "Usuario",
  ): Promise<boolean> {
    const tituloLimpio = nuevoTitulo.trim();
    if (!tituloLimpio) return false;

    // Guardar inmediatamente en localStorage
    saveLocalCustomTitle(ticketId, tituloLimpio);

    try {
      let { error } = await supabase
        .from("tickets")
        .update({
          titulo: tituloLimpio,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (error) {
        const res2 = await supabase
          .from("tickets")
          .update({
            titulo: tituloLimpio,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticketId);
        if (!res2.error) error = null;
      }

      if (error) {
        await supabase
          .from("tickets")
          .update({
            titulo: tituloLimpio,
          })
          .eq("id", ticketId);
      }

      // Registrar en el historial de movimientos de forma segura
      await safeInsertMovement(
        ticketId,
        `Título actualizado a: "${tituloLimpio}"`,
        usuario,
      );
    } catch (e) {
      console.warn("Aviso al actualizar título en Supabase:", e);
    }

    return true;
  },

  // 3b. Editar el Brief y/o Link de Referencia de un ticket existente (Contenidos / Super Admin)
  async updateTicketBrief(
    ticketId: string | number,
    nuevoBrief: string,
    nuevoLinkReferencia?: string,
    usuario: string = "Usuario",
  ): Promise<boolean> {
    const briefLimpio = (nuevoBrief || "").trim();
    const linkLimpio = (nuevoLinkReferencia || "").trim();
    const fecha = new Date().toISOString();

    const payloadVariants: any[] = [
      {
        brief: briefLimpio,
        link_referencia: linkLimpio || null,
        links_referencia: linkLimpio || null,
        actualizado_en: fecha,
      },
      {
        brief: briefLimpio,
        link_referencia: linkLimpio || null,
        updated_at: fecha,
      },
      {
        brief: briefLimpio,
        link_referencia: linkLimpio || null,
      },
      {
        brief: briefLimpio,
      },
    ];

    for (const variant of payloadVariants) {
      try {
        const { error } = await supabase
          .from("tickets")
          .update(variant)
          .eq("id", ticketId);
        if (!error) break;
      } catch {}
    }

    await safeInsertMovement(
      ticketId,
      `Brief e insumos actualizados por ${usuario}`,
      usuario,
    );

    return true;
  },

  // 4. Mover a registro de eliminados (Soft Delete)
  async deleteTicket(
    ticketId: string | number,
    motivo: string = "Error en la carga de datos",
    usuario: string = "Usuario",
  ): Promise<boolean> {
    const fecha = new Date().toISOString();
    const motivoFinal =
      motivo && motivo.trim() ? motivo.trim() : "Error en la carga de datos";

    // 1. Guardar de inmediato en metadatos locales para garantizar persistencia y respuesta instantánea en UI
    saveLocalDeletedMetadata(ticketId, {
      eliminado: true,
      eliminado_en: fecha,
      motivo_eliminacion: motivoFinal,
      eliminado_por: usuario,
    });

    // 2. Intentar actualizar en Supabase con múltiples estrategias para adaptarse a cualquier esquema
    try {
      // Intento 1: Actualizar con todas las columnas de borrado suave
      let { error } = await supabase
        .from("tickets")
        .update({
          eliminado: true,
          eliminado_en: fecha,
          motivo_eliminacion: motivoFinal,
          eliminado_por: usuario,
          estado: "eliminado",
          actualizado_en: fecha,
        })
        .eq("id", ticketId);

      // Intento 2: Si falla por restricción de CHECK o ENUM en 'estado', intentar solo columnas booleanas sin tocar 'estado'
      if (error) {
        const res2 = await supabase
          .from("tickets")
          .update({
            eliminado: true,
            eliminado_en: fecha,
            motivo_eliminacion: motivoFinal,
            eliminado_por: usuario,
          })
          .eq("id", ticketId);
        if (!res2.error) {
          error = null;
        }
      }

      // Intento 3: Si la columna 'eliminado' no existe en la BD, probar marcar estado='eliminado'
      if (error) {
        const res3 = await supabase
          .from("tickets")
          .update({
            estado: "eliminado",
            actualizado_en: fecha,
          })
          .eq("id", ticketId);
        if (!res3.error) {
          error = null;
        }
      }

      // Intento 4: Si 'estado' solo admite valores predeterminados (como 'rechazado' en CHECK constraints)
      if (error) {
        const res4 = await supabase
          .from("tickets")
          .update({
            estado: "rechazado",
          })
          .eq("id", ticketId);
        if (!res4.error) {
          error = null;
        }
      }

      // Registrar en el historial de movimientos de forma segura
      await safeInsertMovement(
        ticketId,
        `Pedido enviado al Registro de Eliminados (Motivo: ${motivoFinal})`,
        usuario,
      );
    } catch (e) {
      console.warn(
        "Aviso al sincronizar eliminación con Supabase (mantenido localmente):",
        e,
      );
    }

    return true;
  },

  // 5. Restaurar ticket desde el registro de eliminados
  async restoreTicket(
    ticketId: string | number,
    usuario: string = "Usuario",
  ): Promise<boolean> {
    const fecha = new Date().toISOString();

    // 1. Quitar de metadatos locales de eliminados
    removeLocalDeletedMetadata(ticketId);

    try {
      // Intento 1: Restaurar todas las columnas
      let { error } = await supabase
        .from("tickets")
        .update({
          eliminado: false,
          motivo_eliminacion: null,
          eliminado_en: null,
          estado: "pendiente",
          actualizado_en: fecha,
        })
        .eq("id", ticketId);

      // Intento 2: Sin columnas adicionales si no existen
      if (error) {
        const res2 = await supabase
          .from("tickets")
          .update({
            estado: "pendiente",
            actualizado_en: fecha,
          })
          .eq("id", ticketId);
        if (!res2.error) {
          error = null;
        }
      }

      // Intento 3: Solo estado básico
      if (error) {
        await supabase
          .from("tickets")
          .update({
            estado: "pendiente",
          })
          .eq("id", ticketId);
      }

      // Registrar en el historial de movimientos de forma segura
      await safeInsertMovement(
        ticketId,
        "Ticket restaurado desde el Registro de Eliminados",
        usuario,
      );
    } catch (e) {
      console.warn(
        "Aviso al restaurar en Supabase (restaurado localmente):",
        e,
      );
    }

    return true;
  },

  // 6. Eliminación definitiva (Hard Delete para Super Admin)
  async hardDeleteTicket(ticketId: string | number): Promise<boolean> {
    // Limpiar de todos los registros y caches locales
    removeLocalDeletedMetadata(ticketId);
    try {
      const titles = getLocalCustomTitles();
      delete titles[String(ticketId)];
      localStorage.setItem("ticketing_custom_titles", JSON.stringify(titles));
    } catch {}

    try {
      await supabase.from("comentarios").delete().eq("ticket_id", ticketId);
      await supabase.from("tickets").delete().eq("id", ticketId);
    } catch (err) {
      console.warn("Aviso al eliminar definitivamente en Supabase:", err);
    }

    return true;
  },

  // 6b. Purgar todo el registro de eliminados para siempre (Super Admin)
  async emptyEliminatedTickets(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Intento 1: Llamar RPC si está configurado en Supabase
      const { data: rpcData, error: rpcError } = await supabase.rpc("vaciar_registro_eliminados");
      if (!rpcError && rpcData?.success) {
        localStorage.removeItem("ticketing_deleted_metadata");
        return { success: true, count: rpcData.count || 0 };
      }
    } catch {}

    // Intento 2: Eliminación directa en tablas
    try {
      // 1. Obtener los IDs de tickets eliminados
      const { data: ticketsElim } = await supabase
        .from("tickets")
        .select("id")
        .or("eliminado.eq.true,estado.eq.eliminado");

      const ids = (ticketsElim || []).map((t) => t.id);

      if (ids.length > 0) {
        // Eliminar comentarios asociados
        await supabase.from("comentarios").delete().in("ticket_id", ids);
        // Eliminar tickets
        await supabase.from("tickets").delete().in("id", ids);
      }

      // Eliminar también por condición directa
      await supabase.from("tickets").delete().eq("eliminado", true);
      await supabase.from("tickets").delete().eq("estado", "eliminado");

      // Limpiar metadatos locales
      localStorage.removeItem("ticketing_deleted_metadata");

      return { success: true, count: ids.length };
    } catch (err: any) {
      console.warn("Aviso purgando registro de eliminados en Supabase:", err);
      localStorage.removeItem("ticketing_deleted_metadata");
      return { success: true, count: 0 };
    }
  },

  // 7. Cambiar el estado de un ticket con compatibilidad multi-esquema y registro de auditoría
  async updateTicketStatus(
    ticketId: string | number,
    nuevoEstado: string,
    usuarioNombre?: string,
  ): Promise<boolean> {
    saveLocalTicketStatus(ticketId, nuevoEstado);

    const variants = [
      { estado: nuevoEstado, actualizado_en: new Date().toISOString() },
      { estado: nuevoEstado, updated_at: new Date().toISOString() },
      { estado: nuevoEstado },
    ];

    let exito = false;
    for (const variant of variants) {
      try {
        const { error } = await supabase
          .from("tickets")
          .update(variant)
          .eq("id", ticketId);
        if (!error) {
          exito = true;
          break;
        }
      } catch {}
    }

    if (!exito) {
      console.warn(
        "Aviso actualizando estado en Supabase (guardado localmente):",
        nuevoEstado,
      );
    }

    // Registrar en el historial de movimientos de forma segura
    await safeInsertMovement(
      ticketId,
      `Estado cambiado a: ${nuevoEstado}`,
      usuarioNombre || "Usuario",
    );

    return true;
  },

  // 8. Agregar o actualizar el enlace de entrega (Drive) y cambiar a revisión automáticamente
  async updateDeliveryLink(
    ticketId: string | number,
    link: string,
    cambiarARevision: boolean = true,
  ): Promise<boolean> {
    saveLocalDeliveryLink(ticketId, link);
    if (cambiarARevision) {
      saveLocalTicketStatus(ticketId, "en_revision");
    }

    const payloadVariants: any[] = [];
    if (cambiarARevision) {
      payloadVariants.push({
        link_entrega: link,
        links_entrega: link,
        estado: "en_revision",
        actualizado_en: new Date().toISOString(),
      });
      payloadVariants.push({
        link_entrega: link,
        links_entrega: link,
        estado: "en_revision",
        updated_at: new Date().toISOString(),
      });
      payloadVariants.push({ link_entrega: link, estado: "en_revision" });
      payloadVariants.push({ links_entrega: link, estado: "en_revision" });
    }
    payloadVariants.push({
      link_entrega: link,
      actualizado_en: new Date().toISOString(),
    });
    payloadVariants.push({
      link_entrega: link,
      updated_at: new Date().toISOString(),
    });
    payloadVariants.push({
      links_entrega: link,
      actualizado_en: new Date().toISOString(),
    });
    payloadVariants.push({
      links_entrega: link,
      updated_at: new Date().toISOString(),
    });
    payloadVariants.push({ link_entrega: link });
    payloadVariants.push({ links_entrega: link });

    let exito = false;
    for (const variant of payloadVariants) {
      try {
        const { error } = await supabase
          .from("tickets")
          .update(variant)
          .eq("id", ticketId);
        if (!error) {
          exito = true;
          break;
        }
      } catch {}
    }

    if (!exito) {
      console.warn(
        "Aviso actualizando link de entrega en Supabase (guardado localmente):",
        link,
      );
    }

    return true;
  },

  // 8b. Asignar o desasignar un diseñador responsable al ticket y mover a 'en_proceso' si estaba en 'pendiente'
  async assignTicket(
    ticketId: string | number,
    asignadoA: string,
    usuarioNombre?: string,
    cambiarAEnProceso: boolean = true,
  ): Promise<boolean> {
    const nombreLimpio = (asignadoA || "").trim();

    if (!nombreLimpio) {
      // Desasignar diseñador
      try {
        const current = getLocalAssignedDesigners();
        delete current[String(ticketId)];
        localStorage.setItem(
          "ticketing_assigned_designers",
          JSON.stringify(current),
        );
      } catch {}

      const unassignVariants: any[] = [
        {
          asignado_a: null,
          asignado_nombre: null,
          actualizado_en: new Date().toISOString(),
        },
        {
          asignado_a: null,
          updated_at: new Date().toISOString(),
        },
        { asignado_a: null },
      ];

      for (const variant of unassignVariants) {
        try {
          const { error } = await supabase
            .from("tickets")
            .update(variant)
            .eq("id", ticketId);
          if (!error) break;
        } catch {}
      }

      await safeInsertMovement(
        ticketId,
        `Ticket dejado sin asignar`,
        usuarioNombre || "Diseño",
      );
      return true;
    }

    saveLocalAssignedDesigner(ticketId, nombreLimpio);
    if (cambiarAEnProceso) {
      saveLocalTicketStatus(ticketId, "en_proceso");
    }

    const payloadVariants: any[] = [];
    if (cambiarAEnProceso) {
      payloadVariants.push({
        asignado_a: nombreLimpio,
        asignado_nombre: nombreLimpio,
        estado: "en_proceso",
        actualizado_en: new Date().toISOString(),
      });
      payloadVariants.push({
        asignado_a: nombreLimpio,
        asignado_nombre: nombreLimpio,
        estado: "en_proceso",
        updated_at: new Date().toISOString(),
      });
      payloadVariants.push({ asignado_a: nombreLimpio, estado: "en_proceso" });
      payloadVariants.push({ asignado_a: nombreLimpio, estado: "En Proceso" });
    }
    payloadVariants.push({
      asignado_a: nombreLimpio,
      asignado_nombre: nombreLimpio,
      actualizado_en: new Date().toISOString(),
    });
    payloadVariants.push({
      asignado_a: nombreLimpio,
      updated_at: new Date().toISOString(),
    });
    payloadVariants.push({ asignado_a: nombreLimpio });

    for (const variant of payloadVariants) {
      try {
        const { error } = await supabase
          .from("tickets")
          .update(variant)
          .eq("id", ticketId);
        if (!error) break;
      } catch {}
    }

    // Registrar en el historial de movimientos de forma segura
    await safeInsertMovement(
      ticketId,
      `Ticket asignado a: ${nombreLimpio}${cambiarAEnProceso ? " (Pasa a En Proceso)" : ""}`,
      usuarioNombre || "Diseño",
    );

    return true;
  },

  // 8c. Obtener todos los miembros del equipo (Contenidos y Gráfica)
  async fetchTeamMembers(): Promise<Profile[]> {
    let list: Profile[] = [];
    try {
      // 1. Intentar desde tabla 'perfiles'
      const resPerfiles = await supabase.from("perfiles").select("*");
      if (!resPerfiles.error && resPerfiles.data && resPerfiles.data.length > 0) {
        list = resPerfiles.data as Profile[];
      }
    } catch {}

    // 2. Si no hubo resultados o dio error, intentar con 'profiles'
    if (list.length === 0) {
      try {
        const resProfiles = await supabase.from("profiles").select("*");
        if (!resProfiles.error && resProfiles.data && resProfiles.data.length > 0) {
          list = resProfiles.data as Profile[];
        }
      } catch {}
    }

    // 3. Combinar con miembros guardados localmente
    const localMembers = getLocalTeamMembers();
    for (const lm of localMembers) {
      if (!list.some((p) => p.email.toLowerCase() === lm.email.toLowerCase())) {
        list.push(lm);
      }
    }

    // 4. Si la lista sigue vacía, devolver los predeterminados de la plataforma
    if (list.length === 0) {
      list = [
        {
          id: "des-1",
          email: "nacho@empresa.com",
          nombre: "Nacho",
          rol: "superadmin",
          area: "Todas",
          color: "blue",
        },
        {
          id: "des-2",
          email: "lucia@empresa.com",
          nombre: "Lucía",
          rol: "operador",
          area: "Gráfica",
          color: "purple",
        },
        {
          id: "des-3",
          email: "coni@empresa.com",
          nombre: "Coni",
          rol: "solicitante",
          area: "Contenidos",
          color: "emerald",
        },
      ];
    }

    return list;
  },

  // Obtener lista de diseñadores y miembros del equipo para el selector de asignación (Solo Diseño)
  async fetchDesigners(): Promise<Profile[]> {
    const all = await this.fetchTeamMembers();
    const soloDiseno = all.filter((p) => {
      const area = (p.area || "").toLowerCase();
      const rol = (p.rol || "").toLowerCase();
      const nombre = (p.nombre || "").toLowerCase();
      return (
        area.includes("gr") ||
        area.includes("dise") ||
        rol.includes("graf") ||
        rol.includes("dise") ||
        nombre.includes("dise") ||
        area === "todas" ||
        rol === "superadmin"
      );
    });

    return soloDiseno.length > 0 ? soloDiseno : all;
  },

  // Crear nuevo usuario (Contenidos o Gráfica) por el Superadmin
  async createTeamMember(payload: {
    nombre: string;
    email: string;
    password?: string;
    rol: "superadmin" | "operador" | "solicitante";
    area: UserArea;
    color?: string;
  }): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const emailLimpio = payload.email.trim().toLowerCase();
    const nombreLimpio = payload.nombre.trim();
    const colorFinal = payload.color || "blue";
    const password = payload.password || "Woof1234!";

    let userId = "";

    // MÉTODO 1 (Recomendado): Intentar dar de alta directamente mediante la función RPC 'crear_usuario_equipo'
    // Esta función inserta el usuario en auth.users con email_confirmed_at = now() y en public.perfiles
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("crear_usuario_equipo", {
        p_email: emailLimpio,
        p_password: password,
        p_nombre: nombreLimpio,
        p_rol: payload.rol,
        p_area: payload.area,
        p_color: colorFinal,
      });

      if (!rpcError && rpcData) {
        if (rpcData.success) {
          const profile: Profile = {
            id: rpcData.user_id,
            email: emailLimpio,
            nombre: nombreLimpio,
            rol: payload.rol,
            area: payload.area,
            color: colorFinal,
            created_at: new Date().toISOString(),
          };

          saveLocalTeamMember(profile);
          saveLocalUserColor(nombreLimpio, colorFinal);
          saveLocalUserColor(emailLimpio, colorFinal);
          saveLocalUserColor(profile.id, colorFinal);

          return { success: true, profile };
        } else if (rpcData.error) {
          return { success: false, error: rpcData.error };
        }
      }
    } catch (e: any) {
      console.warn("RPC crear_usuario_equipo no disponible, usando fallback Auth signUp:", e);
    }

    // MÉTODO 2 (Fallback estándar): Crear usuario en Supabase Auth mediante cliente secundario (sin cerrar sesión del admin)
    try {
      const tempAuthClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
        email: emailLimpio,
        password: password,
        options: {
          data: {
            nombre: nombreLimpio,
            rol: payload.rol,
            area: payload.area,
            color: colorFinal,
          },
        },
      });

      if (authError) {
        console.error("Error Auth signUp en Supabase:", authError.message);
        const msg = authError.message || "";
        if (msg.toLowerCase().includes("signups not allowed")) {
          return {
            success: false,
            error: "Los registros están bloqueados en tu Supabase. Ve a Authentication -> Providers -> Email y activa 'Allow new users to sign up' (o corre el script SQL de creación en Supabase).",
          };
        }
        return { 
          success: false, 
          error: `Error de Supabase Auth: ${authError.message}. Recuerda desactivar 'Confirm email' en Authentication -> Providers -> Email en Supabase.` 
        };
      }

      if (authData?.user?.id) {
        userId = authData.user.id;
      }
    } catch (e: any) {
      console.error("Excepción al crear usuario en Supabase Auth:", e);
      return { success: false, error: e?.message || "Error al conectar con Supabase Auth." };
    }

    if (!userId) {
      return { success: false, error: "No se pudo generar el usuario en Supabase Auth." };
    }

    const newProfile: Profile = {
      id: userId,
      email: emailLimpio,
      nombre: nombreLimpio,
      rol: payload.rol,
      area: payload.area,
      color: colorFinal,
      created_at: new Date().toISOString(),
    };

    // 2. Insertar en tabla 'perfiles' de Supabase
    try {
      const { error: pErr } = await supabase.from("perfiles").upsert([newProfile]);
      if (pErr) console.warn("Aviso insert perfiles:", pErr.message);
    } catch {}
    try {
      await supabase.from("profiles").upsert([newProfile]);
    } catch {}

    // 3. Sincronizar persistencia local
    saveLocalTeamMember(newProfile);
    saveLocalUserColor(nombreLimpio, colorFinal);
    saveLocalUserColor(emailLimpio, colorFinal);
    saveLocalUserColor(userId, colorFinal);

    return { success: true, profile: newProfile };
  },

  // Cambiar el color de etiqueta de un usuario
  async updateUserColor(
    identifier: string,
    colorId: string,
    nombre?: string
  ): Promise<boolean> {
    saveLocalUserColor(identifier, colorId);
    if (nombre) {
      saveLocalUserColor(nombre, colorId);
    }

    // Actualizar en localStorage
    const localMembers = getLocalTeamMembers();
    const updatedMembers = localMembers.map((m) => {
      if (
        m.id === identifier ||
        m.email.toLowerCase() === identifier.toLowerCase() ||
        (nombre && m.nombre.toLowerCase() === nombre.toLowerCase())
      ) {
        return { ...m, color: colorId };
      }
      return m;
    });
    localStorage.setItem("woof_team_members", JSON.stringify(updatedMembers));

    // Intentar actualizar en Supabase
    try {
      await supabase
        .from("perfiles")
        .update({ color: colorId })
        .or(`id.eq.${identifier},email.eq.${identifier}`);
    } catch {}
    try {
      await supabase
        .from("profiles")
        .update({ color: colorId })
        .or(`id.eq.${identifier},email.eq.${identifier}`);
    } catch {}

    return true;
  },

  // Modificar usuario del equipo: nombre, sector/área y permisos/rol (Super Admin)
  async updateTeamMember(
    userId: string,
    data: {
      nombre: string;
      area: UserArea;
      rol: "superadmin" | "operador" | "solicitante";
      color?: string;
    },
  ): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const nomLimpio = data.nombre.trim();
    const colorLimpio = data.color || undefined;

    // 1. Intentar por RPC en Supabase
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "modificar_usuario_equipo",
        {
          p_user_id: userId,
          p_nombre: nomLimpio,
          p_area: data.area,
          p_rol: data.rol,
          p_color: colorLimpio || null,
        },
      );
      if (!rpcError && rpcData?.success) {
        // Exitoso por RPC
      }
    } catch (e) {
      console.warn("RPC modificar_usuario_equipo no disponible, usando fallback:", e);
    }

    // 2. Actualizar en perfiles / profiles
    const updatePayload: any = {
      nombre: nomLimpio,
      area: data.area,
      rol: data.rol,
    };
    if (colorLimpio) updatePayload.color = colorLimpio;

    try {
      await supabase.from("perfiles").update(updatePayload).eq("id", userId);
    } catch {}
    try {
      await supabase.from("profiles").update(updatePayload).eq("id", userId);
    } catch {}

    // 3. Actualizar en localStorage
    let updatedProfile: Profile | undefined;
    try {
      const members = getLocalTeamMembers();
      const idx = members.findIndex((m) => m.id === userId);
      if (idx >= 0) {
        members[idx] = {
          ...members[idx],
          nombre: nomLimpio,
          area: data.area,
          rol: data.rol,
          ...(colorLimpio ? { color: colorLimpio } : {}),
        };
        updatedProfile = members[idx];
        localStorage.setItem("woof_team_members", JSON.stringify(members));
      }
    } catch {}

    if (colorLimpio) {
      saveLocalUserColor(nomLimpio, colorLimpio);
      saveLocalUserColor(userId, colorLimpio);
    }

    return { success: true, profile: updatedProfile };
  },

  // Borrar usuario del equipo y su acceso (Super Admin)
  async deleteTeamMember(
    userId: string,
    email?: string,
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Intentar por RPC en Supabase
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "borrar_usuario_equipo",
        { p_user_id: userId },
      );
      if (!rpcError && rpcData?.success) {
        // Exitoso por RPC
      }
    } catch (e) {
      console.warn("RPC borrar_usuario_equipo no disponible, usando fallback:", e);
    }

    // 2. Borrar de tablas perfiles / profiles
    try {
      await supabase.from("perfiles").delete().eq("id", userId);
      if (email) {
        await supabase.from("perfiles").delete().eq("email", email.toLowerCase());
      }
    } catch {}
    try {
      await supabase.from("profiles").delete().eq("id", userId);
      if (email) {
        await supabase.from("profiles").delete().eq("email", email.toLowerCase());
      }
    } catch {}

    // 3. Limpiar de localStorage
    try {
      const members = getLocalTeamMembers().filter(
        (m) =>
          m.id !== userId &&
          (!email || m.email.toLowerCase() !== email.toLowerCase()),
      );
      localStorage.setItem("woof_team_members", JSON.stringify(members));
    } catch {}

    return { success: true };
  },

  // 8d. Solicitar Ajustes (Cambia el estado a 'correcciones' en Naranja y notifica a Diseño)
  async requestCorrections(
    ticketId: string | number,
    detalleAjustes: string,
    usuarioNombre?: string,
    usuarioRol: UserRole = "CONTENIDOS",
  ): Promise<boolean> {
    const estado = "correcciones";
    await this.updateTicketStatus(ticketId, estado, usuarioNombre);

    // Registrar comentario destacado de ajustes
    await this.addComment(
      ticketId,
      `🟠 **Ajustes Solicitados:** ${detalleAjustes}`,
      usuarioNombre || "Contenidos",
      undefined,
      usuarioRol,
    );

    // Registrar en auditoría de movimientos de forma segura
    await safeInsertMovement(
      ticketId,
      `Se solicitaron ajustes: ${detalleAjustes}`,
      usuarioNombre || "Contenidos",
    );

    return true;
  },

  // 8e. Aprobar Entrega (Cambia el estado a 'resuelto' en Verde)
  async approveTicket(
    ticketId: string | number,
    usuarioNombre?: string,
    usuarioRol: UserRole = "CONTENIDOS",
  ): Promise<boolean> {
    const estado = "resuelto";
    await this.updateTicketStatus(ticketId, estado, usuarioNombre);

    // Registrar comentario de aprobación
    await this.addComment(
      ticketId,
      `🎉 **¡Entrega aprobada!** El material final ha sido revisado y aprobado satisfactoriamente.`,
      usuarioNombre || "Contenidos",
      undefined,
      usuarioRol,
    );

    // Registrar en auditoría de movimientos de forma segura
    await safeInsertMovement(
      ticketId,
      "Entrega aprobada por el solicitante (Resuelto)",
      usuarioNombre || "Contenidos",
    );

    return true;
  },

  // 9. Cargar comentarios de un ticket identificando autor y rol
  async fetchComments(ticketId: string | number): Promise<Comentario[]> {
    let res = await supabase
      .from("comentarios")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("creado_en", { ascending: true });

    if (res.error) {
      res = await supabase
        .from("comentarios")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
    }

    if (res.error) {
      res = await supabase
        .from("comentarios")
        .select("*")
        .eq("ticket_id", ticketId);
    }

    if (res.error) {
      console.error(
        "Error cargando comentarios de Supabase:",
        res.error.message,
      );
      return [];
    }

    return (res.data || []).map(formatComment);
  },

  // 10. Agregar un nuevo comentario guardando explícitamente el rol y nombre
  async addComment(
    ticketId: string | number,
    contenido: string,
    usuario: string = "Contenidos",
    linkAdjunto?: string,
    rolParam?: UserRole,
  ): Promise<Comentario | null> {
    if (!contenido && !linkAdjunto) return null;

    let rol: UserRole = rolParam || "CONTENIDOS";
    if (!rolParam) {
      if (usuario.toUpperCase().includes("ADMIN")) rol = "SUPER_ADMIN";
      else if (
        usuario.toUpperCase().includes("GRAF") ||
        usuario.toUpperCase().includes("DISE")
      )
        rol = "GRAFICA";
      else rol = "CONTENIDOS";
    }

    const usuarioLimpio = (usuario || "").trim();
    const esGenerico =
      !usuarioLimpio ||
      usuarioLimpio === "Contenidos" ||
      usuarioLimpio === "Grafica" ||
      usuarioLimpio === "GRAFICA";

    const nombreLegible = !esGenerico
      ? usuarioLimpio
      : rol === "SUPER_ADMIN"
        ? "Super Administrador"
        : rol === "GRAFICA"
          ? "Equipo de Gráfica"
          : "Equipo de Contenidos";

    // Incorporar el link al texto si existe
    let textoBase = contenido.trim();
    if (linkAdjunto && !textoBase.includes(linkAdjunto)) {
      textoBase = textoBase
        ? `${textoBase}\n\n🔗 Enlace de Drive: ${linkAdjunto}`
        : `🔗 Enlace de Drive: ${linkAdjunto}`;
    }

    // Incrustamos marca invisible <!--rol:ROL--> para garantizar autoría permanente
    const textoConMarca = `<!--rol:${rol}-->${textoBase}`;

    const payloads = [
      // 1. Esquema estándar confirmado de la base de datos (ticket_id, mensaje, usuario)
      {
        ticket_id: ticketId,
        mensaje: textoConMarca,
        usuario: nombreLegible,
      },
      // 2. Esquema alternativo con nombre 'contenido'
      {
        ticket_id: ticketId,
        contenido: textoConMarca,
        usuario: nombreLegible,
      },
      // 3. Esquema mínimo solo con mensaje
      {
        ticket_id: ticketId,
        mensaje: textoConMarca,
      },
      // 4. Esquema extendido si existieran columnas adicionales
      {
        ticket_id: ticketId,
        mensaje: textoConMarca,
        usuario: nombreLegible,
        autor_rol: rol,
        link_adjunto: linkAdjunto || null,
      },
    ];

    let ultimoError: any = null;

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from("comentarios")
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        return formatComment(data);
      }

      ultimoError = error;
    }

    console.error(
      "Error al guardar comentario en Supabase:",
      ultimoError?.message || ultimoError,
    );
    return null;
  },

  // 11. Cargar historial de movimientos (integrado en el feed único de comentarios)
  async fetchMovements(
    _ticketId: string | number,
  ): Promise<HistorialMovimiento[]> {
    return [];
  },

  // Alias retrocompatibles
  async getComments(ticketId: string | number): Promise<Comentario[]> {
    return this.fetchComments(ticketId);
  },
  async getDesigners(): Promise<Profile[]> {
    return this.fetchDesigners();
  },
  async getMovements(ticketId: string | number): Promise<HistorialMovimiento[]> {
    return this.fetchMovements(ticketId);
  },
};
