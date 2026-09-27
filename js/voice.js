// Voces de los personajes: cada frase tiene su propio audio (frases en js/lines.js, audios en audio/voces/).
// Suenan en los diálogos, en la cinemática, en los gritos de los piratas y en las conversaciones
// entre personajes, que ocurren solas cuando pasas cerca: se acercan, se miran y hablan (con bocadillos).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const V = (G.Voice = {});
  const $ = (id) => document.getElementById(id);
  const LIST = () => G.VOICE_LIST || {};

  // Las mismas reglas que scripts/voces.js: solo se oye lo que va entre «comillas»
  const MOODS = ['neutral', 'calma', 'mando', 'grito', 'furia', 'miedo', 'susurro', 'triste', 'alegre', 'burla'];
  const moodOf = (text) => { const m = String(text).match(/^\{(\w+)\}/); return m && MOODS.includes(m[1]) ? m[1] : 'neutral'; };
  const spoken = (text) => { const t = String(text).replace(/^\{\w+\}/, ''), q = t.match(/«[^»]*»/g); return (q ? q.map((s) => s.slice(1, -1)).join(' ') : t).replace(/\s+/g, ' ').trim(); };
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  V.key = (spk, text) => spk + '-' + hash(spk + '|' + moodOf(text) + '|' + spoken(text));
  V.dur = (spk, text) => LIST()[V.key(spk, text)] || Math.max(1.6, spoken(text).length * 0.066);

  // Quién habla, a partir del nombre que muestra el diálogo
  const BY_NAME = [['Silvano', 'silvano'], ['Capitana Mara', 'mara'], ['Kaito', 'kaito'], ['Crane', 'crane'], ['Bastián', 'bastian'], ['Kalgor', 'kalgor'], ['Genbu', 'genbu'],
    ['Wypar', 'wypar'], ['Kamakiro', 'kamakiro'], ['Aisha', 'aisha'], ['Laka', 'laka'], ['Brahan', 'brahan'], ['Hiena', 'hiena'], ['Pista de Rogan', 'rogan'], ['Ancla oxidada', 'narrador'], ['Piedra de la calavera', 'narrador']];
  V.speakerOf = (who) => { who = who || ''; for (const [n, k] of BY_NAME) if (who.includes(n)) return k; return null; };
  // Voz de una criatura que habla
  V.speakerOfCreature = (c) => {
    if (!c) return null;
    if (c.type === 'npc') { const n = G.Prologue.NPCS[c.extra % G.Prologue.NPCS.length]; return n && n.key; }
    if (c.type === 'villager') return V.speakerOf(c.name);
    if (c.type === 'pirate_boss') return 'hiena';
    if (c.type === 'pirate' || c.type === 'pirate_gun') return 'pirata' + (1 + (Math.abs(c.extra | 0) % 3));
    return null;
  };

  // ------------------------------------------------------------------ reproducción
  const cache = new Map();
  function load(key) {
    if (!cache.has(key)) {
      const ctx = G.Audio.ctx();
      cache.set(key, fetch('audio/voces/' + key + '.mp3').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((ok, ko) => ctx.decodeAudioData(b, ok, ko))).catch(() => null));
    }
    return cache.get(key);
  }
  const playing = { dialog: null, chat: null, bark: null };
  // Reproduce una frase. opts: { ch: canal ('dialog' | 'chat' | 'bark'), at: criatura o {x, z} para oírla en su sitio }
  V.say = function (spk, text, opts) {
    opts = opts || {};
    const ch = opts.ch || 'dialog';
    V.stop(ch);
    const key = V.key(spk, text);
    if (!LIST()[key] || !G.Audio.ready) return null;
    const h = { key, at: opts.at || null, stopped: false, src: null, gain: null, pan: null };
    playing[ch] = h;
    load(key).then((buf) => {
      if (!buf || h.stopped) return;
      const ctx = G.Audio.ctx();
      h.src = ctx.createBufferSource(); h.src.buffer = buf;
      h.gain = ctx.createGain(); h.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      h.src.connect(h.gain);
      if (h.pan) { h.gain.connect(h.pan); h.pan.connect(G.Audio.voiceBus()); } else h.gain.connect(G.Audio.voiceBus());
      place(h);
      h.src.onended = () => { if (playing[ch] === h) playing[ch] = null; };
      h.src.start();
    });
    return h;
  };
  V.stop = function (ch) {
    for (const k of ch ? [ch] : Object.keys(playing)) {
      const h = playing[k];
      if (!h) continue;
      h.stopped = true;
      try { if (h.src) h.src.stop(); } catch (e) { /* ya terminó */ }
      playing[k] = null;
    }
  };
  // Volumen y panorama según dónde está quien habla
  function place(h) {
    if (!h.gain) return;
    if (!h.at) { h.gain.gain.value = 1; if (h.pan) h.pan.pan.value = 0; return; }
    const cam = G.camera.position, dx = h.at.x - cam.x, dz = h.at.z - cam.z, d = Math.hypot(dx, dz);
    const v = U.clamp(1 - (d - 5) / 40, 0, 1);
    h.gain.gain.value = v * v;
    if (h.pan) {
      const yaw = G.Player ? G.Player.yaw : 0;
      // Derecha de la cámara: (cos yaw, -sin yaw) con la convención de three.js (mira hacia -Z)
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      h.pan.pan.value = d > 0.5 ? U.clamp((dx * rx + dz * rz) / d, -1, 1) * 0.75 : 0;
    }
  }

  // ------------------------------------------------------------------ diálogos con el jugador
  V.dialog = function (d) {
    const spk = d.voice || V.speakerOf(d.who);
    if (!spk) { V.stop('dialog'); return; }
    stopChat();
    V.say(spk, d.text, { ch: 'dialog' });
  };

  // ------------------------------------------------------------------ bocadillos y subtítulos
  const bubbles = [];
  function bubble(c, text, dur) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = spoken(text);
    $('bubbles').appendChild(el);
    const b = { c, el, t: dur + 0.4 };
    // Un solo bocadillo por personaje
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].c === c) { bubbles[i].el.remove(); bubbles.splice(i, 1); }
    bubbles.push(b);
    return b;
  }
  const _v = new THREE.Vector3();
  function drawBubbles(dt) {
    const w = innerWidth, h = innerHeight;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.t -= dt;
      if (b.t <= 0 || !b.c || b.c.dead) { b.el.remove(); bubbles.splice(i, 1); continue; }
      _v.set(b.c.x, (b.c.y || G.height(b.c.x, b.c.z)) + 2.35, b.c.z);
      const d = _v.distanceTo(G.camera.position);
      _v.project(G.camera);
      const show = _v.z < 1 && d < 34 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      b.el.style.display = show ? '' : 'none';
      if (!show) continue;
      b.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${U.clamp(1.25 - d / 40, 0.6, 1)})`;
    }
  }
  let subT = 0;
  function subtitle(spk, text, dur) {
    const el = $('chatSub');
    if (!G.Profile.set('subs')) { el.classList.remove('show'); return; }
    const name = (G.VOICES[spk] || {}).name || '';
    el.innerHTML = (name ? `<b>${G.Net.esc(name)}:</b> ` : '') + G.Net.esc('«' + spoken(text) + '»');
    el.classList.add('show');
    subT = dur + 0.3;
  }

  // ------------------------------------------------------------------ conversaciones entre personajes
  let chat = null, chatCd = 12, soloCd = 25, checkT = 0, lastWorld = null;
  const played = new Set();
  const flags = () => (G.state.world && G.state.world.story && G.state.world.story.flags) || {};
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
  const busy = (c) => !c || c.dead || c.aggro > 0 || c.frozen > 0;

  // Quién puede hablar en cada sitio (junto al jugador)
  function cast(at, P) {
    const L = G.Creatures.list;
    if (at === 'crew') {
      const crew = L.filter((c) => c.type === 'npc' && c.extra > 0 && !busy(c) && near(c, P, 30));
      const m = {}; for (const c of crew) m[V.speakerOfCreature(c)] = c;
      return m;
    }
    if (at === 'piratas') {
      // Solo si los espías desde lejos (de cerca te atacan)
      const ps = L.filter((c) => (c.type === 'pirate' || c.type === 'pirate_gun' || c.type === 'pirate_boss') && !busy(c) && near(c, P, 42) && !near(c, P, 16));
      const m = { piratas: ps.filter((c) => c.type !== 'pirate_boss') };
      const b = ps.find((c) => c.type === 'pirate_boss'); if (b) m.hiena = b;
      return m;
    }
    if (at === 'aldea') {
      if (G.Story.tribeHostile()) return {};
      const m = {};
      for (const c of L) if (c.type === 'villager' && !busy(c) && near(c, P, 30)) { const k = V.speakerOf(c.name); if (k) m[k] = c; }
      return m;
    }
    return {};
  }
  // Asigna cada frase a un personaje concreto (los piratas genéricos se turnan: A, B, A…)
  function assign(conv, m) {
    const need = conv.lines.some(([s]) => s === 'hiena') ? 1 : 2;
    const pir = (m.piratas || []).slice(0, 4);
    const A = pir[0], B = pir.find((c) => c !== A && V.speakerOfCreature(c) !== V.speakerOfCreature(A)) || pir[1];
    const roles = [A, B];
    let pi = 0;
    const out = [];
    for (const [s, text] of conv.lines) {
      let c;
      if (s === 'pirata') { c = roles[pi % need]; pi++; } else c = m[s];
      if (!c) return null;
      out.push({ c, spk: V.speakerOfCreature(c), text });
    }
    return out;
  }
  function startChat() {
    const P = G.Player.pos, f = flags();
    const opts = [];
    G.LINES.charlas.forEach((conv, i) => {
      if (played.has(i) || (conv.when && !conv.when(f))) return;
      const seq = assign(conv, cast(conv.at, P));
      if (!seq) return;
      // Todos cerca unos de otros
      const cs = [...new Set(seq.map((s) => s.c))];
      if (cs.some((a) => cs.some((b) => !near(a, b, 22)))) return;
      opts.push({ i, seq, cs });
    });
    if (!opts.length) {
      // Si ya se oyeron todas las posibles aquí, se pueden repetir
      if (played.size) { played.clear(); chatCd = 20; }
      return;
    }
    const o = opts[Math.floor(Math.random() * opts.length)];
    played.add(o.i);
    chat = { seq: o.seq, cs: o.cs, i: -1, t: 6, gather: true };
    // Se acercan unos a otros (cada uno a su hueco del corro) y se miran
    const n = o.cs.length, mid = o.cs.reduce((a, c) => ({ x: a.x + c.x / n, z: a.z + c.z / n }), { x: 0, z: 0 }), r = n > 2 ? 1.5 : 1.1;
    for (const c of o.cs) {
      const a = Math.atan2(c.z - mid.z, c.x - mid.x);
      c.chat = { x: mid.x + Math.cos(a) * r, z: mid.z + Math.sin(a) * r };
      c.chatFace = o.cs.find((x) => x !== c);
    }
  }
  function stopChat() {
    if (!chat) return;
    for (const c of chat.cs) { c.chat = null; c.chatFace = null; }
    chat = null;
    V.stop('chat');
    chatCd = 25 + Math.random() * 25;
  }
  function stepChat(dt) {
    const P = G.Player.pos;
    if (G.Story.dialog || chat.cs.some((c) => c.dead || c.aggro > 0) || !chat.cs.some((c) => near(c, P, 48))) { stopChat(); return; }
    chat.t -= dt;
    if (chat.gather) {
      // Esperan a estar juntos (o como mucho 6 s)
      const close = chat.cs.every((a) => chat.cs.every((b) => near(a, b, 4.2)));
      if (!close && chat.t > 0) return;
      chat.gather = false; chat.t = 0.2;
    }
    if (chat.t > 0) return;
    chat.i++;
    if (chat.i >= chat.seq.length) { stopChat(); return; }
    const s = chat.seq[chat.i], dur = V.dur(s.spk, s.text);
    // Quien habla mira a quien habló antes (o al siguiente); los demás miran a quien habla
    const other = (chat.seq[chat.i - 1] || chat.seq[chat.i + 1] || {}).c;
    for (const c of chat.cs) c.chatFace = c === s.c ? (other && other !== c ? other : c.chatFace) : s.c;
    V.say(s.spk, s.text, { ch: 'chat', at: s.c });
    bubble(s.c, s.text, dur);
    if (near(s.c, P, 22)) subtitle(s.spk, s.text, dur);
    chat.t = dur + 0.45;
  }
  // Silvano habla solo cuando pasas cerca de su cabaña
  function solo() {
    const P = G.Player.pos;
    const s = G.Creatures.list.find((c) => c.type === 'npc' && c.extra === 0 && !c.dead);
    if (!s || !near(s, P, 18) || near(s, P, 4.5) || !flags().metHermit) return false;
    const pool = G.LINES.silvano.solo, text = pool[Math.floor(Math.random() * pool.length)];
    const dur = V.dur('silvano', text);
    V.say('silvano', text, { ch: 'chat', at: s });
    bubble(s, text, dur);
    subtitle('silvano', text, dur);
    return true;
  }

  // ------------------------------------------------------------------ gritos de combate
  let barkCd = 0;
  function barks() {
    const P = G.Player.pos, f = flags();
    for (const c of G.Creatures.list) {
      if (c.type !== 'pirate' && c.type !== 'pirate_gun' && c.type !== 'pirate_boss') continue;
      const boss = c.type === 'pirate_boss', ag = c.aggro > 0;
      if (boss && c.dead && !c._fell) { c._fell = true; say1(c, 'hiena', G.LINES.hiena.fall, true); continue; }
      if (c.dead) continue;
      if (boss && !c._rage && c.hp < c.d.hp * 0.5) { c._rage = true; say1(c, 'hiena', G.LINES.hiena.rage, true); }
      if (ag && !c._ag && barkCd <= 0 && near(c, P, 40) && (!c._barkT || performance.now() - c._barkT > 25000)) {
        c._barkT = performance.now();
        const spk = V.speakerOfCreature(c), pool = G.LINES[spk].spot;
        say1(c, spk, pool[Math.floor(Math.random() * pool.length)]);
      }
      c._ag = ag;
    }
    void f;
  }
  function say1(c, spk, text, force) {
    if (!force && barkCd > 0) return;
    barkCd = 3.5;
    const dur = V.dur(spk, text);
    V.say(spk, text, { ch: 'bark', at: c });
    bubble(c, text, dur);
  }

  // ------------------------------------------------------------------ fotograma
  V.update = function (dt) {
    for (const k in playing) { const h = playing[k]; if (h && h.at) place(h); }
    drawBubbles(dt);
    if (subT > 0 && (subT -= dt) <= 0) $('chatSub').classList.remove('show');
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; V.reset(); }
    if (!G.state.world || !G.Player.pos) return;
    barkCd -= dt;
    barks();
    if (chat) { stepChat(dt); return; }
    chatCd -= dt; soloCd -= dt;
    if ((checkT -= dt) > 0) return;
    checkT = 1;
    if (G.Story.dialog || playing.dialog) return;
    if (chatCd <= 0) { startChat(); if (chat) return; }
    if (soloCd <= 0 && solo()) soloCd = 40 + Math.random() * 35;
  };
  // Para pruebas desde la consola
  V.debug = () => ({ chat: chat && chat.seq.map((s) => s.spk + ': ' + spoken(s.text)), line: chat && chat.i, chatCd, soloCd, played: [...played], playing: Object.keys(playing).filter((k) => playing[k]) });
  // Al salir de la partida o cambiar de mundo
  V.reset = function () {
    stopChat(); V.stop();
    for (const b of bubbles) b.el.remove();
    bubbles.length = 0;
    $('chatSub').classList.remove('show');
    chatCd = 12; soloCd = 25; played.clear();
  };
})();
