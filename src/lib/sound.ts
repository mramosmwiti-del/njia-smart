const MUTE_KEY = "njia_sound_muted";

let ctx: AudioContext | null = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isSoundMuted() {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setSoundMuted(muted: boolean) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** Short two-tone chime for an incoming notification/chat message. */
export function playNotificationSound() {
  if (isSoundMuted()) return;
  try {
    const c = getCtx();
    const now = c.currentTime;
    [[880, now, 0.09], [660, now + 0.09, 0.12]].forEach(([freq, start, dur]) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq as number;
      gain.gain.setValueAtTime(0.001, start as number);
      gain.gain.exponentialRampToValueAtTime(0.15, (start as number) + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, (start as number) + (dur as number));
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start as number);
      osc.stop((start as number) + (dur as number) + 0.02);
    });
  } catch {
    // Audio can fail before any user gesture has unlocked it — non-fatal.
  }
}
