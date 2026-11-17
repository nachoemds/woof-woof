// public/sw.js
// Service Worker oficial de Woof Woof para Notificaciones Push y Alertas en Segundo Plano

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Escuchar eventos Push nativos del navegador (Push API)
self.addEventListener('push', (event) => {
  let payload = {
    title: '🐾 Novedad en Woof Woof',
    body: 'Tienes una nueva actualización en el tablero de tickets.',
    icon: '/IsoYema.svg',
    badge: '/IsoYema.svg',
    tag: 'woof-push-' + Date.now(),
    data: { ticketId: null, url: '/' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          ticketId: parsed.ticketId || parsed.data?.ticketId || null,
          url: parsed.url || parsed.data?.url || '/',
        },
      };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/IsoYema.svg',
      badge: payload.badge || '/IsoYema.svg',
      tag: payload.tag,
      renotify: true,
      silent: true,
      requireInteraction: false,
      data: payload.data,
    })
  );
});

// Escuchar mensajes desde la aplicación principal cuando la pestaña está en segundo plano
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;

  const { title, body, ticketId, tag } = event.data.payload || {};

  event.waitUntil(
    self.registration.showNotification(title || '🐾 Woof Woof', {
      body: body || 'Nueva actualización en un ticket.',
      icon: '/IsoYema.svg',
      badge: '/IsoYema.svg',
      tag: tag || `woof-ticket-${ticketId || Date.now()}`,
      renotify: true,
      silent: true,
      requireInteraction: false,
      data: {
        ticketId: ticketId || null,
        url: '/',
      },
    })
  );
});

// Al hacer clic en la notificación nativa del sistema operativo (Mac / Windows)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ticketId = event.notification.data ? event.notification.data.ticketId : null;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una pestaña de Woof Woof abierta, enfocarla y abrir el ticket
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              ticketId: ticketId,
            });
            return;
          }
        }
        // Si no había pestaña abierta, abrir una nueva
        if (self.clients.openWindow) {
          const targetUrl = ticketId ? `/?ticket=${ticketId}` : '/';
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
