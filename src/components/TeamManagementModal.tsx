// src/components/TeamManagementModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Users, 
  Palette, 
  Check, 
  ShieldCheck, 
  Pencil,
  Trash2,
  Loader2, 
  KeyRound, 
  Mail, 
  User as UserIcon,
  Pipette,
  AlertTriangle
} from 'lucide-react';
import { Profile, UserArea } from '../types';
import { ticketsService } from '../lib/supabase';
import { TAG_COLOR_OPTIONS, getTagColorDef } from '../lib/tagColors';
import { UserTagBadge } from './UserTagBadge';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile?: Profile | null;
  onUserCreated?: (newProfile: Profile) => void;
  onUserUpdated?: (updatedProfile: Profile) => void;
  onUserDeleted?: (deletedUserId: string) => void;
}

export const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'create'>('members');
  const [members, setMembers] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Formulario nuevo usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Woof1234!');
  const [area, setArea] = useState<UserArea>('Gráfica');
  const [rol, setRol] = useState<'operador' | 'solicitante' | 'superadmin'>('operador');
  const [selectedColor, setSelectedColor] = useState<string>('purple');
  const [createHexInput, setCreateHexInput] = useState<string>('#9333ea');
  const [creando, setCreando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Miembro seleccionado para cambiar color en modal centrado
  const [memberForColorPicker, setMemberForColorPicker] = useState<Profile | null>(null);
  const [tempColor, setTempColor] = useState<string>('blue');
  const [tempHexInput, setTempHexInput] = useState<string>('#2563eb');
  const [guardandoColor, setGuardandoColor] = useState(false);

  // Miembro seleccionado para EDITAR (Nombre, Sector/Área, Permisos/Rol)
  const [memberToEdit, setMemberToEdit] = useState<Profile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editArea, setEditArea] = useState<UserArea>('Gráfica');
  const [editRol, setEditRol] = useState<'operador' | 'solicitante' | 'superadmin'>('operador');
  const [editColor, setEditColor] = useState<string>('blue');
  const [editHexInput, setEditHexInput] = useState<string>('#2563eb');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Miembro seleccionado para ELIMINAR (Confirmación)
  const [memberToDelete, setMemberToDelete] = useState<Profile | null>(null);
  const [eliminandoMiembro, setEliminandoMiembro] = useState(false);

  useEffect(() => {
    if (isOpen) {
      cargarMiembros();
      setMensajeExito(null);
      setMensajeError(null);
      setMemberForColorPicker(null);
      setMemberToEdit(null);
      setMemberToDelete(null);
    }
  }, [isOpen]);

  // Si cambia el área seleccionada al crear, sugerir el rol adecuado
  const handleAreaChange = (nuevaArea: UserArea) => {
    setArea(nuevaArea);
    if (nuevaArea === 'Gráfica') {
      setRol('operador');
      setSelectedColor('purple');
      setCreateHexInput('#9333ea');
    } else if (nuevaArea === 'Contenidos') {
      setRol('solicitante');
      setSelectedColor('emerald');
      setCreateHexInput('#059669');
    } else {
      setRol('superadmin');
      setSelectedColor('blue');
      setCreateHexInput('#2563eb');
    }
  };

  const cargarMiembros = async () => {
    setLoadingMembers(true);
    try {
      const lista = await ticketsService.fetchTeamMembers();
      setMembers(lista);
    } catch (err) {
      console.error('Error cargando miembros:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Crear usuario
  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);

    const nomLimpio = nombre.trim();
    const mailLimpio = email.trim().toLowerCase();

    if (!nomLimpio) {
      setMensajeError('Por favor ingresa un nombre para el usuario.');
      return;
    }
    if (!mailLimpio || !mailLimpio.includes('@')) {
      setMensajeError('Por favor ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setMensajeError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCreando(true);
    try {
      const res = await ticketsService.createTeamMember({
        nombre: nomLimpio,
        email: mailLimpio,
        password,
        rol,
        area,
        color: selectedColor,
      });

      if (res.success && res.profile) {
        setMensajeExito(`¡Usuario ${nomLimpio} creado con éxito! Ya puede iniciar sesión.`);
        setNombre('');
        setEmail('');
        setPassword('Woof1234!');
        if (onUserCreated) {
          onUserCreated(res.profile);
        }
        await cargarMiembros();
        setActiveTab('members');
      } else {
        setMensajeError(res.error || 'No se pudo crear el usuario. Intenta nuevamente.');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setCreando(false);
    }
  };

  // Abrir selector de color
  const handleOpenColorPickerForMember = (member: Profile) => {
    const current = member.color || getTagColorDef(member.nombre).id;
    const def = getTagColorDef(member.nombre, member.color);
    const hex = current.startsWith('#') ? current : (def.customHex || '#2563eb');
    setMemberForColorPicker(member);
    setTempColor(current);
    setTempHexInput(hex);
  };

  // Guardar cambio de color
  const handleAceptarCambioColor = async () => {
    if (!memberForColorPicker) return;
    setGuardandoColor(true);
    try {
      const colorFinal = tempColor.startsWith('#') ? tempColor.toLowerCase() : tempColor;
      await ticketsService.updateUserColor(memberForColorPicker.id, colorFinal, memberForColorPicker.nombre);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberForColorPicker.id ? { ...m, color: colorFinal } : m))
      );
      if (onUserUpdated) {
        onUserUpdated({ ...memberForColorPicker, color: colorFinal });
      }
      setMemberForColorPicker(null);
    } catch (err) {
      console.error('Error actualizando color del miembro:', err);
    } finally {
      setGuardandoColor(false);
    }
  };

  // Abrir modal de edición de datos de usuario (Nombre, Sector/Área, Permisos/Rol)
  const handleOpenEditMember = (member: Profile) => {
    const current = member.color || getTagColorDef(member.nombre).id;
    const def = getTagColorDef(member.nombre, member.color);
    const hex = current.startsWith('#') ? current : (def.customHex || '#2563eb');

    setMemberToEdit(member);
    setEditNombre(member.nombre);
    setEditArea(member.area || 'Gráfica');
    setEditRol(member.rol || 'operador');
    setEditColor(current);
    setEditHexInput(hex);
  };

  // Guardar edición de datos de usuario
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;

    const nomLimpio = editNombre.trim();
    if (!nomLimpio) {
      setMensajeError('El nombre no puede estar vacío.');
      return;
    }

    setGuardandoEdicion(true);
    try {
      const colorFinal = editColor.startsWith('#') ? editColor.toLowerCase() : editColor;
      const res = await ticketsService.updateTeamMember(memberToEdit.id, {
        nombre: nomLimpio,
        area: editArea,
        rol: editRol,
        color: colorFinal,
      });

      if (res.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberToEdit.id
              ? {
                  ...m,
                  nombre: nomLimpio,
                  area: editArea,
                  rol: editRol,
                  color: colorFinal,
                }
              : m
          )
        );

        if (onUserUpdated) {
          onUserUpdated({
            ...memberToEdit,
            nombre: nomLimpio,
            area: editArea,
            rol: editRol,
            color: colorFinal,
          });
        }

        setMensajeExito(`Datos de ${nomLimpio} actualizados correctamente.`);
        setMemberToEdit(null);
      } else {
        setMensajeError(res.error || 'No se pudieron actualizar los datos.');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al actualizar usuario.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Confirmar eliminación de usuario
  const handleConfirmarEliminar = async () => {
    if (!memberToDelete) return;
    setEliminandoMiembro(true);
    try {
      const res = await ticketsService.deleteTeamMember(memberToDelete.id, memberToDelete.email);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
        if (onUserDeleted) {
          onUserDeleted(memberToDelete.id);
        }
        setMensajeExito(`El usuario ${memberToDelete.nombre} ha sido eliminado.`);
        setMemberToDelete(null);
      } else {
        setMensajeError(res.error || 'No se pudo eliminar el usuario.');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al eliminar usuario.');
    } finally {
      setEliminandoMiembro(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-[#252525] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-400/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
                <span>Gestión de Equipo &amp; Usuarios</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase">
                  Super Admin
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Administra roles, sectores, etiquetas y cuentas de acceso de Contenidos y Gráfica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de navegación */}
        <div className="px-6 pt-3 border-b border-neutral-200 dark:border-neutral-800 flex space-x-2 bg-white dark:bg-[#1e1e1e] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'members'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Miembros del Equipo ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'create'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>

        {/* Notificaciones de Éxito / Error */}
        {mensajeExito && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
            <button onClick={() => setMensajeExito(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {mensajeError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between shrink-0">
            <span>{mensajeError}</span>
            <button onClick={() => setMensajeError(null)} className="text-rose-600 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contenido según pestaña con Scroll Asegurado */}
        <div className="p-6 pb-16 overflow-y-auto flex-1 [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent] dark:[scrollbar-color:#404040_transparent]">
          {activeTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Edita sectores, permisos, colores o elimina usuarios que ya no pertenezcan al equipo.
                </span>
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo</span>
                </button>
              </div>

              {loadingMembers ? (
                <div className="py-12 flex flex-col items-center justify-center text-neutral-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
                  <span className="text-xs">Cargando miembros...</span>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#1a1a1a]">
                  {members.map((member) => {
                    const isSelf = Boolean(
                      currentUserProfile &&
                      (currentUserProfile.id === member.id ||
                        currentUserProfile.email.toLowerCase() === member.email.toLowerCase())
                    );

                    return (
                      <div
                        key={member.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition"
                      >
                        {/* Datos del Miembro */}
                        <div className="flex items-center space-x-3 min-w-0">
                          <UserTagBadge
                            name={member.nombre}
                            colorId={member.color}
                            size="md"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                {member.nombre}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  Tú
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                              {member.email}
                            </span>
                          </div>
                        </div>

                        {/* Badges de Área, Rol y Botones de Acción */}
                        <div className="flex items-center space-x-1.5 shrink-0 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              member.area === 'Gráfica'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
                                : member.area === 'Contenidos'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50'
                            }`}
                          >
                            {member.area}
                          </span>

                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                            {member.rol}
                          </span>

                          {/* Botón Color */}
                          <button
                            type="button"
                            onClick={() => handleOpenColorPickerForMember(member)}
                            title="Personalizar color de etiqueta"
                            className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer flex items-center space-x-1 text-xs font-medium"
                          >
                            <Palette className="w-3.5 h-3.5 text-amber-500" />
                            <span>Color</span>
                          </button>

                          {/* Botón Editar (Nombre, Área, Rol) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditMember(member)}
                            title="Modificar nombre, equipo/sector y permisos"
                            className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-neutral-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer flex items-center space-x-1 text-xs font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                            <span>Editar</span>
                          </button>

                          {/* Botón Eliminar Usuario */}
                          {!isSelf ? (
                            <button
                              type="button"
                              onClick={() => setMemberToDelete(member)}
                              title="Eliminar usuario del sistema"
                              className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span 
                              className="p-1 text-neutral-300 dark:text-neutral-600 cursor-not-allowed" 
                              title="No puedes eliminar tu propia cuenta"
                            >
                              <Trash2 className="w-3.5 h-3.5 opacity-30" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCrearUsuario} className="space-y-4">
              {/* Selector de Área / Sector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  1. Área de trabajo / Sector:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAreaChange('Gráfica')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      area === 'Gráfica'
                        ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 font-bold ring-1 ring-purple-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🎨</span>
                      <span className="text-xs font-bold">Gráfica / Diseño</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Ejecutan pedidos, suben links de Drive y cambian estados
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAreaChange('Contenidos')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      area === 'Contenidos'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold ring-1 ring-emerald-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📝</span>
                      <span className="text-xs font-bold">Contenidos</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Crean pedidos de piezas, revisan entregas y aprueban
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAreaChange('Todas')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      area === 'Todas'
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold ring-1 ring-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base">⭐</span>
                      <span className="text-xs font-bold">Administrador</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Acceso total a todas las funciones y sectores
                    </p>
                  </button>
                </div>
              </div>

              {/* Nombre y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    2. Nombre de la persona:
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ej: Nacho, Lucía, Sofi..."
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    3. Correo electrónico (Login):
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Contraseña Inicial */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  4. Contraseña inicial para su acceso:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
                  />
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 block">
                  El usuario podrá ingresar de inmediato con este correo y esta contraseña.
                </span>
              </div>

              {/* Selección de Color con Selector Libre HEX o Paleta Rápida */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    5. Color de su etiqueta de asignación:
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <UserTagBadge
                      name={nombre || 'Nuevo Miembro'}
                      colorId={selectedColor}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Selector de color libre y entrada HEX */}
                <div className="p-3 bg-neutral-50 dark:bg-[#242424] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center space-x-3">
                  <label 
                    className="w-9 h-9 rounded-xl border border-neutral-300 dark:border-neutral-700 cursor-pointer overflow-hidden shadow-2xs flex items-center justify-center shrink-0 relative"
                    style={{ backgroundColor: createHexInput }}
                    title="Haz clic para elegir cualquier color libre"
                  >
                    <input
                      type="color"
                      value={createHexInput.startsWith('#') && createHexInput.length === 7 ? createHexInput : '#9333ea'}
                      onChange={(e) => {
                        setSelectedColor(e.target.value);
                        setCreateHexInput(e.target.value);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Pipette className="w-3.5 h-3.5 text-white drop-shadow-md pointer-events-none" />
                  </label>
                  <div className="flex-1 flex items-center space-x-2">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Color libre:</span>
                    <input
                      type="text"
                      value={createHexInput}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        if (!val.startsWith('#')) val = `#${val}`;
                        setCreateHexInput(val);
                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          setSelectedColor(val);
                        }
                      }}
                      placeholder="#9333EA"
                      maxLength={7}
                      className="w-28 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 uppercase"
                    />
                  </div>
                </div>

                {/* Paleta rápida */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {TAG_COLOR_OPTIONS.map((col) => {
                    const isSelected = selectedColor === col.id || selectedColor === col.customHex;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setSelectedColor(col.id);
                          if (col.customHex) setCreateHexInput(col.customHex);
                        }}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          isSelected
                            ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold ring-2 ring-neutral-900/10 dark:ring-white/10'
                            : 'border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${col.dotBg} shrink-0`} />
                        <span className="truncate text-[11px]">{col.label.split('/')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Enviar */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creando usuario...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Crear Usuario &amp; Guardar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ✏️ MODAL EDITAR USUARIO: SECTOR, PERMISOS, NOMBRE */}
      {memberToEdit && (
        <div 
          className="fixed inset-0 z-60 bg-neutral-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-100"
          onClick={() => setMemberToEdit(null)}
        >
          <div 
            className="w-full max-w-lg bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-[#252525] shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Modificar Usuario: {memberToEdit.nombre}
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {memberToEdit.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemberToEdit(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarEdicion} className="p-5 overflow-y-auto flex-1 space-y-4 [scrollbar-width:thin]">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Nombre visible:
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Sector / Área */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Sector / Equipo al que pertenece:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditArea('Gráfica')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editArea === 'Gráfica'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold ring-1 ring-purple-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center space-x-1">
                      <span>🎨</span>
                      <span>Gráfica</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Diseño</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditArea('Contenidos')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editArea === 'Contenidos'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold ring-1 ring-emerald-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center space-x-1">
                      <span>📝</span>
                      <span>Contenidos</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Pedidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditArea('Todas')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      editArea === 'Todas'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold ring-1 ring-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center space-x-1">
                      <span>⭐</span>
                      <span>Todas</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Global</span>
                  </button>
                </div>
              </div>

              {/* Permisos / Rol */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Nivel de Permisos / Rol:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRol('operador')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRol === 'operador'
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="text-xs font-semibold">Operador</div>
                    <span className="text-[10px] text-neutral-400">Ejecuta pedidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRol('solicitante')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRol === 'solicitante'
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="text-xs font-semibold">Solicitante</div>
                    <span className="text-[10px] text-neutral-400">Crea y aprueba</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRol('superadmin')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRol === 'superadmin'
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="text-xs font-semibold">Super Admin</div>
                    <span className="text-[10px] text-neutral-400">Control total</span>
                  </button>
                </div>
              </div>

              {/* Previsualización de Etiqueta */}
              <div className="p-3 bg-neutral-50 dark:bg-[#252525] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Etiqueta resultante:</span>
                <UserTagBadge name={editNombre || 'Usuario'} colorId={editColor} size="md" />
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMemberToEdit(null)}
                  disabled={guardandoEdicion}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {guardandoEdicion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL CONFIRMAR ELIMINACIÓN DE USUARIO */}
      {memberToDelete && (
        <div 
          className="fixed inset-0 z-60 bg-neutral-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-100"
          onClick={() => setMemberToDelete(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ¿Eliminar usuario del equipo?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Esta acción dará de baja la cuenta y eliminará sus accesos.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-[#252525] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center space-x-3">
              <UserTagBadge name={memberToDelete.nombre} colorId={memberToDelete.color} size="md" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                  {memberToDelete.nombre}
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                  {memberToDelete.email} • {memberToDelete.area}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={eliminandoMiembro}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={eliminandoMiembro}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {eliminandoMiembro ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, eliminar usuario</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO CENTRADO PARA ELEGIR COLOR CON PREVIEW Y BOTÓN ACEPTAR */}
      {memberForColorPicker && (
        <div 
          className="fixed inset-0 z-60 bg-neutral-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-100"
          onClick={() => setMemberForColorPicker(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del diálogo */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-[#252525] shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Color para {memberForColorPicker.nombre}
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Prueba cualquier color y guarda cuando estés conforme
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemberForColorPicker(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido con Previsualización y Selector de Color Libre */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 [scrollbar-width:thin]">
              
              {/* Previsualización del miembro limpia sin texto redundante */}
              <div className="p-3.5 bg-neutral-50 dark:bg-[#252525] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                <UserTagBadge
                  name={memberForColorPicker.nombre}
                  colorId={tempColor}
                  size="md"
                />
              </div>

              {/* Selector de Color Libre (HTML5 Color Wheel & HEX) */}
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1a1a1a] space-y-2.5">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5">
                  <Pipette className="w-3.5 h-3.5 text-amber-500" />
                  <span>Selector de Color Libre (Cualquier Color)</span>
                </span>

                <div className="flex items-center space-x-3">
                  <label 
                    className="relative w-11 h-11 rounded-xl border-2 border-neutral-300 dark:border-neutral-700 cursor-pointer overflow-hidden shadow-2xs hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shrink-0"
                    style={{ backgroundColor: tempHexInput }}
                    title="Haz clic para abrir el selector de color libre"
                  >
                    <input
                      type="color"
                      value={tempHexInput.startsWith('#') && tempHexInput.length === 7 ? tempHexInput : '#2563eb'}
                      onChange={(e) => {
                        setTempColor(e.target.value);
                        setTempHexInput(e.target.value);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Pipette className="w-4 h-4 text-white drop-shadow-md pointer-events-none" />
                  </label>

                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Código HEX
                    </label>
                    <input
                      type="text"
                      value={tempHexInput}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        if (!val.startsWith('#')) val = `#${val}`;
                        setTempHexInput(val);
                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          setTempColor(val);
                        }
                      }}
                      placeholder="#2563EB"
                      maxLength={7}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#222222] text-neutral-900 dark:text-neutral-100 uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Paleta rápida de 10 colores */}
              <div>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-2">
                  O tonos rápidos de Notion:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {TAG_COLOR_OPTIONS.map((col) => {
                    const isSelected = tempColor === col.id || tempColor === col.customHex;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setTempColor(col.id);
                          if (col.customHex) setTempHexInput(col.customHex);
                        }}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold ring-2 ring-neutral-900/10'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${col.dotBg} shrink-0 ring-1 ring-black/10`} />
                        <span className="truncate text-[11px]">{col.label.split('/')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Pie con Botón Cancelar y Botón Aceptar Explícito */}
            <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#222222] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setMemberForColorPicker(null)}
                disabled={guardandoColor}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleAceptarCambioColor}
                disabled={guardandoColor}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {guardandoColor ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Aceptar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamManagementModal;
