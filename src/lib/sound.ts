// src/lib/sound.ts
/**
 * Generador de sonido de ladrido de perro de tamaño mediano usando Web Audio API.
 * 100% nativo, sin dependencias externas ni archivos pesados.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
 * Sintetiza un ladrido canino orgánico de perro mediano:
 * - Tono base en ~360Hz - 420Hz que cae rápidamente a ~220Hz.
 * - Modulación de garganta tipo "woof" con formantes acústicos.
 * - Golpe de aire inicial con ruido filtrado (ataque sónico).
 */
function emitirLadridoIndividual(ctx: AudioContext, startTime: number, pitchMultiplier = 1.0, volume = 0.7) {
  // 1. Oscilador principal (cuerdas vocales caninas)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();

  // Tipo diente de sierra con armónicos ricos
  osc.type = 'sawtooth';

  // Frecuencia inicial rápida y caída acústica
  const startFreq = 420 * pitchMultiplier;
  const midFreq = 340 * pitchMultiplier;
  const endFreq = 210 * pitchMultiplier;

  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(midFreq, startTime + 0.04);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.16);

  // Filtro de formante ("resonancia de hocico / ladrido")
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(750 * pitchMultiplier, startTime);
  filter.frequency.exponentialRampToValueAtTime(500 * pitchMultiplier, startTime + 0.16);
  filter.Q.setValueAtTime(3.2, startTime);

  // Envolvente de volumen (ataque seco, cuerpo lleno, caída rápida)
  oscGain.gain.setValueAtTime(0.001, startTime);
  oscGain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  oscGain.gain.exponentialRampToValueAtTime(volume * 0.5, startTime + 0.08);
  oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

  osc.connect(filter);
  filter.connect(oscGain);
  oscGain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.2);

  // 2. Golpe de aire / aliento de ataque (ruido blanco filtrado para el sonido "Wff")
  const bufferSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(950 * pitchMultiplier, startTime);
  noiseFilter.Q.setValueAtTime(2.0, startTime);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.45, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(startTime);
  noise.stop(startTime + 0.08);
}

/**
 * Reproduce el sonido de alerta "Woof Woof" (doble ladrido de perro mediano, enérgico y simpático)
 */
export function playDogBark(volume: number = 0.65): void {
  // Verificar si el usuario tiene el sonido activado
  try {
    const soundEnabled = localStorage.getItem('woof_sound_enabled');
    if (soundEnabled === 'false') {
      return;
    }
  } catch {}

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Primer ladrido: "Woof!"
  emitirLadridoIndividual(ctx, now, 1.0, volume);

  // Segundo ladrido inmediato un poco más grave: "...Woof!"
  emitirLadridoIndividual(ctx, now + 0.16, 0.92, volume * 0.85);
}

/**
 * Comprueba si el sonido canino está activado en las preferencias locales
 */
export function isDogSoundEnabled(): boolean {
  try {
    return localStorage.getItem('woof_sound_enabled') !== 'false';
  } catch {
    return true;
  }
}

/**
 * Cambia el estado del sonido canino
 */
export function setDogSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('woof_sound_enabled', enabled ? 'true' : 'false');
  } catch {}
}
