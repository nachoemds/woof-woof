// scripts/gen_dog_bark.js
import fs from 'fs';

const sampleRate = 44100;

function createDogBarkWav() {
  const duration = 0.55; // 550 ms for a crisp double woof
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(totalSamples);

  // Helper to add a bark at a given start time
  function addBark(startTimeSec, pitchMult, volMult) {
    const barkDuration = 0.20;
    const startIdx = Math.floor(startTimeSec * sampleRate);
    const endIdx = Math.min(totalSamples, startIdx + Math.floor(barkDuration * sampleRate));

    let phase = 0;
    let phaseTri = 0;
    let subPhase = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const t = (i - startIdx) / sampleRate;
      const progress = t / barkDuration;

      // Frequency drop: from 420Hz down to 220Hz
      const freq = (420 * pitchMult) * Math.pow(220 / 420, progress);
      const subFreq = freq * 0.5;

      phase += (2 * Math.PI * freq) / sampleRate;
      phaseTri += (2 * Math.PI * freq * 1.5) / sampleRate;
      subPhase += (2 * Math.PI * subFreq) / sampleRate;

      // Amplitude envelope: explosive attack (15ms), snappy decay
      let env = 0;
      if (t < 0.015) {
        env = t / 0.015;
      } else {
        env = Math.exp(-9 * (t - 0.015));
      }

      // Rich harmonic synthesis
      const saw = (phase % (2 * Math.PI)) / Math.PI - 1;
      const tri = 2 * Math.abs(2 * ((phaseTri / (2 * Math.PI)) % 1) - 1) - 1;
      const sub = Math.sin(subPhase);
      const noise = (Math.random() * 2 - 1) * 0.25;

      // Formant filtering approximation (peaks around 650Hz and 1200Hz)
      const formant = Math.sin(phase * 1.8) * 0.4 + Math.sin(phase * 2.8) * 0.2;

      let sample = (saw * 0.45 + tri * 0.3 + sub * 0.2 + noise + formant) * env * volMult;
      sample = Math.tanh(sample * 1.8);

      buffer[i] += sample;
    }
  }

  // Bark 1: "Woof!"
  addBark(0.01, 1.0, 0.95);
  // Bark 2: "Woof!"
  addBark(0.24, 1.12, 0.82);

  // Normalize
  let maxAmp = 0;
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  if (maxAmp > 0) {
    const norm = 0.92 / maxAmp;
    for (let i = 0; i < totalSamples; i++) {
      buffer[i] *= norm;
    }
  }

  // Convert to 16-bit PCM WAV
  const byteRate = sampleRate * 2; // 16-bit mono
  const dataSize = totalSamples * 2;
  const wavBuffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write('WAVE', 8);

  // fmt chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // Chunk size
  wavBuffer.writeUInt16LE(1, 20);  // Audio format 1 = PCM
  wavBuffer.writeUInt16LE(1, 22);  // 1 channel (mono)
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(2, 32);  // Block align
  wavBuffer.writeUInt16LE(16, 34); // Bits per sample

  // data chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    wavBuffer.writeInt16LE(Math.floor(intSample), 44 + i * 2);
  }

  return wavBuffer;
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

const wavData = createDogBarkWav();
fs.writeFileSync('./public/woofwoof.mp3', wavData);
fs.writeFileSync('./public/woofwoof.wav', wavData);
fs.writeFileSync('./public/woof.mp3', wavData);
fs.writeFileSync('./public/ladrido.mp3', wavData);

console.log('Successfully generated woofwoof audio files in ./public/');
