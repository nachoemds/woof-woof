// src/lib/pushNotifications.ts
/**
 * Servicio de Notificaciones Nativas del Navegador y Push API (Segundo Plano)
 * Permite alertar a los equipos de Contenidos y Gráfica incluso cuando la pestaña
 * está minimizada, en segundo plano o el usuario está usando otro programa (Figma, Drive, etc.).
 */

import { reproducirLadridoAlerta } from './audioAlert';

export type PushPermissionState = NotificationPermission | 'unsupported';

const PUSH_ENABLED_STORAGE_KEY = 'woof_push_enabled';

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Inicializa y registra el Service Worker (/sw.js) para soporte de Push en segundo plano
 * y escucha clics en las notificaciones del sistema operativo para abrir el ticket.
 */
export async function initPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;

    // Escuchar cuando el usuario hace clic en la notificación nativa para abrir el ticket
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK' && event.data.ticketId) {
        window.dispatchEvent(
          new CustomEvent('woof_open_ticket', {
            detail: { ticketId: event.data.ticketId },
          })
        );
      }
    });

    return reg;
  } catch (err) {
    console.warn('Aviso registrando Service Worker para notificaciones:', err);
    return null;
  }
}

/**
 * Devuelve el estado actual de los permisos nativos del navegador
 */
export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Verifica si el usuario tiene activadas las notificaciones de escritorio en su configuración
 */
export function isPushNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
  return saved !== 'false';
}

/**
 * Activa o pausa las notificaciones nativas para el usuario actual
 */
export function setPushNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Solicita permiso al usuario para mostrar notificaciones nativas de escritorio
 * y dispara una notificación de bienvenida si se concede.
 */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      setPushNotificationEnabled(true);
      await initPushServiceWorker();

      // Enviar notificación de prueba confirmando que está activo
      await sendNativePushNotification({
        title: '🐾 ¡Alertas de Woof Woof activadas!',
        body: 'Recibirás notificaciones aquí aunque tengas la pestaña en segundo plano o minimizada.',
        tag: 'woof-welcome-test',
        forceWhenVisible: true,
      });
    }

    return permission;
  } catch (err) {
    console.error('Error al solicitar permiso de notificaciones:', err);
    return Notification.permission;
  }
}

export interface NativePushOptions {
  title: string;
  body: string;
  ticketId?: string | number;
  tag?: string;
  /** Si es true, muestra el banner nativo incluso si la pestaña está enfocada */
  forceWhenVisible?: boolean;
  /** Si es true, reproduce también la alerta sonora de Woof Woof */
  playSound?: boolean;
}

/**
 * Dispara una notificación nativa del sistema operativo (macOS / Windows)
 * utilizando el Service Worker (ideal para segundo plano) o la API Notification estándar.
 */
export async function sendNativePushNotification({
  title,
  body,
  ticketId,
  tag,
  forceWhenVisible = false,
  playSound = true,
}: NativePushOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Reproducir sonido de alerta (funciona en primer y segundo plano)
  if (playSound) {
    try {
      reproducirLadridoAlerta();
    } catch {}
  }

  // 2. Verificar si el navegador soporta Notification API y si está habilitado
  if (!('Notification' in window)) return false;
  if (!isPushNotificationEnabled()) return false;
  if (Notification.permission !== 'granted') return false;

  // Comprobar si la pestaña está en segundo plano, minimizada o sin foco
  const isTabInBackground =
    document.hidden ||
    document.visibilityState !== 'visible' ||
    (typeof document.hasFocus === 'function' && !document.hasFocus());

  // Si la pestaña está en segundo plano (o se fuerza explícitamente), mostramos el banner nativo del SO
  if (!isTabInBackground && !forceWhenVisible) {
    // Incluso cuando está visible, si el usuario está en otra ventana o monitor, document.hasFocus() es false
    // y sí se habrá enviado. Si está mirando activamente la pestaña, ya ve el Toast en pantalla.
    return false;
  }

  const notificationTag = tag || `woof-ticket-${ticketId || Date.now()}`;

  // Intento 1: A través del Service Worker (máxima prioridad para pestañas en segundo plano)
  try {
    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration());
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        icon: '/IsoYema.svg',
        badge: '/IsoYema.svg',
        tag: notificationTag,
        silent: true, // Silencia el sonido por defecto de Windows/Mac para que solo suene ladrido.mp3
        data: { ticketId: ticketId ?? null, url: '/' },
      });
      return true;
    }
  } catch (err) {
    console.warn('Fallback a Notification directa:', err);
  }

  // Intento 2: API Notification estándar del navegador
  try {
    const notif = new Notification(title, {
      body,
      icon: '/IsoYema.svg',
      badge: '/IsoYema.svg',
      tag: notificationTag,
      silent: true, // Silencia el sonido por defecto de Windows/Mac para que solo suene ladrido.mp3
    });

    notif.onclick = () => {
      window.focus();
      if (ticketId !== undefined && ticketId !== null) {
        window.dispatchEvent(
          new CustomEvent('woof_open_ticket', {
            detail: { ticketId },
          })
        );
      }
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('No se pudo mostrar la notificación nativa:', err);
    return false;
  }
}
