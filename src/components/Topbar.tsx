// src/components/Topbar.tsx
import React, { useState, useEffect } from 'react';
import { UserRole, Profile } from '../types';
import { LogOut, Sun, Moon, Users, Palette, Bell, BellRing, BellOff } from 'lucide-react';
import { WoofLogo } from './WoofLogo';
import { reproducirLadridoAlerta } from '../lib/audioAlert';
import { getTagColorDef, isLightHex } from '../lib/tagColors';
import {
  getPushPermissionState,
  isPushNotificationEnabled,
  setPushNotificationEnabled,
  requestPushPermission,
  sendNativePushNotification,
  PushPermissionState,
} from '../lib/pushNotifications';

interface TopbarProps {
  currentRole: UserRole;
  onRoleChange?: (role: UserRole) => void;
  userProfile?: Profile | null;
  onSignOut?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenNewTicketModal?: () => void;
  onOpenTeamModal?: () => void;
  onOpenColorPicker?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  userProfile,
  onSignOut,
  isDarkMode = true,
  onToggleDarkMode,
  onOpenTeamModal,
  onOpenColorPicker,
}) => {
  const colorDef = userProfile ? getTagColorDef(userProfile.nombre, userProfile.color) : null;

  const [pushPerm, setPushPerm] = useState<PushPermissionState>(() => getPushPermissionState());
  const [pushEnabled, setPushEnabledState] = useState<boolean>(() => isPushNotificationEnabled());

  useEffect(() => {
    const syncPushState = () => {
      setPushPerm(getPushPermissionState());
      setPushEnabledState(isPushNotificationEnabled());
    };
    window.addEventListener('focus', syncPushState);
    return () => window.removeEventListener('focus', syncPushState);
  }, []);

  const handleTogglePush = async () => {
    const currentPerm = getPushPermissionState();

    // Si aún no dio permiso en el navegador, solicitarlo ahora
    if (currentPerm === 'default') {
      const result = await requestPushPermission();
      setPushPerm(result);
      setPushEnabledState(isPushNotificationEnabled());
      return;
    }

    // Si el navegador tiene permisos concedidos, alternar encendido/pausa
    if (currentPerm === 'granted') {
      const nextState = !pushEnabled;
      setPushNotificationEnabled(nextState);
      setPushEnabledState(nextState);

      if (nextState) {
        await sendNativePushNotification({
          title: '🔔 Alertas en 2do plano activadas',
          body: 'Te avisaremos aquí cuando haya novedades aunque estés en otra pestaña o programa.',
          tag: 'woof-toggle-on',
          forceWhenVisible: true,
        });
      }
      return;
    }
  };

  const isPushActive = pushPerm === 'granted' && pushEnabled;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1b1b1b]/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Isotipo & Branding Oficial "Woof Woof" con Easter Egg de ladrido */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => reproducirLadridoAlerta(true)}
            className="flex items-center justify-center p-1 rounded-xl bg-amber-400/10 dark:bg-amber-400/20 border border-amber-400/30 dark:border-amber-400/40 shadow-2xs cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            title="Woof! 🐾"
          >
            <WoofLogo size={32} animated={true} />
          </button>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight text-lg">
              Woof Woof
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm hidden sm:inline font-medium">
              Plataforma de gestión y seguimiento de tickets
            </span>
          </div>
        </div>

        {/* Sección de Acciones: Notificaciones Push, Modo Oscuro, Equipo, Perfil y Salir */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          
          {/* Botón Gestión de Equipo para Superadmin */}
          {userProfile?.rol === 'superadmin' && onOpenTeamModal && (
            <button
              onClick={onOpenTeamModal}
              title="Administrar Usuarios de Contenidos y Gráfica &amp; Colores"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 dark:border-amber-400/30 text-xs font-bold transition cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
            >
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Equipo &amp; Usuarios</span>
              <span className="sm:hidden">Equipo</span>
            </button>
          )}

          {/* Botón de Notificaciones Nativas del Navegador (Push en 2do plano) */}
          {pushPerm !== 'unsupported' && (
            <button
              type="button"
              onClick={handleTogglePush}
              title={
                pushPerm === 'denied'
                  ? 'Las notificaciones están bloqueadas en tu navegador. Habilítalas desde el candado de la barra de direcciones.'
                  : isPushActive
                  ? 'Alertas nativas en segundo plano ACTIVAS (Clic para pausar)'
                  : pushPerm === 'default'
                  ? 'Habilitar notificaciones nativas cuando la pestaña esté en segundo plano'
                  : 'Alertas en segundo plano PAUSADAS (Clic para activar)'
              }
              className={`inline-flex items-center space-x-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs ${
                pushPerm === 'denied'
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 opacity-75'
                  : isPushActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50'
                  : pushPerm === 'default'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 hover:bg-amber-100/80 animate-pulse'
                  : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700/80'
              }`}
            >
              {pushPerm === 'denied' ? (
                <BellOff className="w-4 h-4 text-rose-500 shrink-0" />
              ) : isPushActive ? (
                <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Bell className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden md:inline">
                {pushPerm === 'denied'
                  ? 'Push Bloqueado'
                  : isPushActive
                  ? 'Alertas 2do Plano'
                  : pushPerm === 'default'
                  ? 'Activar Alertas'
                  : 'Alertas Pausadas'}
              </span>
            </button>
          )}

          {/* Selector de Modo Oscuro / Claro */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro (Notion Dark)'}
              className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-50 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700 rounded-xl transition cursor-pointer shadow-2xs"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-90 duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>
          )}

          {/* Perfil de Usuario con selector de color personal */}
          {userProfile && (
            <div className="flex items-center space-x-1.5 bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700/80 pl-2.5 pr-1.5 py-1 rounded-xl text-xs">
              <div 
                style={colorDef?.customHex ? { backgroundColor: colorDef.customHex, color: isLightHex(colorDef.customHex) ? '#171717' : '#ffffff' } : undefined}
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shadow-2xs shrink-0 ${
                  !colorDef?.customHex ? (colorDef ? colorDef.avatarBg : 'bg-neutral-900 text-white') : ''
                }`}
              >
                {userProfile.nombre ? userProfile.nombre.charAt(0).toUpperCase() : 'U'}
              </div>

              <div className="flex flex-col text-left pl-1">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 leading-tight truncate max-w-[90px] sm:max-w-none">
                  {userProfile.nombre || userProfile.email}
                </span>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                    userProfile.rol === 'superadmin' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40' 
                      : userProfile.rol === 'operador'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  }`}>
                    {userProfile.rol}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500 text-[10px] hidden sm:inline">•</span>
                  <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-medium hidden sm:inline">
                    {userProfile.area}
                  </span>
                </div>
              </div>

              {/* Botón para cambiar el color de mi etiqueta */}
              {onOpenColorPicker && (
                <button
                  type="button"
                  onClick={onOpenColorPicker}
                  title="Personalizar el color de mi etiqueta"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition cursor-pointer ml-1"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Botón Salir */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Cerrar sesión"
              className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
};

export default Topbar;
