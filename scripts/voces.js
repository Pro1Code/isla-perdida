// Genera las voces de los personajes (un MP3 por frase) con voces neuronales Piper:
//   node scripts/voces.js            (solo las frases nuevas o cambiadas)
//   node scripts/voces.js --todo     (vuelve a generarlas todas, p. ej. si cambias el tono de una voz)
// Lee las frases y las voces de js/lines.js, guarda los audios en audio/voces/ y la lista con
// su duración en js/voice-list.js. Piper, sus voces y el codificador MP3 (lamejs) están en
// la carpeta de compilación: ~/isla-perdida-build/tools/piper y tools/voz.
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

// ------------------------------------------------------------------ frases (las mismas reglas que js/voice.js)
const ctx = { window: { G: {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'lines.js'), 'utf8'), ctx);
const { VOICES, LINES } = ctx.window.G;
const spoken = (text) => { const q = text.match(/«[^»]*»/g); return (q ? q.map((s) => s.slice(1, -1)).join(' ') : text).replace(/\s+/g, ' ').trim(); };
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const keyOf = (spk, text) => spk + '-' + hash(spk + '|' + spoken(text));
const PIRATES = ['pirata1', 'pirata2', 'pirata3'];
const jobs = new Map();
const add = (spk, text) => { if (!VOICES[spk]) throw new Error('Voz desconocida: ' + spk); const k = keyOf(spk, text); if (!jobs.has(k)) jobs.set(k, { spk, text: spoken(text) }); };
const walk = (spk, v) => { if (typeof v === 'string') add(spk, v); else if (v && typeof v === 'object') for (const k in v) walk(spk, v[k]); };
for (const k in LINES) {
  if (k === 'cine') for (const [spk, t] of LINES.cine) add(spk, t);
  else if (k === 'charlas') { for (const c of LINES.charlas) for (const [spk, t] of c.lines) for (const s of spk === 'pirata' ? PIRATES : [spk]) add(s, t); }
  else walk(k, LINES[k]);
}

// Cómo debe pronunciarse (Piper lee en español)
const say = (t) => t.replace(/…/g, '...').replace(/✖/g, 'equis').replace(/—/g, ',').replace(/\bCrane\b/g, 'Créin').replace(/\bD\. Aldor\b/g, 'De Aldor')
  .replace(/\bQ\b/g, 'cu').replace(/\(Z\)/g, '(zeta)').replace(/\bMI\b/g, 'mi').replace(/[()]/g, ',');

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
// Tono: se remuestrea (p > 1 más agudo y más corto; el ritmo se compensa al generar con Piper)
function resample(s, p, sr) {
  const k = sr / RATE * p, n = Math.floor(s.length / k), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * k, j = Math.floor(x), f = x - j; o[i] = (s[j] || 0) * (1 - f) + (s[j + 1] || 0) * f; }
  return o;
}
function trim(s) {
  const th = 0.012; let a = 0, b = s.length - 1;
  while (a < b && Math.abs(s[a]) < th) a++;
  while (b > a && Math.abs(s[b]) < th) b--;
  const pad = Math.round(RATE * 0.04);
  return s.slice(Math.max(0, a - pad), Math.min(s.length, b + pad));
}
function echo(s) {
  const d1 = Math.round(RATE * 0.12), d2 = Math.round(RATE * 0.26), o = new Float32Array(s.length + d2);
  for (let i = 0; i < o.length; i++) o[i] = (s[i] || 0) + (s[i - d1] || 0) * 0.34 + (s[i - d2] || 0) * 0.17;
  return o;
}
function normalize(s) {
  let sum = 0, pk = 0, n = 0;
  for (const v of s) { if (Math.abs(v) > 0.01) { sum += v * v; n++; } pk = Math.max(pk, Math.abs(v)); }
  const rms = Math.sqrt(sum / Math.max(1, n));
  const g = Math.min(0.14 / Math.max(rms, 1e-4), 0.92 / Math.max(pk, 1e-4));
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

// ------------------------------------------------------------------ generación (un proceso de Piper por voz)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voces-'));
const bySpk = {};
for (const [k, j] of todo) (bySpk[j.spk] = bySpk[j.spk] || []).push([k, j]);
const list = {};
for (const [k] of jobs) if (prev[k] && !todo.some(([t]) => t === k)) list[k] = prev[k];
for (const spk in bySpk) {
  const V = VOICES[spk], items = bySpk[spk];
  const input = items.map(([k, j]) => JSON.stringify(Object.assign({ text: say(j.text), output_file: path.join(TMP, k + '.wav') }, V.s !== undefined ? { speaker_id: V.s } : {}))).join('\n') + '\n';
  const r = spawnSync(PIPER, ['-m', path.join(MODELS, MODEL[V.v] + '.onnx'), '--json-input', '--length_scale', String((V.l || 1) * (V.p || 1)), '--sentence_silence', '0.25', '-q'], { input, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error(`Piper falló con la voz ${spk}:`, r.stderr); process.exit(1); }
  for (const [k] of items) {
    const w = readWav(path.join(TMP, k + '.wav'));
    let s = trim(resample(w.s, V.p || 1, w.sr));
    if (V.eco) s = echo(s);
    s = normalize(s);
    fs.writeFileSync(path.join(OUT, k + '.mp3'), mp3(s));
    list[k] = Math.round(s.length / RATE * 100) / 100;
  }
  console.log(`  ${spk}: ${items.length}`);
}
fs.rmSync(TMP, { recursive: true, force: true });

// Audios que ya no se usan
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !jobs.has(f.slice(0, -4))) fs.rmSync(path.join(OUT, f));
const keys = Object.keys(list).sort();
fs.writeFileSync(LIST, '// Generado por scripts/voces.js: audios de voz disponibles (audio/voces/<clave>.mp3) y su duración en segundos\n' +
  'window.G.VOICE_LIST = {\n' + keys.map((k) => `  '${k}': ${list[k]},`).join('\n') + '\n};\n');
const size = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`✅ ${keys.length} voces · ${(size / 1048576).toFixed(1)} MB en audio/voces`);
