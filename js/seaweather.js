// Clima peligroso en alta mar (lejos de las islas):
//  - Tormentas: olas más altas, rayos que pueden caer en el mástil y golpes de mar si navegas rápido.
//  - Remolinos que se forman a proa durante las tormentas (arrastran y dañan como los fijos).
//  - Bancos de niebla que tapan el horizonte (de noche, en ellos navega el Holandés de las Mareas).
// El anfitrión (o la partida individual) decide los sucesos y los envía al resto.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const S = (G.SeaWx = { fog: 0, fogTarget: 0, fogT: 0 });
  const atSea = (x, z) => !G.Arch.zoneOf(x, z) && !G.Arch.landOf(x, z) && G.height(x, z) < -6;
  S.atSea = atSea;

  // Barcos con jugadores a bordo en alta mar
  function crewedShips() {
    const out = new Set();
    if (G.Player.ship && !G.Player.dead) out.add(G.Player.ship);
    for (const p of G.Net.peers.values()) if (p.shipId && !p.dead) { const s = G.Ships.byId(p.shipId); if (s) out.add(s); }
    return [...out].filter((s) => !s.sinking && atSea(s.x, s.z));
  }

  // ------------------------------------------------------------------ rayos
  let boltMesh = null, boltT = 0;
  function showBolt(x, z, y1) {
    if (boltMesh) G.scene.remove(boltMesh);
    const pts = [];
    let px = x + (Math.random() - 0.5) * 6, pz = z + (Math.random() - 0.5) * 6;
    for (let y = 70; y > y1; y -= 5) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 3 + (x - px) * 0.25; pz += (Math.random() - 0.5) * 3 + (z - pz) * 0.25; }
    pts.push(new THREE.Vector3(x, y1, z));
    boltMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 1 }));
    G.scene.add(boltMesh);
    boltT = 0.35;
    G.Weather.flash = 1;
    G.Audio.play('thunder', 1);
    G.Ships.puff(x, y1, z, 0xfff0a0, 2.2, 0.6, 5);
    G.Ships.puff(x, y1, z, 0x3a3a3a, 3, 2.5, 8);
  }
  // Un relámpago de la tormenta puede caer en un barco (lo llama weather.js)
  S.onBolt = function () {
    if (!G.Net.authority()) return;
    const ships = crewedShips();
    if (!ships.length || Math.random() > 0.3) return;
    const s = ships[Math.floor(Math.random() * ships.length)];
    const mastY = G.World.waveHeight(s.x, s.z) + (s.type === 'barco' ? 11 : s.type === 'balsa' ? 4 : 7);
    showBolt(s.x, s.z, mastY);
    G.Net.send({ t: 'seaWx', bolt: [s.x, s.z, mastY] });
    G.Ships.hurt(s, s.def.hp * (0.08 + Math.random() * 0.06), '¡Un rayo cae sobre el mástil!');
  };

  // ------------------------------------------------------------------ remolinos pasajeros
  let whirlTex = null;
  function tex() {
    return whirlTex || (whirlTex = U.canvasTex(256, 256, (c, w, h) => {
      c.translate(w / 2, h / 2);
      for (let k = 0; k < 5; k++) {
        c.strokeStyle = `rgba(255,255,255,${0.55 - k * 0.08})`; c.lineWidth = 7 - k;
        c.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.1) { const r = 6 + a * 6.4; c.lineTo(Math.cos(a + k * 1.25) * r, Math.sin(a + k * 1.25) * r); }
        c.stroke();
      }
    }, true));
  }
  const temps = [];
  function addWhirl(x, z, r, life) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: tex(), transparent: true, depthWrite: false, color: 0xdff4ff, opacity: 0 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.12, z);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.25, 24), new THREE.MeshBasicMaterial({ color: 0x06202e, transparent: true, opacity: 0, depthWrite: false }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(x, 0.1, z);
    G.scene.add(disc); G.scene.add(hole);
    const w = { x, z, r, disc, hole, life, max: life, temp: true };
    G.Landmarks.whirls.push(w);
    temps.push(w);
  }
  function removeWhirl(w) {
    G.scene.remove(w.disc); G.scene.remove(w.hole);
    w.disc.geometry.dispose(); w.hole.geometry.dispose(); w.disc.material.dispose(); w.hole.material.dispose();
    const L = G.Landmarks.whirls, i = L.indexOf(w);
    if (i >= 0) L.splice(i, 1);
  }

  // ------------------------------------------------------------------ red
  S.onNet = function (m) {
    if (m.fog !== undefined) { S.fogTarget = m.fog; if (m.fog > 0.3 && crewedShips().length) G.UI.msg('🌫️ Un banco de niebla cubre el mar. No se ve más allá de la proa…', 'warn', 'fog'); }
    if (m.whirl) { addWhirl(m.whirl[0], m.whirl[1], m.whirl[2], m.whirl[3]); if (G.Player.ship) G.UI.msg('🌀 ¡Se está formando un remolino a proa! Vira el timón.', 'bad', 'whirl'); }
    if (m.bolt) showBolt(m.bolt[0], m.bolt[1], m.bolt[2]);
  };
  function send(m) { S.onNet(m); G.Net.send(Object.assign({ t: 'seaWx' }, m)); }

  // ------------------------------------------------------------------ fotograma
  let checkT = 5, hitT = 0, lastWorld = null;
  S.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; for (const w of temps.splice(0)) removeWhirl(w); S.fog = S.fogTarget = 0; S.fogT = 0; }
    if (!G.state.world) return;
    const Wx = G.Weather, storm = Wx.type === 'storm' ? Wx.intensity : 0, P = G.Player;
    // Olas: más altas en las tormentas (solo mar adentro: en la orilla el agua casi no se mueve)
    const amp = 1 + storm * 0.9 + (Wx.type === 'rain' ? Wx.intensity * 0.25 : 0);
    G.World.waveAmp = amp;
    if (G.World.seaMat) G.World.seaMat.uniforms.uAmp.value = amp;
    // Niebla
    S.fog += (S.fogTarget - S.fog) * Math.min(1, dt * 0.25);
    // Rayo que se desvanece
    if (boltMesh && (boltT -= dt) <= 0) { G.scene.remove(boltMesh); boltMesh.geometry.dispose(); boltMesh.material.dispose(); boltMesh = null; }
    else if (boltMesh) boltMesh.material.opacity = boltT / 0.35;
    // Remolinos pasajeros: aparecen y se desvanecen
    for (let i = temps.length - 1; i >= 0; i--) {
      const w = temps[i];
      w.life -= dt;
      const a = Math.min(1, (w.max - w.life) / 4, w.life / 4);
      w.disc.material.opacity = Math.max(0, a); w.hole.material.opacity = Math.max(0, a * 0.8);
      if (w.life <= 0) { removeWhirl(w); temps.splice(i, 1); }
    }
    // Golpes de mar: navegando rápido en plena tormenta (lo calcula quien lleva el timón)
    const s = P.ship;
    if (s && storm > 0.6 && atSea(s.x, s.z) && G.Ships.isAuth(s) && Math.abs(s.speed) > 3 && (hitT -= dt) <= 0) {
      hitT = 1;
      if (Math.random() < 0.05 + Math.abs(s.speed) * 0.006) {
        hitT = 12;
        G.Ships.hurt(s, s.def.hp * (0.03 + Math.random() * 0.03), '¡Un golpe de mar barre la cubierta! Navega más despacio en la tormenta');
        P.shake = 0.7; P.wet = 100;
        G.Audio.play('splash');
      }
    }
    // Sucesos (los decide el anfitrión)
    if (!G.Net.authority() || (checkT -= dt) > 0) return;
    checkT = 5;
    const ships = crewedShips();
    S.fogT -= 5;
    if (S.fogTarget > 0 && S.fogT <= 0) send({ fog: 0 });
    else if (S.fogTarget === 0 && ships.length) {
      // Más niebla de noche y al amanecer
      const h = G.Game.hour(), p = h >= 20 || h < 7 ? 0.05 : 0.015;
      if (Math.random() < p) { S.fogT = 70 + Math.random() * 80; send({ fog: 0.82 }); }
    }
    if (storm > 0.6 && ships.length && temps.length < 2 && Math.random() < 0.06) {
      const sh = ships[Math.floor(Math.random() * ships.length)], d = 55 + Math.random() * 30, a = sh.yaw + (Math.random() - 0.5) * 0.5;
      const x = sh.x + Math.sin(a) * d, z = sh.z + Math.cos(a) * d;
      if (atSea(x, z)) send({ whirl: [Math.round(x), Math.round(z), 9 + Math.round(Math.random() * 4), 60] });
    }
  };
})();
