// Medusa (translúcida, sin esqueleto). El resto de animales se esculpen con esqueleto en fauna.js.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl;
  const Anim = (G.Animals = {});

  // ------------------------------------------------------------------ medusa
  Anim.jelly = function () {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x802070, emissiveIntensity: 0.7, transparent: true, opacity: 0.62, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const bell = M.lathe([[0, 0.45], [0.2, 0.43], [0.36, 0.32], [0.46, 0.12], [0.44, 0.0], [0.39, 0.03], [0.3, 0.12], [0.02, 0.18]], 20, (x, y) => (y > 0.3 ? 0xf8c8f0 : 0xe890d8));
    const rim = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; rim.push(M.ball(0.03, 0xffe0ff, Math.cos(a) * 0.43, 0.01, Math.sin(a) * 0.43)); }
    g.add(new THREE.Mesh(U.merge([bell, ...rim]), mat));
    const arms = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, pts = [];
      for (let k = 0; k <= 6; k++) pts.push([Math.cos(a) * 0.08 + Math.sin(k * 1.4 + i) * 0.06, 0.1 - k * 0.16, Math.sin(a) * 0.08 + Math.cos(k * 1.3 + i) * 0.06]);
      arms.push(M.tube(pts, [0.045, 0.015], 6, 0xf0a8e0, 20));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, pts = [];
      for (let k = 0; k <= 5; k++) pts.push([Math.cos(a) * (0.4 - k * 0.02), -k * 0.28, Math.sin(a) * (0.4 - k * 0.02) + Math.sin(k + i) * 0.04]);
      arms.push(M.tube(pts, [0.008, 0.003], 4, 0xf8d8f8, 12));
    }
    const tm = new THREE.Mesh(U.merge(arms), mat);
    g.add(tm);
    return { g, legs: [], head: null, tail: tm, mat };
  };

})();
