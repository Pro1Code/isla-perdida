// Genera las voces de los personajes (un MP3 por frase) con voces neuronales Piper:
//   node scripts/voces.js            (solo las frases nuevas o cambiadas)
//   node scripts/voces.js --todo     (vuelve a generarlas todas, p. ej. si cambias el tono de una voz)
// Lee las frases y las voces de js/lines.js, guarda los audios en audio/voces/ y la lista con
// su duración en js/voice-list.js. Piper, sus voces y el codificador MP3 (lamejs) están en
// la carpeta de compilación: ~/isla-perdida-build/tools/piper y tools/voz.
// Cada frase se dice con la emoción marcada al principio ({mando}, {miedo}, {susurro}…): cambia el ritmo,
// el tono, la expresividad y se le añaden efectos (temblor, voz rasposa, aliento, eco de cueva).
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOLS = path.join(os.homedir(), 'isla-perdida-build', 'tools');
const PIPER = path.join(TOOLS, 'piper', 'piper', 'piper.exe');
const MODELS = path.join(TOOLS, 'piper', 'voices');
const MODEL = { davefx: 'es_ES-davefx-medium', sharvard: 'es_ES-sharvard-medium', ald: 'es_MX-ald-medium', claude: 'es_MX-claude-high', daniela: 'es_AR-daniela-high' };
const OUT = path.join(ROOT, 'audio', 'voces');
const LIST = path.join(ROOT, 'js', 'voice-list.js');
const ALL = process.argv.includes('--todo');
const RATE = 22050, KBPS = 32;

if (!fs.existsSync(PIPER)) { console.error('No encuentro Piper en ' + PIPER); process.exit(1); }
vm.runInThisContext(fs.readFileSync(path.join(TOOLS, 'voz', 'node_modules', 'lamejs', 'lame.all.js'), 'utf8'));
/* global lamejs */

// ------------------------------------------------------------------ emociones
// l: ritmo (>1 más pausado) · p: tono · ns/nw: expresividad de Piper · sil: pausa entre frases
// rudo: voz rasposa · vib: temblor de tono [Hz, cantidad] · trem: temblor de volumen · aire: aliento
// rev: eco de cueva · rms: fuerza de la voz
const MOODS = {
  neutral: {},
  calma: { l: 1.06, p: 0.98, ns: 0.5, nw: 0.6, rms: 0.13 },
  mando: { l: 1.08, p: 0.94, ns: 0.45, nw: 0.55, rudo: 0.15, rms: 0.16 },
  grito: { l: 0.88, p: 1.06, ns: 0.8, nw: 0.9, sil: 0.15, rudo: 0.35, rms: 0.19 },
  furia: { l: 0.9, p: 0.97, ns: 0.85, nw: 0.9, sil: 0.15, rudo: 0.5, rms: 0.19 },
  miedo: { l: 0.9, p: 1.08, ns: 0.95, nw: 1.1, vib: [6.5, 0.028], trem: [8, 0.3], aire: 0.12, rms: 0.13 },
  susurro: { l: 1.18, p: 0.96, ns: 0.55, nw: 0.7, sil: 0.45, aire: 0.35, rev: 0.35, rms: 0.1 },
  triste: { l: 1.2, p: 0.93, ns: 0.5, nw: 0.6, sil: 0.45, vib: [4.5, 0.012], aire: 0.08, rms: 0.11 },
  alegre: { l: 0.94, p: 1.06, ns: 0.85, nw: 0.95, rms: 0.15 },
  burla: { l: 1.0, p: 1.03, ns: 0.9, nw: 1.0, rudo: 0.2, rms: 0.15 },
};

// ------------------------------------------------------------------ frases (las mismas reglas que js/voice.js)
const ctx = { window: { G: {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'lines.js'), 'utf8'), ctx);
const { VOICES, LINES } = ctx.window.G;
const moodOf = (text) => { const m = String(text).match(/^\{(\w+)\}/); return m && MOODS[m[1]] ? m[1] : 'neutral'; };
const spoken = (text) => { const t = String(text).replace(/^\{\w+\}/, ''), q = t.match(/«[^»]*»/g); return (q ? q.map((s) => s.slice(1, -1)).join(' ') : t).replace(/\s+/g, ' ').trim(); };
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const keyOf = (spk, text) => spk + '-' + hash(spk + '|' + moodOf(text) + '|' + spoken(text));
const PIRATES = ['pirata1', 'pirata2', 'pirata3'];
const jobs = new Map();
const add = (spk, text) => { if (!VOICES[spk]) throw new Error('Voz desconocida: ' + spk); const k = keyOf(spk, text); if (!jobs.has(k)) jobs.set(k, { spk, mood: moodOf(text), text: spoken(text) }); };
const walk = (spk, v) => { if (typeof v === 'string') add(spk, v); else if (v && typeof v === 'object') for (const k in v) walk(spk, v[k]); };
for (const k in LINES) {
  if (k === 'cine') for (const [spk, t] of LINES.cine) add(spk, t);
  else if (k === 'charlas') { for (const c of LINES.charlas) for (const [spk, t] of c.lines) for (const s of spk === 'pirata' ? PIRATES : [spk]) add(s, t); }
  else walk(k, LINES[k]);
}

// Cómo debe pronunciarse (Piper lee en español). Los marineros arrastran las erres.
const L_ = '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]';
function say(t, V) {
  t = t.replace(/…/g, '...').replace(/✖/g, 'equis').replace(/—/g, ',').replace(/\bCrane\b/g, 'Créin').replace(/\bD\. Aldor\b/g, 'De Aldor')
    .replace(/\bQ\b/g, 'cu').replace(/\(Z\)/g, '(zeta)').replace(/\bMI\b/g, 'mi').replace(/[()]/g, ',').replace(/Jajaja/g, 'Ja, ja, ja');
  t = t.replace(/rr/g, 'rrr')
    .replace(new RegExp('(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])([rR])(?=' + L_ + ')', 'g'), '$1$2r')
    .replace(/([nlsNLS])r/g, '$1rr');
  if (V.lobo) t = t.replace(new RegExp('(' + L_ + ')r(?!' + L_ + ')', 'g'), '$1rr');
  return t;
}

// ------------------------------------------------------------------ lista anterior (duraciones)
const prev = {};
if (fs.existsSync(LIST)) { const c = { window: { G: {} } }; try { vm.runInNewContext(fs.readFileSync(LIST, 'utf8'), c); Object.assign(prev, c.window.G.VOICE_LIST || {}); } catch (e) { /* se regenera */ } }
fs.mkdirSync(OUT, { recursive: true });
const todo = [...jobs].filter(([k]) => ALL || !prev[k] || !fs.existsSync(path.join(OUT, k + '.mp3')));
console.log(`${jobs.size} frases · ${todo.length} por generar`);

// ------------------------------------------------------------------ audio
function readWav(f) {
  const b = fs.readFileSync(f); let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) >> 1, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
  return { sr: b.readUInt32LE(24), s };
}
// Tono: se remuestrea (p > 1 más agudo y más corto; el ritmo se compensa al generar con Piper).
// vibs: temblores de tono [[Hz, cantidad], ...] (miedo, tristeza, edad)
function resample(s, p, sr, vibs) {
  const k = sr / RATE * p, out = [];
  let x = 0, i = 0;
  while (x < s.length - 1) {
    const j = Math.floor(x), f = x - j;
    out.push(s[j] * (1 - f) + s[j + 1] * f);
    let m = 1;
    for (const [hz, d] of vibs) m += d * Math.sin(2 * Math.PI * hz * i / RATE);
    x += k * m; i++;
  }
  return Float32Array.from(out);
}
function trim(s) {
  const th = 0.012; let a = 0, b = s.length - 1;
  while (a < b && Math.abs(s[a]) < th) a++;
  while (b > a && Math.abs(s[b]) < th) b--;
  const pad = Math.round(RATE * 0.04);
  return s.slice(Math.max(0, a - pad), Math.min(s.length, b + pad));
}
// Temblor de volumen (miedo)
function tremolo(s, hz, d) { for (let i = 0; i < s.length; i++) s[i] *= 1 - d * (0.5 + 0.5 * Math.sin(2 * Math.PI * hz * i / RATE)); return s; }
// Voz rasposa de lobo de mar: saturación suave
function rough(s, amount) {
  let pk = 0; for (const v of s) pk = Math.max(pk, Math.abs(v));
  const drive = 1 + amount * 5, g = 1 / Math.max(pk, 1e-4), n = Math.tanh(drive);
  for (let i = 0; i < s.length; i++) s[i] = Math.tanh(s[i] * g * drive) / n;
  return s;
}
// Aliento: ruido agudo que sigue a la voz (susurros, miedo)
function breath(s, amount) {
  let env = 0, prev = 0, seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < s.length; i++) {
    const a = Math.abs(s[i]);
    env += (a - env) * (a > env ? 0.02 : 0.002);
    const w = rnd(), hp = w - prev; prev = w;
    s[i] += hp * env * amount * 2.2;
  }
  return s;
}
// Eco de cueva (reverberación sencilla: 4 peines + 2 pasatodo)
function reverb(s, wet) {
  const tail = Math.round(RATE * 1.0), o = new Float32Array(s.length + tail), wetB = new Float32Array(o.length);
  for (const ms of [29.7, 37.1, 41.1, 43.7]) {
    const d = Math.round(RATE * ms / 1000), buf = new Float32Array(d);
    let lp = 0;
    for (let i = 0; i < o.length; i++) {
      const y = buf[i % d];
      lp = y * 0.7 + lp * 0.3;
      buf[i % d] = (s[i] || 0) + lp * 0.78;
      wetB[i] += y * 0.25;
    }
  }
  for (const ms of [5.0, 1.7]) {
    const d = Math.round(RATE * ms / 1000), buf = new Float32Array(d);
    for (let i = 0; i < o.length; i++) { const b = buf[i % d], x = wetB[i]; const y = -0.7 * x + b; buf[i % d] = x + 0.7 * y; wetB[i] = y; }
  }
  for (let i = 0; i < o.length; i++) o[i] = (s[i] || 0) * (1 - wet * 0.4) + wetB[i] * wet;
  return o;
}
function echo(s) {
  const d1 = Math.round(RATE * 0.12), d2 = Math.round(RATE * 0.26), o = new Float32Array(s.length + d2);
  for (let i = 0; i < o.length; i++) o[i] = (s[i] || 0) + (s[i - d1] || 0) * 0.34 + (s[i - d2] || 0) * 0.17;
  return o;
}
function normalize(s, target) {
  let sum = 0, pk = 0, n = 0;
  for (const v of s) { if (Math.abs(v) > 0.01) { sum += v * v; n++; } pk = Math.max(pk, Math.abs(v)); }
  const rms = Math.sqrt(sum / Math.max(1, n));
  const g = Math.min(target / Math.max(rms, 1e-4), 0.95 / Math.max(pk, 1e-4));
  for (let i = 0; i < s.length; i++) s[i] *= g;
  // Entrada y salida suaves (sin chasquidos)
  const f = Math.min(200, s.length >> 2);
  for (let i = 0; i < f; i++) { s[i] *= i / f; s[s.length - 1 - i] *= i / f; }
  return s;
}
function mp3(s) {
  const pcm = new Int16Array(s.length);
  for (let i = 0; i < s.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s[i] * 32767)));
  const enc = new lamejs.Mp3Encoder(1, RATE, KBPS), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const e = enc.flush(); if (e.length) parts.push(Buffer.from(e));
  return Buffer.concat(parts);
}

// ------------------------------------------------------------------ generación (un proceso de Piper por voz y emoción)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voces-'));
const groups = {};
for (const [k, j] of todo) (groups[j.spk + '|' + j.mood] = groups[j.spk + '|' + j.mood] || []).push([k, j]);
const list = {};
for (const [k] of jobs) if (prev[k] && !todo.some(([t]) => t === k)) list[k] = prev[k];
for (const g in groups) {
  const [spk, mood] = g.split('|'), V = VOICES[spk], M = MOODS[mood], items = groups[g];
  const p = (V.p || 1) * (M.p || 1), l = (V.l || 1) * (M.l || 1);
  const input = items.map(([k, j]) => JSON.stringify(Object.assign({ text: say(j.text, V), output_file: path.join(TMP, k + '.wav') }, V.s !== undefined ? { speaker_id: V.s } : {}))).join('\n') + '\n';
  const args = ['-m', path.join(MODELS, MODEL[V.v] + '.onnx'), '--json-input', '--length_scale', String(l * p), '--noise_scale', String(M.ns ?? 0.667), '--noise_w', String(M.nw ?? 0.8), '--sentence_silence', String(M.sil ?? 0.25), '-q'];
  const r = spawnSync(PIPER, args, { input, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error(`Piper falló con la voz ${spk} (${mood}):`, r.stderr); process.exit(1); }
  const vibs = [];
  if (M.vib) vibs.push(M.vib);
  if (V.viejo) vibs.push([5.2, 0.009]);
  for (const [k] of items) {
    const w = readWav(path.join(TMP, k + '.wav'));
    let s = trim(resample(w.s, p, w.sr, vibs));
    if (M.trem) s = tremolo(s, M.trem[0], M.trem[1]);
    const rudo = Math.min(0.8, (V.rudo || 0) + (M.rudo || 0));
    if (rudo > 0) s = rough(s, rudo);
    if (M.aire) s = breath(s, M.aire);
    if (V.eco) s = echo(s);
    if (M.rev) s = reverb(s, M.rev);
    s = normalize(s, M.rms || 0.14);
    fs.writeFileSync(path.join(OUT, k + '.mp3'), mp3(s));
    list[k] = Math.round(s.length / RATE * 100) / 100;
  }
  console.log(`  ${spk} · ${mood}: ${items.length}`);
}
fs.rmSync(TMP, { recursive: true, force: true });

// Audios que ya no se usan
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !jobs.has(f.slice(0, -4))) fs.rmSync(path.join(OUT, f));
const keys = Object.keys(list).sort();
fs.writeFileSync(LIST, '// Generado por scripts/voces.js: audios de voz disponibles (audio/voces/<clave>.mp3) y su duración en segundos\n' +
  'window.G.VOICE_LIST = {\n' + keys.map((k) => `  '${k}': ${list[k]},`).join('\n') + '\n};\n');
const size = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`✅ ${keys.length} voces · ${(size / 1048576).toFixed(1)} MB en audio/voces`);
