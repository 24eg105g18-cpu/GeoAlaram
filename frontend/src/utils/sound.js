/**
 * Reliable in-browser audio synthesizer using Web Audio API.
 * Emits pleasant, attention-grabbing chime and alarm sounds
 * with zero external audio file dependencies.
 */

let audioCtx = null;
let alarmIntervalId = null;

/**
 * Get or initialize singleton AudioContext instance.
 */
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  // If closed unexpectedly, recreate instance
  if (audioCtx && audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  return audioCtx;
};

/**
 * Unlocks AudioContext synchronously on user gesture (click, tap, keypress).
 * Bypasses browser autoplay restrictions for subsequent background triggers.
 */
export const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('[GeoAlarm Audio] AudioContext resume attempt deferred:', err.message);
      });
    }
  } catch (err) {
    console.warn('[GeoAlarm Audio] Audio unlock failed:', err.message);
  }
};

// Automatically attach one-time unlock listeners to common user interactions
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    unlockAudio();
    if (audioCtx && audioCtx.state === 'running') {
      ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
        window.removeEventListener(evt, autoUnlock);
      });
    }
  };

  ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, autoUnlock, { passive: true, capture: true });
  });
}

/**
 * Play an attention-grabbing multi-frequency chime.
 * Ensures the AudioContext is resumed before scheduling audio nodes.
 */
export const playAlarmTone = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Await resume if suspended so currentTime is valid and oscillators play audibly
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('[GeoAlarm Audio] Could not resume AudioContext without user interaction:', e.message);
      }
    }

    if (ctx.state !== 'running') {
      console.warn('[GeoAlarm Audio] AudioContext is not running (state: ' + ctx.state + '). User interaction required to enable sound.');
      return;
    }

    const now = ctx.currentTime;

    // First tone (higher pitch - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (higher harmony - D6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.2);
    gain2.gain.setValueAtTime(0.4, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.6);

    // Third confirmation chime (triangle - E6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1318.51, now + 0.4);
    gain3.gain.setValueAtTime(0.35, now + 0.4);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.4);
    osc3.stop(now + 0.9);
  } catch (err) {
    console.warn('[GeoAlarm Audio] Audio playback error:', err.message);
  }
};

/**
 * Start repeating alarm chime loop.
 */
export const startAlarmSound = () => {
  stopAlarmSound(); // Clear any existing interval
  unlockAudio();    // Attempt immediate unlock
  playAlarmTone();  // Play initial chime
  alarmIntervalId = setInterval(() => {
    playAlarmTone();
  }, 1600);
};

/**
 * Stop repeating alarm chime loop.
 */
export const stopAlarmSound = () => {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
};
