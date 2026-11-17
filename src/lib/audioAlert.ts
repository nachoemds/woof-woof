// src/lib/audioAlert.ts
/**
 * Sistema de audio oficial "Woof Woof"
 * Reproduce SIEMPRE el archivo de ladrido cargado en el proyecto (/ladrido.mp3 / /woofwoof.mp3).
 *
 * Para evitar que Chrome/Safari bloqueen `new Audio().play()` cuando llega una notificación
 * por WebSocket (Supabase Realtime) y disparen otro sonido por error:
 * 1. Precargamos y decodificamos el archivo real (/ladrido.mp3) en memoria (AudioBuffer) al iniciar.
 * 2. Desbloqueamos el canal de audio en el primer clic/tecla del usuario.
 * 3. Al llegar una notificación, reproducimos el archivo real cargado sin usar sintetizadores artificiales.
 */

const SOUND_FILES = ['/ladrido.mp3', '/woofwoof.mp3', '/woof.mp3', '/woofwoof.wav'];

let audioCtx: AudioContext | null = null;
let decodedBarkBuffer: AudioBuffer | null = null;
let isLoadingBuffer = false;
let preloadedAudioElement: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Precarga el archivo real /ladrido.mp3 en memoria para que pueda sonar instantáneamente
 * incluso cuando el evento proviene de Supabase Realtime en segundo plano.
 */
async function preloadRealBarkFile(): Promise<void> {
  if (typeof window === 'undefined' || decodedBarkBuffer || isLoadingBuffer) return;
  isLoadingBuffer = true;

  try {
    // 1. Preparar elemento HTMLAudioElement reutilizable apuntando a /ladrido.mp3
    if (!preloadedAudioElement) {
      preloadedAudioElement = new Audio('/ladrido.mp3');
      preloadedAudioElement.preload = 'auto';
      preloadedAudioElement.volume = 1.0;
    }

    // 2. Decodificar el archivo de audio real en AudioBuffer
    const ctx = getAudioContext();
    if (!ctx) return;

    for (const url of SOUND_FILES) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          decodedBarkBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          break;
        }
      } catch {
        // Intentar con el siguiente nombre de archivo en public/
      }
    }
  } catch {
    // Ignorar errores de red iniciales
  } finally {
    isLoadingBuffer = false;
  }
}

// Desbloqueo y precarga automática del archivo /ladrido.mp3 ante la primera interacción del usuario
if (typeof window !== 'undefined') {
  const desbloquearYPrecargarAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    preloadRealBarkFile();
  };

  window.addEventListener('click', desbloquearYPrecargarAudio, { passive: true });
  window.addEventListener('keydown', desbloquearYPrecargarAudio, { passive: true });
  window.addEventListener('touchstart', desbloquearYPrecargarAudio, { passive: true });

  // Iniciar precarga apenas carga el módulo
  setTimeout(() => {
    preloadRealBarkFile();
  }, 300);
}

/**
 * Reproduce el buffer decodificado del archivo real /ladrido.mp3
 */
function playDecodedBarkBuffer(): boolean {
  const ctx = getAudioContext();
  if (!ctx || !decodedBarkBuffer) return false;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const source = ctx.createBufferSource();
    source.buffer = decodedBarkBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reproduce el sonido de alerta original cargado (/ladrido.mp3)
 */
export function reproducirLadridoAlerta(forzar = false) {
  if (typeof window === 'undefined') return;

  const sonidoHabilitado = localStorage.getItem('woof_sound_enabled');
  if (sonidoHabilitado === 'false' && !forzar) {
    return;
  }

  // 1. Si el archivo /ladrido.mp3 ya está decodificado en memoria, reproducirlo directamente
  // (Esto garantiza que SIEMPRE suene el archivo real de ladrido sin ser bloqueado por el navegador)
  if (decodedBarkBuffer && playDecodedBarkBuffer()) {
    return;
  }

  // 2. Reproducir directamente el archivo /ladrido.mp3 mediante HTMLAudioElement
  try {
    const audio = preloadedAudioElement || new Audio('/ladrido.mp3');
    audio.currentTime = 0;
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Fallback inmediato a /woofwoof.mp3 si /ladrido.mp3 no estuviera disponible
        try {
          const fallbackAudio = new Audio('/woofwoof.mp3');
          fallbackAudio.volume = 1.0;
          fallbackAudio.play().catch(() => {});
        } catch {}
      });
    }
    // Asegurar que quede decodificado para las próximas notificaciones en tiempo real
    preloadRealBarkFile();
  } catch (err) {
    console.warn('Error reproduciendo /ladrido.mp3:', err);
  }
}

export function isWoofSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('woof_sound_enabled') !== 'false';
}

export function setWoofSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('woof_sound_enabled', enabled ? 'true' : 'false');
}
