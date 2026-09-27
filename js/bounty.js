// Carteles de "Se busca": tu recompensa sube al derrotar jefes y enemigos importantes.
// Tu cartel (con tu retrato) se ve desde la pausa y la bitácora, hay carteles con tu cara en el
// campamento pirata y en la aldea Shandara, y los personajes te reconocen cuando eres famoso.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const B = (G.Bounty = {});
  const $ = (id) => document.getElementById(id);

  // Recompensa por cada enemigo derrotado
  B.REWARD = {
    pirate: 300, pirate_gun: 300, pirate_boss: 15000, boss: 8000, serpent: 30000, bear: 500, jaguar: 400, caiman: 400,
    marine: 900, marine_gun: 900, marine_boss: 40000, yeti: 50000, lavadragon: 80000,
    navy_ship: 6000, ghost_ship: 100000,
  };
  // Por qué sube (si no está aquí: "Derrotaste a un/una …")
  B.WHY = {
    pirate_boss: 'Derrotaste a la Capitana Hiena', boss: 'Derrotaste al Jabalí gigante', serpent: 'Venciste a la Serpiente marina',
    marine_boss: 'Derrotaste a un comodoro de la Marina Blanca', yeti: 'Derrotaste al Rey de la Escarcha', lavadragon: 'Derrotaste al Dragón de Brasa',
    navy_ship: 'Hundiste un barco de la Marina Blanca', ghost_ship: 'Hundiste el Holandés de las Mareas',
  };
  B.FAME = 5000; // a partir de aquí te reconocen
  B.value = () => (G.state && G.state.bounty) || 0;
  B.fmt = (v) => Math.round(v).toLocaleString('es-ES');
  B.title = (v = B.value()) => (v <= 0 ? 'Náufrago sin fama' : v < 5000 ? 'Buscavidas del mar' : v < 20000 ? 'Pirata novato' : v < 60000 ? 'Terror de las mareas'
    : v < 150000 ? 'Azote de la Marina Blanca' : 'Leyenda del Archipiélago');
  B.famous = () => B.value() >= B.FAME;

  // Sube la recompensa (reason: por qué)
  B.add = function (amount, reason) {
    if (!G.state || !amount) return;
    const before = B.value();
    G.state.bounty = before + amount;
    G.state.recog = {}; // con la fama nueva, los personajes vuelven a comentar tu cartel
    const v = B.value();
    if (amount >= 5000 || B.title(before) !== B.title(v)) {
      G.UI.banner('📜 ¡Tu recompensa ha subido!', `${B.fmt(v)} doblones · «${B.title(v)}»${reason ? ' · ' + reason : ''}`);
      G.Audio.play('win');
      setTimeout(() => G.UI.msg('Mira tu cartel de <b>Se busca</b> en la pausa (<kbd>Esc</kbd>) o en la bitácora (<kbd>J</kbd>).', 'info', 'bounty'), 2500);
    } else G.UI.msg(`📜 Recompensa +${B.fmt(amount)}: <b>${B.fmt(v)}</b> doblones`, 'info', 'bountyS');
    refresh();
  };
  B.onKill = function (type) {
    const r = B.REWARD[type];
    if (!r) return;
    const name = (G.Creatures.DEF && G.Creatures.DEF[type] && G.Creatures.DEF[type].name) || '';
    B.add(r, B.WHY[type] || (name ? 'Derrotaste a un ' + name.toLowerCase() : ''));
  };

  // ------------------------------------------------------------------ retrato del jugador
  let rr = null, portraitImg = null, portraitKey = '';
  function renderPortrait() {
    if (!rr) {
      rr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      rr.setSize(256, 256); rr.toneMapping = THREE.ACESFilmicToneMapping; rr.toneMappingExposure = 1.05;
    }
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e0, 0x4a3a2a, 1.8));
    const s = new THREE.DirectionalLight(0xffffff, 2.2); s.position.set(1.5, 3, 3); sc.add(s);
    const L = G.Profile.lookHex(), m = G.Character.create(L.shirt, { skin: L.skin, pants: L.pants });
    G.Equip.apply(m, G.Player.visibleIds ? G.Player.visibleIds() : G.Profile.cosIds());
    sc.add(m.root);
    m.update(0.016, { pos: new THREE.Vector3(), yaw: 0, pitch: 0, speed: 0, onGround: true, swimming: false, swing: 0, holding: false });
    m.root.rotation.y = 0.28; m.root.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    cam.position.set(0.28, 1.72, 1.45); cam.lookAt(0, 1.64, 0);
    rr.render(sc, cam);
    const url = rr.domElement.toDataURL();
    if (m.dispose) m.dispose();
    return url;
  }
  // Retrato en caché (se rehace si cambias de aspecto o de cosméticos)
  function portrait(done) {
    const key = JSON.stringify([G.Profile.look(), G.Profile.cosIds(), G.Inv && G.Inv.equip && G.Inv.equip.head && G.Inv.equip.head.id]);
    if (portraitImg && key === portraitKey) { done(portraitImg); return; }
    portraitKey = key;
    const im = new Image();
    im.onload = () => { portraitImg = im; done(im); };
    try { im.src = renderPortrait(); } catch (e) { done(null); }
  }

  // ------------------------------------------------------------------ el cartel
  const PW = 384, PH = 590;
  function paint(c, img) {
    const w = PW, h = PH, v = B.value(), rnd = U.rng(77);
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, '#f0e3bf'); g.addColorStop(1, '#c4a56c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Manchas y arrugas del papel
    for (let i = 0; i < 45; i++) { c.fillStyle = `rgba(110,70,25,${0.03 + rnd() * 0.07})`; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 8 + rnd() * 40, 6 + rnd() * 28, rnd() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(90,60,25,.25)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(rnd() * w, 0); c.lineTo(rnd() * w, h); c.stroke(); }
    c.strokeStyle = '#4a2c10'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 2; c.strokeRect(24, 24, w - 48, h - 48);
    c.fillStyle = '#3a200c'; c.textAlign = 'center';
    c.font = '900 62px Cinzel, Georgia, serif'; c.fillText('SE BUSCA', w / 2, 96);
    c.font = '700 17px Georgia, serif'; c.fillText('— VIVO O MUERTO —', w / 2, 124);
    // Retrato en sepia
    const px = 54, py = 140, pw = w - 108, ph = 220;
    c.fillStyle = '#d6c396'; c.fillRect(px, py, pw, ph);
    if (img) {
      c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      c.filter = 'sepia(0.8) contrast(1.2) brightness(0.95)';
      const s = pw / img.width * 1.05;
      c.drawImage(img, px + pw / 2 - img.width * s / 2, py + ph / 2 - img.height * s / 2 + 8, img.width * s, img.height * s);
      c.restore();
    } else { c.font = '900 90px Georgia, serif'; c.fillStyle = '#8a6a3a'; c.fillText('?', w / 2, py + ph / 2 + 30); c.fillStyle = '#3a200c'; }
    c.strokeStyle = '#3a200c'; c.lineWidth = 3; c.strokeRect(px, py, pw, ph);
    c.fillStyle = '#3a200c';
    c.font = '900 34px Cinzel, Georgia, serif';
    const name = (G.Profile.name() || 'Náufrago').toUpperCase();
    c.fillText(name.length > 14 ? name.slice(0, 14) : name, w / 2, py + ph + 44);
    c.font = '700 15px Georgia, serif'; c.fillText('RECOMPENSA', w / 2, py + ph + 72);
    c.font = '900 42px Georgia, serif'; c.fillText(`${B.fmt(v)}`, w / 2, py + ph + 116);
    c.font = '700 15px Georgia, serif'; c.fillText('DOBLONES', w / 2, py + ph + 138);
    c.font = 'italic 17px Georgia, serif'; c.fillText(`«${B.title(v)}»`, w / 2, py + ph + 176);
    c.font = '700 12px Georgia, serif'; c.fillText('Por orden de la MARINA BLANCA', w / 2, h - 38);
  }
  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = PW; posterCanvas.height = PH;
  let posterTex = null;
  function refresh() {
    portrait((img) => {
      paint(posterCanvas.getContext('2d'), img);
      if (posterTex) posterTex.needsUpdate = true;
      for (const p of boards) p.visible = B.value() > 0;
      const big = $('posterBig');
      if (big && !$('posterWin').classList.contains('hidden')) big.getContext('2d').drawImage(posterCanvas, 0, 0);
    });
  }
  B.refresh = refresh;
  let lastVis = null;
  B.update = function () {
    const vis = B.value() > 0;
    if (vis !== lastVis) { lastVis = vis; refresh(); }
  };

  // ------------------------------------------------------------------ ventana del cartel
  function buildWin() {
    if ($('posterWin')) return;
    const el = document.createElement('div');
    el.id = 'posterWin';
    el.className = 'fe-overlay hidden';
    el.innerHTML = `<div class="poster-card"><canvas id="posterBig" width="${PW}" height="${PH}"></canvas>
      <p id="posterInfo" class="muted small-text"></p><button id="posterClose" class="btn primary">Cerrar</button></div>`;
    document.body.appendChild(el);
    $('posterClose').onclick = B.close;
    document.addEventListener('keydown', (e) => { if (!el.classList.contains('hidden') && e.code === 'Escape') { e.stopPropagation(); B.close(); } }, true);
  }
  B.open = function () {
    buildWin();
    $('posterWin').classList.remove('hidden');
    const v = B.value();
    $('posterInfo').innerHTML = v > 0 ? `Tu recompensa sube al derrotar jefes, capitanes y barcos de la Marina Blanca.` : 'Aún nadie ofrece nada por tu cabeza. Derrota a jefes y capitanes para hacerte famoso.';
    portrait((img) => { paint(posterCanvas.getContext('2d'), img); $('posterBig').getContext('2d').drawImage(posterCanvas, 0, 0); });
  };
  B.close = () => { if ($('posterWin')) $('posterWin').classList.add('hidden'); };

  // ------------------------------------------------------------------ carteles en el mundo
  const boards = [];
  // Tablón con el cartel: dos postes, una tabla y el papel (se crea al generar el mundo)
  function board(x, z, yaw) {
    const K = G.Landmarks.kit(), M = G.Mdl, y = G.height(x, z);
    const wood = [M.xf(M.paint(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), 0x6a4a2a), -0.55, 1.05, 0), M.xf(M.paint(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), 0x6a4a2a), 0.55, 1.05, 0),
      M.xf(M.paint(new THREE.BoxGeometry(1.35, 1.25, 0.06), 0x8a6a42), 0, 1.35, 0)];
    const g = new THREE.Group();
    g.add(new THREE.Mesh(U.merge(wood), K.mats().vc));
    if (!posterTex) { posterTex = new THREE.CanvasTexture(posterCanvas); posterTex.colorSpace = THREE.SRGBColorSpace; }
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.14), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.95 }));
    paper.position.set(0, 1.37, 0.035); paper.rotation.z = 0.03;
    g.add(paper);
    g.position.set(x, y, z); g.rotation.y = yaw;
    g.visible = B.value() > 0;
    K.track(g);
    boards.push(g);
  }
  B.build = function () {
    boards.length = 0;
    // Campamento pirata (en la Isla Perdida)
    const Pr = G.Prologue;
    if (Pr && Pr.PIRATES) { const P = Pr.PIRATES; board(P.x + 6, P.z - 5, Math.atan2(-6, 5)); }
    // Aldea Shandara (Isla Tahuri)
    for (const s of G.Arch.islands) {
      const V = s.feat && s.feat.village;
      if (V && V.wx !== undefined) board(V.wx + V.r * 0.45, V.wz + V.r * 0.2, Math.atan2(-V.r * 0.45, -V.r * 0.2));
    }
    refresh();
  };
})();
