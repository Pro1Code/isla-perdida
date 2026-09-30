// Genera el ícono del juego (PNG 256×256 e ICO, y los de 192 y 512 para la app del móvil) sin dependencias: isla con palmera, sol y mar.
// Uso: node scripts/make-icon.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 4;
// PNG
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Color de cada punto (coordenadas 0..1, y hacia abajo); devuelve [r, g, b, a]
function color(x, y) {
  const cx = x - 0.5, cy = y - 0.5, d = Math.hypot(cx, cy);
  if (d > 0.49) return [0, 0, 0, 0];
  if (d > 0.46) return [0.78, 0.62, 0.32, 1]; // aro dorado
  // Cielo y mar
  let c = y < 0.58 ? [mix(0.98, 0.55, y / 0.58), mix(0.72, 0.8, y / 0.58), mix(0.35, 0.95, y / 0.58)] : [0.05, mix(0.45, 0.25, (y - 0.58) / 0.4), mix(0.62, 0.45, (y - 0.58) / 0.4)];
  // Sol
  const sd = Math.hypot(x - 0.68, y - 0.34);
  if (sd < 0.11) c = [1, 0.86, 0.45];
  else if (sd < 0.16) c = c.map((v, i) => mix(v, [1, 0.8, 0.5][i], (0.16 - sd) / 0.05 * 0.6));
  // Olas
  if (y > 0.72) {
    const band = Math.floor((y - 0.72) / 0.055), fy = ((y - 0.72) / 0.055) % 1, fx = (x * 7 + band * 0.45) % 1;
    if (fx < 0.45 && Math.abs(fy - 0.5 - Math.sin(fx / 0.45 * Math.PI) * 0.25) < 0.09) c = [0.6, 0.85, 0.9];
  }
  // Isla (arena)
  const iy = 0.66 - 0.09 * Math.exp(-((x - 0.45) ** 2) / 0.03);
  if (y > iy && y < 0.7 && x > 0.2 && x < 0.72) c = y > 0.685 ? [0.85, 0.7, 0.45] : [0.95, 0.83, 0.55];
  // Tronco curvo de la palmera
  for (let t = 0; t <= 1; t += 0.01) {
    const tx = 0.44 + Math.sin(t * 1.3) * 0.09, ty = 0.6 - t * 0.33, w = mix(0.022, 0.012, t);
    if (Math.hypot(x - tx, y - ty) < w) c = Math.floor(t * 12) % 2 ? [0.45, 0.3, 0.16] : [0.55, 0.37, 0.2];
  }
  // Hojas
  const hx = 0.44 + Math.sin(1.3) * 0.09, hy = 0.27;
  for (const [a, L] of [[-2.6, 0.2], [-1.9, 0.17], [-0.3, 0.2], [0.35, 0.18], [-1.2, 0.14], [2.9, 0.16]]) {
    for (let t = 0; t <= 1; t += 0.02) {
      const fx = hx + Math.cos(a) * L * t, fy = hy + Math.sin(a) * L * t + t * t * 0.06;
      if (Math.hypot(x - fx, y - fy) < 0.03 * Math.sin(Math.PI * Math.min(1, t + 0.15))) c = [0.18, mix(0.55, 0.42, t), 0.2];
    }
  }
  // Cocos
  if (Math.hypot(x - hx + 0.012, y - hy - 0.02) < 0.016 || Math.hypot(x - hx - 0.018, y - hy - 0.015) < 0.014) c = [0.35, 0.22, 0.1];
  return [...c, 1];
}
// Dibuja el ícono de S×S píxeles (con supermuestreo) y devuelve el PNG
function render(S) {
const N = S * SS, px = new Float32Array(S * S * 4);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const c = color((i + 0.5) / N, (j + 0.5) / N), o = (Math.floor(j / SS) * S + Math.floor(i / SS)) * 4;
  px[o] += c[0] * c[3]; px[o + 1] += c[1] * c[3]; px[o + 2] += c[2] * c[3]; px[o + 3] += c[3];
}
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4, a = px[o + 3] / (SS * SS), r = y * (S * 4 + 1) + 1 + x * 4;
    raw[r] = clamp(Math.round(a ? px[o] / px[o + 3] * 255 : 0), 0, 255);
    raw[r + 1] = clamp(Math.round(a ? px[o + 1] / px[o + 3] * 255 : 0), 0, 255);
    raw[r + 2] = clamp(Math.round(a ? px[o + 2] / px[o + 3] * 255 : 0), 0, 255);
    raw[r + 3] = clamp(Math.round(a * 255), 0, 255);
  }
}
// PNG
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const png = render(256);
// ICO con el PNG dentro (Windows Vista y posteriores)
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'desktop', 'icon.png'), png);
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png);
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([ico, png]));
// Íconos de la app para el móvil (PWA: se instala desde el navegador)
fs.mkdirSync(path.join(root, 'img'), { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(path.join(root, 'img', `icon-${s}.png`), render(s));
console.log('Ícono creado:', png.length, 'bytes (y img/icon-192.png, img/icon-512.png)');
