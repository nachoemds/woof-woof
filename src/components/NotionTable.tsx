// src/components/NotionTable.tsx
import React, { useState, useMemo, useCallback } from "react";
import { Ticket, UserRole, Profile } from "../types";
import { ticketsService } from "../lib/supabase";
import { KanbanBoard } from "./KanbanBoard";
import { UserTagBadge } from "./UserTagBadge";
import {
  Plus,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FolderCheck,
  LayoutGrid,
  List,
  UserCheck,
  User,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";

export type SortField = "novedades" | "fecha_desc" | "fecha_asc" | "prioridad" | "titulo";

interface NotionTableProps {
  tickets: Ticket[];
  currentRole: UserRole;
  userProfile?: Profile | null;
  unreadTicketIds?: (string | number)[];
  onOpenNewTicketModal: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  onDeleteTicket?: (ticketId: string | number, motivo: string) => void;
  onRestoreTicket?: (ticketId: string | number) => void;
  onHardDeleteTicket?: (ticketId: string | number) => void;
  onEmptyTrash?: () => void;
  onUpdateTicketStatus?: (ticketId: string | number, newStatus: string) => void;
  onTakeTicket?: (ticketId: string | number) => void;
}

export const NotionTable: React.FC<NotionTableProps> = ({
  tickets,
  currentRole,
  userProfile,
  unreadTicketIds = [],
  onOpenNewTicketModal,
  onSelectTicket,
  onDeleteTicket,
  onRestoreTicket,
  onHardDeleteTicket,
  onEmptyTrash,
  onUpdateTicketStatus,
  onTakeTicket,
}) => {
  const [currentView, setCurrentView] = useState<"activos" | "eliminados">("activos");
  const [viewMode, setViewMode] = useState<"tabla" | "kanban">("tabla");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");
  const [filterArea, setFilterArea] = useState<string>("TODAS");
  const [filterDisenador, setFilterDisenador] = useState<string>("TODOS");
  const [soloMisPedidos, setSoloMisPedidos] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortField>("novedades");

  // Estado para modal rápido de eliminación (Soft delete) desde la tabla
  const [ticketAEliminar, setTicketAEliminar] = useState<Ticket | null>(null);
  const [motivoEliminar, setMotivoEliminar] = useState<string>("Error en la carga de datos");
  const [eliminandoTicket, setEliminandoTicket] = useState(false);

  // Estados para Eliminación Definitiva (Purgar para siempre Super Admin)
  const [ticketAPurgar, setTicketAPurgar] = useState<Ticket | null>(null);
  const [purgandoIndividual, setPurgandoIndividual] = useState(false);
  const [mostrarModalVaciarPapelera, setMostrarModalVaciarPapelera] = useState(false);
  const [vaciandoPapelera, setVaciandoPapelera] = useState(false);

  // Separación limpia entre tickets activos y registro de eliminados
  const ticketsActivos = useMemo(() => {
    return tickets.filter((t) => !t.eliminado && (t.estado || "").toLowerCase() !== "eliminado");
  }, [tickets]);

  const ticketsEliminados = useMemo(() => {
    return tickets.filter((t) => Boolean(t.eliminado || (t.estado || "").toLowerCase() === "eliminado"));
  }, [tickets]);

  // Comprueba si un ticket representa una NOVEDAD activa según estado de lectura
  const checkTieneNovedad = useCallback(
    (t: Ticket): boolean => {
      if (t.eliminado || (t.estado || "").toLowerCase() === "eliminado") return false;
      return Boolean(unreadTicketIds && unreadTicketIds.some((id) => String(id) === String(t.id)));
    },
    [unreadTicketIds],
  );

  // Devuelve siempre el badge simple "Nuevo" en rojo
  const getNovedadBadge = useCallback((_t: Ticket) => {
    return {
      label: "Nuevo",
      classes:
        "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
    };
  }, []);

  // Cantidad total de tickets activos con novedades no leídas o que requieren atención según el rol
  const novedadesCount = useMemo(() => {
    return ticketsActivos.filter(checkTieneNovedad).length;
  }, [ticketsActivos, checkTieneNovedad]);

  // Obtener la lista única de áreas para el filtro opcional
  const areasUnicas = useMemo(() => {
    const fuente = currentView === "activos" ? ticketsActivos : ticketsEliminados;
    return Array.from(new Set(fuente.map((t) => t.area_solicitante))).filter(Boolean);
  }, [currentView, ticketsActivos, ticketsEliminados]);

  // Obtener la lista única de diseñadores asignados para el filtro personalizado
  const disenadoresUnicos = useMemo(() => {
    const fuente = currentView === "activos" ? ticketsActivos : ticketsEliminados;
    const asignados = fuente.map((t) => t.asignado_a || t.asignado_nombre).filter(Boolean) as string[];
    return Array.from(new Set(asignados)).sort();
  }, [currentView, ticketsActivos, ticketsEliminados]);

  // Asignar prioridad de estado (1 = mayor atención/pendiente o correcciones, 5 = cerrado/resuelto)
  const getEstadoPrioridad = (estado?: string): number => {
    const est = (estado || "").toLowerCase();
    if (est.includes("correc") || est.includes("ajust")) return 1;
    if (est.includes("pendiente")) return 2;
    if (est.includes("proceso")) return 3;
    if (est.includes("revis")) return 4;
    if (est.includes("resuelto") || est.includes("aprob")) return 5;
    return 6;
  };

  // 1. Filtrado dinámico en tiempo real
  const ticketsFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const listaBase = currentView === "activos" ? ticketsActivos : ticketsEliminados;

    return listaBase.filter((t) => {
      const ticketNum = t.ticket_number || (t.numero_ticket ? `#${String(t.numero_ticket).padStart(3, "0")}` : "#001");
      const numeroPuro = t.numero_ticket ? String(t.numero_ticket) : "";
      const est = (t.estado || "").toLowerCase();

      const tieneNovedad = checkTieneNovedad(t);

      // Filtro de búsqueda por texto: título, brief, número (#001), área, diseñador asignado o autor
      const matchSearch =
        !term ||
        (t.titulo || "").toLowerCase().includes(term) ||
        (t.brief || "").toLowerCase().includes(term) ||
        ticketNum.toLowerCase().includes(term) ||
        numeroPuro.includes(term) ||
        (t.area_solicitante || "").toLowerCase().includes(term) ||
        (t.asignado_a || t.asignado_nombre || "").toLowerCase().includes(term) ||
        (t.motivo_eliminacion || "").toLowerCase().includes(term) ||
        (t.creado_por || "").toLowerCase().includes(term);

      // Si estamos en la vista de activos, aplicar filtros de estado y novedades
      let matchEstado = true;
      if (currentView === "activos") {
        if (filterEstado === "NOVEDADES") {
          matchEstado = tieneNovedad;
        } else if (filterEstado !== "TODOS") {
          matchEstado =
            est === filterEstado.toLowerCase() ||
            (filterEstado === "Pendiente" && est.includes("pendiente")) ||
            (filterEstado === "En Proceso" && est.includes("proceso")) ||
            (filterEstado === "En Revisión" && est.includes("revis")) ||
            (filterEstado === "Correcciones" && (est.includes("correc") || est.includes("ajust"))) ||
            (filterEstado === "Resuelto" && (est.includes("resuelto") || est.includes("aprob")));
        }
      }

      // Filtro por área solicitante
      const matchArea = filterArea === "TODAS" || t.area_solicitante === filterArea;

      // Filtro por diseñador asignado
      let matchDisenador = true;
      if (filterDisenador === "SIN_ASIGNAR") {
        matchDisenador = !t.asignado_a && !t.asignado_nombre;
      } else if (filterDisenador !== "TODOS") {
        const asignado = (t.asignado_a || t.asignado_nombre || "").toLowerCase();
        matchDisenador = asignado.includes(filterDisenador.toLowerCase());
      }

      // Filtro inteligente "Mis Pedidos" adaptado al Rol del usuario
      let matchMisPedidos = true;
      if (soloMisPedidos && userProfile) {
        const miNombre = (userProfile.nombre || "").toLowerCase().trim();
        const miEmail = (userProfile.email || "").toLowerCase().trim();
        const miId = userProfile.id;

        if (currentRole === "CONTENIDOS" || userProfile.rol === "solicitante") {
          // Para CONTENIDOS: solo tickets creados por este usuario
          const creador = (t.creado_por || "").toLowerCase().trim();
          matchMisPedidos =
            Boolean(miNombre && creador.includes(miNombre)) ||
            Boolean(miEmail && creador.includes(miEmail.split("@")[0])) ||
            Boolean(miId && t.user_id === miId);
        } else if (currentRole === "GRAFICA" || userProfile.rol === "operador") {
          // Para GRÁFICA: solo tickets asignados a este diseñador
          const asignado = (t.asignado_a || t.asignado_nombre || "").toLowerCase().trim();
          matchMisPedidos = Boolean(miNombre && asignado.includes(miNombre));
        } else {
          // Para SUPER_ADMIN: creados por él o asignados a él
          const creador = (t.creado_por || "").toLowerCase().trim();
          const asignado = (t.asignado_a || t.asignado_nombre || "").toLowerCase().trim();
          matchMisPedidos =
            Boolean(miNombre && (creador.includes(miNombre) || asignado.includes(miNombre))) ||
            Boolean(miId && t.user_id === miId);
        }
      }

      return matchSearch && matchEstado && matchArea && matchDisenador && matchMisPedidos;
    });
  }, [
    currentView,
    ticketsActivos,
    ticketsEliminados,
    searchTerm,
    filterEstado,
    filterArea,
    filterDisenador,
    soloMisPedidos,
    userProfile,
    currentRole,
    checkTieneNovedad,
  ]);

  // Conteo de "Mis pedidos" para el botón con badge
  const misPedidosCount = useMemo(() => {
    if (!userProfile) return 0;
    const miNombre = (userProfile.nombre || "").toLowerCase().trim();
    const miEmail = (userProfile.email || "").toLowerCase().trim();
    const miId = userProfile.id;

    return ticketsActivos.filter((t) => {
      if (currentRole === "CONTENIDOS" || userProfile.rol === "solicitante") {
        const creador = (t.creado_por || "").toLowerCase().trim();
        return (
          Boolean(miNombre && creador.includes(miNombre)) ||
          Boolean(miEmail && creador.includes(miEmail.split("@")[0])) ||
          Boolean(miId && t.user_id === miId)
        );
      } else if (currentRole === "GRAFICA" || userProfile.rol === "operador") {
        const asignado = (t.asignado_a || t.asignado_nombre || "").toLowerCase().trim();
        return Boolean(miNombre && asignado.includes(miNombre));
      } else {
        const creador = (t.creado_por || "").toLowerCase().trim();
        const asignado = (t.asignado_a || t.asignado_nombre || "").toLowerCase().trim();
        return (
          Boolean(miNombre && (creador.includes(miNombre) || asignado.includes(miNombre))) ||
          Boolean(miId && t.user_id === miId)
        );
      }
    }).length;
  }, [ticketsActivos, userProfile, currentRole]);

  // 2. Ordenamiento de la tabla estilo bandeja de correo Gmail:
  // Los tickets con actividad o creación más reciente se quedan siempre arriba, incluso después de ser leídos.
  const ticketsOrdenados = useMemo(() => {
    return [...ticketsFiltrados].sort((a, b) => {
      if (sortBy === "novedades" || sortBy === "fecha_desc") {
        const timeA = Math.max(
          new Date(a.actualizado_en || a.updated_at || a.creado_en || a.created_at || 0).getTime(),
          new Date(a.creado_en || a.created_at || 0).getTime(),
        );
        const timeB = Math.max(
          new Date(b.actualizado_en || b.updated_at || b.creado_en || b.created_at || 0).getTime(),
          new Date(b.creado_en || b.created_at || 0).getTime(),
        );
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        const numA = Number(a.numero_ticket) || Number(String(a.id).replace(/\D/g, "")) || 0;
        const numB = Number(b.numero_ticket) || Number(String(b.id).replace(/\D/g, "")) || 0;
        return numB - numA;
      }
      if (sortBy === "prioridad") {
        const pA = getEstadoPrioridad(a.estado);
        const pB = getEstadoPrioridad(b.estado);
        if (pA !== pB) return pA - pB;
      }
      if (sortBy === "fecha_asc") {
        const timeA = new Date(a.creado_en || a.created_at || 0).getTime();
        const timeB = new Date(b.creado_en || b.created_at || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        const numA = Number(a.numero_ticket) || Number(String(a.id).replace(/\D/g, "")) || 0;
        const numB = Number(b.numero_ticket) || Number(String(b.id).replace(/\D/g, "")) || 0;
        return numA - numB;
      }
      if (sortBy === "titulo") {
        return (a.titulo || "").localeCompare(b.titulo || "");
      }
      return 0;
    });
  }, [ticketsFiltrados, sortBy]);

  const getBadgeClass = (estado?: string) => {
    const est = (estado || "").toLowerCase();
    if (est.includes("eliminad"))
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60";
    if (est.includes("correc") || est.includes("ajust"))
      return "bg-orange-50 text-orange-800 border-orange-300 font-semibold dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-700/60";
    if (est.includes("pendiente"))
      return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60";
    if (est.includes("proceso"))
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/60";
    if (est.includes("revis"))
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800/60";
    if (est.includes("resuelto") || est.includes("aprob"))
      return "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60";
    if (est.includes("rechaz"))
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60";
    return "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700";
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

  const limpiarBusqueda = () => {
    setSearchTerm("");
    setFilterEstado("TODOS");
    setFilterArea("TODAS");
    setFilterDisenador("TODOS");
  };

  const puedeCrearTicket = currentRole === "CONTENIDOS" || currentRole === "SUPER_ADMIN";

  return (
    <div className="space-y-4">
      {/* Selector de Pestañas: Solicitudes Activas vs Registro de Eliminados */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setCurrentView("activos");
              setFilterEstado("TODOS");
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              currentView === "activos"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <span>Solicitudes Activas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                currentView === "activos"
                  ? "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
                  : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {ticketsActivos.length}
            </span>
          </button>

          <button
            onClick={() => {
              setCurrentView("eliminados");
              setFilterEstado("TODOS");
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              currentView === "eliminados"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-neutral-500 dark:text-neutral-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Registro de Eliminados</span>
            {ticketsEliminados.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  currentView === "eliminados"
                    ? "bg-rose-800 text-white"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-semibold"
                }`}
              >
                {ticketsEliminados.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Selector de Vista: Tabla vs Tablero Kanban */}
          {currentView === "activos" && (
            <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200/80 dark:border-neutral-700">
              <button
                onClick={() => setViewMode("tabla")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === "tabla"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
                title="Vista de lista / tabla Notion"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabla</span>
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === "kanban"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
                title="Vista de tablero Kanban por columnas de estado"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablero</span>
              </button>
            </div>
          )}

          {/* Botón Vaciar Registro de Eliminados para Super Admin */}
          {currentView === "eliminados" && currentRole === "SUPER_ADMIN" && ticketsEliminados.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarModalVaciarPapelera(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-xs hover:shadow active:scale-98 cursor-pointer"
              title="Eliminar definitivamente todos los tickets archivados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Registro ({ticketsEliminados.length})</span>
            </button>
          )}

          {/* Botón Nuevo Ticket original: solo para Contenidos y Super Admin en activos */}
          {currentView === "activos" && (currentRole === "CONTENIDOS" || currentRole === "SUPER_ADMIN") && (
            <button
              onClick={onOpenNewTicketModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold rounded-lg transition shadow-xs hover:shadow active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Ordenamiento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-50/70 dark:bg-[#202020] p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
        {/* Barra de búsqueda interactiva */}
        <div className="flex-1 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por #ticket, título, diseñador o área..."
              className="w-full text-xs pl-8 pr-8 py-2 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-neutral-900 dark:focus:border-neutral-400 shadow-2xs transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Ordenamiento */}
          <div className="flex items-center space-x-1.5 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 rounded-lg shadow-2xs text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
            <span className="text-neutral-400 dark:text-neutral-500 text-[11px] font-medium hidden sm:inline">
              Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="novedades" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                Novedades y Actividad (Casilla de Mails)
              </option>
              <option value="fecha_desc" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                Fecha de Creación (Más reciente)
              </option>
              <option value="fecha_asc" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                Fecha de Creación (Más antiguo)
              </option>
              {currentView === "activos" && (
                <option value="prioridad" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                  Estado / Prioridad
                </option>
              )}
              <option value="titulo" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                Título (A - Z)
              </option>
            </select>
          </div>

          {/* Filtro por Diseñador asignado en vista de activos */}
          {currentView === "activos" && (
            <div className="flex items-center space-x-1.5 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 rounded-lg shadow-2xs text-xs">
              <User className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span className="text-neutral-400 dark:text-neutral-500 text-[11px] font-medium hidden sm:inline">
                Diseñador:
              </span>
              <select
                value={filterDisenador}
                onChange={(e) => setFilterDisenador(e.target.value)}
                className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 font-medium focus:outline-none cursor-pointer pr-1 max-w-[150px] truncate"
              >
                <option value="TODOS" className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
                  Todos los diseñadores
                </option>
                <option
                  value="SIN_ASIGNAR"
                  className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
                >
                  Sin asignar
                </option>
                {disenadoresUnicos.map((dis) => (
                  <option
                    key={dis}
                    value={dis}
                    className="bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
                  >
                    {dis}
                  </option>
                ))}
              </select>
              {filterDisenador !== "TODOS" && (
                <button
                  type="button"
                  onClick={() => setFilterDisenador("TODOS")}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded transition cursor-pointer"
                  title="Restablecer filtro de diseñador"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Botón rápido "Mis pedidos" para el usuario logueado con contador */}
          {currentView === "activos" && userProfile?.nombre && (
            <button
              type="button"
              onClick={() => setSoloMisPedidos((prev) => !prev)}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium whitespace-nowrap cursor-pointer flex items-center space-x-1.5 border shadow-2xs ${
                soloMisPedidos
                  ? "bg-blue-600 text-white border-blue-700 font-bold ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              }`}
              title={
                currentRole === "CONTENIDOS" || userProfile.rol === "solicitante"
                  ? `Filtrar solo los pedidos creados por ti (${userProfile.nombre})`
                  : `Filtrar solo los pedidos asignados a ti (${userProfile.nombre})`
              }
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mis pedidos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  soloMisPedidos
                    ? "bg-white/25 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                }`}
              >
                {misPedidosCount}
              </span>
            </button>
          )}

          {/* Filtros rápidos por Estado solo en vista de activos */}
          {currentView === "activos" && (
            <div className="flex items-center space-x-1 overflow-x-auto py-1">
              {[
                { id: "TODOS", label: `Todos (${ticketsActivos.length})` },
                { id: "Pendiente", label: "Pendiente" },
                { id: "En Proceso", label: "En Proceso" },
                { id: "En Revisión", label: "En Revisión" },
                { id: "Correcciones", label: "Correcciones", isOrange: true },
                { id: "Resuelto", label: "Resuelto" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setFilterEstado(st.id)}
                  className={`px-2.5 py-1 text-xs rounded-md transition font-medium whitespace-nowrap cursor-pointer ${
                    filterEstado === st.id
                      ? st.isOrange
                        ? "bg-orange-600 text-white shadow-2xs font-bold"
                        : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-2xs font-bold"
                      : st.isOrange
                        ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50"
                        : "bg-white dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  }`}
                >
                  {st.label}
                </button>
              ))}

              {/* Botón destacado de Novedades */}
              {novedadesCount > 0 && (
                <button
                  onClick={() => setFilterEstado(filterEstado === "NOVEDADES" ? "TODOS" : "NOVEDADES")}
                  className={`px-2.5 py-1 text-xs rounded-md transition font-semibold whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                    filterEstado === "NOVEDADES"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                  }`}
                  title="Filtrar solo tickets con nuevas acciones o comentarios sin leer"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span>Nuevos ({novedadesCount})</span>
                </button>
              )}
            </div>
          )}

          {currentView === "eliminados" && (
            <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-md border border-rose-200 dark:border-rose-900/60 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Registro de auditoría de tickets eliminados</span>
            </div>
          )}
        </div>
      </div>

      {/* Contenedor Principal: Tablero Kanban o Tabla estilo Notion */}
      {currentView === "activos" && viewMode === "kanban" ? (
        <div className="space-y-4">
          <KanbanBoard
            tickets={ticketsOrdenados}
            currentRole={currentRole}
            userProfile={userProfile}
            unreadTicketIds={unreadTicketIds}
            onSelectTicket={onSelectTicket}
            onUpdateTicketStatus={(ticketId: string | number, newStatus: string) => {
              if (onUpdateTicketStatus) {
                onUpdateTicketStatus(ticketId, newStatus);
              } else {
                const usuarioNombre =
                  userProfile?.nombre ||
                  (currentRole === "SUPER_ADMIN"
                    ? "Super Administrador"
                    : currentRole === "GRAFICA"
                      ? "Diseñador Gráfica"
                      : "Equipo de Contenidos");
                ticketsService.updateTicketStatus(ticketId, newStatus, usuarioNombre).catch(console.error);
              }
            }}
            onTakeTicket={onTakeTicket}
            checkTieneNovedad={checkTieneNovedad}
            getNovedadBadge={getNovedadBadge}
          />

          {/* Barra de resumen inferior para la vista Tablero Kanban */}
          <div className="px-4 py-3 bg-white dark:bg-[#1e1e1e] rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2">
              <span>
                Mostrando <strong className="text-neutral-800 dark:text-neutral-200">{ticketsOrdenados.length}</strong>{" "}
                de <strong className="text-neutral-800 dark:text-neutral-200">{ticketsActivos.length}</strong> tickets
                en el tablero
              </span>
              {searchTerm && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">(filtrados por "{searchTerm}")</span>
              )}
              {filterDisenador !== "TODOS" && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  (diseñador: {filterDisenador === "SIN_ASIGNAR" ? "Sin asignar" : filterDisenador})
                </span>
              )}
              {soloMisPedidos && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">(Mis pedidos: activo)</span>
              )}
            </div>
            <div className="flex items-center space-x-2.5 text-[11px] flex-wrap">
              <span>
                Pendientes:{" "}
                <strong className="text-neutral-700 dark:text-neutral-200">
                  {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("pendiente")).length}
                </strong>
              </span>
              <span>•</span>
              <span>
                En Proceso:{" "}
                <strong className="text-blue-700 dark:text-blue-400">
                  {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("proceso")).length}
                </strong>
              </span>
              <span>•</span>
              <span>
                En Revisión:{" "}
                <strong className="text-purple-700 dark:text-purple-400">
                  {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("revis")).length}
                </strong>
              </span>
              <span>•</span>
              <span>
                Correcciones:{" "}
                <strong className="text-orange-700 dark:text-orange-400">
                  {
                    ticketsActivos.filter(
                      (t) =>
                        (t.estado || "").toLowerCase().includes("correc") ||
                        (t.estado || "").toLowerCase().includes("ajust"),
                    ).length
                  }
                </strong>
              </span>
              <span>•</span>
              <span>
                Resueltos:{" "}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("resuelto")).length}
                </strong>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#252525] text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider select-none">
                  {/* Cabecera: # Ticket */}
                  <th className="py-3 px-4 w-28"># Ticket</th>

                  {/* Cabecera: Título */}
                  <th
                    onClick={() => setSortBy(sortBy === "titulo" ? "fecha_desc" : "titulo")}
                    className="py-3 px-4 cursor-pointer hover:text-neutral-900 dark:hover:text-white group"
                    title="Ordenar por título"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Título del pedido</span>
                      {sortBy === "titulo" && <ArrowDown className="w-3 h-3 text-neutral-900 dark:text-white" />}
                    </div>
                  </th>

                  {/* Cabecera: Área Solicitante */}
                  <th className="py-3 px-4 w-40">Área / Solicitante</th>

                  {/* Cabecera: Diseñador Asignado (Solo en activos) */}
                  {currentView === "activos" && <th className="py-3 px-4 w-36">Asignado a</th>}

                  {/* Cabecera: Estado o Motivo de Eliminación */}
                  <th className="py-3 px-4 w-40">{currentView === "activos" ? "Estado" : "Motivo"}</th>

                  {/* Cabecera: Actividad / Fecha */}
                  <th
                    onClick={() => setSortBy(sortBy === "novedades" ? "fecha_asc" : "novedades")}
                    className="py-3 px-4 w-32 cursor-pointer hover:text-neutral-900 dark:hover:text-white group"
                    title="Alternar orden por novedades y actividad reciente"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{currentView === "activos" ? "Últ. Actividad" : "Eliminado"}</span>
                      {sortBy === "novedades" || sortBy === "fecha_desc" ? (
                        <ArrowDown className="w-3 h-3 text-neutral-900 dark:text-white" />
                      ) : sortBy === "fecha_asc" ? (
                        <ArrowUp className="w-3 h-3 text-neutral-900 dark:text-white" />
                      ) : null}
                    </div>
                  </th>

                  {/* Columna Acciones / Drive */}
                  <th className="py-3 px-4 w-36 text-center">{currentView === "activos" ? "Drive" : "Acciones"}</th>

                  <th className="py-3 px-2 w-8"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {ticketsOrdenados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={currentView === "activos" ? 8 : 7}
                      className="py-12 text-center text-neutral-400 dark:text-neutral-500"
                    >
                      <div className="max-w-sm mx-auto space-y-2">
                        <p className="font-medium text-neutral-600 dark:text-neutral-300">
                          {currentView === "activos"
                            ? "No se encontraron tickets activos"
                            : "No hay tickets en el Registro de Eliminados"}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {currentView === "eliminados"
                            ? "La papelera está vacía. Todos los pedidos eliminados por error o cancelados se registran aquí."
                            : filterEstado === "NOVEDADES"
                              ? "No hay tickets con acciones nuevas sin leer."
                              : searchTerm
                                ? `No hay coincidencias para "${searchTerm}".`
                                : "Aún no hay tickets que coincidan con los filtros seleccionados."}
                        </p>
                        {searchTerm && (
                          <button
                            onClick={limpiarBusqueda}
                            className="mt-2 inline-flex items-center space-x-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-md text-xs font-medium transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Restablecer búsqueda</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  ticketsOrdenados.map((ticket) => {
                    const est = (ticket.estado || "").toLowerCase();
                    const tieneNovedad = currentView === "activos" && checkTieneNovedad(ticket);
                    const novedadBadge = tieneNovedad ? getNovedadBadge(ticket) : null;
                    const asignado = ticket.asignado_a || ticket.asignado_nombre;

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => onSelectTicket(ticket)}
                        className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition cursor-pointer group ${
                          tieneNovedad
                            ? "bg-rose-50/25 dark:bg-rose-950/20"
                            : ticket.eliminado
                              ? "bg-neutral-50/50 dark:bg-neutral-900/30 opacity-90"
                              : ""
                        }`}
                      >
                        {/* # Ticket */}
                        <td className="py-3.5 px-4 font-mono font-medium text-neutral-600 dark:text-neutral-400">
                          <div className="flex items-center space-x-2">
                            {tieneNovedad ? (
                              <span className="relative flex h-2.5 w-2.5 shrink-0" title="¡Novedad en este ticket!">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-xs"></span>
                              </span>
                            ) : (
                              <span className="w-2.5 h-2.5 shrink-0" />
                            )}

                            <span
                              className={`group-hover:text-neutral-900 dark:group-hover:text-white transition-colors ${
                                ticket.eliminado ? "line-through text-neutral-400 dark:text-neutral-600" : ""
                              }`}
                            >
                              {ticket.ticket_number ||
                                (ticket.numero_ticket ? `#${String(ticket.numero_ticket).padStart(3, "0")}` : "#001")}
                            </span>

                            {tieneNovedad && novedadBadge && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold leading-none ${novedadBadge.classes}`}
                              >
                                {novedadBadge.label}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Título y Brief resumido */}
                        <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-neutral-100">
                          <div className="flex flex-col">
                            <span
                              className={`truncate max-w-md group-hover:underline ${
                                ticket.eliminado ? "text-neutral-500 dark:text-neutral-400" : ""
                              }`}
                            >
                              {ticket.titulo}
                            </span>
                            {ticket.brief && (
                              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-normal truncate max-w-md mt-0.5">
                                {ticket.brief.replace(/<[^>]*>/g, "")}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Área Solicitante y Creador */}
                        <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-300">
                          <div className="flex flex-col space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 w-fit">
                              {ticket.area_solicitante}
                            </span>
                            <span
                              className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-1 font-medium"
                              title={`Pedido creado por: ${ticket.creado_por || "Equipo de Contenidos"}`}
                            >
                              <span className="text-neutral-400">👤</span>
                              <span className="truncate max-w-[120px] font-semibold text-neutral-700 dark:text-neutral-300">
                                {ticket.creado_por || "Equipo de Contenidos"}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Diseñador Asignado (Solo en vista de activos) */}
                        {currentView === "activos" && (
                          <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                            {asignado ? (
                              <UserTagBadge name={asignado} size="sm" />
                            ) : (
                              <span className="text-neutral-400 dark:text-neutral-500 italic text-[11px]">
                                Sin asignar
                              </span>
                            )}
                          </td>
                        )}

                        {/* Estado en Activos vs Motivo en Eliminados */}
                        <td className="py-3.5 px-4">
                          {currentView === "activos" ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${getBadgeClass(
                                ticket.estado,
                              )}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  est.includes("correc") || est.includes("ajust")
                                    ? "bg-orange-500"
                                    : est.includes("resuelto")
                                      ? "bg-emerald-500"
                                      : est.includes("proceso")
                                        ? "bg-blue-500"
                                        : est.includes("revis")
                                          ? "bg-purple-500"
                                          : "bg-amber-500"
                                }`}
                              />
                              {est.includes("correc") ? "Correcciones" : ticket.estado}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {ticket.motivo_eliminacion || "Error en la carga de datos"}
                            </span>
                          )}
                        </td>

                        {/* Fecha / Última Actividad */}
                        <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {formatearFecha(
                            currentView === "eliminados"
                              ? ticket.eliminado_en || ticket.actualizado_en || ticket.creado_en
                              : ticket.actualizado_en || ticket.updated_at || ticket.creado_en || ticket.created_at,
                          )}
                        </td>

                        {/* Drive (Activos) o Botones Restaurar/Purgar (Eliminados) */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {currentView === "activos" ? (
                            <div className="flex items-center justify-center space-x-1.5">
                              {ticket.link_entrega || ticket.links_entrega ? (
                                <a
                                  href={ticket.link_entrega || ticket.links_entrega}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir diseños terminados en Google Drive"
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[11px] font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs hover:scale-102 transition"
                                >
                                  <FolderCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Entrega Drive</span>
                                  <ExternalLink className="w-2.5 h-2.5 ml-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                </a>
                              ) : ticket.link_referencia || ticket.links_referencia ? (
                                <a
                                  href={ticket.link_referencia || ticket.links_referencia}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir material de referencia"
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] transition"
                                >
                                  <ExternalLink className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                                  <span>Insumos</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-neutral-300 dark:text-neutral-600">—</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={async () => {
                                  const usuarioNombre =
                                    currentRole === "SUPER_ADMIN" ? "Super Administrador" : "Equipo de Contenidos";
                                  await ticketsService.restoreTicket(ticket.id, usuarioNombre);
                                  onRestoreTicket?.(ticket.id);
                                }}
                                className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-medium transition cursor-pointer"
                                title="Restaurar ticket a Solicitudes Activas"
                              >
                                <RotateCcw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Restaurar</span>
                              </button>

                              {currentRole === "SUPER_ADMIN" && onHardDeleteTicket && (
                                <button
                                  onClick={() => setTicketAPurgar(ticket)}
                                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 text-neutral-400 hover:text-rose-700 dark:hover:text-rose-400 rounded transition cursor-pointer"
                                  title="Eliminar definitivamente de la base de datos (Super Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Flecha lateral para abrir Drawer */}
                        <td className="py-3.5 px-2 text-right">
                          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Resumen inferior estilo Notion con todos los 5 estados */}
          <div className="px-4 py-3 bg-neutral-50/80 dark:bg-[#202020] border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span>
                Mostrando <strong className="text-neutral-800 dark:text-neutral-200">{ticketsOrdenados.length}</strong>{" "}
                de{" "}
                <strong className="text-neutral-800 dark:text-neutral-200">
                  {currentView === "activos" ? ticketsActivos.length : ticketsEliminados.length}
                </strong>{" "}
                {currentView === "activos" ? "tickets activos" : "registros archivados"}
              </span>
              {searchTerm && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">(filtrados por "{searchTerm}")</span>
              )}
              {soloMisPedidos && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">(Mis pedidos: activo)</span>
              )}
            </div>
            {currentView === "activos" && (
              <div className="flex items-center space-x-2.5 text-[11px] flex-wrap">
                <span>
                  Pendientes:{" "}
                  <strong className="text-neutral-700 dark:text-neutral-200">
                    {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("pendiente")).length}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  En Proceso:{" "}
                  <strong className="text-blue-700 dark:text-blue-400">
                    {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("proceso")).length}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  En Revisión:{" "}
                  <strong className="text-purple-700 dark:text-purple-400">
                    {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("revis")).length}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Correcciones:{" "}
                  <strong className="text-orange-700 dark:text-orange-400">
                    {
                      ticketsActivos.filter(
                        (t) =>
                          (t.estado || "").toLowerCase().includes("correc") ||
                          (t.estado || "").toLowerCase().includes("ajust"),
                      ).length
                    }
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Resueltos:{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {ticketsActivos.filter((t) => (t.estado || "").toLowerCase().includes("resuelto")).length}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Mover a Eliminados desde la Tabla */}
      {ticketAEliminar && (
        <div className="fixed inset-0 z-60 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ¿Mover ticket{" "}
                  {ticketAEliminar.ticket_number ||
                    (ticketAEliminar.numero_ticket
                      ? `#${String(ticketAEliminar.numero_ticket).padStart(3, "0")}`
                      : "#001")}{" "}
                  a Eliminados?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  "{ticketAEliminar.titulo}". Se archivará en el Registro de Eliminados y podrás restaurarlo cuando
                  quieras.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                Motivo de la eliminación:
              </label>

              {/* Botones rápidos de motivo frecuente */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  "Error en la carga de datos",
                  "Pedido duplicado",
                  "Cancelado por el solicitante",
                  "Prueba de carga",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMotivoEliminar(preset)}
                    className={`text-[11px] px-2 py-1 rounded-md border transition cursor-pointer ${
                      motivoEliminar === preset
                        ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium"
                        : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
                placeholder="Escribe el motivo aquí..."
                className="w-full text-xs px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setTicketAEliminar(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setEliminandoTicket(true);
                  const motivoFinal = motivoEliminar.trim() || "Error en la carga de datos";
                  const usuarioNombre = currentRole === "SUPER_ADMIN" ? "Super Administrador" : "Equipo de Contenidos";
                  try {
                    await ticketsService.deleteTicket(ticketAEliminar.id, motivoFinal, usuarioNombre);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    onDeleteTicket?.(ticketAEliminar.id, motivoFinal);
                    setTicketAEliminar(null);
                    setEliminandoTicket(false);
                  }
                }}
                disabled={eliminandoTicket}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{eliminandoTicket ? "Eliminando..." : "Mover a Eliminados"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Purgado Individual de Ticket */}
      {ticketAPurgar && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-200 dark:border-rose-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
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

            <div className="p-3 bg-neutral-50 dark:bg-[#1a1a1a] rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
              <span className="font-bold">Ticket:</span> "{ticketAPurgar.titulo}"
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setTicketAPurgar(null)}
                disabled={purgandoIndividual}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPurgandoIndividual(true);
                  try {
                    await ticketsService.hardDeleteTicket(ticketAPurgar.id);
                    onHardDeleteTicket?.(ticketAPurgar.id);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setPurgandoIndividual(false);
                    setTicketAPurgar(null);
                  }
                }}
                disabled={purgandoIndividual}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purgandoIndividual ? "Eliminando..." : "Sí, eliminar para siempre"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Vaciar Todo el Registro de Eliminados */}
      {mostrarModalVaciarPapelera && (
        <div className="fixed inset-0 z-60 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202020] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-200 dark:border-rose-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ¿Vaciar todo el registro de eliminados?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Se eliminarán definitivamente todos los <strong>{ticketsEliminados.length}</strong> tickets archivados y sus comentarios.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200">
              ⚠️ Esta acción purgará de forma irreversible toda la información de estos tickets en Supabase.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMostrarModalVaciarPapelera(false)}
                disabled={vaciandoPapelera}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setVaciandoPapelera(true);
                  try {
                    await ticketsService.emptyEliminatedTickets();
                    onEmptyTrash?.();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setVaciandoPapelera(false);
                    setMostrarModalVaciarPapelera(false);
                  }
                }}
                disabled={vaciandoPapelera}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{vaciandoPapelera ? "Purgando..." : "Sí, vaciar registro"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
