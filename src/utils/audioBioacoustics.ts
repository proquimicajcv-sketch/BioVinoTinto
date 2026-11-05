/**
 * Bioacoustic Audio Synthesizer for Amphibian and Bird Vocalizations
 * Generates guttural pulsed resonance matching tropical frog advertisement calls
 */

let audioCtx: AudioContext | null = null;
let activeSourceNodes: AudioNode[] = [];
let isAudioRunning = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export interface SoundPlaybackController {
  stop: () => void;
}

export function playFrogCall(
  onTick?: (frequencyData: number[]) => void,
  onEnd?: () => void
): SoundPlaybackController {
  const ctx = getAudioContext();
  isAudioRunning = true;

  const now = ctx.currentTime;
  const pulseInterval = 0.65; // Time between pulses
  const totalPulses = 10;
  const duration = totalPulses * pulseInterval;

  // Cleanup past nodes
  activeSourceNodes.forEach((node) => {
    try {
      (node as AudioScheduledSourceNode).stop?.();
      node.disconnect();
    } catch {
      // Ignore
    }
  });
  activeSourceNodes = [];

  // Analyser node for real visual waveform
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.7, now);

  masterGain.connect(analyser);
  analyser.connect(ctx.destination);

  // Synthesize repeated "chack-chack" calls
  for (let i = 0; i < totalPulses; i++) {
    const pulseTime = now + i * pulseInterval;
    
    // Guttural resonant oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(420, pulseTime);
    osc1.frequency.exponentialRampToValueAtTime(190, pulseTime + 0.12);

    // Formant bandpass filter around 3.8 kHz (dominant frequency of Isthmohyla nacientes)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3800, pulseTime);
    filter.Q.setValueAtTime(5.0, pulseTime);

    // Amplitude envelope
    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0.001, pulseTime);
    pulseGain.gain.linearRampToValueAtTime(0.85, pulseTime + 0.02);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, pulseTime + 0.18);

    // Secondary sub-harmonic harmonic pulse
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(840, pulseTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, pulseTime);
    subGain.gain.linearRampToValueAtTime(0.25, pulseTime + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.001, pulseTime + 0.14);

    osc1.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(masterGain);

    osc2.connect(subGain);
    subGain.connect(masterGain);

    osc1.start(pulseTime);
    osc1.stop(pulseTime + 0.22);
    osc2.start(pulseTime);
    osc2.stop(pulseTime + 0.2);

    activeSourceNodes.push(osc1, osc2, pulseGain, subGain);
  }

  // Animation frame loop for waveform data
  let animId: number;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const updateSpectrum = () => {
    if (!isAudioRunning) return;
    analyser.getByteFrequencyData(dataArray);
    const normalized = Array.from(dataArray.slice(0, 16)).map((v) => v / 255);
    onTick?.(normalized);
    animId = requestAnimationFrame(updateSpectrum);
  };
  animId = requestAnimationFrame(updateSpectrum);

  const timer = setTimeout(() => {
    stopSound();
    onEnd?.();
  }, duration * 1000);

  const stopSound = () => {
    isAudioRunning = false;
    cancelAnimationFrame(animId);
    clearTimeout(timer);
    activeSourceNodes.forEach((n) => {
      try {
        (n as AudioScheduledSourceNode).stop?.();
        n.disconnect();
      } catch {
        // Ignore
      }
    });
    activeSourceNodes = [];
  };

  return { stop: stopSound };
}

/**
 * Plays user-uploaded or recorded audio with real-time waveform frequency analysis
 */
export function playCustomAudio(
  audioUrl: string,
  onTick?: (frequencyData: number[]) => void,
  onEnd?: () => void
): SoundPlaybackController {
  const audio = new Audio(audioUrl);
  let animId: number;
  let isPlaying = true;

  try {
    const ctx = getAudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateSpectrum = () => {
      if (!isPlaying) return;
      analyser.getByteFrequencyData(dataArray);
      const normalized = Array.from(dataArray.slice(0, 16)).map((v) => v / 255);
      onTick?.(normalized);
      animId = requestAnimationFrame(updateSpectrum);
    };

    audio.onplay = () => {
      animId = requestAnimationFrame(updateSpectrum);
    };

    audio.onended = () => {
      isPlaying = false;
      cancelAnimationFrame(animId);
      onEnd?.();
    };

    audio.onerror = () => {
      isPlaying = false;
      cancelAnimationFrame(animId);
      onEnd?.();
    };

    audio.play().catch((err) => {
      console.warn('Audio playback error:', err);
      onEnd?.();
    });

    return {
      stop: () => {
        isPlaying = false;
        cancelAnimationFrame(animId);
        audio.pause();
        audio.currentTime = 0;
      },
    };
  } catch (err) {
    console.warn('Fallback to standard audio element:', err);
    audio.play().catch(() => onEnd?.());
    audio.onended = () => onEnd?.();
    return {
      stop: () => {
        audio.pause();
        onEnd?.();
      },
    };
  }
}

/**
 * Creates and downloads a client-generated WAV sonogram audio file
 */
export function generateSonogramWav(filename = 'CR-BIO-Isthmohyla-nacientes.wav') {
  const sampleRate = 44100;
  const duration = 2.5;
  const numSamples = sampleRate * duration;
  const buffer = new Float32Array(numSamples);

  // Synthesize acoustic frog pulses
  const pulseTimes = [0.1, 0.6, 1.1, 1.6, 2.1];
  for (const pt of pulseTimes) {
    const startIndex = Math.floor(pt * sampleRate);
    const pulseLen = Math.floor(0.18 * sampleRate);
    for (let i = 0; i < pulseLen && startIndex + i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 28) * Math.sin((t / 0.18) * Math.PI);
      const freq = 2100;
      const sample = Math.sin(2 * Math.PI * freq * t) * env;
      buffer[startIndex + i] += sample * 0.7;
    }
  }

  // Convert Float32Array to 16-bit PCM WAV
  const wavBytes = encodeWav(buffer, sampleRate);
  const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // Write RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
