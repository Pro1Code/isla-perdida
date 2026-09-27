// Generador del paquete de texturas oficial: un icono por objeto en img/items/<id>.png.
// Se usa desde el navegador con el juego abierto (http://localhost:8093) y un receptor local
// que guarde los PNG (puerto 8098). En la consola:
//   eval(await (await fetch('scripts/iconos.js')).text()); await Iconos.todos();
// Cada icono es una foto del modelo 3D del objeto (el de la mano, la prenda sin el cuerpo o
// la construcción) con la misma luz de estudio, cámara ortográfica y un contorno oscuro.
(function () {
  'use strict';
  const G = window.G, V3 = THREE.Vector3, M = G.Mdl, U = G.U;
  const SIZE = 128, R = 256, PAD = 7;
  let rr = null, scene = null, cam = null;

  function setup() {
    if (rr) return;
    rr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rr.setPixelRatio(1); rr.setSize(R, R);
    rr.toneMapping = THREE.ACESFilmicToneMapping; rr.toneMappingExposure = 1.12;
    rr.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x4a4038, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-2, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 1.3); rim.position.set(3, 2, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe6c8, 0.5); fill.position.set(2, -1, 3); scene.add(fill);
    // Reflejos de estudio (sin ellos los metales salen negros)
    const env = new THREE.Scene(), sky = new THREE.SphereGeometry(10, 32, 16), col = [];
    for (let i = 0; i < sky.attributes.position.count; i++) { const y = sky.attributes.position.getY(i) / 10, c = new THREE.Color(y > 0 ? 0xf4f6ff : 0x5a4a3a).lerp(new THREE.Color(0xffd9a8), 1 - Math.abs(y)); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
    for (const [x, y, z] of [[-6, 6, 6], [7, 3, -2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p); }
    const pm = new THREE.PMREMGenerator(rr);
    scene.environment = pm.fromScene(env, 0.03).texture;
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
  }

  // Caja de lo que se ve (sin las mallas ocultas, p. ej. el cuerpo bajo una prenda)
  function visibleBox(obj, only) {
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || (o.material && o.material.visible === false) || (only && !only.has(o))) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    });
    return box;
  }
  // Foto del objeto desde la dirección dir, encuadrado y centrado
  function shot(obj, dir, only) {
    setup();
    scene.add(obj);
    const box = visibleBox(obj, only), c = box.getCenter(new V3());
    cam.position.copy(c).addScaledVector(new V3(dir[0], dir[1], dir[2]).normalize(), 50);
    cam.up.set(0, 1, 0); cam.lookAt(c); cam.updateMatrixWorld();
    const inv = cam.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new V3(x, y, z).applyMatrix4(inv);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = Math.max(x1 - x0, y1 - y0) / 2 * 1.04;
    cam.left = cx - h; cam.right = cx + h; cam.top = cy + h; cam.bottom = cy - h;
    cam.updateProjectionMatrix();
    rr.clear(); rr.render(scene, cam);
    scene.remove(obj);
    return outline(rr.domElement);
  }
  // Reduce a 128 px y añade un contorno oscuro (como los iconos de un juego)
  function outline(src) {
    const o = document.createElement('canvas'); o.width = o.height = SIZE;
    const x = o.getContext('2d');
    x.imageSmoothingQuality = 'high';
    const sil = document.createElement('canvas'); sil.width = sil.height = SIZE;
    const s = sil.getContext('2d');
    s.imageSmoothingQuality = 'high';
    s.drawImage(src, PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(22,14,6,0.92)'; s.fillRect(0, 0, SIZE, SIZE);
    for (let a = 0; a < 16; a++) x.drawImage(sil, Math.cos(a / 16 * Math.PI * 2) * 2.2, Math.sin(a / 16 * Math.PI * 2) * 2.2);
    x.drawImage(src, PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2);
    return o;
  }

  // ------------------------------------------------------------------ modelos de los objetos
  const LONG = new Set(['palo', 'bambu', 'dardo', 'antorcha', 'cana', 'lanza', 'lanza_obsidiana', 'arpon', 'cerbatana', 'baston', 'katana', 'sable', 'mosquete', 'pistola', 'pala', 'catalejo']);
  function garment(id) {
    const m = G.Character.create(0xe6dfcc, { skin: 0xc68d67, pants: 0x3b5270 });
    G.Equip.apply(m, [id]);
    m.update(0.016, { pos: new V3(), yaw: 0, pitch: 0, speed: 0, onGround: true, swimming: false, swing: 0, holding: false });
    m.root.updateMatrixWorld(true);
    // Se oculta solo la pintura del cuerpo (las prendas cuelgan de sus huesos)
    const eq = new Set(m.eqMeshes), hide = new THREE.MeshBasicMaterial({ visible: false });
    m.root.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && !eq.has(o)) o.material = hide; });
    // Punto de vista según la parte del cuerpo (el torso, desde arriba para que se vea el cuello)
    const slot = G.ITEMS[id].eq.slot, DIR = { head: [0.7, 0.5, 1], chest: [0.6, 0.35, 1], legs: [0.55, 0.3, 1], feet: [0.9, 0.7, 1] };
    const dir = id === 'aletas' ? [0.35, 1.2, 0.7] : id === 'bicornio' ? [1, 0.45, 0.35] : DIR[slot] || [0.42, 0.18, 1];
    return { obj: m.root, dir, only: eq, done: () => m.dispose && m.dispose() };
  }
  function mat(color) { return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, color }); }
  function canoe() {
    const g = new THREE.Group();
    const hull = M.loft({ z0: -1.9, z1: 1.9, n: 24, m: 18, prof: (t) => { const k = Math.pow(Math.sin(Math.PI * t), 0.55); return { rx: 0.42 * k + 0.02, ry: 0.26 * k + 0.02, y: Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.18 }; },
      color: (t, a, ca, sa) => (sa > 0.55 ? 0x3a2414 : Math.abs(sa - 0.45) < 0.08 ? 0x5a3a20 : 0x8a5a32) });
    g.add(new THREE.Mesh(hull, mat(0xffffff)));
    const oar = [M.xf(M.paint(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), 0x9a7040), 0, 0, 0, 0, 0, Math.PI / 2), M.xf(M.paint(new THREE.BoxGeometry(0.4, 0.025, 0.2), 0x8a6035), 0.72, 0, 0)];
    const o = new THREE.Mesh(U.merge(oar), mat(0xffffff)); o.position.set(-0.1, 0.3, 0.2); o.rotation.y = 1.2;
    g.add(o);
    return g;
  }
  function treasureMap() {
    const tex = U.canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#e8d6a6'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(120,80,30,${Math.random() * 0.12})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 0, 7); c.fill(); }
      c.fillStyle = '#b8a070'; c.strokeStyle = '#6a4a22'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(60, 60); c.bezierCurveTo(110, 20, 190, 40, 200, 90); c.bezierCurveTo(210, 140, 120, 160, 80, 130); c.bezierCurveTo(40, 110, 30, 80, 60, 60); c.fill(); c.stroke();
      c.setLineDash([7, 6]); c.strokeStyle = '#7a2a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 160); c.quadraticCurveTo(70, 120, 150, 95); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#d01818'; c.lineWidth = 8; c.beginPath(); c.moveTo(140, 82); c.lineTo(162, 106); c.moveTo(162, 82); c.lineTo(140, 106); c.stroke();
      c.strokeStyle = '#4a3218'; c.lineWidth = 2; c.beginPath(); c.arc(222, 34, 16, 0, 7); c.moveTo(222, 14); c.lineTo(222, 54); c.moveTo(202, 34); c.lineTo(242, 34); c.stroke();
    });
    const geo = new THREE.PlaneGeometry(1.4, 1, 24, 12), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 2.2) * 0.05 + Math.pow(Math.max(0, x - 0.45) / 0.25, 2) * 0.12 + Math.pow(Math.max(0, -y - 0.3) / 0.2, 2) * 0.05); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
    m.rotation.x = -0.5;
    const g = new THREE.Group(); g.add(m);
    return g;
  }
  // ------------------------------------------------------------------ dibujos de barcos (planos y sellos)
  function drawShip(c, type, cx, cy, s, stroke) {
    c.save(); c.translate(cx, cy); c.scale(s, s); c.lineWidth = 2.2 / s * (stroke ? 1 : 0.6); c.lineJoin = c.lineCap = 'round';
    const hull = (w, h) => { c.beginPath(); c.moveTo(-w, 0); c.lineTo(w, 0); c.lineTo(w * 0.75, h); c.lineTo(-w * 0.8, h); c.closePath(); };
    const go = () => (stroke ? c.stroke() : c.fill());
    if (type === 'balsa') { for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-16 + i * 8, 6, 4, 4, 0, 0, 7); go(); } c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -24); go(); c.beginPath(); c.moveTo(1, -22); c.lineTo(14, -6); c.lineTo(1, -6); c.closePath(); go(); }
    else if (type === 'canoa') { c.beginPath(); c.moveTo(-26, -2); c.quadraticCurveTo(0, 16, 26, -2); c.quadraticCurveTo(0, 4, -26, -2); go(); c.beginPath(); c.moveTo(-8, -18); c.lineTo(10, 10); go(); }
    else if (type === 'velero') { hull(22, 9); go(); c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2, -30); go(); c.beginPath(); c.moveTo(0, -28); c.lineTo(18, -3); c.lineTo(0, -3); c.closePath(); go(); c.beginPath(); c.moveTo(-4, -26); c.lineTo(-16, -3); c.lineTo(-4, -3); c.closePath(); go(); }
    else if (type === 'lancha') { hull(24, 9); go(); c.beginPath(); c.rect(-10, -12, 16, 12); go(); c.beginPath(); c.rect(8, -24, 6, 24); go(); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(12 + i * 5, -30 - i * 5, 3 + i, 0, 7); go(); } }
    else { hull(26, 10); go(); for (const [x, h] of [[-12, 26], [0, 32], [12, 24]]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -h); go(); c.beginPath(); c.rect(x - 7, -h + 3, 14, 9); go(); c.beginPath(); c.rect(x - 6, -h + 14, 12, 8); go(); } }
    c.restore();
  }
  function blueprint(type, title) {
    const tex = U.canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#1f4f8f'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1;
      for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = '#eaf3ff'; c.fillStyle = '#eaf3ff';
      drawShip(c, type, 128, 108, 2.6, true);
      c.font = 'bold 20px Georgia, serif'; c.textAlign = 'center'; c.fillText(title, 128, 168);
      c.strokeRect(6, 6, w - 12, h - 12);
    });
    const geo = new THREE.PlaneGeometry(1.4, 1, 20, 10), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.pow(Math.max(0, -x - 0.45) / 0.25, 2) * 0.16 + Math.sin(x * 3) * 0.03); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
    m.rotation.x = -0.45;
    const roll = new THREE.Mesh(M.xf(M.paint(new THREE.CylinderGeometry(0.09, 0.09, 1.04, 14), 0x2a5a9a), -0.72, 0, 0.12), mat(0xffffff));
    const g = new THREE.Group(); g.add(m); m.add(roll);
    return g;
  }
  // Sello en una esquina (para distinguir objetos parecidos)
  const SHIPOF = { plano_velero: 'velero', plano_lancha: 'lancha', plano_barco: 'barco', rep_balsa: 'balsa', rep_canoa: 'canoa', rep_velero: 'velero', rep_lancha: 'lancha', rep_barco: 'barco' };
  const REPCOL = { rep_balsa: 0x8a5a30, rep_canoa: 0x3a7a3a, rep_velero: 0x2a5aa0, rep_lancha: 0x6a6a74, rep_barco: 0xb03a2a };
  function badge(id, canvas) {
    const x = canvas.getContext('2d');
    const seal = (fill, draw) => { x.save(); x.fillStyle = 'rgba(22,14,6,.9)'; x.beginPath(); x.arc(98, 98, 25, 0, 7); x.fill(); x.fillStyle = fill; x.beginPath(); x.arc(98, 98, 22, 0, 7); x.fill(); draw(); x.restore(); };
    if (/^pista_\d/.test(id)) seal('#b8231c', () => { x.fillStyle = '#ffe9c8'; x.font = '900 22px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(['I', 'II', 'III'][+id.slice(6) - 1], 98, 99); });
    else if (/^rep_/.test(id)) seal('#f2e6c8', () => { x.fillStyle = '#3a2410'; x.strokeStyle = '#3a2410'; drawShip(x, SHIPOF[id], 98, 104, 0.62, false); });
  }
  // Prenda del torso colgada en una percha: cuerpo, mangas, cuello, ribetes y botones
  function hanging(o) {
    const P = [], len = o.long ? 1.25 : 0.85, w = 0.34;
    const bodyCol = (t, a, ca, sa) => (o.trim && t < 0.07 ? o.trim : o.weave && Math.sin(t * 60 + a * 8) > 0.55 ? o.weave : o.color);
    P.push(M.loft({ z0: 0, z1: len, n: 16, m: 20, prof: (t) => ({ rx: w * (1 + t * (o.long ? 0.35 : 0.12)), ry: 0.19 * (1 + t * 0.15), y: 0 }), color: (t, a, ca, sa) => bodyCol(1 - t, a, ca, sa) }));
    // Abertura delantera, ribetes y botones
    if (o.trim) P.push(M.xf(M.paint(new THREE.BoxGeometry(0.05, 0.03, len), o.trim), 0, 0.19, len / 2));
    if (o.buttons) for (let i = 0; i < (o.long ? 5 : 3); i++) P.push(M.ball(0.035, o.buttons, 0.07, 0.2, 0.15 + i * 0.16));
    if (o.fur) P.push(M.xf(M.paint(new THREE.TorusGeometry(0.28, 0.1, 8, 20), o.fur), 0, 0, 0.02, 0, 0, 0, [1.15, 0.8, 0.6]));
    else P.push(M.xf(M.paint(new THREE.TorusGeometry(0.22, 0.045, 6, 20), o.trim || o.color), 0, 0, 0.02, 0, 0, 0, [1.1, 0.75, 0.6]));
    if (o.sleeves) for (const sgn of [-1, 1]) {
      P.push(M.tube([[sgn * 0.3, 0, 0.1], [sgn * 0.5, 0, 0.42], [sgn * 0.58, 0, o.long ? 0.85 : 0.72]], [0.12, 0.1], 10, o.color, 12));
      if (o.cuff) P.push(M.xf(M.paint(new THREE.TorusGeometry(0.1, 0.045, 6, 14), o.cuff), sgn * 0.58, 0, o.long ? 0.85 : 0.72, 0, 0, 0));
    }
    const g = new THREE.Group(), cloth = new THREE.Mesh(U.merge(P), mat(0xffffff));
    cloth.rotation.x = Math.PI / 2; // de pie: el cuello arriba
    g.add(cloth);
    const hanger = new THREE.Mesh(U.merge([M.tube([[-0.36, 0.02, 0], [0, 0.14, 0], [0.36, 0.02, 0]], [0.025, 0.025], 6, 0x8a5a30, 12), M.tube([[0, 0.14, 0], [0, 0.26, 0], [0.07, 0.33, 0], [0.12, 0.27, 0]], [0.012, 0.012], 5, 0x9aa0a8, 10)]), mat(0xffffff));
    g.add(hanger);
    return { obj: g, dir: [0.45, 0.25, 1] };
  }
  const CUSTOM = {
    chaleco_fibra: () => hanging({ color: 0xc8b070, weave: 0xa89050, trim: 0x8a7040 }),
    chaqueta_cuero: () => hanging({ color: 0x7a4a26, trim: 0x5a341a, sleeves: true, buttons: 0xc8a050 }),
    abrigo: () => hanging({ color: 0x8a6040, long: true, sleeves: true, fur: 0xd8c8a8, cuff: 0xd8c8a8 }),
    abrigo_grueso: () => hanging({ color: 0xeeeae2, long: true, sleeves: true, fur: 0xffffff, cuff: 0xd8d2c8, buttons: 0x6a5a4a }),
    casaca_capitan: () => hanging({ color: 0xa01e1e, long: true, sleeves: true, trim: 0xd8b040, cuff: 0xd8b040, buttons: 0xe8c860 }),
    coco: () => { const g = new THREE.Group(), hair = (xx, y, z) => (Math.sin(xx * 60 + y * 40) * Math.sin(z * 50) > 0.2 ? 0x5a3a1e : 0x7a5230);
      g.add(new THREE.Mesh(M.xf(M.paint(new THREE.SphereGeometry(0.5, 20, 16), hair), -0.25, 0.1, -0.2, 0, 0, 0, [1, 1.08, 1]), mat(0xffffff)));
      for (const [a, b] of [[-0.12, 0.1], [0.12, 0.1], [0, -0.08]]) g.add(new THREE.Mesh(M.ball(0.06, 0x2a1a0e, -0.25 + a, 0.18 + b, 0.28), mat(0xffffff)));
      const half = M.xf(M.paint(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hair), 0, 0, 0);
      const flesh = M.xf(M.paint(new THREE.CircleGeometry(0.42, 24), 0xf6f2e8), 0, 0.001, 0, -Math.PI / 2); const ring = M.xf(M.paint(new THREE.TorusGeometry(0.43, 0.035, 6, 28), 0xe8e0cc), 0, 0.005, 0, Math.PI / 2);
      const h = new THREE.Mesh(U.merge([half, flesh, ring]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })); h.position.set(0.35, -0.2, 0.3); h.rotation.set(0.9, 0, -0.3); g.add(h); return { obj: g, dir: [0.4, 0.5, 1] }; },
    cuero: () => ({ obj: new THREE.Mesh(M.fin([[-0.6, 0.35], [-0.4, 0.3], [-0.2, 0.42], [0.2, 0.42], [0.4, 0.3], [0.62, 0.36], [0.52, 0.05], [0.58, -0.3], [0.38, -0.34], [0.2, -0.46], [-0.2, -0.46], [-0.38, -0.34], [-0.6, -0.3], [-0.52, 0.02]], 0.05, (xx, y) => (Math.hypot(xx * 0.9, y * 1.3) < 0.3 ? 0xb07a45 : 0x8a5a30)), mat(0xffffff)), dir: [0.2, 1, 0.9] }),
    almeja: () => { const g = new THREE.Group(); for (const [x, ry, open] of [[-0.35, 0.4, 0], [0.35, -0.3, 0.9]]) { const shell = (o) => M.xf(M.paint(new THREE.SphereGeometry(0.42, 22, 10, 0, Math.PI, 0, Math.PI / 2.4), (xx, y, z) => (Math.sin(Math.atan2(z, xx) * 18) > 0.3 ? 0xe8d8c8 : 0xc8a890), 0.02), 0, 0, 0, o ? -open : 0, 0, 0, [1, 0.5, 1]); const s1 = new THREE.Mesh(shell(0), mat(0xffffff)), s2 = new THREE.Mesh(shell(1), mat(0xffffff)); s2.scale.y = -1; const p = new THREE.Group(); p.add(s1, s2); p.position.x = x; p.rotation.y = ry; g.add(p); } return { obj: g, dir: [0.3, 0.8, 1] }; },
    almeja_asada: () => { const g = new THREE.Group(); for (const [x, z] of [[-0.35, 0], [0.35, 0.1], [0, -0.35]]) { const sh = M.xf(M.paint(new THREE.SphereGeometry(0.34, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.4), (xx, y, zz) => (Math.sin(Math.atan2(zz, xx) * 16) > 0.3 ? 0x8a5a38 : 0x6a4028)), x, 0, z, 0, 0, 0, [1, 0.45, 0.8]); const meat = M.ball(0.2, 0xe89048, x, 0.02, z, [1, 0.35, 0.8]); g.add(new THREE.Mesh(U.merge([sh, meat]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }))); } return { obj: g, dir: [0.3, 1, 1] }; },
    cataplasma: () => { const leaf = M.xf(M.paint(new THREE.SphereGeometry(0.45, 18, 12), (xx, y, z) => (Math.abs(Math.sin(xx * 14 + z * 3)) < 0.12 ? 0x9ac060 : 0x4a8a3a)), 0, 0, 0, 0, 0, 0, [1.25, 0.55, 0.9]); const cord = M.xf(M.paint(new THREE.TorusGeometry(0.45, 0.03, 6, 30), 0x9a7a4a), 0, 0, 0, Math.PI / 2, 0, 0, [1.12, 0.92, 1]); const cord2 = M.xf(M.paint(new THREE.TorusGeometry(0.33, 0.03, 6, 30), 0x9a7a4a), 0, 0, 0, 0, Math.PI / 2, 0, [1, 0.7, 1]); const tip = M.xf(M.paint(new THREE.ConeGeometry(0.12, 0.3, 4), 0x5a9a3a), 0, 0.3, 0.1, -0.5); return { obj: new THREE.Mesh(U.merge([leaf, cord, cord2, tip]), mat(0xffffff)), dir: [0.5, 0.7, 1] }; },
    tela_vela: () => { const g = []; for (let i = 0; i < 3; i++) g.push(M.xf(M.paint(new THREE.BoxGeometry(1.1 - i * 0.05, 0.14, 0.8 - i * 0.04), i % 2 ? 0xe6dcc4 : 0xf2eada), i * 0.03, i * 0.15, -i * 0.02, 0, i * 0.06, 0)); g.push(M.xf(M.paint(new THREE.TorusGeometry(0.43, 0.025, 6, 24), 0x8a6a3a), 0, 0.2, 0, Math.PI / 2, 0, 0, [1.3, 0.95, 1.6])); return { obj: new THREE.Mesh(U.merge(g), mat(0xffffff)), dir: [0.6, 0.8, 1] }; },
    colmillo: () => { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 1.9; pts.push([Math.cos(a) * 0.8 - 0.4, Math.sin(a) * 0.8 - 0.3, 0]); } return { obj: new THREE.Mesh(M.tube(pts, (t) => 0.16 * (1 - t) + 0.015, 12, (t) => (t < 0.08 ? 0x8a6a4a : t > 0.85 ? 0xfaf6ec : 0xece2c8), 30), mat(0xffffff)), dir: [0.15, 0.1, 1] }; },
    piel_gruesa: () => { const base = M.fin([[-0.6, 0.3], [-0.35, 0.36], [-0.15, 0.5], [0.15, 0.5], [0.35, 0.36], [0.6, 0.32], [0.5, 0], [0.62, -0.32], [0.3, -0.3], [0.15, -0.5], [-0.15, -0.5], [-0.3, -0.3], [-0.62, -0.32], [-0.5, 0]], 0.06, 0xe8e4dc); const parts = [base], r = U.rng(4); for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 1.0, y = (r() - 0.5) * 0.8; if (Math.abs(x) > 0.5 - Math.abs(y) * 0.2) continue; parts.push(M.ball(0.06 + r() * 0.04, r() > 0.5 ? 0xf4f2ee : 0xd8d2c6, x, y, 0.04 + r() * 0.03, [1, 1, 0.6])); } return { obj: new THREE.Mesh(U.merge(parts), mat(0xffffff)), dir: [0.2, 1, 0.9] }; },
    carne_cocida: () => { const meat = M.xf(M.paint(new THREE.SphereGeometry(0.42, 18, 14), (x, y, z) => (Math.sin(x * 20 + y * 12) > 0.5 ? 0x6a3a1a : 0x8a4a22)), 0.15, 0.1, 0, 0, 0, 0.5, [1.35, 1, 1]); const bone = M.tube([[-0.25, -0.25, 0], [-0.55, -0.55, 0]], [0.07, 0.07], 8, 0xf4efe2); const knob = [M.ball(0.09, 0xf4efe2, -0.6, -0.52, 0.05), M.ball(0.09, 0xf4efe2, -0.52, -0.62, -0.05)]; return { obj: new THREE.Mesh(U.merge([meat, bone, ...knob]), mat(0xffffff)), dir: [0.3, 0.4, 1] }; },
    red_pesca: () => { const parts = [], P = (u, v) => [u - 0.5, -0.3 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v), v - 0.5]; for (let i = 0; i <= 6; i++) { const a = [], b = []; for (let k = 0; k <= 8; k++) { a.push(P(i / 6, k / 8)); b.push(P(k / 8, i / 6)); } parts.push(M.tube(a, [0.012, 0.012], 4, 0xc8b88a, 16), M.tube(b, [0.012, 0.012], 4, 0xc8b88a, 16)); } for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1]]) { const p = P(u, v); parts.push(M.ball(0.07, u === 0.5 ? 0xf2f2f0 : 0xe86a2a, p[0], p[1] + 0.02, p[2], [1, 0.7, 1])); } return { obj: new THREE.Mesh(U.merge(parts), mat(0xffffff)), dir: [0.5, 1, 0.8] }; },
    fragmento_mapa: () => { const tex = U.canvasTex(256, 200, (c, w, h) => { c.beginPath(); const pts = [[10, 20], [60, 6], [120, 22], [170, 4], [240, 24], [226, 80], [250, 130], [220, 190], [150, 176], [90, 196], [20, 180], [34, 110]]; pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = '#e4cf9c'; c.fill(); c.clip(); for (let i = 0; i < 25; i++) { c.fillStyle = `rgba(120,80,30,${Math.random() * 0.14})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 0, 7); c.fill(); } c.fillStyle = '#a89060'; c.strokeStyle = '#5a3a18'; c.lineWidth = 3; c.beginPath(); c.moveTo(150, 60); c.bezierCurveTo(230, 50, 250, 160, 170, 170); c.bezierCurveTo(120, 175, 110, 80, 150, 60); c.fill(); c.stroke(); c.setLineDash([6, 6]); c.strokeStyle = '#7a2a1a'; c.beginPath(); c.moveTo(20, 120); c.quadraticCurveTo(80, 80, 150, 110); c.stroke(); c.font = 'bold 16px Georgia'; c.fillStyle = '#4a2c10'; c.fillText('Aur…', 40, 60); }); tex.premultiplyAlpha = false; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide })); m.rotation.set(-0.5, 0, 0.12); const g = new THREE.Group(); g.add(m); return { obj: g, dir: [0.1, 0.6, 1] }; },
    polvora: () => { const keg = M.lathe([[0.001, -0.45], [0.33, -0.45], [0.4, -0.2], [0.42, 0], [0.4, 0.2], [0.33, 0.42], [0.001, 0.42]], 22, (x, y, z) => (Math.abs(Math.abs(y) - 0.3) < 0.035 ? 0x3a3a40 : Math.floor((Math.atan2(z, x) + 3.2) * 3) % 2 ? 0x6a4424 : 0x5a3a1e)); const pile = M.xf(M.paint(new THREE.ConeGeometry(0.28, 0.22, 16), 0x1c1c1e), 0, 0.52, 0); const spill = M.xf(M.paint(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x1c1c1e), 0.45, -0.45, 0.2, 0, 0, 0, [1, 0.2, 0.8]); return { obj: new THREE.Mesh(U.merge([keg, pile, spill]), mat(0xffffff)), dir: [0.6, 0.7, 1] }; },
    canoa: () => ({ obj: canoe(), dir: [0.9, 1.1, 0.9] }),
    mapa_tesoro: () => ({ obj: treasureMap(), dir: [0.15, 0.6, 1] }),
    plano_velero: () => ({ obj: blueprint('velero', 'VELERO'), dir: [0.12, 0.55, 1] }),
    plano_lancha: () => ({ obj: blueprint('lancha', 'LANCHA'), dir: [0.12, 0.55, 1] }),
    plano_barco: () => ({ obj: blueprint('barco', 'BARCO PIRATA'), dir: [0.12, 0.55, 1] }),
  };

  // Modelo y punto de vista de cada objeto
  function subject(id) {
    const it = G.ITEMS[id];
    if (CUSTOM[id]) return CUSTOM[id]();
    if (it.eq && G.Equip.has(id)) return garment(id);
    const build = G.Build.BUILDERS[it.place || id];
    if (build) return { obj: build(), dir: [1, 0.9, 1.25] };
    const m = G.makeItemMesh(id);
    if (!m) return null;
    // Kits de repuesto: la caja del color de cada barco
    if (REPCOL[id]) m.traverse((o) => { const c = o.material && o.material.color, hsl = c && c.getHSL({}); if (hsl && hsl.s > 0.4 && (hsl.h < 0.06 || hsl.h > 0.94)) { o.material = o.material.clone(); o.material.color.set(REPCOL[id]); } });
    const g = new THREE.Group(), inner = new THREE.Group();
    inner.add(m); g.add(inner);
    const b = visibleBox(m), sz = b.getSize(new V3());
    // Objetos largos (herramientas, armas, palos): en diagonal, como en un inventario
    const long = LONG.has(id) || it.tool || Math.max(sz.y, sz.z) > Math.min(sz.x, Math.min(sz.y, sz.z)) * 2.4 && Math.max(sz.y, sz.z) > sz.x * 2;
    if (long) {
      if (sz.z > sz.y) { inner.rotation.y = Math.PI / 2; g.rotation.set(0.25, 0, 0.62); }   // armas de fuego: el cañón hacia arriba a la derecha
      else g.rotation.set(0, 0.5, -0.78);
      return { obj: g, dir: [0.12, 0.1, 1] };
    }
    return { obj: g, dir: [0.65, 0.75, 1] };
  }

  // ------------------------------------------------------------------ generar y guardar
  const Iconos = (window.Iconos = {});
  Iconos.uno = function (id) {
    const s = subject(id);
    if (!s) return null;
    const c = shot(s.obj, s.dir, s.only);
    if (s.done) s.done();
    badge(id, c);
    return c;
  };
  Iconos.todos = async function (ids, port = 8098) {
    const hechos = [], fallos = [];
    for (const id of ids || Object.keys(G.ITEMS)) {
      try {
        const c = Iconos.uno(id);
        if (!c) { fallos.push(id); continue; }
        await fetch(`http://127.0.0.1:${port}/?name=${id}.png`, { method: 'POST', body: c.toDataURL('image/png') });
        hechos.push(id);
      } catch (e) { fallos.push(id + ': ' + e.message); }
    }
    return { hechos: hechos.length, fallos };
  };
  // Hoja con todos los iconos (para revisarlos)
  Iconos.hoja = function (ids, cols = 12, px = 96) {
    ids = ids || Object.keys(G.ITEMS);
    const rows = Math.ceil(ids.length / cols), o = document.createElement('canvas');
    o.width = cols * px; o.height = rows * (px + 14);
    const x = o.getContext('2d');
    x.fillStyle = '#2a3a44'; x.fillRect(0, 0, o.width, o.height);
    ids.forEach((id, i) => {
      const c = Iconos.uno(id), cx = (i % cols) * px, cy = Math.floor(i / cols) * (px + 14);
      if (c) x.drawImage(c, cx, cy, px, px);
      x.fillStyle = '#fff'; x.font = '10px sans-serif'; x.textAlign = 'center'; x.fillText(id.slice(0, 16), cx + px / 2, cy + px + 10);
    });
    return o;
  };
})();
