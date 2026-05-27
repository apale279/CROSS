let sharedAudioCtx = null;
let alertLoopTimerId = null;
let loopConsumers = 0;

/** Sblocca audio dopo un click/tasto (policy browser). */
export function unlockPmaAlertAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
  } catch {
    /* ignore */
  }
}

/** Doppio beep (Web Audio, contesto riutilizzato). */
export function playPmaAlertSound() {
  try {
    unlockPmaAlertAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;

    const playBeep = (startOffset, freq = 880) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.28;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + startOffset;
      osc.start(t);
      osc.stop(t + 0.28);
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        playBeep(0, 880);
        playBeep(0.32, 988);
      });
      return;
    }
    playBeep(0, 880);
    playBeep(0.32, 988);
  } catch {
    /* ignore */
  }
}

const ALERT_LOOP_MS = 1600;

function startLoopTimer() {
  if (alertLoopTimerId != null) return;
  const tick = () => {
    unlockPmaAlertAudio();
    playPmaAlertSound();
  };
  tick();
  alertLoopTimerId = window.setInterval(tick, ALERT_LOOP_MS);
}

function stopLoopTimer() {
  if (alertLoopTimerId != null) {
    window.clearInterval(alertLoopTimerId);
    alertLoopTimerId = null;
  }
}

/** Ripete il doppio beep finché tutti i consumer non hanno chiamato stop. */
export function startPmaAlertSoundLoop() {
  loopConsumers += 1;
  unlockPmaAlertAudio();
  startLoopTimer();
}

export function stopPmaAlertSoundLoop() {
  loopConsumers = Math.max(0, loopConsumers - 1);
  if (loopConsumers === 0) stopLoopTimer();
}
