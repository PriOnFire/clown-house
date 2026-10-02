// ============================================================
// audio.js — fully procedural WebAudio sound engine.
// No audio files: ambience, music box, party loop, PA chimes,
// footsteps, heartbeat, static and stingers are all synthesized.
// ============================================================
let ctx = null, master = null, verb = null, verbGain = null;
let started = false;
let volume = 0.8;

export function audioReady() { return started; }
export function setVolume(v) { volume = v; if (master) master.gain.value = v * v; }

export function initAudio() {
  if (started) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = volume * volume;
  // cheap "concrete hall" space: feedback delay network
  verb = ctx.createDelay(0.5); verb.delayTime.value = 0.11;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
  verbGain = ctx.createGain(); verbGain.gain.value = 0.22;
  verb.connect(fb); fb.connect(lp); lp.connect(verb);
  verb.connect(verbGain); verbGain.connect(master);
  master.connect(ctx.destination);
  started = true;
  startAmbience();
}
export function resumeAudio() { if (ctx && ctx.state === "suspended") ctx.resume(); }

// ---------- helpers ----------
function now() { return ctx.currentTime; }
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function osc(type, freq, t0, dur, peak, dest, detune = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
  env(g, t0, 0.008, peak, dur);
  o.connect(g); g.connect(dest || master);
  o.start(t0); o.stop(t0 + dur + 0.1);
  return o;
}
let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  return noiseBuf;
}
function getWhiteNoise() {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function noiseHit(t, dur, peak, filterFreq, type = "lowpass", dest) {
  const src = ctx.createBufferSource(); src.buffer = getWhiteNoise();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  env(g, t, 0.005, peak, dur);
  src.connect(f); f.connect(g); g.connect(dest || master);
  src.start(t); src.stop(t + dur + 0.1);
}

// ---------- ambience ----------
let ambNodes = null;
function startAmbience() {
  const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220;
  const g = ctx.createGain(); g.gain.value = 0.05;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  const hum = ctx.createOscillator(); hum.type = "sawtooth"; hum.frequency.value = 50;
  const humF = ctx.createBiquadFilter(); humF.type = "lowpass"; humF.frequency.value = 120;
  const humG = ctx.createGain(); humG.gain.value = 0.010;
  hum.connect(humF); humF.connect(humG); humG.connect(master); hum.start();
  ambNodes = { g, humG };
}

// ---------- UI / interaction ----------
export function uiClick() { if (!started) return; osc("square", 1180, now(), 0.05, 0.06); }
export function uiHover() { if (!started) return; osc("square", 830, now(), 0.03, 0.03); }
export function pickup() {
  if (!started) return; const t = now();
  osc("triangle", 660, t, 0.09, 0.12); osc("triangle", 990, t + 0.08, 0.14, 0.12);
}
export function doorCreak() {
  if (!started) return; const t = now();
  const o = ctx.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(90, t + 0.35);
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 300; f.Q.value = 6;
  const g = ctx.createGain(); env(g, t, 0.04, 0.09, 0.4);
  o.connect(f); f.connect(g); g.connect(master); g.connect(verb);
  o.start(t); o.stop(t + 0.5);
}
export function doorLocked() {
  if (!started) return; const t = now();
  noiseHit(t, 0.07, 0.15, 900, "bandpass"); noiseHit(t + 0.12, 0.07, 0.12, 700, "bandpass");
}
export function switchClick() { if (!started) return; noiseHit(now(), 0.04, 0.1, 2500, "highpass"); }
export function balloonPop() {
  if (!started) return; const t = now();
  noiseHit(t, 0.09, 0.5, 1800, "highpass"); osc("sine", 220, t, 0.12, 0.25);
}
export function boing() {
  if (!started) return; const t = now();
  const o = ctx.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.3);
  const g = ctx.createGain(); env(g, t, 0.01, 0.14, 0.35);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
}

// ---------- footsteps ----------
let altStep = false;
export function footstep(run, inPit) {
  if (!started) return; const t = now(); altStep = !altStep;
  if (inPit) { noiseHit(t, 0.12, run ? 0.20 : 0.11, altStep ? 480 : 380, "lowpass"); return; }
  noiseHit(t, run ? 0.09 : 0.07, run ? 0.13 : 0.07, altStep ? 700 : 560, "bandpass");
}
export function clownStep(vol, heavy) {
  if (!started) return; const t = now();
  noiseHit(t, 0.1, vol * (heavy ? 1.6 : 1), heavy ? 160 : 320, "lowpass");
  if (heavy) osc("sine", 62, t, 0.16, vol * 0.8);
}

// ---------- PA / announcements ----------
export function paChime(distorted = 0) {
  if (!started) return; const t = now();
  const det = distorted * 40;
  osc("sine", 659, t, 0.9, 0.12, verb, det); osc("sine", 523, t + 0.35, 1.1, 0.12, verb, -det);
  noiseHit(t, 0.15, 0.05, 2000, "highpass");
}
export function paSquelch() {
  if (!started) return; const t = now();
  noiseHit(t, 0.06, 0.12, 3000, "highpass"); osc("square", 1960, t + 0.04, 0.04, 0.03);
}
export function garbleVoice(dur = 1.4, dark = 0.5) {
  // unintelligible "voice through ceiling speaker" burble
  if (!started) return; const t = now();
  const o = ctx.createOscillator(); o.type = "sawtooth";
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 8;
  const g = ctx.createGain(); env(g, t, 0.06, 0.10, dur);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 7 + dark * 5;
  const lfoG = ctx.createGain(); lfoG.gain.value = 300;
  lfo.connect(lfoG); lfoG.connect(f.frequency);
  o.frequency.setValueAtTime(110 - dark * 30, t);
  o.frequency.linearRampToValueAtTime(90 + dark * 20, t + dur);
  f.frequency.value = 800;
  o.connect(f); f.connect(g); g.connect(master); g.connect(verb);
  o.start(t); o.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
}

// ---------- music box (Jingle / birthday) ----------
// original motif — deliberately *almost* a birthday tune, slightly wrong
const MOTIF = [
  [392, .42], [392, .14], [440, .56], [392, .56], [523.25, .56], [493.88, 1.0],
  [392, .42], [392, .14], [440, .56], [392, .56], [587.33, .56], [523.25, 1.0],
];
export function musicBox(vol = 0.16, detune = 0, rate = 1, panX = 0) {
  if (!started) return;
  let t = now() + 0.05;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, panX));
  p.connect(master); p.connect(verb);
  for (const [f, d] of MOTIF) {
    const g = ctx.createGain();
    env(g, t, 0.01, vol, d * 2.2 / rate, 0.0001);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    o.detune.value = detune + (Math.random() - 0.5) * 8;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 3.98;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(p);
    o.start(t); o.stop(t + d * 3 / rate); o2.start(t); o2.stop(t + d * 3 / rate);
    t += d / rate;
  }
  return t - now();
}

// ---------- party mode loop ----------
let partyNodes = null;
export function partyLoopStart() {
  if (!started || partyNodes) return;
  const g = ctx.createGain(); g.gain.value = 0.0; g.connect(master);
  g.gain.linearRampToValueAtTime(0.10, now() + 2);
  // calliope-ish arpeggio scheduler
  const notes = [261.6, 329.6, 392, 523.25, 392, 329.6, 349.2, 440, 349.2, 293.7, 392, 493.9];
  let idx = 0, timer = null;
  const tick = () => {
    const t = now();
    const o = ctx.createOscillator(); o.type = "square";
    o.frequency.value = notes[idx % notes.length]; idx++;
    const og = ctx.createGain(); env(og, t, 0.01, 0.25, 0.22);
    o.connect(og); og.connect(g); og.connect(verb);
    o.start(t); o.stop(t + 0.3);
    if (idx % 4 === 0) { osc("sine", 65.4, t, 0.28, 0.16, g); noiseHit(t, 0.05, 0.05, 6000, "highpass", g); }
  };
  timer = setInterval(tick, 240);
  partyNodes = { g, timer };
}
export function partyLoopStop() {
  if (!partyNodes) return;
  clearInterval(partyNodes.timer);
  partyNodes.g.gain.linearRampToValueAtTime(0.0001, now() + 1.2);
  setTimeout(() => { try { partyNodes.g.disconnect(); } catch (e) {} partyNodes = null; }, 1500);
}

// ---------- drone (tension layers) ----------
let drone = null;
export function droneStart(level = 0) {
  if (!started || drone) return;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
  const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 55;
  const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 55.7;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 240 + level * 300;
  o1.connect(f); o2.connect(f); f.connect(g); o1.start(); o2.start();
  g.gain.linearRampToValueAtTime(0.05 + level * 0.05, now() + 3);
  drone = { g, o1, o2, f };
}
export function droneLevel(level) {
  if (!drone) { droneStart(level); return; }
  drone.f.frequency.linearRampToValueAtTime(240 + level * 600, now() + 0.5);
  drone.g.gain.linearRampToValueAtTime(0.05 + level * 0.06, now() + 0.5);
}
export function droneStop() {
  if (!drone) return;
  drone.g.gain.linearRampToValueAtTime(0.0001, now() + 1.5);
  const d = drone; drone = null;
  setTimeout(() => { try { d.o1.stop(); d.o2.stop(); } catch (e) {} }, 1800);
}

// ---------- heartbeat ----------
let hbTimer = null, hbRate = 0;
export function heartbeatSet(r) {
  hbRate = r;
  if (!started) return;
  if (r <= 0 && hbTimer) { clearInterval(hbTimer); hbTimer = null; return; }
  if (hbTimer) return;
  hbTimer = setInterval(() => {
    if (hbRate <= 0) return;
    const t = now();
    osc("sine", 58, t, 0.12, 0.28 * hbRate); osc("sine", 50, t + 0.18, 0.14, 0.22 * hbRate);
  }, Math.max(380, 900 - hbRate * 480));
}

// ---------- stingers / scares ----------
export function stinger(size = 0.5) {
  if (!started) return; const t = now();
  const o = ctx.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(200 + Math.random() * 300, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.7 * size);
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2000;
  f.frequency.exponentialRampToValueAtTime(200, t + 0.8 * size);
  const g = ctx.createGain(); env(g, t, 0.01, 0.30 * size, 0.8 * size);
  o.connect(f); f.connect(g); g.connect(master); g.connect(verb);
  o.start(t); o.stop(t + size);
  osc("sawtooth", 466, t, 0.6 * size, 0.14 * size, verb, 25);
  osc("sawtooth", 493, t, 0.6 * size, 0.14 * size, verb, -18);
}
export function scream() {
  if (!started) return; const t = now();
  const o = ctx.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(700, t);
  o.frequency.linearRampToValueAtTime(1500, t + 0.18);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.9);
  const ring = ctx.createOscillator(); ring.frequency.value = 37;
  const rg = ctx.createGain(); rg.gain.value = 0.5;
  const g = ctx.createGain(); g.gain.value = 0.0;
  ring.connect(rg.gain ? rg : rg); // ring mod via gain node
  o.connect(g); rg.connect(g.gain);
  const gg = ctx.createGain(); env(gg, t, 0.02, 0.28, 0.9);
  g.connect(gg); gg.connect(master); gg.connect(verb);
  o.start(t); o.stop(t + 1); ring.start(t); ring.stop(t + 1);
  noiseHit(t, 0.7, 0.20, 1200, "bandpass", verb);
}
export function staticBurst(dur = 0.25, vol = 0.2) {
  if (!started) return; noiseHit(now(), dur, vol, 2800, "highpass");
}
export function powerUp() {
  if (!started) return; const t = now();
  osc("sine", 60, t, 1.2, 0.3); osc("sine", 120, t + 0.2, 1.0, 0.15);
  osc("triangle", 523, t + 0.5, 0.2, 0.14); osc("triangle", 659, t + 0.65, 0.2, 0.14); osc("triangle", 784, t + 0.8, 0.45, 0.16);
  noiseHit(t + 0.45, 0.4, 0.08, 3000, "highpass");
}
export function carnivalCar() {
  // distant children's ride starting by itself
  if (!started) return; const t = now();
  osc("square", 330, t, 0.16, 0.05, verb); osc("square", 392, t + 0.18, 0.16, 0.05, verb);
  osc("square", 440, t + 0.36, 0.3, 0.05, verb);
}
export function clownGiggle(vol = 0.1, panX = 0) {
  if (!started) return; let t = now();
  const p = ctx.createStereoPanner(); p.pan.value = panX; p.connect(master); p.connect(verb);
  for (let i = 0; i < 4; i++) {
    const g = ctx.createGain(); env(g, t, 0.02, vol, 0.12);
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(500 + i * 90 + Math.random() * 60, t);
    o.frequency.linearRampToValueAtTime(320, t + 0.13);
    o.connect(g); g.connect(p); o.start(t); o.stop(t + 0.2);
    t += 0.15 + Math.random() * 0.05;
  }
}
export function whisper() {
  if (!started) return; const t = now();
  noiseHit(t, 1.1, 0.06, 1200, "bandpass", verb);
  osc("sine", 190, t + 0.2, 0.7, 0.03, verb, 12);
}
export function candleWhoosh() {
  if (!started) return; noiseHit(now(), 0.3, 0.12, 900, "lowpass", verb);
}
