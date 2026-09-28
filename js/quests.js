// Tablones de encargos: uno en cada isla con jefe. Isla Perdida: campamento de tu tripulación; Tahuri: aldea
// Shandara; Escarcha: aldea Kyrr; Brasa: aldea de Ceniza.
// Cada tablón tiene 15 encargos que salen de 3 en 3 en hojas de papel clavadas en la pizarra: se leen ahí mismo,
// se aceptan haciendo clic en la hoja (la que miras se resalta) y, al cumplirlos, aparece «COMPLETADO» en verde.
// Cuando las 3 están cumplidas salen 3 más. Tras los 15, la última hoja pide derrotar al jefe de la isla.
// Cada tablón terminado cuenta para el logro «Héroe de las aldeas». Cada jugador tiene los suyos (G.state.quests).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Q = (G.Quests = {});
  const esc = (s) => G.Net.esc(String(s));

  // [tipo, qué, cuántos, por qué] · tipos: bring (se entrega en el tablón), hunt, visit (isla) y treasure
  const VILLAGES = {
    perdida: {
      name: 'Campamento de la Gaviota Errante', who: ['Capitana Mara', 'Kaito', 'Crane', 'Bastián'], boss: 'boss', bossName: 'Jabalí gigante',
      bossWhy: 'El jabalí gigante arrasa la pradera. Sin él, la isla será nuestra.',
      list: [
        ['bring', 'madera', 10, 'La hoguera del campamento se apaga. Trae leña.'],
        ['bring', 'piedra', 8, 'Quiero un buen círculo de piedras para la hoguera.'],
        ['hunt', 'crab', 4, 'Los cangrejos se meten en las provisiones.'],
        ['bring', 'coco', 6, 'Nos queda poca agua: los cocos ayudarán.'],
        ['hunt', 'boar', 2, 'Esta noche asamos jabalí para todos.'],
        ['bring', 'carne_cocida', 4, 'La tripulación tiene hambre. ¡Carne asada!'],
        ['bring', 'agua_limpia', 3, 'Necesitamos agua hervida para el viaje.'],
        ['hunt', 'snake', 3, 'Hay serpientes entre las cajas del naufragio.'],
        ['bring', 'cuerda', 2, 'Hacen falta cuerdas para amarrar la vela.'],
        ['hunt', 'jaguar', 1, 'Un jaguar ronda el campamento de noche.'],
        ['bring', 'pez_asado', 5, 'Bastián quiere probar el pescado de la isla.'],
        ['visit', 'tahuri', 1, 'Dicen que en Tahuri vive una tribu. Averigua si son amigos.'],
        ['hunt', 'pirate', 3, 'Los piratas de la Hiena vigilan nuestra costa.'],
        ['bring', 'lingote', 2, 'Crane necesita hierro para su mosquete.'],
        ['treasure', null, 1, 'Rogan escondió más tesoros. ¡Encuentra uno!'],
      ],
    },
    tahuri: {
      name: 'Aldea Shandara', who: ['Wypar', 'Aisha', 'Kamakiro', 'Laka', 'Brahan', 'Genbu', 'Anciano Kalgor'], boss: 'bigcaiman', bossName: 'Gran Caimán del río',
      bossWhy: 'El Gran Caimán del río se come nuestras canoas. ¡Acaba con él!',
      list: [
        ['bring', 'madera', 12, 'Hay que reparar el techo de la choza grande.'],
        ['hunt', 'crab', 5, 'Los cangrejos se comen las redes de pesca.'],
        ['bring', 'coco', 6, 'Los niños quieren leche de coco.'],
        ['hunt', 'boar', 3, 'Los jabalíes destrozan los huertos de la aldea.'],
        ['bring', 'fibra', 10, 'Faltan cuerdas para las canoas.'],
        ['bring', 'pez_asado', 5, 'La fiesta de la luna llena necesita comida.'],
        ['hunt', 'snake', 2, 'Hay serpientes junto al pozo. Los niños tienen miedo.'],
        ['bring', 'bambu', 8, 'Vamos a construir una pasarela sobre el río.'],
        ['hunt', 'caiman', 2, 'Dos caimanes vigilan el río donde lavamos.'],
        ['bring', 'cuero', 3, 'Mi tambor está roto. Necesito cuero nuevo.'],
        ['hunt', 'jaguar', 1, 'Un jaguar se llevó una cabra. Que no se lleve a nadie más.'],
        ['visit', 'perdida', 1, 'En la Isla Perdida vive un ermitaño brujo. Llévale nuestro saludo.'],
        ['bring', 'lingote', 3, 'Queremos puntas de hierro para las lanzas.'],
        ['hunt', 'pirate', 3, 'Piratas de la Hiena espían la costa. Espántalos.'],
        ['treasure', null, 1, 'Genbu dice que un tesoro enterrado pagaría la nueva canoa de la aldea.'],
      ],
    },
    escarcha: {
      name: 'Aldea Kyrr', who: ['Sigrun', 'Toke', 'Ylva', 'Anciana Hild', 'Bram'], boss: 'yeti', bossName: 'Rey de la Escarcha',
      bossWhy: 'Mientras el Rey de la Escarcha viva, nadie se atreve a subir a la montaña.',
      list: [
        ['bring', 'madera', 12, 'Sin leña, la noche en Escarcha no perdona.'],
        ['bring', 'piedra', 10, 'El muro contra la ventisca se está cayendo.'],
        ['hunt', 'seal', 3, 'Necesitamos grasa de foca para las lámparas.'],
        ['bring', 'carne_cocida', 5, 'Los cazadores vuelven hambrientos del hielo.'],
        ['hunt', 'snowwolf', 3, 'Los lobos de las nieves rodean la aldea.'],
        ['bring', 'cuero', 4, 'Hay que coser botas nuevas para los niños.'],
        ['bring', 'grasa', 3, 'La grasa de foca mantiene encendidas las lámparas.'],
        ['bring', 'pez_asado', 5, 'El lago helado ya no da peces. Tráenos pescado.'],
        ['hunt', 'bear', 1, 'Un oso blanco rompió el almacén de carne.'],
        ['bring', 'piel_gruesa', 3, 'Queremos abrigos que aguanten la ventisca.'],
        ['bring', 'cristal_hielo', 6, 'Los cristales de hielo iluminan nuestras chozas.'],
        ['visit', 'brasa', 1, 'Dicen que en Brasa la tierra quema. Ve y cuéntanos.'],
        ['bring', 'mineral_plata', 4, 'Hild quiere forjar amuletos de plata.'],
        ['hunt', 'bear', 2, 'Dos osos blancos bajan de la montaña cada noche.'],
        ['treasure', null, 1, 'Toke soñó con un cofre enterrado. ¡Búscalo!'],
      ],
    },
    brasa: {
      name: 'Aldea de Ceniza', who: ['Tizón', 'Ascua', 'Chispa', 'Maestro Hollín', 'Pavesa'], boss: 'lavadragon', bossName: 'Dragón de Brasa',
      bossWhy: 'El Dragón de Brasa quema nuestras minas. ¡Derrótalo!',
      list: [
        ['bring', 'piedra', 10, 'La colada rompió el muro del horno.'],
        ['hunt', 'lavacrab', 3, 'Los cangrejos de lava muerden a los mineros.'],
        ['bring', 'madera', 8, 'En Brasa apenas crecen árboles. Necesitamos madera.'],
        ['bring', 'carbon', 6, 'Sin carbón, la forja se apaga.'],
        ['hunt', 'salamander', 2, 'Unas salamandras de fuego se colaron en la mina.'],
        ['bring', 'agua_limpia', 4, 'Aquí el agua escasea. ¡Tráenos agua hervida!'],
        ['bring', 'azufre', 6, 'El maestro Hollín prepara pólvora.'],
        ['bring', 'obsidiana', 4, 'Tallamos puntas de obsidiana para las herramientas.'],
        ['hunt', 'lavacrab', 4, 'Otra plaga de cangrejos de lava en la playa negra.'],
        ['bring', 'lingote', 3, 'La forja necesita hierro para las picas nuevas.'],
        ['hunt', 'salamander', 3, 'Las salamandras rondan las coladas.'],
        ['visit', 'escarcha', 1, 'Nunca hemos visto la nieve. Ve a Escarcha y cuéntanos.'],
        ['bring', 'polvora', 4, 'Queremos abrir un túnel nuevo en la montaña.'],
        ['hunt', 'pirate', 3, 'Los piratas de la Hiena roban nuestro carbón.'],
        ['treasure', null, 1, 'Un minero encontró un mapa… pero no sabe leerlo. ¡Desentierra el tesoro!'],
      ],
    },
  };
  Q.VILLAGES = VILLAGES;
  // Nombres de los animales en los encargos: [singular, plural, artículo]
  const PREY = {
    crab: ['cangrejo', 'cangrejos', 'un'], boar: ['jabalí', 'jabalíes', 'un'], snake: ['serpiente', 'serpientes', 'una'], caiman: ['caimán', 'caimanes', 'un'],
    jaguar: ['jaguar', 'jaguares', 'un'], pirate: ['pirata de la Hiena', 'piratas de la Hiena', 'un'], bear: ['oso blanco', 'osos blancos', 'un'],
    lavacrab: ['cangrejo de lava', 'cangrejos de lava', 'un'], seal: ['foca', 'focas', 'una'], snowwolf: ['lobo de las nieves', 'lobos de las nieves', 'un'],
    salamander: ['salamandra de fuego', 'salamandras de fuego', 'una'],
  };
  const PER = 3, TOTAL = 15;
  const itemName = (id) => (G.ITEMS[id] ? G.ITEMS[id].n.toLowerCase() : id);
  const PLURAL = { perla: 'perlas', mapa_tesoro: 'mapas del tesoro' };
  const extraText = (e) => `${e[1]} ${e[1] > 1 && PLURAL[e[0]] ? PLURAL[e[0]] : itemName(e[0])}`;

  // ------------------------------------------------------------------ estado (por jugador)
  const st = () => {
    let s = G.state.quests;
    if (!s || !s.boards) s = G.state.quests = { v: 2, boards: {}, done: (s && s.done) || 0 };
    return s;
  };
  const bst = (v) => st().boards[v] || (st().boards[v] = { idx: 0, slots: [], fin: false, wait: 0 });
  // La misión final se cumple al derrotar al jefe después de aceptarla (los jefes vuelven a los 30 minutos)
  const bossDone = (q) => G.Bosses.kills(q.t) > (q.k0 || 0);

  function reward(g, boss) {
    if (boss) return { doblon: 60, coins: 150, extra: ['perla', 3] };
    return { doblon: 4 + g * 4 + Math.floor(Math.random() * 4), coins: 12 + g * 10, extra: g >= 3 && Math.random() < 0.5 ? (Math.random() < 0.5 ? ['mapa_tesoro', 1] : ['perla', 2]) : null };
  }
  function make(v, i) {
    const V = VILLAGES[v], [kind, what, n, why] = V.list[i], g = Math.floor(i / PER);
    const q = { key: v + ':' + i, v, kind, n, got: 0, why, who: V.who[i % V.who.length], rw: reward(g), st: 'open' };
    if (kind === 'hunt') { const p = PREY[what] || [what, what, 'un']; q.t = what; q.text = n > 1 ? `Caza ${n} ${p[1]}` : `Caza ${p[2]} ${p[0]}`; }
    else if (kind === 'bring') { q.item = what; q.text = `Trae ${n} × ${itemName(what)}`; }
    else if (kind === 'visit') { const isl = G.Arch.islands.find((s) => s.type === what); q.isl = isl ? isl.id : -1; q.text = `Visita ${isl ? isl.name : what}`; }
    else q.text = 'Desentierra un tesoro';
    return q;
  }
  function makeBoss(v) {
    const V = VILLAGES[v];
    return { key: v + ':boss', v, kind: 'boss', t: V.boss, n: 1, got: 0, why: V.bossWhy, who: V.name, rw: reward(0, true), st: 'open', text: `Derrota al ${V.bossName}`, boss: true };
  }
  // Pone en la pizarra los encargos que tocan (3 nuevos, o la misión final tras los 15)
  function refill(v) {
    const b = bst(v);
    if (b.slots.length && !b.slots.every((q) => q.st === 'done')) return false;
    if (b.idx < TOTAL) {
      b.slots = [];
      for (let k = 0; k < PER && b.idx < TOTAL; k++) b.slots.push(make(v, b.idx++));
      return true;
    }
    if (!b.fin) { b.fin = true; b.slots = [makeBoss(v)]; return true; }
    return false;
  }
  const allActive = () => { const out = []; for (const v in st().boards) for (const q of st().boards[v].slots) if (q.st === 'active') out.push(q); return out; };

  // ------------------------------------------------------------------ progreso
  const rwText = (rw) => `${rw.doblon} doblones · 🪙 ${rw.coins}${rw.extra ? ` · ${extraText(rw.extra)}` : ''}`;
  function complete(q) {
    q.st = 'done'; q.got = q.n;
    const s = st();
    s.done++;
    G.Game.give('doblon', q.rw.doblon);
    G.Profile.addCoins(q.rw.coins, 'Encargo cumplido');
    if (q.rw.extra) G.Game.give(q.rw.extra[0], q.rw.extra[1]);
    if (q.v === 'tahuri') { const w = G.state.world && G.state.world.story; if (w) { w.rep = Math.min(100, (w.rep || 0) + 5); G.Net.send({ t: 'story', w }); } }
    G.Audio.play('win');
    G.Ach.add('quest');
    const V = VILLAGES[q.v], b = bst(q.v);
    if (q.boss) G.UI.banner(`🏆 ¡${V.name} está a salvo!`, `Derrotaste al ${V.bossName} · ${rwText(q.rw)}`);
    else G.UI.banner('📋 ¡Encargo cumplido!', `${q.who}: «¡Gracias, forastero!» · ${rwText(q.rw)}`);
    // Los 15 encargos del tablón: una parte del logro de las aldeas
    if (!q.boss && b.idx >= TOTAL && b.slots.every((x) => x.st === 'done')) {
      G.Ach.flag('aldea:' + q.v);
      const n = Object.keys(VILLAGES).filter((k) => G.Profile.cnt('aldea:' + k) > 0).length;
      const part = G.Ach.blocked() ? 'los logros no cuentan en partidas con trucos' : `Logro «Héroe de las aldeas»: ${n}/4 aldeas`;
      setTimeout(() => G.UI.banner(`🛖 ${V.name}: ¡15 encargos cumplidos!`, `${part} · En el tablón te espera la misión final`), 3500);
    }
    hud(); dirty = true;
  }
  function progress(q, add) {
    q.got = Math.min(q.n, q.got + add);
    if (q.got >= q.n && q.kind !== 'bring') complete(q);
    else { G.UI.msg(`📋 ${esc(q.text)}: ${q.got}/${q.n}`, 'info', 'quest' + q.key); hud(); dirty = true; }
  }
  Q.onKill = function (type) {
    for (const q of allActive()) {
      if (q.kind === 'hunt' && (q.t === type || (q.t === 'pirate' && type === 'pirate_gun'))) progress(q, 1);
      else if (q.kind === 'boss' && q.t === type) complete(q);
    }
  };
  Q.onEvent = function (ev) { for (const q of allActive()) if (q.kind === ev) progress(q, 1); };

  // Clic (o E) en una hoja de la pizarra
  Q.click = function (tg) {
    const b = tg.b, q = bst(b.v).slots[tg.i];
    if (!q) return;
    if (q.st === 'open') {
      q.st = 'active';
      G.Audio.play('select');
      G.UI.msg(`📋 Encargo aceptado: <b>${esc(q.text)}</b>`, 'good', 'questtake');
      if (q.boss) {
        q.k0 = G.Bosses.kills(q.t);
        if (!G.Bosses.canSpawn(q.t)) { const m = Math.ceil((30 * 60 - (G.Bosses.clock() - G.Bosses.killedAt(q.t))) / 60); G.UI.msg(`⏳ El ${VILLAGES[q.v].bossName} volverá dentro de unos ${m} min.`, 'info', 'bossback'); }
      }
    } else if (q.st === 'active' && q.kind === 'bring') {
      const have = G.Inv.count(q.item);
      if (have < q.n) { G.UI.msg(`Te faltan ${q.n - have} × ${itemName(q.item)}.`, 'warn', 'quest'); G.Audio.play('error'); return; }
      G.Inv.remove(q.item, q.n);
      complete(q);
    } else if (q.st === 'active') G.UI.msg(`📋 ${esc(q.text)}: ${q.got}/${q.n}`, 'info', 'quest' + q.key);
    hud(); dirty = true;
  };
  Q.prompt = function (tg) {
    const q = bst(tg.b.v).slots[tg.i];
    if (!q) return '';
    const t = `📋 <b>${esc(q.text)}</b>`;
    if (q.st === 'open') return `${t} · <kbd>Clic</kbd> Aceptar`;
    if (q.st === 'done') return `${t} · ✅ Completado`;
    if (q.kind === 'bring') { const have = G.Inv.count(q.item); return have >= q.n ? `${t} · <kbd>Clic</kbd> Entregar` : `${t} · tienes ${have}/${q.n}`; }
    return `${t} · en curso ${q.got}/${q.n}`;
  };

  // ------------------------------------------------------------------ las hojas de papel (textura dibujada)
  const PW = 320, PH = 416;
  function wrap(ctx, text, maxW) {
    const words = String(text).split(' '), lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  function drawPaper(ctx, q) {
    const F = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const big = !!(q && q.boss), W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Papel envejecido
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, big ? '#efe0b8' : '#f4e9c8'); gr.addColorStop(1, big ? '#dcc690' : '#e6d4a4');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const rnd = U.rng(q ? q.key.length * 97 + (q.key.charCodeAt(q.key.length - 1) || 0) : 3);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(110,80,40,${rnd() * 0.07})`; ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3); }
    ctx.strokeStyle = 'rgba(120,90,50,.45)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
    // Chincheta
    ctx.fillStyle = '#b02020'; ctx.beginPath(); ctx.arc(W / 2, 22, 10, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(W / 2 - 3, 19, 3, 0, 7); ctx.fill();
    if (!q) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = 58;
    ctx.fillStyle = '#8a2a2a'; ctx.font = `800 ${big ? 26 : 20}px ${F}`;
    ctx.fillText(big ? '⚔️ MISIÓN FINAL' : q.who, W / 2, y); y += big ? 40 : 34;
    ctx.fillStyle = '#2a1e12'; ctx.font = `900 ${big ? 34 : 29}px ${F}`;
    for (const l of wrap(ctx, q.text, W - 40)) { ctx.fillText(l, W / 2, y); y += big ? 38 : 33; }
    y += 6;
    ctx.fillStyle = '#5a4630'; ctx.font = `italic 600 ${big ? 19 : 18}px ${F}`;
    for (const l of wrap(ctx, `«${q.why}»`, W - 44).slice(0, 5)) { ctx.fillText(l, W / 2, y); y += 23; }
    // Recompensa
    const ry = H - (big ? 108 : 100);
    ctx.fillStyle = 'rgba(120,90,50,.35)'; ctx.fillRect(28, ry - 26, W - 56, 2);
    ctx.fillStyle = '#6a4a1a'; ctx.font = `800 17px ${F}`;
    ctx.fillText('Recompensa', W / 2, ry - 4);
    ctx.fillStyle = '#2a1e12'; ctx.font = `700 19px ${F}`;
    ctx.fillText(`${q.rw.doblon} doblones · 🪙 ${q.rw.coins}`, W / 2, ry + 20);
    if (q.rw.extra) { ctx.font = `600 17px ${F}`; ctx.fillText(`+ ${extraText(q.rw.extra)}`, W / 2, ry + 42); }
    // Estado
    const fy = H - 30;
    if (q.st === 'open') { ctx.fillStyle = '#a0521a'; ctx.font = `800 20px ${F}`; ctx.fillText('👆 Clic para aceptar', W / 2, fy); }
    else if (q.st === 'active') {
      const have = q.kind === 'bring' ? Math.min(G.Inv.count(q.item), q.n) : q.got, k = have / q.n;
      ctx.fillStyle = 'rgba(60,40,20,.25)'; ctx.fillRect(40, fy - 22, W - 80, 14);
      ctx.fillStyle = k >= 1 ? '#2f9a44' : '#c88a2a'; ctx.fillRect(40, fy - 22, (W - 80) * k, 14);
      ctx.fillStyle = '#2a1e12'; ctx.font = `800 18px ${F}`;
      ctx.fillText(q.kind === 'bring' && have >= q.n ? '¡Clic para entregar!' : `En curso · ${have}/${q.n}`, W / 2, fy + 12);
    }
    if (q.st === 'done') {
      // Sello «COMPLETADO» en diagonal
      ctx.save();
      ctx.translate(W / 2, H / 2 + 10); ctx.rotate(-0.42);
      ctx.strokeStyle = 'rgba(30,150,60,.9)'; ctx.fillStyle = 'rgba(30,150,60,.92)';
      ctx.lineWidth = 6; ctx.strokeRect(-138, -34, 276, 68);
      ctx.lineWidth = 2; ctx.strokeRect(-128, -26, 256, 52);
      ctx.font = `900 40px ${F}`; ctx.textBaseline = 'middle'; ctx.fillText('COMPLETADO', 0, 2);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ tablones en el mundo
  const boards = [];
  const BW = 2.1, BH = 1.35, BY = 1.45; // pizarra (ancho, alto, altura del centro)
  function paperMesh(w, h) {
    const cv = document.createElement('canvas');
    const k = w > 0.7 ? 1.3 : 1;
    cv.width = Math.round(PW * k); cv.height = Math.round(PH * k);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: 0xfff0c8, emissiveMap: tex, emissiveIntensity: 0.1, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.userData.cv = cv; m.userData.tex = tex; m.userData.sig = '';
    return m;
  }
  function makeBoard(v, isl, x, z, yaw) {
    const K = G.Landmarks.kit(), M = G.Mdl, y = G.height(x, z);
    const parts = [M.xf(M.paint(new THREE.CylinderGeometry(0.08, 0.09, 2.6, 6), 0x5a3a20), -BW / 2 - 0.06, 1.3, 0), M.xf(M.paint(new THREE.CylinderGeometry(0.08, 0.09, 2.6, 6), 0x5a3a20), BW / 2 + 0.06, 1.3, 0),
      M.xf(M.paint(new THREE.BoxGeometry(BW, BH, 0.07), (px, py) => (Math.abs(Math.sin(py * 26)) > 0.94 ? 0x6a4e30 : 0x8a6a42)), 0, BY, 0),
      M.xf(M.paint(new THREE.BoxGeometry(BW + 0.16, 0.08, 0.12), 0x5a3a20), 0, BY + BH / 2 + 0.03, 0), M.xf(M.paint(new THREE.BoxGeometry(BW + 0.16, 0.08, 0.12), 0x5a3a20), 0, BY - BH / 2 - 0.03, 0),
      M.xf(M.paint(new THREE.ConeGeometry(1.45, 0.5, 4), 0x9a8a5a), 0, BY + BH / 2 + 0.35, 0, 0, Math.PI / 4, 0, [1.05, 1, 0.42])];
    const g = new THREE.Group();
    g.add(new THREE.Mesh(U.merge(parts), K.mats().vc));
    // Tres hojas y el cartel grande de la misión final
    const papers = [-0.68, 0, 0.68].map((px, i) => { const m = paperMesh(0.6, 0.78); m.position.set(px, BY - 0.01, 0.045); m.rotation.z = (i - 1) * 0.035; g.add(m); return m; });
    const poster = paperMesh(0.86, 1.1); poster.position.set(0, BY, 0.05); g.add(poster);
    g.position.set(x, y, z); g.rotation.y = yaw;
    K.track(g);
    // Postes sólidos y un icono en el mapa (no se abre: las hojas se leen en la pizarra)
    for (const s of [-1, 1]) K.circle(x + Math.cos(yaw) * s * (BW / 2 + 0.06), z - Math.sin(yaw) * s * (BW / 2 + 0.06), 0.25);
    G.Landmarks.loot.push({ id: 'quests:' + v, kind: 'board', x, y: y + 1.0, z, g, opened: false, extra: true, hitR: 0, name: 'Tablón de encargos', noTarget: true });
    boards.push({ v, isl, x, y, z, g, papers, poster });
  }
  Q.build = function () {
    boards.length = 0;
    for (const s of G.Arch.islands) {
      const V = s.feat && s.feat.village;
      if (!VILLAGES[s.type] || !V || V.wx === undefined) continue;
      const x = V.wx - V.r * 0.35, z = V.wz + V.r * 0.3;
      makeBoard(s.type, s, x, z, Math.atan2(V.wx - x, V.wz - z));
    }
    // Isla Perdida: en el campamento de tu tripulación, en un hueco libre (sin tiendas, arbustos ni rocas) mirando al centro
    const C = G.Prologue && G.Prologue.CREW;
    if (C) {
      let best = null;
      for (let r = 7; r <= 14 && !best; r += 1.5) for (let k = 0; k < 16 && !best; k++) {
        const a = (k / 16) * Math.PI * 2 + 0.3, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r, h = G.height(x, z);
        if (h < 1.2) continue;
        const yaw = Math.atan2(C.x - x, C.z - z);
        let ok = true;
        for (const s of [-1.4, 0, 1.4]) for (const f of [0, 1.3, 2.5]) {
          const px = x + Math.cos(yaw) * s + Math.sin(yaw) * f, pz = z - Math.sin(yaw) * s + Math.cos(yaw) * f;
          if (G.Landmarks.blocks(px, pz) || Math.abs(G.height(px, pz) - h) > 0.6) ok = false;
        }
        G.Res.query(x, z, 4, (res) => { if (res.alive && Math.hypot(res.x - x, res.z - z) < 2.6) ok = false; });
        if (ok) best = { x, z, yaw };
      }
      if (!best) { const x = C.x - 5.5, z = C.z + 6.5; best = { x, z, yaw: Math.atan2(C.x - x, C.z - z) }; }
      makeBoard('perdida', G.Arch.islands[0], best.x, best.z, best.yaw);
    }
    dirty = true;
  };

  // Hoja que miras (raycast contra las hojas de los tablones cercanos)
  const _rc = new THREE.Raycaster();
  Q.findTarget = function (o, d) {
    const P = G.Player.pos, objs = [];
    for (const b of boards) if (Math.abs(b.x - P.x) < 9 && Math.abs(b.z - P.z) < 9) for (const m of [...b.papers, b.poster]) if (m.visible) objs.push(m);
    if (!objs.length) return null;
    _rc.set(o, d); _rc.far = 4.2;
    const h = _rc.intersectObjects(objs, false)[0];
    if (!h) return null;
    const b = boards.find((x) => x.papers.includes(h.object) || x.poster === h.object);
    return { kind: 'qpaper', b, i: h.object === b.poster ? 0 : b.papers.indexOf(h.object), t: h.distance };
  };

  // ------------------------------------------------------------------ fotograma
  let dirty = true, checkT = 0, drawT = 0;
  Q.update = function (dt) {
    if (!G.state.world) return;
    const P = G.Player.pos, tg = G.Game.target;
    // Resalta la hoja a la que apuntas
    for (const b of boards) {
      const all = [...b.papers, b.poster];
      for (const m of all) {
        const on = tg && tg.kind === 'qpaper' && tg.b === b && ((m === b.poster && tg.i === 0 && b.poster.visible) || b.papers[tg.i] === m);
        m.material.emissiveIntensity = U.lerp(m.material.emissiveIntensity, on ? 0.45 : 0.1, Math.min(1, dt * 12));
        const sc = U.lerp(m.scale.x, on ? 1.05 : 1, Math.min(1, dt * 12)); m.scale.set(sc, sc, 1);
      }
    }
    if ((checkT -= dt) <= 0) {
      checkT = 1;
      // Visitas y jefes ya derrotados (también si lo derrotó un compañero)
      const z = G.Arch.zoneOf(P.x, P.z);
      for (const q of allActive()) {
        if (q.kind === 'visit' && z && z.id === q.isl) progress(q, 1);
        else if (q.kind === 'boss' && bossDone(q)) complete(q);
      }
      // Tablones: al acercarte por primera vez se llenan; con las 3 cumplidas, salen 3 nuevas
      for (const b of boards) {
        const s = bst(b.v), near = Math.hypot(b.x - P.x, b.z - P.z) < 16;
        if (!s.slots.length) { refill(b.v); dirty = true; continue; }
        if (!s.slots.every((q) => q.st === 'done') || (s.fin && s.idx >= TOTAL && s.slots[0] && s.slots[0].boss)) { s.wait = 0; continue; }
        if (!near) continue;
        if ((s.wait += 1) >= 3 && refill(b.v)) {
          s.wait = 0; dirty = true;
          G.Audio.play('select');
          G.UI.msg(s.fin && s.slots[0].boss ? `⚔️ Misión final en el tablón: <b>${esc(s.slots[0].text)}</b>` : '📋 ¡Nuevos encargos en el tablón!', 'good', 'questnew');
        }
      }
      hud();
    }
    // Redibuja las hojas cuyo contenido ha cambiado (las entregas cambian con lo que llevas)
    if ((drawT -= dt) <= 0 || dirty) {
      drawT = 0.5; dirty = false;
      for (const b of boards) {
        if (Math.hypot(b.x - P.x, b.z - P.z) > 60) continue;
        const s = bst(b.v), fin = s.slots.length === 1 && s.slots[0].boss;
        b.poster.visible = !!fin;
        b.papers.forEach((m, i) => (m.visible = !fin && !!s.slots[i]));
        const list = fin ? [[b.poster, s.slots[0]]] : b.papers.map((m, i) => [m, s.slots[i]]);
        for (const [m, q] of list) {
          if (!q || !m.visible) continue;
          const sig = [q.key, q.st, q.got, q.kind === 'bring' && q.st === 'active' ? Math.min(G.Inv.count(q.item), q.n) : ''].join('|');
          if (sig === m.userData.sig) continue;
          m.userData.sig = sig;
          drawPaper(m.userData.cv.getContext('2d'), q);
          m.userData.tex.needsUpdate = true;
        }
      }
    }
  };

  // ------------------------------------------------------------------ encargos activos en pantalla
  function hud() {
    let el = document.getElementById('questHud');
    if (!el) { el = document.createElement('div'); el.id = 'questHud'; const o = document.getElementById('objective'); if (!o) return; o.appendChild(el); }
    const list = G.state && G.state.world ? allActive() : [];
    el.innerHTML = list.map((q) => { const have = q.kind === 'bring' ? Math.min(G.Inv.count(q.item), q.n) : q.got; return `<div>📋 ${q.item ? G.icon(q.item, 'xs') + ' ' : ''}${esc(q.text)} <b>${have}/${q.n}</b></div>`; }).join('');
    el.classList.toggle('hidden', !el.innerHTML);
  }
  Q.hud = hud;
})();
