// src/lib/audioAlert.ts
/**
 * Sistema de audio oficial "Woof Woof"
 * Prioridades de reproducción:
 * 1. Audio personalizado en memoria/localStorage (woof_custom_sound)
 * 2. Archivo /woofwoof.mp3 (servido desde la carpeta public/)
 * 3. Archivo /woofwoof.wav (servido desde la carpeta public/)
 * 4. Sintetizador acústico Web Audio API de respaldo para garantizar que SIEMPRE suene.
 */

let audioCtx: AudioContext | null = null;

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

// Desbloqueo del contexto de audio ante cualquier clic o tecla del usuario
if (typeof window !== 'undefined') {
  const desbloquearAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', desbloquearAudio, { passive: true });
  window.addEventListener('keydown', desbloquearAudio, { passive: true });
  window.addEventListener('touchstart', desbloquearAudio, { passive: true });
}

/**
 * Sintetizador acústico de respaldo (ladrido canino de perro mediano)
 */
function sintetizarLadrido(
  ctx: AudioContext,
  startTime: number,
  pitchMultiplier = 1,
  volumeMultiplier = 1
) {
  const duracion = 0.22;
  const osc = ctx.createOscillator();
  const oscTri = ctx.createOscillator();
  osc.type = 'sawtooth';
  oscTri.type = 'triangle';

  const freqInicial = 380 * pitchMultiplier;
  const freqFinal = 220 * pitchMultiplier;

  osc.frequency.setValueAtTime(freqInicial, startTime);
  osc.frequency.exponentialRampToValueAtTime(freqFinal, startTime + duracion);

  oscTri.frequency.setValueAtTime(freqInicial * 0.5, startTime);
  oscTri.frequency.exponentialRampToValueAtTime(freqFinal * 0.5, startTime + duracion);

  const formantFilter = ctx.createBiquadFilter();
  formantFilter.type = 'bandpass';
  formantFilter.frequency.setValueAtTime(650, startTime);
  formantFilter.Q.setValueAtTime(2.8, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.6 * volumeMultiplier, startTime + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duracion);

  osc.connect(formantFilter);
  oscTri.connect(formantFilter);
  formantFilter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  oscTri.start(startTime);
  osc.stop(startTime + duracion);
  oscTri.stop(startTime + duracion);

  // Ruido de garganta
  const bufferSize = Math.floor(ctx.sampleRate * duracion);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(900, startTime);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.35 * volumeMultiplier, startTime + 0.025);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + duracion);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(startTime);
  noise.stop(startTime + duracion);
}

export function reproducirSintetizadorRespaldo() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const ahora = ctx.currentTime;
    sintetizarLadrido(ctx, ahora + 0.01, 1.0, 0.85);
    sintetizarLadrido(ctx, ahora + 0.22, 1.15, 0.75);
  } catch (err) {
    console.warn('Error sintetizando ladrido de respaldo:', err);
  }
}

/**
 * Guarda un archivo de sonido personalizado (Base64) en localStorage
 */
export function guardarSonidoPersonalizado(dataUrl: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('woof_custom_sound', dataUrl);
  } catch (err) {
    console.warn('No se pudo guardar el sonido en localStorage:', err);
  }
}

/**
 * Obtiene el sonido personalizado si existe
 */
export function obtenerSonidoPersonalizado(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('woof_custom_sound');
}

/**
 * Reproduce el sonido de alerta Woof Woof:
 * 1. Audio personalizado en localStorage
 * 2. Archivo /woofwoof.mp3
 * 3. Archivo /woofwoof.wav
 * 4. Sintetizador nativo de respaldo
 */
export function reproducirLadridoAlerta(forzar = false) {
  if (typeof window === 'undefined') return;

  const sonidoHabilitado = localStorage.getItem('woof_sound_enabled');
  if (sonidoHabilitado === 'false' && !forzar) {
    return;
  }

  // 1. Audio guardado directamente en el navegador por el usuario
  const customSound = localStorage.getItem('woof_custom_sound');
  if (customSound) {
    try {
      const audio = new Audio(customSound);
      audio.volume = 1.0;
      const promise = audio.play();
      if (promise) {
        promise.catch(() => reproducirSintetizadorRespaldo());
      }
      return;
    } catch {
      // Si falla, continuar
    }
  }

  // 2. Intentar reproducir el archivo de audio woofwoof.mp3
  try {
    const audio = new Audio('/woofwoof.mp3');
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn('Fallo reproducir /woofwoof.mp3:', err);
        // 3. Fallback a /woofwoof.wav
        try {
          const audioWav = new Audio('/woofwoof.wav');
          audioWav.volume = 1.0;
          const wavPromise = audioWav.play();
          if (wavPromise) {
            wavPromise.catch(() => reproducirSintetizadorRespaldo());
          }
        } catch {
          reproducirSintetizadorRespaldo();
        }
      });
    }
  } catch (err) {
    console.warn('Error iniciando Audio:', err);
    reproducirSintetizadorRespaldo();
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
