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

const PMA_ALERT_FREQ_ARRIVO = [880, 988];
/** Tre note ascendenti «campanello interno» (distinto dal doppio beep arrivo). */
const PMA_ALERT_FREQ_CHIAMA_TRIAGE = [587, 698, 831];

function withAudioContext(run) {
  try {
    unlockPmaAlertAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => run(ctx));
      return;
    }
    run(ctx);
  } catch {
    /* ignore */
  }
}

function playTone(ctx, startOffset, freq, duration, type = 'sine', peakGain = 0.28) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = peakGain;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime + startOffset;
  osc.start(t);
  osc.stop(t + duration);
}

function playDoubleBeep(freq1, freq2) {
  withAudioContext((ctx) => {
    playTone(ctx, 0, freq1, 0.28);
    playTone(ctx, 0.32, freq2, 0.28);
  });
}

/** Tre note ascendenti (onda triangolare) per «Chiamata paziente». */
function playTripleAscendingChime(freqs) {
  withAudioContext((ctx) => {
    const noteDur = 0.2;
    const gap = 0.12;
    let at = 0;
    for (const freq of freqs) {
      playTone(ctx, at, freq, noteDur, 'triangle', 0.24);
      at += noteDur + gap;
    }
  });
}

/** Doppio beep arrivo mezzo (tonalità alta). */
export function playPmaAlertSound() {
  playDoubleBeep(PMA_ALERT_FREQ_ARRIVO[0], PMA_ALERT_FREQ_ARRIVO[1]);
}

/** Campanello triplo ascendente — «Chiamata paziente» (distinto da arrivo). */
export function playPmaChiamaTriageAlertSound() {
  playTripleAscendingChime(PMA_ALERT_FREQ_CHIAMA_TRIAGE);
}

const ALERT_LOOP_MS = 1600;
const CHIAMA_TRIAGE_LOOP_MS = 2200;

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

let chiamaTriageLoopTimerId = null;
let chiamaTriageLoopConsumers = 0;

function startChiamaTriageLoopTimer() {
  if (chiamaTriageLoopTimerId != null) return;
  const tick = () => {
    unlockPmaAlertAudio();
    playPmaChiamaTriageAlertSound();
  };
  tick();
  chiamaTriageLoopTimerId = window.setInterval(tick, CHIAMA_TRIAGE_LOOP_MS);
}

function stopChiamaTriageLoopTimer() {
  if (chiamaTriageLoopTimerId != null) {
    window.clearInterval(chiamaTriageLoopTimerId);
    chiamaTriageLoopTimerId = null;
  }
}

/** Loop suono «Chiama triage» (indipendente da arrivo/diario). */
export function startPmaChiamaTriageAlertLoop() {
  chiamaTriageLoopConsumers += 1;
  unlockPmaAlertAudio();
  startChiamaTriageLoopTimer();
}

export function stopPmaChiamaTriageAlertLoop() {
  chiamaTriageLoopConsumers = Math.max(0, chiamaTriageLoopConsumers - 1);
  if (chiamaTriageLoopConsumers === 0) stopChiamaTriageLoopTimer();
}
