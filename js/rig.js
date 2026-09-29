// Animales con esqueleto: una sola malla con huesos (SkinnedMesh) esculpida con sdf.js, piel procedural
// (pelo con hebras y brillo suave, rosetas, escamas con relieve, manchas, grietas de lava) y un animador
// con pasos de verdad: paso, trote y galope según la velocidad, patas por cinemática inversa que pisan el
// suelo sin resbalar (también en cuesta), columna que se dobla al girar, respiración, cola y cabeza vivas.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const R = (G.Rig = { cache: {} });
  const V3 = THREE.Vector3, Q = THREE.Quaternion, Col = THREE.Color;

  // ------------------------------------------------------------------ plantilla (se construye una vez por especie)
  R.animal = function (name) {
    const b = { name, bones: [], map: {}, prims: [], parts: [], legs: [] };
    b.bone = function (nm, parent, pos, end) {
      b.map[nm] = b.bones.length;
      b.bones.push({ name: nm, parent: parent === null ? -1 : b.map[parent], pos: new V3(...pos), end: end ? new V3(...end) : null });
      return b;
    };
    b.p = function (...prims) { for (const p of prims.flat()) if (p) b.prims.push(p); return b; };
    // Pieza aparte (orejas, ojos, dientes…): o.bone (rígida) u o.bones (pesos automáticos por cercanía a esos huesos)
    b.part = function (geo, o) { if (geo) b.parts.push({ geo, o: o || {} }); return b; };
    // Pata: huesos de la cadera al pie (3 o 4); el último acaba en su "end" (la punta que toca el suelo)
    b.leg = function (bones, o) { b.legs.push(Object.assign({ bones }, o || {})); return b; };
    // En modo diferido (R.prepare) devuelve el trabajo pendiente en vez de la plantilla
    b.done = function (o) { const gen = build(b, o || {}); return R.deferred ? { gen } : G.Sdf.run(gen); };
    return b;
  };
  // Extremo de cada hueso: su "end" o su primer hijo
  function boneEnd(b, i) {
    const bn = b.bones[i];
    if (bn.end) return bn.end;
    const ch = b.bones.findIndex((x) => x.parent === i);
    return ch >= 0 ? b.bones[ch].pos : bn.pos.clone().add(new V3(0, 0, 0.05));
  }
  function segDist(p, a, e) {
    const abx = e.x - a.x, aby = e.y - a.y, abz = e.z - a.z, l2 = abx * abx + aby * aby + abz * abz || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2));
    return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t);
  }
  // Atributos de una pieza aparte (mismos que el cuerpo esculpido)
  function prepPart(b, geo, o) {
    if (geo.index) geo = geo.toNonIndexed();
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    if (geo.attributes.uv1) geo.deleteAttribute('uv1');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const n = geo.attributes.position.count, P = geo.attributes.position;
    if (!geo.attributes.color) { const c = new Float32Array(n * 3).fill(0.5); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const sur = new Float32Array(n * 3), hair = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const names = o.bone ? [o.bone] : o.bones || [b.bones[0].name];
    const segs = names.map((nm) => { const i = b.map[nm]; return { i, a: b.bones[i].pos, e: boneEnd(b, i) }; });
    const hd = o.hair ? new V3(...o.hair).normalize() : null, p = new V3();
    for (let v = 0; v < n; v++) {
      sur[v * 3] = o.fur ?? 0; sur[v * 3 + 1] = o.pat ?? 0; sur[v * 3 + 2] = o.ps ?? 1;
      p.fromBufferAttribute(P, v);
      let ws;
      if (segs.length === 1) ws = [[segs[0].i, 1]];
      else {
        ws = segs.map((s) => [s.i, 1 / Math.pow(Math.max(1e-3, segDist(p, s.a, s.e)), 4)]).sort((x, y) => y[1] - x[1]).slice(0, 4);
        const t = ws.reduce((a, w) => a + w[1], 0);
        ws = ws.map(([i, w]) => [i, w / t]);
      }
      for (let q = 0; q < 4; q++) { si[v * 4 + q] = ws[q] ? ws[q][0] : 0; sw[v * 4 + q] = ws[q] ? ws[q][1] : 0; }
      const d = hd || new V3().subVectors(segs[0].e, segs[0].a).normalize();
      hair[v * 3] = d.x; hair[v * 3 + 1] = d.y; hair[v * 3 + 2] = d.z;
    }
    geo.setAttribute('aSurf', new THREE.BufferAttribute(sur, 3));
    geo.setAttribute('aHair', new THREE.BufferAttribute(hair, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const reg = new Float32Array(n * 4);
    if (o.reg !== undefined) for (let v = 0; v < n; v++) reg[v * 4 + o.reg] = 1;
    geo.setAttribute('aReg', new THREE.BufferAttribute(reg, 4));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'aSurf', 'aHair', 'skinIndex', 'skinWeight', 'aReg'].includes(k)) geo.deleteAttribute(k);
    return geo;
  }
  function* build(b, o) {
    const t0 = performance.now();
    // Dos niveles de detalle: la malla fina de cerca y otra más ligera (celdas más grandes) de lejos
    const mkGeo = function* (h) {
      const geos = [];
      // Grupos de primitivas (p.grp) que no se funden entre sí, cada uno con su tamaño de celda (o.hg)
      const groups = new Map();
      for (const p of b.prims) { const k = p.grp || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
      for (const [k, list] of groups) {
        if (!list.some((p) => !p.sub && !p.paint)) continue;
        const hk = o.hg && o.hg[k] ? h * (o.hg[k] / (o.h || 0.02)) : h;
        geos.push(yield* G.Sdf.meshGen(list, { h: hk, bones: b.map, cb: o.cb, bb: o.bb, color: o.color, ao: o.ao, aoMin: o.aoMin }));
      }
      yield;
      for (const pt of b.parts) { geos.push(prepPart(b, pt.geo.clone(), pt.o)); yield; }
      const g = window.mergeGeometries(geos, false);
      geos.forEach((q) => q.dispose());
      g.computeBoundingSphere();
      g.userData.shared = true;
      yield;
      return g;
    };
    const geo = yield* mkGeo(o.h || 0.02);
    const geoLow = o.lod === false ? null : yield* mkGeo((o.h || 0.02) * (o.lodK || 2.3));
    // Patas: articulaciones en reposo, largos y direcciones
    const legs = b.legs.map((L) => {
      const idx = L.bones.map((nm) => b.map[nm]);
      const J = idx.map((i) => b.bones[i].pos.clone());
      const E = boneEnd(b, idx[idx.length - 1]).clone();
      const pts = [...J, E];
      const len = [], dir = [];
      for (let i = 0; i < idx.length; i++) { const d = new V3().subVectors(pts[i + 1], pts[i]); len.push(d.length()); dir.push(d.normalize()); }
      const tgt = idx.length - 1; // la articulación que se lleva al objetivo (tobillo o menudillo)
      return Object.assign({}, L, { idx, J, E, len, dir, tgt });
    });
    const tpl = { name: b.name, geo, geoLow, bones: b.bones.map((x) => ({ name: x.name, parent: x.parent, pos: x.pos.clone() })), map: b.map, legs, o };
    tpl.ms = Math.round(performance.now() - t0);
    tpl.tris = geo.attributes.position.count / 3;
    return tpl;
  }
  // Detalle según la distancia a la cámara (en metros del animal sin escalar)
  R.lod = function (rig, d) {
    if (!rig.meshLow) return;
    const far = d > (rig.tpl.o.lodDist || 20);
    rig.mesh.visible = !far; rig.meshLow.visible = far;
  };
  // Plantilla en caché (se esculpe la primera vez que hace falta). Si ya se estaba preparando en segundo plano,
  // se termina en el momento
  R.pending = {};
  R.queue = [];
  R.get = function (key, make) {
    if (R.cache[key]) return R.cache[key];
    const job = R.pending[key];
    if (job) { delete R.pending[key]; R.queue = R.queue.filter((k) => k !== key); if (job.gen) return (R.cache[key] = G.Sdf.run(job.gen)); }
    return (R.cache[key] = make());
  };
  // Esculpe en segundo plano, a trocitos de pocos milisegundos, para que el juego no se congele
  // (primero el código de la especie, en su turno, y luego la malla poco a poco)
  R.prepare = function (key, make) {
    if (R.cache[key] || R.pending[key]) return;
    R.pending[key] = { make, gen: null };
    R.queue.push(key);
    pump();
  };
  let pumping = false;
  function pump() {
    if (pumping) return;
    pumping = true;
    const step = () => {
      const t0 = performance.now();
      while (R.queue.length && performance.now() - t0 < (R.budget || 5)) {
        const key = R.queue[0], job = R.pending[key];
        if (!job) { R.queue.shift(); continue; }
        if (!job.gen) {
          R.deferred = true;
          try { job.gen = job.make().gen; } finally { R.deferred = false; }
          break; // el resto del trabajo, en el siguiente turno
        }
        const r = job.gen.next();
        if (r.done) { R.cache[key] = r.value; delete R.pending[key]; R.queue.shift(); }
      }
      if (R.queue.length) setTimeout(step, 0); else pumping = false;
    };
    setTimeout(step, 0);
  }

  // ------------------------------------------------------------------ material de piel
  const SKIN_VS = `
attribute vec3 aSurf;
attribute vec3 aHair;
#ifdef HUMAN
attribute vec4 aReg;
varying vec4 vReg;
#endif
varying vec3 vRest;
varying vec3 vSurf;
varying vec3 vHair;
`;
  const SKIN_FS = `
varying vec3 vRest;
varying vec3 vSurf;
varying vec3 vHair;
#ifdef HUMAN
varying vec4 vReg;
uniform vec3 uSkin;
uniform vec3 uShirt;
uniform vec3 uPants;
uniform vec3 uHairC;
uniform float uRim;
#endif
uniform float uFurFreq;
uniform float uFurAmt;
uniform float uBump;
uniform float uGloss;
uniform float uPatScale;
uniform vec3 uPatCol;
uniform vec3 uPatCol2;
uniform float uSheen;
uniform float uTime;
uniform vec3 uLava;
float rgHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 rgHash3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float rgNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rgHash(i), rgHash(i + vec3(1, 0, 0)), f.x), mix(rgHash(i + vec3(0, 1, 0)), rgHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(rgHash(i + vec3(0, 0, 1)), rgHash(i + vec3(1, 0, 1)), f.x), mix(rgHash(i + vec3(0, 1, 1)), rgHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 rgVoro(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 r = g - f + rgHash3(p + g);
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = rgHash(p + g); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
vec3 rgBump(vec3 surf_pos, vec3 surf_norm, float hgt, float fd) {
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 r1 = cross(sy, surf_norm), r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * fd;
  vec2 dh = vec2(dFdx(hgt), dFdy(hgt));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surf_norm - grad);
}
`;
  const SKIN_COLOR = `
#ifdef HUMAN
  {
    float fw = clamp(1.0 - vReg.x - vReg.y - vReg.z - vReg.w, 0.0, 1.0);
    diffuseColor.rgb *= vReg.x * uSkin + vReg.y * uShirt + vReg.z * uPants + vReg.w * uHairC + vec3(fw);
  }
#endif
  vec3 hd = normalize(vHair + vec3(1e-4));
  // Pelo: mechones (se ven de lejos) y hebras finas (solo de cerca, para que no parpadeen)
  vec3 fq = vRest * uFurFreq;
  float fal = dot(fq, hd);
  vec3 fac = fq - hd * fal;
  vec3 cq = fac * 0.2 + hd * fal * 0.11;
  vec3 fwc = fwidth(cq);
  float caa = 1.0 - smoothstep(0.08, 0.3, max(max(fwc.x, fwc.y), fwc.z));
  vec3 fwq = fwidth(fq);
  float faa = 1.0 - smoothstep(0.035, 0.12, max(max(fwq.x, fwq.y), fwq.z));
  float clump = rgNoise(cq) * 0.7 + rgNoise(cq * 2.1 + 3.7) * 0.3;
  float strand = rgNoise(fac + hd * fal * 0.35) * 0.6 + rgNoise(fac * 2.3 + hd * fal * 0.6 + 7.3) * 0.4;
  float furH = 0.5 + (clump - 0.5) * caa * 0.75 + (strand - 0.5) * faa * 0.5;
  float furK = vSurf.x * uFurAmt;
  diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * furH, furK);
  float mott = rgNoise(vRest * 3.1 + 11.0) * 0.6 + rgNoise(vRest * 7.3 + 3.0) * 0.4;
  diffuseColor.rgb *= 1.0 + (mott - 0.5) * 0.2 * vSurf.x;
  // El relieve solo con lo que se ve bien de cerca (si no, las diferencias entre píxeles dan rayas)
  float bumpH = ((clump - 0.5) * caa * caa + (strand - 0.5) * faa * faa * 0.5) * furK;
  float lavaK = 0.0;
  float glossK = 0.0;
#ifdef PAT_ROSETTE
  {
    // Rosetas (anillos rotos con el centro más oscuro) y, en cabeza y patas (vSurf.z > 1), manchas macizas pequeñas
    float useSolid = clamp(vSurf.z - 1.0, 0.0, 1.0);
    vec3 w = vec3(rgNoise(vRest * uPatScale * 0.9), rgNoise(vRest * uPatScale * 0.9 + 5.0), rgNoise(vRest * uPatScale * 0.9 + 9.0)) - 0.5;
    vec3 pp = vRest * uPatScale + w * 0.3;
    vec3 vr = rgVoro(pp);
    float ring = smoothstep(0.2, 0.26, vr.x) * (1.0 - smoothstep(0.36, 0.43, vr.x));
    float ang = rgNoise(normalize(pp - floor(pp)) * 4.0 + vr.z * 23.0);
    float brk = smoothstep(0.25, 0.38, ang);
    float inner = 1.0 - smoothstep(0.17, 0.24, vr.x);
    float dot1 = (1.0 - smoothstep(0.05, 0.08, vr.x)) * step(0.55, vr.z);
    vec3 ps2 = vRest * uPatScale * 2.3 + w * 0.25;
    vec3 vs = rgVoro(ps2);
    float solid = (1.0 - smoothstep(0.2, 0.27, vs.x)) * step(0.25, vs.z);
    float paa = 1.0 - smoothstep(0.2, 0.5, length(fwidth(pp)));
    float m = mix(max(ring * brk, dot1), solid, useSolid) * vSurf.y * paa;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.78 - 0.06 * vr.z), inner * (1.0 - useSolid) * vSurf.y * paa);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatCol, m * 0.94);
  }
#endif
#ifdef PAT_SPOTS
  {
    float ps = uPatScale;
    float n = rgNoise(vRest * ps) * 0.68 + rgNoise(vRest * ps * 2.3 + 4.0) * 0.32;
    float m = smoothstep(0.6, 0.66, n) * vSurf.y;
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatCol, m);
  }
#endif
#ifdef PAT_BANDS
  {
    float al = dot(vRest, hd) * uPatScale * 0.25;
    vec3 side = vRest - hd * dot(vRest, hd);
    float lat = length(side.xz) * uPatScale * 0.4;
    float band = smoothstep(0.55, 0.62, abs(fract(al + lat * 0.5) - 0.5) * 2.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatCol, band * vSurf.y * 0.9);
    float dk = smoothstep(0.85, 0.92, abs(fract(al * 2.0 + 0.25) - 0.5) * 2.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatCol2, dk * vSurf.y * 0.8);
  }
#endif
#ifdef PAT_SCALES
  {
    float ps = uPatScale * (vSurf.z > 1.5 ? 2.0 : 1.0);
    vec3 pp = vRest * ps;
    pp -= hd * dot(pp, hd) * 0.4;
    vec3 vr = rgVoro(pp);
    float saa = 1.0 - smoothstep(0.15, 0.5, length(fwidth(pp)));
    float edge = vr.y - vr.x;
    float groove = (1.0 - smoothstep(0.03, 0.14, edge)) * saa;
    float dome = 1.0 - vr.x * 0.9 * saa;
    float sk = vSurf.y;
    bumpH = mix(bumpH, dome * 0.55 - groove * 0.6, vSurf.y);
    diffuseColor.rgb *= 1.0 - groove * 0.5 * sk;
    diffuseColor.rgb *= 1.0 + (vr.z - 0.5) * 0.3 * vSurf.y;
    lavaK = groove * vSurf.y;
    glossK = dome * vSurf.y;
  }
#endif
`;
  R.material = function (o) {
    o = o || {};
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.88, metalness: 0 });
    const u = {
      uFurFreq: { value: o.furFreq ?? 55 }, uFurAmt: { value: o.fur ?? 1 }, uBump: { value: o.bump ?? 0.012 }, uGloss: { value: o.gloss ?? 0.3 },
      uPatScale: { value: o.patScale ?? 10 }, uPatCol: { value: new Col(o.patCol ?? 0x000000) }, uPatCol2: { value: new Col(o.patCol2 ?? 0x000000) },
      uSheen: { value: o.sheen ?? 0.45 }, uTime: { value: 0 }, uLava: { value: new Col(o.lava ?? 0x000000) },
    };
    const pats = o.pattern ? String(o.pattern).split('+') : [];
    mat.defines = {};
    for (const p of pats) mat.defines['PAT_' + p.toUpperCase()] = '';
    // Personas: los colores de piel, camisa, pantalón y pelo van en el material (la malla es la misma para todos)
    if (o.human) {
      mat.defines.HUMAN = '';
      Object.assign(u, { uSkin: { value: new Col(o.skin ?? 0xc68d67) }, uShirt: { value: new Col(o.shirt ?? 0xe6dfcc) }, uPants: { value: new Col(o.pants ?? 0x3b5270) }, uHairC: { value: new Col(o.hair ?? 0x2a1b12) },
        uRim: { value: o.rim ?? 0.1 } });
      pats.push('human');
    }
    mat.userData.u = u;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SKIN_VS)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vSurf = aSurf; vHair = aHair;' + (o.human ? '\nvReg = aReg;' : ''));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + SKIN_FS)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + SKIN_COLOR)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(uGloss, roughnessFactor * (0.85 + 0.3 * furH) - glossK * 0.25, clamp(vSurf.x + (1.0 - vSurf.x) * 0.0, 0.0, 1.0));')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = rgBump(-vViewPosition, normal, bumpH * uBump, faceDirection);\nfloat rgFres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);\ndiffuseColor.rgb *= 1.0 + rgFres * uSheen * furK;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLava * lavaK * (0.75 + 0.25 * sin(uTime * 2.0 + vRest.x * 3.0 + vRest.z * 2.0));'
          // Personas: luz de contorno suave (como en los juegos estilizados: la silueta se despega del fondo)
          + '\n#ifdef HUMAN\ntotalEmissiveRadiance += (0.35 + 0.65 * diffuseColor.rgb) * pow(rgFres, 1.6) * uRim;\n#endif');
    };
    mat.customProgramCacheKey = () => 'rigskin-' + pats.join('+');
    return mat;
  };

  // ------------------------------------------------------------------ instancia (una por animal)
  R.instance = function (tpl, mat) {
    const bones = tpl.bones.map((bd) => { const bn = new THREE.Bone(); bn.name = bd.name; return bn; });
    tpl.bones.forEach((bd, i) => {
      if (bd.parent >= 0) { bones[bd.parent].add(bones[i]); bones[i].position.copy(bd.pos).sub(tpl.bones[bd.parent].pos); }
      else bones[i].position.copy(bd.pos);
    });
    const mesh = new THREE.SkinnedMesh(tpl.geo, mat);
    tpl.bones.forEach((bd, i) => { if (bd.parent < 0) mesh.add(bones[i]); });
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius *= 1.35;
    const g = new THREE.Group();
    g.add(mesh);
    let meshLow = null;
    if (tpl.geoLow) {
      meshLow = new THREE.SkinnedMesh(tpl.geoLow, mat);
      meshLow.bind(mesh.skeleton, mesh.bindMatrix);
      meshLow.castShadow = true;
      meshLow.boundingSphere = mesh.boundingSphere;
      meshLow.visible = false;
      g.add(meshLow);
    }
    const B = {};
    bones.forEach((bn) => (B[bn.name] = bn));
    const rig = { g, mesh, meshLow, bones, B, tpl, mat, rest: tpl.bones.map((bd, i) => bones[i].position.clone()), phase: Math.random(), t: Math.random() * 100, gw: { walk: 1, trot: 0, gallop: 0 }, look: { y: 0, p: 0, ty: 0, tp: 0, next: 0 }, ear: 0, tailV: 0, lastYaw: null };
    if (tpl.o.extra) tpl.o.extra(rig); // piezas propias de la instancia (ojos que brillan…)
    return rig;
  };

  // ------------------------------------------------------------------ animación
  const OFFS = {
    walk: { fl: 0.25, fr: 0.75, hl: 0.0, hr: 0.5 },
    trot: { fl: 0.0, fr: 0.5, hl: 0.5, hr: 0.0 },
    gallop: { fl: 0.55, fr: 0.45, hl: 0.08, hr: 0.0 },
    bound: { fl: 0.5, fr: 0.5, hl: 0.0, hr: 0.0 },
  };
  const _q = new Q(), _q2 = new Q(), _v = new V3(), _v2 = new V3(), _v3 = new V3(), _e = new THREE.Euler();
  const rq = [], rp = [];
  // Transformaciones de todos los huesos en el espacio del animal (los padres van antes que los hijos)
  function solveRoot(rig) {
    const T = rig.tpl.bones, bs = rig.bones;
    for (let i = 0; i < bs.length; i++) {
      rq[i] = rq[i] || new Q(); rp[i] = rp[i] || new V3();
      const p = T[i].parent;
      if (p < 0) { rq[i].copy(bs[i].quaternion); rp[i].copy(bs[i].position); }
      else { rq[i].multiplyQuaternions(rq[p], bs[i].quaternion); rp[i].copy(bs[i].position).applyQuaternion(rq[p]).add(rp[p]); }
    }
  }
  // Orienta el hueso i (reposo: dir) hacia la dirección D (espacio del animal)
  function aim(rig, i, dir, D) {
    const p = rig.tpl.bones[i].parent;
    _v3.copy(D).applyQuaternion(_q2.copy(rq[p]).invert()).normalize();
    rig.bones[i].quaternion.setFromUnitVectors(dir, _v3);
    rq[i].multiplyQuaternions(rq[p], rig.bones[i].quaternion);
  }
  const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a), y = v.y * c - v.z * s, z = v.y * s + v.z * c; v.y = y; v.z = z; return v; };
  const sm = (x) => x * x * (3 - 2 * x);

  // st: { speed, turn (rad/s), lunge (0..1), crouch (0..1), jaw (0..1), fear, dead, ground(x, z) → dy, look: {yaw, pitch} }
  R.animate = function (rig, dt, st) {
    const tpl = rig.tpl, o = tpl.o, B = rig.B;
    rig.t += dt;
    const t = rig.t;
    for (let i = 0; i < rig.bones.length; i++) { rig.bones[i].quaternion.identity(); rig.bones[i].position.copy(rig.rest[i]); rig.bones[i].scale.set(1, 1, 1); }
    // Muerto: cabeza caída, boca entreabierta y patas flojas
    if (st.dead) {
      for (const nm of tpl.o.neck || []) if (B[nm]) B[nm].rotation.x = 0.35 / (tpl.o.neck.length || 1);
      if (B.jaw) B.jaw.rotation.x = (tpl.o.jawOpen || 0.4) * 0.5;
      for (const L of tpl.legs) { const b0 = rig.bones[L.idx[0]], b1 = rig.bones[L.idx[1]]; b0.rotation.x = L.front ? -0.35 : 0.4; b1.rotation.x = L.front ? 0.5 : -0.45; }
      solveRoot(rig);
      return;
    }
    const speed = st.speed || 0;
    // Pesos de cada paso según la velocidad
    const gaits = o.gaits || { walk: { v: [0, 99], stride: 0.6, duty: 0.65, lift: 0.08 } };
    let wsum = 0;
    const want = {};
    for (const k in gaits) {
      const gt = gaits[k], v0 = gt.v[0], v1 = gt.v[1], f = 0.35;
      const w = (v0 <= 0 ? 1 : U.smooth(v0 - f, v0 + f, speed)) * (v1 >= 99 ? 1 : 1 - U.smooth(v1 - f, v1 + f, speed));
      want[k] = w; wsum += w;
    }
    for (const k in gaits) { rig.gw[k] = U.lerp(rig.gw[k] || 0, want[k] / (wsum || 1), Math.min(1, dt * 6)); }
    let stride = 0, lift = 0, gs = 0;
    for (const k in gaits) { stride += gaits[k].stride * rig.gw[k]; lift += (gaits[k].lift || 0.08) * rig.gw[k]; gs += rig.gw[k]; }
    // Pasos algo más cortos y rápidos (como en los juegos: se lee mejor el movimiento y no parece a cámara lenta),
    // y el pie sube un poco más en un arco limpio
    stride = (stride / (gs || 1)) * 0.78; lift /= gs || 1;
    st.dt = dt;
    const move = U.smooth(0.03, 0.35, speed);
    rig.phase = (rig.phase + (speed * dt) / Math.max(0.05, stride)) % 1;
    const ph = rig.phase;
    const gal = rig.gw.gallop || 0, bnd = rig.gw.bound || 0;
    // Cuerpo: balanceo, agacharse, flexión de la columna al galopar y al girar
    const hips = B[o.hips || 'hips'], chest = B[o.chest || 'chest'];
    const bob = (o.bob || 0.015) * move * (1 + gal * 2.5);
    const cr = (st.crouch || 0) * (o.crouch || 0.15);
    if (hips) {
      hips.position.y += -bob * (0.5 + 0.5 * Math.cos(ph * Math.PI * 4)) * (1 - gal) - gal * bob * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2)) - cr;
      hips.rotation.x = gal * Math.sin(ph * Math.PI * 2) * 0.1 + (st.pitch || 0);
    }
    const spine = o.spine || [];
    const turn = U.clamp(st.turn || 0, -3, 3);
    for (const nm of spine) { const b = B[nm]; if (!b) continue; b.rotation.y = -turn * 0.06; b.rotation.x = -gal * Math.sin(ph * Math.PI * 2) * 0.07; }
    // Respiración
    if (B.belly) { const br = 1 + Math.sin(t * (1.6 + speed * 0.6)) * 0.035; B.belly.scale.set(br, br, 1); }
    // Cabeza: mira alrededor cuando está quieto, sigue al objetivo y embiste
    const L = rig.look;
    if (t > L.next) { L.next = t + 1.5 + Math.random() * 3.5; L.ty = (Math.random() - 0.5) * (speed > 0.5 ? 0.3 : 1.1); L.tp = (Math.random() - 0.4) * 0.35; }
    const lk = st.look;
    L.y = U.lerp(L.y, lk ? lk.yaw : L.ty, Math.min(1, dt * 2.5));
    L.p = U.lerp(L.p, lk ? lk.pitch : L.tp * (1 - move * 0.6), Math.min(1, dt * 2.5));
    const neck = o.neck || [], lunge = st.lunge || 0;
    neck.forEach((nm, i) => {
      const b = B[nm]; if (!b) return;
      b.rotation.y = L.y / neck.length - turn * 0.05;
      b.rotation.x = L.p / neck.length + Math.sin(ph * Math.PI * 4) * 0.025 * move - lunge * (o.lungeNeck || 0.25) + cr * 0.4 / neck.length;
    });
    if (B.head) { B.head.rotation.x = -Math.sin(ph * Math.PI * 4) * 0.03 * move + lunge * (o.lungeHead || 0.3); B.head.position.z += lunge * (o.lungeFwd || 0.05); }
    if (B.jaw) B.jaw.rotation.x = (st.jaw || 0) * (o.jawOpen || 0.5) + Math.max(0, Math.sin(t * 0.7)) * 0.02;
    // Cola: péndulo con retraso por segmento; abajo si tiene miedo
    const tail = o.tail || [];
    tail.forEach((nm, i) => {
      const b = B[nm]; if (!b) return;
      const k = (i + 1) / tail.length;
      b.rotation.y = Math.sin(t * (o.tailFreq || 2.2) - i * 0.7) * (o.tailAmp || 0.18) * (0.5 + move) * k + turn * 0.12 * k;
      b.rotation.x = (st.fear ? 0.35 : 0) / tail.length + Math.sin(ph * Math.PI * 2 - i) * 0.05 * move;
    });
    // Orejas: algún movimiento de vez en cuando
    if (B.earL && B.earR) {
      rig.ear = Math.max(0, rig.ear - dt);
      if (rig.ear <= 0 && Math.random() < dt * 0.3) rig.ear = 0.35;
      const tw = Math.sin((rig.ear / 0.35) * Math.PI) * 0.35;
      B.earL.rotation.z = tw + (st.fear ? 0.5 : 0); B.earR.rotation.z = -(st.fear ? 0.5 : 0);
      B.earL.rotation.x = st.fear ? 0.6 : 0; B.earR.rotation.x = st.fear ? 0.6 : 0;
    }
    if (o.anim) o.anim(rig, st, dt, ph, move);
    solveRoot(rig);
    // Patas: objetivo del pie según el paso y cinemática inversa de dos huesos
    if (!st.noLegs) for (const L2 of tpl.legs) legIK(rig, L2, st, ph, stride, lift, move, gaits);
    if (o.post) o.post(rig, st, dt, ph, move); // retoques después de las patas (patas recogidas al volar…)
  };

  const _mD = new V3(), _mA = new V3(); // sin crear vectores nuevos en cada fotograma (evita tirones del recolector)
  function legIK(rig, L, st, ph, stride, lift, move, gaits) {
    const idx = L.idx, n = idx.length;
    // Fase y objetivo combinando los pasos activos
    let dz = 0, dy = 0, flex = 0, wsum = 0;
    for (const k in gaits) {
      const w = rig.gw[k];
      if (w < 0.001) continue;
      const gt = gaits[k], off = (gt.off || OFFS[k] || OFFS.walk)[L.key] || 0, duty = gt.duty;
      const p = (ph + off) % 1, sweep = stride * duty;
      let z, y, f;
      if (p < duty) { const s = p / duty; z = sweep * (0.5 - s); y = 0; f = 0; }
      else { const s = (p - duty) / (1 - duty); z = sweep * (sm(s) - 0.5); y = Math.sin(s * Math.PI) * (gt.lift || lift) * 1.3; f = Math.sin(s * Math.PI); }
      dz += z * w; dy += y * w; flex += f * w; wsum += w;
    }
    dz = (dz / (wsum || 1)) * move; dy = (dy / (wsum || 1)) * move; flex = (flex / (wsum || 1)) * move;
    const J = L.J, tgt = L.tgt;
    const T = _v.copy(J[tgt]);
    T.z += dz + (L.reach || 0) * (st.lunge || 0);
    T.y += dy;
    // Suelo bajo el pie, suavizado (sin saltitos de un fotograma a otro en terreno irregular)
    const gy = st.ground ? st.ground(J[tgt].x, J[tgt].z + dz) : 0, gk = rig.gy || (rig.gy = {});
    gk[L.key] = gk[L.key] === undefined ? gy : U.lerp(gk[L.key], gy, Math.min(1, (st.dt || 0.016) * 14));
    T.y += gk[L.key];
    // Pie / pezuña (último hueso): plano en el apoyo, se dobla hacia atrás al levantarlo
    const footDir = rotX(_v2.copy(L.dir[n - 1]), flex * (L.toeFlex ?? (L.front ? 1.3 : 0.6)));
    if (n === 4) {
      // Caña / metatarso: se pliega al levantar la pata (la delantera hacia atrás, la trasera hacia delante);
      // el objetivo es la muñeca / el corvejón y el pie sube al plegarse
      const metaDir = rotX(_mD.copy(L.dir[2]), flex * (L.metaFlex ?? (L.front ? 1.1 : -0.55)));
      const A = _mA.copy(T).addScaledVector(L.dir[2], -L.len[2]);
      A.y += dy * (L.front ? -0.35 : -0.2);
      twoBone(rig, L, A);
      aim(rig, idx[2], L.dir[2], metaDir);
      aim(rig, idx[3], L.dir[3], footDir);
    } else {
      twoBone(rig, L, T);
      aim(rig, idx[2], L.dir[2], footDir);
    }
  }
  // Cadera → rodilla → tobillo (target) con la rodilla hacia el mismo lado que en reposo
  const _H = new V3(), _D = new V3(), _S = new V3(), _K = new V3(), _K2 = new V3();
  function twoBone(rig, L, target) {
    const i0 = L.idx[0], i1 = L.idx[1], p = rig.tpl.bones[i0].parent;
    _H.copy(rig.bones[i0].position).applyQuaternion(rq[p]).add(rp[p]);
    const a = L.len[0], b = L.len[1];
    _D.subVectors(target, _H);
    let d = _D.length();
    d = U.clamp(d, Math.abs(a - b) + 1e-3, (a + b) * 0.999);
    _D.normalize();
    // Lado de la rodilla: el de reposo, girado con el cuerpo
    _S.subVectors(L.J[1], L.J[0]);
    const rd = _K.subVectors(L.J[2], L.J[0]).normalize();
    _S.addScaledVector(rd, -_S.dot(rd)).applyQuaternion(rq[p]);
    _S.addScaledVector(_D, -_S.dot(_D));
    if (_S.lengthSq() < 1e-8) _S.set(0, 0, L.front ? -1 : 1);
    _S.normalize();
    const ca = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), al = Math.acos(ca);
    _K2.copy(_H).addScaledVector(_D, a * ca).addScaledVector(_S, a * Math.sin(al));
    aim(rig, i0, L.dir[0], _K.subVectors(_K2, _H).normalize());
    rp[i1].copy(_K2);
    // Tobillo en la recta cadera → objetivo (a la distancia alcanzable)
    _H.addScaledVector(_D, d);
    aim(rig, i1, L.dir[1], _K.subVectors(_H, _K2).normalize());
  }
  void _q; void _e;
})();
