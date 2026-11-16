// src/components/KanbanBoard.tsx
import React, { useState } from "react";
import { Ticket, UserRole, Profile } from "../types";
import { UserTagBadge } from "./UserTagBadge";
import {
  FolderCheck,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  MoreVertical,
  Plus,
} from "lucide-react";

interface KanbanBoardProps {
  tickets: Ticket[];
  currentRole: UserRole;
  userProfile?: Profile | null;
  unreadTicketIds?: (string | number)[];
  onSelectTicket: (ticket: Ticket) => void;
  onUpdateTicketStatus: (ticketId: string | number, newStatus: string) => void;
  onTakeTicket?: (ticketId: string | number) => void;
  checkTieneNovedad: (ticket: Ticket) => boolean;
  getNovedadBadge: (
    ticket: Ticket,
  ) => { label: string; classes: string } | null;
}

interface ColumnDef {
  id: string;
  label: string;
  colorBorder: string;
  colorDot: string;
  bgHeader: string;
  icon: React.ReactNode;
  emptyText: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "pendiente",
    label: "Pendiente",
    colorBorder: "border-amber-200 dark:border-amber-900/50",
    colorDot: "bg-amber-400",
    bgHeader:
      "bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200",
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    emptyText: "No hay pedidos pendientes",
  },
  {
    id: "en_proceso",
    label: "En Proceso",
    colorBorder: "border-blue-200 dark:border-blue-900/50",
    colorDot: "bg-blue-500",
    bgHeader:
      "bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200",
    icon: <Sparkles className="w-3.5 h-3.5 text-blue-500" />,
    emptyText: "No hay pedidos en proceso",
  },
  {
    id: "correcciones",
    label: "Correcciones",
    colorBorder: "border-orange-200 dark:border-orange-900/50",
    colorDot: "bg-orange-500",
    bgHeader:
      "bg-orange-50/70 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200",
    icon: <AlertCircle className="w-3.5 h-3.5 text-orange-500" />,
    emptyText: "Sin pedidos con ajustes",
  },
  {
    id: "en_revision",
    label: "En Revisión",
    colorBorder: "border-purple-200 dark:border-purple-900/50",
    colorDot: "bg-purple-500",
    bgHeader:
      "bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200",
    icon: <FolderCheck className="w-3.5 h-3.5 text-purple-500" />,
    emptyText: "Sin pedidos para revisión",
  },
  {
    id: "resuelto",
    label: "Resuelto",
    colorBorder: "border-emerald-200 dark:border-emerald-900/50",
    colorDot: "bg-emerald-500",
    bgHeader:
      "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    emptyText: "Sin pedidos resueltos",
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tickets,
  currentRole,
  userProfile,
  unreadTicketIds = [],
  onSelectTicket,
  onUpdateTicketStatus,
  onTakeTicket,
  checkTieneNovedad,
  getNovedadBadge,
}) => {
  const [draggedTicketId, setDraggedTicketId] = useState<
    string | number | null
  >(null);
  const [activeDropColumn, setActiveDropColumn] = useState<string | null>(null);
  const [openMenuTicketId, setOpenMenuTicketId] = useState<
    string | number | null
  >(null);

  // Normalizar el estado del ticket para asignarlo a una de las 5 columnas
  const getTicketColumn = (t: Ticket): string => {
    const est = (t.estado || "").toLowerCase();
    if (est.includes("correc") || est.includes("ajust")) return "correcciones";
    if (est.includes("revis")) return "en_revision";
    if (est.includes("resuelto") || est.includes("aprob")) return "resuelto";
    if (est.includes("proceso")) return "en_proceso";
    return "pendiente";
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string | number) => {
    setDraggedTicketId(ticketId);
    e.dataTransfer.setData("text/plain", String(ticketId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeDropColumn !== colId) {
      setActiveDropColumn(colId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, colId: string) => {
    if (activeDropColumn === colId) {
      setActiveDropColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const ticketId = e.dataTransfer.getData("text/plain") || draggedTicketId;
    if (!ticketId) return;

    const ticket = tickets.find((t) => String(t.id) === String(ticketId));
    if (!ticket) return;

    const currentCol = getTicketColumn(ticket);
    if (currentCol !== targetColId) {
      onUpdateTicketStatus(ticket.id, targetColId);
    }
    setDraggedTicketId(null);
  };

  const handleDragEnd = () => {
    setDraggedTicketId(null);
    setActiveDropColumn(null);
  };

  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return "";
    try {
      const d = new Date(fechaStr);
      return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    } catch {
      return fechaStr;
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-6 pt-1 select-none">
      <div className="flex gap-4 min-w-[1050px]">
        {COLUMNS.map((col) => {
          const colTickets = tickets.filter(
            (t) => getTicketColumn(t) === col.id,
          );
          const isDropTarget = activeDropColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 flex flex-col min-w-[260px] max-w-[320px] rounded-xl border bg-neutral-50/50 dark:bg-[#1a1a1a]/60 transition-colors ${
                isDropTarget
                  ? "border-neutral-900 dark:border-neutral-200 bg-neutral-100/80 dark:bg-neutral-800/60 ring-2 ring-neutral-400/20"
                  : "border-neutral-200/80 dark:border-neutral-800"
              }`}
            >
              {/* Cabecera de Columna */}
              <div className="p-3 border-b border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${col.colorDot}`} />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {col.label}
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                  {colTickets.length}
                </span>
              </div>

              {/* Lista de Tarjetas en la Columna */}
              <div className="p-2.5 flex-1 space-y-2.5 min-h-[420px] overflow-y-auto max-h-[70vh]">
                {colTickets.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-neutral-200 dark:border-neutral-800/80 rounded-lg text-neutral-400 dark:text-neutral-600 text-xs">
                    <span>{col.emptyText}</span>
                    <span className="text-[10px] mt-1 text-neutral-400/70">
                      Arrastra una tarjeta aquí
                    </span>
                  </div>
                ) : (
                  colTickets.map((ticket) => {
                    const tieneNovedad = checkTieneNovedad(ticket);
                    const novedadBadge = tieneNovedad
                      ? getNovedadBadge(ticket)
                      : null;
                    const asignado =
                      ticket.asignado_a || ticket.asignado_nombre;
                    const isDragging =
                      String(draggedTicketId) === String(ticket.id);
                    const menuAbierto = openMenuTicketId === ticket.id;

                    const numStr =
                      ticket.ticket_number ||
                      (ticket.numero_ticket
                        ? `#${String(ticket.numero_ticket).padStart(3, "0")}`
                        : "#001");

                    return (
                      <div
                        key={ticket.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ticket.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectTicket(ticket)}
                        className={`group relative p-3.5 bg-white dark:bg-[#202020] rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-md hover:border-neutral-400 dark:hover:border-neutral-600 ${
                          isDragging ? "opacity-40 scale-98 border-dashed" : ""
                        } ${
                          tieneNovedad
                            ? "border-rose-300 dark:border-rose-800/70 bg-gradient-to-b from-rose-50/20 to-transparent dark:from-rose-950/15"
                            : "border-neutral-200/90 dark:border-neutral-800"
                        }`}
                      >
                        {/* Fila Superior: #Ticket, Área y Novedad */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {tieneNovedad && (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                              </span>
                            )}
                            <span className="font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                              {numStr}
                            </span>
                            {novedadBadge && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold leading-none ${novedadBadge.classes}`}
                              >
                                {novedadBadge.label}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 overflow-hidden">
                            {ticket.area_solicitante && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium truncate max-w-[85px]">
                                {ticket.area_solicitante}
                              </span>
                            )}
                            {ticket.creado_por && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium truncate max-w-[95px] border border-blue-200/60 dark:border-blue-900/40"
                                title={`Pedido creado por: ${ticket.creado_por}`}
                              >
                                👤 {ticket.creado_por}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Título del Ticket */}
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug group-hover:underline mb-1.5">
                          {ticket.titulo}
                        </h4>

                        {/* Extracto del Brief */}
                        {ticket.brief && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed mb-3">
                            {ticket.brief.replace(/<[^>]*>/g, "")}
                          </p>
                        )}

                        {/* Enlace directo a Google Drive si ya fue entregado */}
                        {ticket.link_entrega && (
                          <div className="mb-3">
                            <a
                              href={ticket.link_entrega}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center space-x-1.5 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800 transition shadow-2xs"
                              title="Abrir carpeta o archivo en Google Drive"
                            >
                              <FolderCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Entrega Drive</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          </div>
                        )}

                        {/* Fila Inferior: Diseñador Asignado, Fecha y Acciones Rápidas */}
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-neutral-500 dark:text-neutral-400">
                          {/* Diseñador */}
                          <div className="flex items-center space-x-1.5 truncate max-w-[140px]">
                            {asignado ? (
                              <UserTagBadge name={asignado} size="xs" />
                            ) : (
                              <span className="italic text-neutral-400 dark:text-neutral-500 text-[10px]">
                                Sin asignar
                              </span>
                            )}
                          </div>

                          {/* Fecha */}
                          <span className="text-[10px] font-mono shrink-0 ml-1">
                            {formatearFecha(
                              ticket.creado_en || ticket.created_at,
                            )}
                          </span>
                        </div>

                        {/* Botón rápido para tomar pedido si está en Pendiente y el usuario es Gráfica */}
                        {col.id === "pendiente" &&
                          (currentRole === "GRAFICA" ||
                            currentRole === "SUPER_ADMIN") && (
                            <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-100 dark:border-neutral-800/80 flex items-center justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onTakeTicket) {
                                    onTakeTicket(ticket.id);
                                  } else {
                                    onUpdateTicketStatus(
                                      ticket.id,
                                      "en_proceso",
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold text-[10px] rounded-lg transition shadow-2xs hover:shadow flex items-center space-x-1 cursor-pointer"
                                title="Comenzar a trabajar en este pedido (Pasa a En Proceso)"
                              >
                                <span>⚡ Tomar pedido</span>
                              </button>
                            </div>
                          )}

                        {/* Menú de cambio rápido de columna (móvil o sin arrastre) */}
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTicketId(
                                menuAbierto ? null : ticket.id,
                              );
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Mover a otra columna"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {menuAbierto && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                Mover a:
                              </div>
                              {COLUMNS.filter((c) => c.id !== col.id).map(
                                (targetCol) => (
                                  <button
                                    key={targetCol.id}
                                    onClick={() => {
                                      onUpdateTicketStatus(
                                        ticket.id,
                                        targetCol.id,
                                      );
                                      setOpenMenuTicketId(null);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-1.5 transition"
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${targetCol.colorDot}`}
                                    />
                                    <span>{targetCol.label}</span>
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
