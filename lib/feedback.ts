"use client";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

const SOUND_PREF_KEY = "maestro:sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SOUND_PREF_KEY);
  return stored !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_PREF_KEY, enabled ? "true" : "false");
}

export type FeedbackTone = "success" | "warning" | "urgent" | "tap";

/**
 * Reproduce un tono sintetizado en el dispositivo usando la Web Audio API.
 * No requiere descargar archivos de audio externos.
 */
export function playNotificationSound(tone: FeedbackTone = "success"): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (tone) {
      case "success": {
        // C5 (523Hz) a E5 (659Hz)
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
        break;
      }

      case "warning": {
        // A4 (440Hz)
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case "urgent": {
        // E5 (659Hz) a A5 (880Hz)
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
        break;
      }

      case "tap":
      default: {
        // Click suave de 880Hz
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
    }
  } catch (err) {
    console.debug("[FeedbackSound] No se pudo reproducir audio:", err);
  }
}
/**
 * Emite una vibración háptica en dispositivos móviles compatibles.
 */
export function triggerHaptic(pattern: number | number[] = [60, 40, 60]): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silencioso si no está permitido
  }
}

/**
 * Dispara una alerta combinada: sonido y vibración.
 */
export function triggerAlertFeedback(tone: FeedbackTone = "success"): void {
  playNotificationSound(tone);
  if (tone === "urgent") {
    triggerHaptic([100, 50, 100, 50, 120]);
  } else if (tone === "warning") {
    triggerHaptic([80, 50, 80]);
  } else {
    triggerHaptic(50);
  }
}
