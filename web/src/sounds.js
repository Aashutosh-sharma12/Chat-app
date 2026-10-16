// Ringtone and ringback generated with the Web Audio API, so no audio files are needed.
let ctx = null;
let timer = null;

function context() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function beep(freq, ms, volume = 0.15) {
  const c = context();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.02);
  gain.gain.setValueAtTime(volume, c.currentTime + ms / 1000 - 0.03);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + ms / 1000);
}

function loop(pattern, every) {
  stop();
  const run = () => {
    try {
      pattern();
    } catch {
      /* audio blocked until the user interacts with the page */
    }
  };
  run();
  timer = setInterval(run, every);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

export const sounds = {
  // Incoming call: double ring every 2.5s.
  ring: () =>
    loop(() => {
      beep(880, 350);
      setTimeout(() => beep(660, 350), 420);
    }, 2500),
  // Outgoing call: single tone every 3s.
  ringback: () => loop(() => beep(425, 1000, 0.1), 3000),
  stop,
};
