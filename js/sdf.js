// Escultor por campos de distancia (SDF) para los animales: el cuerpo se modela con primitivas que se funden
// entre sí como la arcilla (uniones suaves) y con restas para las cuencas de los ojos, las fosas nasales o la boca.
// La superficie se extrae con Surface Nets y cada vértice se ajusta a la superficie real → malla orgánica, lisa
// y sin costuras. Cada vértice hereda de las primitivas cercanas su color, su pelo, su dibujo (manchas, escamas),
// la dirección del pelo y los pesos de los huesos (para la malla con esqueleto de rig.js).
(function () {
  'use strict';
  const G = window.G;
  const S = (G.Sdf = {});
  const Col = THREE.Color;

  // ------------------------------------------------------------------ primitivas
  // Opciones comunes: k (radio de fusión), sub (resta), paint (solo pinta, sin forma; soft = borde),
  // bone (hueso), color, fur (0 = piel dura y brillante … 1 = pelo), pat (cantidad de dibujo), ps (escala del dibujo),
  // hair ([x,y,z] dirección del pelo), cb / bb (anchura de la mezcla de color / de huesos)
  const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  function prep(p) {
    p.k = p.k ?? 0.04;
    p.fur = p.fur ?? 1; p.pat = p.pat ?? 1; p.ps = p.ps ?? 1;
    if (p.color !== undefined) p.col = new Col(p.color);
    if (p.kind === 1) {
      const a = V(p.a), b = V(p.b);
      const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      p.L = Math.hypot(d.x, d.y, d.z) || 1e-4;
      const w = norm(d);
      let up = p.up ? norm(V(p.up)) : { x: 0, y: 1, z: 0 };
      if (Math.abs(w.x * up.x + w.y * up.y + w.z * up.z) > 0.96) up = Math.abs(w.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      const u = norm(cross(up, w)), v = cross(w, u);
      p.A = a; p.u = u; p.v = v; p.w = w;
      p.sx = p.sx ?? 1; p.sy = p.sy ?? 1;
      p.fs = Math.min(1, p.sx, p.sy);
      const l2 = p.L * p.L, rr = p.ra - p.rb;
      p.l2 = l2; p.rr = rr; p.a2 = l2 - rr * rr; p.il2 = 1 / l2;
      const R = Math.max(p.ra, p.rb) * Math.max(1, p.sx, p.sy);
      p.min = [Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R];
      p.max = [Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R];
      p.ax = p.hair ? norm(V(p.hair)) : w;
    } else {
      const c = V(p.c), r = p.r;
      p.C = c;
      const e = new THREE.Euler(...(p.rot || [0, 0, 0]));
      const m = new THREE.Matrix4().makeRotationFromEuler(e);
      const el = m.elements; // columnas: ejes locales en el mundo
      p.ex = { x: el[0], y: el[1], z: el[2] }; p.ey = { x: el[4], y: el[5], z: el[6] }; p.ez = { x: el[8], y: el[9], z: el[10] };
      const R = Math.max(r[0], r[1], r[2]);
      p.min = [c.x - R, c.y - R, c.z - R]; p.max = [c.x + R, c.y + R, c.z + R];
      p.ax = p.hair ? norm(V(p.hair)) : (r[2] >= r[0] && r[2] >= r[1] ? p.ez : r[1] >= r[0] ? p.ey : p.ex);
      p.rmin = Math.min(r[0], r[1], r[2]);
    }
    if (p.paint) p.soft = p.soft ?? 0.02;
    return p;
  }
  // Cono redondeado de a (radio ra) a b (radio rb); sx / sy: sección elíptica (ancho / alto); up: hacia dónde es "alto"
  S.cone = (a, b, ra, rb, o) => prep(Object.assign({ kind: 1, a, b, ra, rb }, o || {}));
  // Elipsoide de centro c y radios r = [rx, ry, rz], girado con rot = [x, y, z]
  S.ell = (c, r, o) => prep(Object.assign({ kind: 2, c, r }, o || {}));
  S.sph = (c, r, o) => prep(Object.assign({ kind: 2, c, r: [r, r, r] }, o || {}));

  // Distancia con signo de una primitiva
  function dist(p, x, y, z) {
    if (p.kind === 1) {
      const px = x - p.A.x, py = y - p.A.y, pz = z - p.A.z;
      const lx = (px * p.u.x + py * p.u.y + pz * p.u.z) / p.sx;
      const ly = (px * p.v.x + py * p.v.y + pz * p.v.z) / p.sy;
      const lz = px * p.w.x + py * p.w.y + pz * p.w.z;
      const L = p.L, l2 = p.l2, rr = p.rr, a2 = p.a2, il2 = p.il2;
      const yy = lz * L, zz = yy - l2;
      const x2 = (lx * lx + ly * ly) * l2 * l2, y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      let d;
      if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - p.rb;
      else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - p.ra;
      else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.ra;
      return d * p.fs;
    }
    const dx = x - p.C.x, dy = y - p.C.y, dz = z - p.C.z;
    const qx = (dx * p.ex.x + dy * p.ex.y + dz * p.ex.z) / p.r[0];
    const qy = (dx * p.ey.x + dy * p.ey.y + dz * p.ey.z) / p.r[1];
    const qz = (dx * p.ez.x + dy * p.ez.y + dz * p.ez.z) / p.r[2];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    const k1 = Math.sqrt(qx * qx / (p.r[0] * p.r[0]) + qy * qy / (p.r[1] * p.r[1]) + qz * qz / (p.r[2] * p.r[2]));
    return k1 < 1e-9 ? -p.rmin : (k0 * (k0 - 1)) / k1;
  }
  S.dist = dist;
  function smin(a, b, k) {
    if (k <= 0) return a < b ? a : b;
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return (a < b ? a : b) - h * h * k * 0.25;
  }
  function field(uni, sub, x, y, z) {
    let d = 1e9;
    for (let i = 0; i < uni.length; i++) d = smin(d, dist(uni[i], x, y, z), uni[i].k);
    for (let i = 0; i < sub.length; i++) d = -smin(-d, dist(sub[i], x, y, z), sub[i].k);
    return d;
  }
  const near = (list, x0, y0, z0, x1, y1, z1, m) => list.filter((p) => p.max[0] + p.k + m >= x0 && p.min[0] - p.k - m <= x1 && p.max[1] + p.k + m >= y0 && p.min[1] - p.k - m <= y1 && p.max[2] + p.k + m >= z0 && p.min[2] - p.k - m <= z1);

  // ------------------------------------------------------------------ malla
  // prims: lista de primitivas; o.h: tamaño de celda; o.bones: { nombre: índice }; o.cb / o.bb: mezcla de color / huesos
  // Generador: se puede ejecutar de una vez (S.mesh) o a trozos entre fotogramas (rig.js lo reparte en segundo plano)
  S.meshGen = function* (prims, o) {
    const t0 = performance.now();
    const h = o.h, uni = prims.filter((p) => !p.sub && !p.paint), sub = prims.filter((p) => p.sub), paint = prims.filter((p) => p.paint);
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of uni) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p.min[a] - p.k); mx[a] = Math.max(mx[a], p.max[a] + p.k); }
    for (let a = 0; a < 3; a++) { mn[a] -= h * 2; mx[a] += h * 2; }
    const nx = Math.ceil((mx[0] - mn[0]) / h) + 1, ny = Math.ceil((mx[1] - mn[1]) / h) + 1, nz = Math.ceil((mx[2] - mn[2]) / h) + 1;
    const N = nx * ny * nz, F = new Float32Array(N), done = new Uint8Array(N);
    const id = (i, j, k) => i + nx * (j + ny * k);
    const X = (i) => mn[0] + i * h, Y = (j) => mn[1] + j * h, Z = (k) => mn[2] + k * h;
    // 1) Rejilla gruesa: los bloques lejos de la superficie se rellenan sin calcular
    const C = 4, bx = Math.ceil((nx - 1) / C), by = Math.ceil((ny - 1) / C), bz = Math.ceil((nz - 1) / C);
    const cs = (i, n) => Math.min(i * C, n - 1);
    const cx = bx + 1, cy = by + 1, Fc = new Float32Array(cx * cy * (bz + 1));
    for (let k = 0; k <= bz; k++) for (let j = 0; j <= by; j++) {
      for (let i = 0; i <= bx; i++) Fc[i + cx * (j + cy * k)] = field(uni, sub, X(cs(i, nx)), Y(cs(j, ny)), Z(cs(k, nz)));
      if ((j & 3) === 3) yield;
    }
    const thr = C * h * 1.732 * 1.6;
    let evals = 0;
    for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
      let lo = 1e9, pos = 0, neg = 0;
      for (let c = 0; c < 8; c++) {
        const v = Fc[(i + (c & 1)) + cx * ((j + ((c >> 1) & 1)) + cy * (k + (c >> 2)))];
        lo = Math.min(lo, Math.abs(v)); if (v < 0) neg++; else pos++;
      }
      const i0 = i * C, j0 = j * C, k0 = k * C, i1 = Math.min(i0 + C, nx - 1), j1 = Math.min(j0 + C, ny - 1), k1 = Math.min(k0 + C, nz - 1);
      if ((pos === 8 || neg === 8) && lo > thr) {
        const v = neg === 8 ? -thr : thr;
        for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { const q = id(ii, jj, kk); if (!done[q]) F[q] = v; }
        continue;
      }
      const m = C * h * 1.8;
      const U2 = near(uni, X(i0), Y(j0), Z(k0), X(i1), Y(j1), Z(k1), m), S2 = near(sub, X(i0), Y(j0), Z(k0), X(i1), Y(j1), Z(k1), m);
      for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const q = id(ii, jj, kk);
        if (done[q] === 2) continue;
        F[q] = field(U2, S2, X(ii), Y(jj), Z(kk)); done[q] = 2; evals++;
      }
      if ((evals & 1023) < 128) yield;
    }
    const tA = performance.now();
    // 2) Surface Nets: un vértice por celda que corta la superficie
    const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
    const cellV = new Int32Array(cnx * cny * cnz).fill(-1);
    const P = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const v8 = new Float32Array(8);
    for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0, _y = (j === 0 && (k & 3) === 0); i < cnx; i++) {
      if (_y && i === 0) yield;
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = F[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))]; v8[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        const va = v8[a], vb = v8[b];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t;
        sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
        sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
        n++;
      }
      cellV[i + cnx * (j + cny * k)] = P.length / 3;
      P.push(X(i) + (sx / n) * h, Y(j) + (sy / n) * h, Z(k) + (sz / n) * h);
    }
    const cid = (i, j, k) => cellV[i + cnx * (j + cny * k)];
    const idx = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0, _y = (j === 0 && (k & 3) === 0); i < nx; i++) {
      if (_y && i === 0) yield;
      const v0 = F[id(i, j, k)], in0 = v0 < 0;
      if (i < nx - 1 && j >= 1 && k >= 1 && j < ny - 1 && k < nz - 1 && in0 !== (F[id(i + 1, j, k)] < 0)) quad(cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k), in0);
      if (j < ny - 1 && i >= 1 && k >= 1 && i < nx - 1 && k < nz - 1 && in0 !== (F[id(i, j + 1, k)] < 0)) quad(cid(i - 1, j, k - 1), cid(i - 1, j, k), cid(i, j, k), cid(i, j, k - 1), in0);
      if (k < nz - 1 && i >= 1 && j >= 1 && i < nx - 1 && j < ny - 1 && in0 !== (F[id(i, j, k + 1)] < 0)) quad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k), in0);
    }
    const tB = performance.now();
    // 3) Cada vértice se lleva a la superficie real (Newton) y toma su normal del gradiente
    const nv = P.length / 3, NR = new Float32Array(nv * 3), e = h * 0.2;
    const lists = new Array(nv);
    for (let v = 0; v < nv; v++) {
      if ((v & 63) === 63) yield;
      let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const m = h * 2;
      const U2 = near(uni, x, y, z, x, y, z, m), S2 = near(sub, x, y, z, x, y, z, m);
      lists[v] = U2;
      let gx = 0, gy = 0, gz = 0;
      for (let it = 0; it < 3; it++) {
        const f = field(U2, S2, x, y, z);
        gx = field(U2, S2, x + e, y, z) - field(U2, S2, x - e, y, z);
        gy = field(U2, S2, x, y + e, z) - field(U2, S2, x, y - e, z);
        gz = field(U2, S2, x, y, z + e) - field(U2, S2, x, y, z - e);
        const gl = Math.hypot(gx, gy, gz) / (2 * e);
        if (it === 2 || gl < 1e-6) break;
        let s = f / (gl * gl) / (2 * e);
        const step = Math.abs(f / gl);
        if (step > h * 0.7) s *= (h * 0.7) / step;
        x -= gx * s; y -= gy * s; z -= gz * s;
      }
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
      const gl = Math.hypot(gx, gy, gz) || 1;
      NR[v * 3] = gx / gl; NR[v * 3 + 1] = gy / gl; NR[v * 3 + 2] = gz / gl;
    }
    // Triángulos mirando hacia fuera (según la normal del campo)
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const tx = uy * wz - uz * wy, ty = uz * wx - ux * wz, tz = ux * wy - uy * wx;
      if (tx * (NR[a] + NR[b] + NR[c]) + ty * (NR[a + 1] + NR[b + 1] + NR[c + 1]) + tz * (NR[a + 2] + NR[b + 2] + NR[c + 2]) < 0) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }
    }
    const tC = performance.now();
    // 4) Atributos heredados de las primitivas cercanas
    const nb = o.bones || {}, cbW = o.cb || 0.025, bbW = o.bb || 0.06;
    const U2lerp = (a, b, t) => a + (b - a) * t, aoM = (o.ao || 0.03) * 5.5 + h;
    const aoL = new Array(nv), aoS = new Array(nv);
    if (o.ao !== 0) for (let v = 0; v < nv; v++) { if ((v & 255) === 255) yield; const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; aoL[v] = near(uni, x, y, z, x, y, z, aoM); aoS[v] = near(sub, x, y, z, x, y, z, aoM); }
    const COL = new Float32Array(nv * 3), SUR = new Float32Array(nv * 3), HAIR = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), REG = new Float32Array(nv * 4);
    const c = new Col(), tmp = new Col();
    for (let v = 0; v < nv; v++) {
      if ((v & 127) === 127) yield;
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const L = lists[v].length ? lists[v] : uni;
      let dmin = 1e9, pmin = null;
      const ds = L.map((p) => { const d = Math.max(0, dist(p, x, y, z)); if (d < dmin) { dmin = d; pmin = p; } return d; });
      // La nitidez del color la marca la pieza más cercana (trufa, pezuñas o garras con borde nítido)
      const tauC = (pmin && pmin.cb) || cbW;
      let wsum = 0, r = 0, g = 0, b = 0, fu = 0, pa = 0, ps = 0, hx = 0, hy = 0, hz = 0;
      const rg = [0, 0, 0, 0];
      const bw = {};
      for (let i = 0; i < L.length; i++) {
        const p = L[i], dd = ds[i] - dmin;
        const wc = Math.exp(-dd / Math.min(tauC, p.cb || cbW));
        if (p.col) { r += p.col.r * wc; g += p.col.g * wc; b += p.col.b * wc; } else { r += wc * 0.5; g += wc * 0.5; b += wc * 0.5; }
        fu += p.fur * wc; pa += p.pat * wc; ps += p.ps * wc;
        if (p.reg !== undefined) rg[p.reg] += wc;
        const s = hx * p.ax.x + hy * p.ax.y + hz * p.ax.z < 0 ? -1 : 1;
        hx += p.ax.x * wc * s; hy += p.ax.y * wc * s; hz += p.ax.z * wc * s;
        wsum += wc;
        if (p.bone !== undefined) { const wb = Math.exp(-dd / (p.bb || bbW)); bw[p.bone] = (bw[p.bone] || 0) + wb; }
      }
      c.setRGB(r / wsum, g / wsum, b / wsum);
      let fur = fu / wsum, pat = pa / wsum, psc = ps / wsum;
      for (let q = 0; q < 4; q++) rg[q] /= wsum;
      for (const p of paint) {
        if (x < p.min[0] - p.soft || x > p.max[0] + p.soft || y < p.min[1] - p.soft || y > p.max[1] + p.soft || z < p.min[2] - p.soft || z > p.max[2] + p.soft) continue;
        const d = dist(p, x, y, z), t = 1 - Math.min(1, Math.max(0, (d + p.soft) / (2 * p.soft)));
        if (t <= 0) continue;
        const k = t * t * (3 - 2 * t) * (p.amt ?? 1);
        if (p.col) c.lerp(tmp.copy(p.col), k);
        if (p.reg !== undefined || p.fixed) for (let q = 0; q < 4; q++) rg[q] += ((p.reg === q ? 1 : 0) - rg[q]) * k;
        if (p.fur !== undefined && p.paintFur) fur += (p.fur - fur) * k;
        if (p.pat !== undefined && p.paintPat) pat += (p.pat - pat) * k;
      }
      // Oclusión ambiental: los huecos (axilas, bajo la mandíbula, base de las orejas) quedan en sombra
      if (o.ao !== 0) {
        const nx = NR[v * 3], ny = NR[v * 3 + 1], nz = NR[v * 3 + 2], d0 = o.ao || 0.03;
        const A2 = aoL[v] || uni, SS = aoS[v] || sub;
        let occ = 0, wt = 0;
        for (let q = 1; q <= 3; q++) {
          const dd = d0 * q * q * 0.6, w = 1 / q;
          occ += w * Math.max(0, dd - field(A2, SS, x + nx * dd, y + ny * dd, z + nz * dd)) / dd; wt += w;
        }
        const ao = Math.max(0, 1 - occ / wt * 1.6);
        c.multiplyScalar(U2lerp(o.aoMin ?? 0.4, 1, ao));
      }
      if (o.color) o.color(c, x, y, z, NR[v * 3], NR[v * 3 + 1], NR[v * 3 + 2]);
      COL[v * 3] = c.r; COL[v * 3 + 1] = c.g; COL[v * 3 + 2] = c.b;
      SUR[v * 3] = fur; SUR[v * 3 + 1] = pat; SUR[v * 3 + 2] = psc;
      for (let q = 0; q < 4; q++) REG[v * 4 + q] = rg[q];
      const hl = Math.hypot(hx, hy, hz) || 1;
      HAIR[v * 3] = hx / hl; HAIR[v * 3 + 1] = hy / hl; HAIR[v * 3 + 2] = hz / hl;
      const top = Object.entries(bw).sort((a, b2) => b2[1] - a[1]).slice(0, 4);
      let ts = 0;
      for (const [, w] of top) ts += w;
      for (let q = 0; q < 4; q++) {
        SI[v * 4 + q] = top[q] ? nb[top[q][0]] || 0 : 0;
        SW[v * 4 + q] = top[q] && ts > 0 ? top[q][1] / ts : q === 0 ? 1 : 0;
      }
    }
    const tD = performance.now();
    // 5) Geometría (triángulos sueltos, como el resto de piezas de models.js)
    const T = idx.length, out = { pos: new Float32Array(T * 3), nrm: new Float32Array(T * 3), col: new Float32Array(T * 3), sur: new Float32Array(T * 3), hair: new Float32Array(T * 3), si: new Uint16Array(T * 4), sw: new Float32Array(T * 4), reg: new Float32Array(T * 4) };
    for (let t = 0; t < T; t++) {
      const v = idx[t];
      for (let a = 0; a < 3; a++) { out.pos[t * 3 + a] = P[v * 3 + a]; out.nrm[t * 3 + a] = NR[v * 3 + a]; out.col[t * 3 + a] = COL[v * 3 + a]; out.sur[t * 3 + a] = SUR[v * 3 + a]; out.hair[t * 3 + a] = HAIR[v * 3 + a]; }
      for (let a = 0; a < 4; a++) { out.si[t * 4 + a] = SI[v * 4 + a]; out.sw[t * 4 + a] = SW[v * 4 + a]; out.reg[t * 4 + a] = REG[v * 4 + a]; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(out.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(out.nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(out.col, 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(out.sur, 3));
    geo.setAttribute('aHair', new THREE.BufferAttribute(out.hair, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(out.si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(out.sw, 4));
    geo.setAttribute('aReg', new THREE.BufferAttribute(out.reg, 4));
    S.last = { ms: Math.round(performance.now() - t0), tris: T / 3, grid: [nx, ny, nz], evals, fase: [tA - t0, tB - tA, tC - tB, tD - tC].map(Math.round) };
    return geo;
  };
  S.run = (gen) => { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; };
  S.mesh = (prims, o) => S.run(S.meshGen(prims, o));
})();
