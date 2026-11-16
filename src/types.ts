// src/types.ts

export type UserRole = 'superadmin' | 'operador' | 'solicitante' | 'SUPER_ADMIN' | 'CONTENIDOS' | 'GRAFICA';
export type UserArea = 'Contenidos' | 'Gráfica' | 'Todas';

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: 'superadmin' | 'operador' | 'solicitante';
  area: UserArea;
  color?: string;
  created_at?: string;
}

export type TicketStatus = 
  | 'pendiente'
  | 'en_proceso'
  | 'en_revision'
  | 'correcciones'
  | 'resuelto'
  | 'rechazado'
  | 'eliminado'
  | 'Pendiente'
  | 'En Proceso'
  | 'En Revisión'
  | 'Correcciones'
  | 'Resuelto'
  | 'Rechazado'
  | 'Eliminado'
  | 'Borrador';

export interface Ticket {
  id: string | number;
  user_id?: string;
  numero_ticket?: number | string;
  ticket_number?: string;
  titulo: string;
  area_solicitante: string;
  brief: string;
  link_referencia?: string;
  links_referencia?: string;
  link_entrega?: string;
  links_entrega?: string;
  estado: string;
  asignado_a?: string;
  asignado_nombre?: string;
  creado_por?: string;
  rol_creador?: UserRole;
  creado_en?: string;
  created_at?: string;
  actualizado_en?: string;
  updated_at?: string;
  eliminado?: boolean;
  eliminado_en?: string;
  motivo_eliminacion?: string;
  eliminado_por?: string;
}

export interface Comentario {
  id: string | number;
  ticket_id: string | number;
  contenido?: string;
  mensaje?: string;
  usuario?: string;
  autor_nombre?: string;
  autor_rol?: UserRole;
  link_adjunto?: string;
  creado_en?: string;
  created_at?: string;
}

export interface HistorialMovimiento {
  id: string | number;
  ticket_id: string | number;
  usuario_nombre?: string;
  usuario?: string;
  usuario_rol?: UserRole;
  accion: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  creado_en?: string;
  created_at?: string;
}

export interface ToastNotification {
  id: string;
  tipo: 'ticket' | 'comentario' | 'entrega';
  titulo: string;
  mensaje: string;
  ticketId?: string | number;
  ticketNumero?: string;
  autorRol?: UserRole;
  creadoEn: number;
}
