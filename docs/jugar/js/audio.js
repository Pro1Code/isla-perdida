// Sonido 100% generado con Web Audio (sin archivos externos)
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const A = (G.Audio = { ready: false });
  let ctx, master, sfx, amb, vox, dest, noiseBuf, oceanGain, windGain, windFilter, crickGain;
  let birdT = 3, crackleT = 0, time = 0;

  A.init = function () {
    if (A.ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
    vox = ctx.createGain(); vox.gain.value = 1; vox.connect(master);
    dest = sfx;

    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Ruido marrón para el oleaje
    const bLen = ctx.sampleRate * 4;
    const brown = ctx.createBuffer(1, bLen, ctx.sampleRate);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bLen; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5; }

    const ocean = ctx.createBufferSource(); ocean.buffer = brown; ocean.loop = true;
    const oLP = ctx.createBiquadFilter(); oLP.type = 'lowpass'; oLP.frequency.value = 650;
    oceanGain = ctx.createGain(); oceanGain.gain.value = 0;
    ocean.connect(oLP); oLP.connect(oceanGain); oceanGain.connect(amb); ocean.start();

    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(amb); wind.start();

    // Grillos: tono agudo modulado en amplitud
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    const crAM = ctx.createGain(); crAM.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(crAM.gain);
    crickGain = ctx.createGain(); crickGain.gain.value = 0;
    cr.connect(crAM); crAM.connect(crickGain); crickGain.connect(amb);
    cr.start(); lfo.start();
    // Lluvia: ruido blanco filtrado en agudos
    const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    const rf2 = ctx.createBiquadFilter(); rf2.type = 'lowpass'; rf2.frequency.value = 7000;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rs.connect(rf); rf.connect(rf2); rf2.connect(rainGain); rainGain.connect(amb); rs.start();
    A.ready = true;
    A.setVolumes();
  };
  let rainGain;
  A.setRain = (v) => { if (A.ready) rainGain.gain.setTargetAtTime(v * 0.16, ctx.currentTime, 0.5); };

  // Volúmenes de Configuración → Sonido (0-100)
  A.setVolumes = function () {
    if (!A.ready) return;
    const P = G.Profile;
    master.gain.value = (P.set('vol') / 100) * 0.8; sfx.gain.value = P.set('sfx') / 100; amb.gain.value = P.set('amb') / 100; vox.gain.value = (P.set('voz') / 100) * 1.1;
  };
  // Para las voces de los personajes (voice.js)
  A.ctx = () => ctx;
  A.voiceBus = () => vox;
  A.suspend = () => { if (A.ready && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (A.ready && ctx.state === 'suspended') ctx.resume(); };

  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function noise(dur, type, freq, q, vol, delay = 0, freqEnd) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
  }
  function tone(type, f0, f1, dur, vol, delay = 0, attack = 0.005, lp) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, attack, vol, dur);
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(dest); o.start(t); o.stop(t + attack + dur + 0.1);
  }
  function howl() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(360, t);
    o.frequency.linearRampToValueAtTime(640, t + 0.7);
    o.frequency.linearRampToValueAtTime(600, t + 1.6);
    o.frequency.linearRampToValueAtTime(420, t + 2.4);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = 10; vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.6);
    g.gain.setValueAtTime(0.13, t + 1.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g); g.connect(dest); o.start(t); vib.start(t); o.stop(t + 2.6); vib.stop(t + 2.6);
  }

  // Sonido con volumen según la distancia al oyente (acciones de otros jugadores, animales…)
  A.playAt = function (name, x, z, maxDist = 45) {
    const p = G.camera ? G.camera.position : null;
    if (!p) return;
    const vol = 1 - Math.hypot(p.x - x, p.z - z) / maxDist;
    if (vol > 0.02) A.play(name, vol * vol);
  };

  A.play = function (name, vol = 1) {
    if (!A.ready || ctx.state !== 'running') return;
    if (vol < 0.999) { dest = ctx.createGain(); dest.gain.value = vol; dest.connect(sfx); }
    try { playSound(name); } finally { dest = sfx; }
  };
  function playSound(name) {
    const r = Math.random();
    switch (name) {
      case 'step_sand': noise(0.1, 'lowpass', 900 + r * 300, 0.8, 0.1); break;
      case 'step_grass': noise(0.08, 'bandpass', 1900 + r * 600, 0.9, 0.07); break;
      case 'step_wood': tone('sine', 150, 90, 0.07, 0.14); noise(0.05, 'lowpass', 500, 1, 0.07); break;
      case 'splash': noise(0.35, 'bandpass', 900 + r * 400, 0.6, 0.16, 0, 400); break;
      case 'swing': noise(0.16, 'bandpass', 500, 1.5, 0.08, 0, 1800); break;
      case 'chop': tone('triangle', 230, 90, 0.12, 0.35); noise(0.1, 'bandpass', 1300, 1, 0.3); break;
      case 'stone': noise(0.08, 'highpass', 2600, 1, 0.3); tone('square', 950, 700, 0.05, 0.05); break;
      case 'rockbreak': noise(0.5, 'lowpass', 1500, 0.7, 0.4, 0, 300); tone('sine', 110, 50, 0.3, 0.3); break;
      case 'hit': tone('sine', 170, 60, 0.15, 0.4); noise(0.1, 'lowpass', 1300, 1, 0.25); break;
      case 'pickup': tone('sine', 640 + r * 60, 980, 0.09, 0.13); break;
      case 'craft': tone('triangle', 523, 523, 0.12, 0.18); tone('triangle', 784, 784, 0.2, 0.18, 0.1); break;
      case 'place': tone('sine', 120, 55, 0.22, 0.4); noise(0.15, 'lowpass', 700, 1, 0.3); break;
      case 'eat': for (let i = 0; i < 3; i++) noise(0.06, 'bandpass', 2200 + r * 800, 1.2, 0.14, i * 0.13); break;
      case 'drink': for (let i = 0; i < 4; i++) { const f = 320 + Math.random() * 300; tone('sine', f, f + 250, 0.06, 0.12, i * 0.09); } break;
      case 'fill': noise(0.5, 'bandpass', 700, 0.8, 0.15, 0, 1600); break;
      case 'hurt': tone('sawtooth', 280, 110, 0.25, 0.16, 0, 0.005, 1200); break;
      case 'treefall': noise(1.4, 'lowpass', 500, 0.6, 0.35, 0, 150); tone('sine', 90, 40, 0.6, 0.55, 1.05); noise(0.5, 'lowpass', 300, 1, 0.4, 1.05); break;
      case 'ignite': noise(0.6, 'bandpass', 700, 0.5, 0.25, 0, 2200); break;
      case 'crackle': noise(0.02 + r * 0.02, 'highpass', 2500 + r * 2500, 1, 0.06); break;
      case 'bird': { const f = 2200 + r * 900; tone('sine', f, f * 1.35, 0.1, 0.035); tone('sine', f * 1.1, f * 1.5, 0.08, 0.03, 0.14); break; }
      case 'howl': howl(); break;
      case 'grunt': tone('sawtooth', 100, 70, 0.3, 0.2, 0, 0.01, 450); break;
      case 'bite': noise(0.12, 'bandpass', 1800, 1, 0.3); tone('sawtooth', 200, 120, 0.15, 0.14, 0, 0.005, 900); break;
      case 'death': tone('sawtooth', 180, 60, 0.5, 0.15, 0, 0.01, 700); break;
      case 'break': noise(0.25, 'highpass', 1500, 1, 0.3); tone('square', 400, 120, 0.2, 0.08); break;
      case 'error': tone('square', 190, 150, 0.12, 0.05); break;
      case 'select': tone('sine', 900, 900, 0.04, 0.05); break;
      case 'day': [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.5, 0.1, i * 0.18, 0.02)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.4, 0.14, i * 0.16, 0.01)); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => tone('sine', f, f, 0.8, 0.1, i * 0.35, 0.05)); break;
      case 'chat': tone('sine', 880, 1100, 0.07, 0.06); break;
      case 'thunder': noise(2.8, 'lowpass', 260, 0.7, 0.55, 0, 60); noise(0.5, 'lowpass', 900, 0.5, 0.35); break;
      case 'hiss': noise(0.7, 'highpass', 4200, 0.8, 0.12); break;
      case 'plop': tone('sine', 520, 180, 0.12, 0.2); noise(0.18, 'bandpass', 1200, 1, 0.12); break;
      case 'reel': for (let i = 0; i < 6; i++) noise(0.03, 'bandpass', 3000, 2, 0.08, i * 0.05); break;
      case 'roar': tone('sawtooth', 140, 70, 0.9, 0.22, 0, 0.05, 600); noise(0.9, 'lowpass', 500, 0.7, 0.2); break;
      case 'loot': [659, 784, 988, 1318].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.09, 0.01)); break;
      case 'smelt': noise(0.8, 'lowpass', 900, 0.6, 0.25, 0, 300); tone('sine', 300, 600, 0.3, 0.1, 0.3); break;
      case 'step_snow': noise(0.12, 'bandpass', 700 + r * 200, 1.2, 0.1); noise(0.06, 'highpass', 3000, 1, 0.04, 0.03); break;
      case 'cannon': noise(1.6, 'lowpass', 400, 0.6, 0.7, 0, 60); tone('sine', 90, 35, 0.6, 0.6); noise(0.15, 'bandpass', 2000, 0.8, 0.3); break;
      case 'explode': noise(1.2, 'lowpass', 900, 0.6, 0.55, 0, 80); tone('sine', 70, 30, 0.5, 0.45); break;
      case 'creak': tone('sawtooth', 110 + r * 30, 80, 0.5, 0.06, 0, 0.1, 500); noise(0.4, 'bandpass', 600, 3, 0.1); break;
      case 'hammer': for (let i = 0; i < 3; i++) { tone('square', 700, 300, 0.05, 0.08, i * 0.22); noise(0.06, 'bandpass', 2400, 1, 0.2, i * 0.22); } break;
      case 'bell': [1318, 1318].forEach((f, i) => tone('sine', f, f * 0.995, 0.9, 0.12, i * 0.35, 0.005)); break;
      case 'chain': for (let i = 0; i < 8; i++) noise(0.04, 'bandpass', 3500 + Math.random() * 1500, 3, 0.1, i * 0.06); break;
      case 'sail': noise(0.35, 'bandpass', 500, 0.7, 0.12, 0, 1400); break;
      case 'talk': [0, 1, 2].forEach((i) => tone('triangle', 300 + Math.random() * 200, 280 + Math.random() * 200, 0.06, 0.05, i * 0.08)); break;
      case 'eatfruit': [392, 311, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.35, 0.06, i * 0.18, 0.02, 1200)); break;
      case 'gull': { const f = 1800 + r * 400; tone('sawtooth', f, f * 0.6, 0.25, 0.03, 0, 0.01, 2500); tone('sawtooth', f * 0.9, f * 0.5, 0.2, 0.025, 0.3, 0.01, 2500); break; }
      case 'mono': [220, 330, 262, 392].forEach((f, i) => tone('triangle', f, f * 1.02, 0.5, 0.08, i * 0.12, 0.05)); break;
      // Combate (parry.js): parada perfecta (choque metálico que resuena), bloqueo (golpe sordo con metal) y aviso del golpe
      case 'parry': noise(0.05, 'highpass', 3000, 1, 0.5); [1480, 2230, 3310].forEach((f, i) => tone('sine', f, f * 0.985, 0.55 - i * 0.12, 0.2 - i * 0.05, 0, 0.002)); tone('triangle', 740, 700, 0.25, 0.12); break;
      case 'block': noise(0.08, 'bandpass', 1800, 1.2, 0.35); tone('sine', 190, 90, 0.14, 0.35); tone('sine', 1250, 1200, 0.18, 0.08, 0, 0.002); break;
      case 'glint': tone('sine', 2600, 3400, 0.09, 0.07, 0, 0.002); break;
      // Esquive, golpe pesado, impacto fuerte, aterrizaje y fijar enemigo (combat.js)
      case 'whoosh': noise(0.28, 'bandpass', 700, 1.2, 0.2, 0, 2600); break;
      case 'heavySwing': noise(0.32, 'bandpass', 380, 1.1, 0.22, 0, 1500); tone('sine', 140, 70, 0.25, 0.12); break;
      case 'hitHeavy': tone('sine', 120, 45, 0.3, 0.45); noise(0.18, 'lowpass', 1100, 0.8, 0.35); break;
      case 'land': noise(0.16, 'lowpass', 500, 0.8, 0.25); tone('sine', 90, 50, 0.14, 0.2); break;
      case 'lockOn': tone('square', 880, 1320, 0.06, 0.04); tone('square', 1320, 1320, 0.05, 0.04, 0.07); break;
      case 'glintH': tone('sawtooth', 420, 300, 0.3, 0.07, 0, 0.01, 1600); tone('sine', 2100, 2500, 0.12, 0.06, 0, 0.002); break;
    }
  }

  // Ambiente: env = { shore 0..1, night 0..1, height, fireDist }
  A.update = function (dt, e) {
    if (!A.ready || ctx.state !== 'running') return;
    time += dt;
    const now = ctx.currentTime;
    const swell = 0.7 + 0.3 * Math.sin(time * 0.45) * Math.sin(time * 0.17 + 1);
    oceanGain.gain.setTargetAtTime((0.04 + 0.34 * (e.sea ? 0.8 : e.shore)) * swell, now, 0.4);
    windGain.gain.setTargetAtTime(0.02 + 0.06 * U.clamp(e.height / 30, 0, 1) + 0.02 * Math.sin(time * 0.2), now, 0.8);
    windFilter.frequency.setTargetAtTime(380 + 200 * Math.sin(time * 0.13), now, 1);
    crickGain.gain.setTargetAtTime(e.night * 0.012 * (Math.sin(time * 1.3) > -0.3 ? 1 : 0.2) * (1 - e.shore * 0.5), now, 0.3);

    birdT -= dt;
    if (birdT <= 0) {
      birdT = 2 + Math.random() * 6;
      if (e.gulls && e.night < 0.5) A.play('gull', 0.8);
      else if (e.night < 0.3 && e.shore < 0.9 && !e.sea) A.play('bird', 1 - e.shore * 0.6);
    }
    if (e.fireDist < 9) {
      crackleT -= dt;
      if (crackleT <= 0) { crackleT = 0.05 + Math.random() * 0.25; A.play('crackle', 1 - e.fireDist / 9); }
    }
  };
})();
