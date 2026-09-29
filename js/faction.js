// Bandos: Piratas o Marina Blanca. Cada jugador elige el suyo al empezar (también en LAN) y se guarda con su partida.
//  - Pirata: la Marina Blanca te persigue y tu cartel de «Se busca» sube. Las aguas del archipiélago están
//    repartidas entre hermandades piratas: unas son aliadas (no te atacan y pelean contra la Marina) y otras
//    enemigas; el juego te avisa al cruzar de unas aguas a otras. Botín pirata: +30 % de doblones.
//  - Marine: los barcos de la Marina Blanca son tus aliados (te saludan y pelean contra los piratas) y todos
//    los piratas son enemigos. Ganas méritos, subes de rango y cada día cobras tu paga.
// En el modo versus no hay bandos (cada equipo es su propia tripulación).
(function () {
  'use strict';
  const G = window.G;
  const F = (G.Faction = {});
  const $ = (id) => document.getElementById(id);

  F.SIDES = {
    pirata: { name: 'Pirata', long: 'los piratas', icon: '🏴‍☠️', color: '#e8705f' },
    marina: { name: 'Marina Blanca', long: 'la Marina Blanca', icon: '⚓', color: '#6fb4ff' },
  };
  // Hermandades piratas: cada una manda en las aguas de unas islas (la más cercana decide la zona)
  F.CREWS = [
    { key: 'hiena', name: 'Piratas de la Hiena', the: 'los Piratas de la Hiena', short: 'la Hiena', of: 'de la Hiena', ally: false, isl: ['perdida'], sail: 0x3a1c1c, flag: 'espadas', flagColor: '#c0392b', shirts: ['#5a1a1a', '#2a2a2e', '#7a2a2a'] },
    { key: 'gaviota', name: 'Hermandad de la Gaviota', the: 'la Hermandad de la Gaviota', short: 'la Gaviota', of: 'de la Gaviota', ally: true, isl: ['tahuri', 'islote'], sail: 0xe8dcc0, flag: 'ancla', flagColor: '#f2b544', shirts: ['#e6dfcc', '#3a4a6a', '#6a5a3a'] },
    { key: 'lobos', name: 'Lobos del Norte', the: 'los Lobos del Norte', short: 'los Lobos del Norte', of: 'de los Lobos del Norte', ally: true, isl: ['escarcha'], sail: 0x8c9aa6, flag: 'tricornio', flagColor: '#9fd3ff', shirts: ['#4a5a6a', '#6a7a8a', '#2a3440'] },
    { key: 'kraken', name: 'Flota del Kraken Rojo', the: 'la Flota del Kraken Rojo', short: 'el Kraken Rojo', of: 'del Kraken Rojo', ally: false, isl: ['brasa'], sail: 0x6a1410, flag: 'llamas', flagColor: '#ff6a3c', shirts: ['#7a1a14', '#3a1a14', '#8a3a1a'] },
    { key: 'calavera', name: 'Hermandad de la Calavera', the: 'la Hermandad de la Calavera', short: 'la Calavera', of: 'de la Calavera', ally: false, isl: ['ruinas'], sail: 0x1e1e20, flag: 'clasica', flagColor: '#e0e0e0', shirts: ['#1e1e20', '#3a3a3e', '#4a3a2a'] },
    { key: 'perlas', name: 'Corsarios de las Perlas', the: 'los Corsarios de las Perlas', short: 'los Corsarios de las Perlas', of: 'de los Corsarios de las Perlas', ally: true, isl: ['arrecife'], sail: 0x2a6a6a, flag: 'corona', flagColor: '#7fe0d0', shirts: ['#2a6a6a', '#e6dfcc', '#3a5a7a'] },
  ];
  F.crew = (k) => F.CREWS.find((c) => c.key === k) || F.CREWS[4];
  F.crewIdx = (k) => Math.max(0, F.CREWS.findIndex((c) => c.key === k));

  // ------------------------------------------------------------------ estado
  const fac = () => (G.state && G.state.fac) || null;
  F.active = () => !!(G.state && G.state.world && G.state.gm !== 'versus' && !(G.Modes && G.Modes.active));
  F.chosen = () => !!(fac() && fac().side);
  // Hasta elegir (y en partidas de versiones anteriores) se juega como pirata, como siempre
  F.side = () => (F.active() && fac() && fac().side) || 'pirata';
  F.isMarine = () => F.side() === 'marina';
  // Bando de un objetivo de creatures.js / navy.js (jugador local o de la LAN)
  F.sideOf = function (t) {
    if (!t || t.local || t.id === G.Net.myId) return F.side();
    const p = G.Net.peers.get(t.id);
    return (p && p.fc) || 'pirata';
  };
  // Zona pirata en (x, z): la hermandad de la isla más cercana
  F.zoneAt = function (x, z) {
    const n = G.Arch.nearest(x, z);
    const type = n && n.isl ? n.isl.type : 'ruinas';
    return F.CREWS.find((c) => c.isl.includes(type)) || F.crew('calavera');
  };
  // ¿Esta hermandad es enemiga de este bando?
  F.crewHostile = (crewKey, side) => side === 'marina' || !F.crew(crewKey).ally;

  // ------------------------------------------------------------------ quién ataca a quién en el mar
  // Barco controlado por navy.js (Marina, pirata o el Holandés) contra un jugador
  F.shipHostile = function (s, t) {
    const nv = s && s.navy;
    if (!nv) return false;
    if (nv.ghost) return true;
    if (nv.angry && nv.angry[t.id]) return true;
    const side = F.sideOf(t);
    if (nv.pirate) return F.crewHostile(nv.crew, side);
    return side !== 'marina';
  };
  // Barcos que pelean entre sí: la Marina contra los piratas (el Holandés va a lo suyo)
  F.shipsEnemies = (a, b) => !!(a.navy && b.navy && !a.navy.ghost && !b.navy.ghost && !!a.navy.pirate !== !!b.navy.pirate);
  // Tripulante de la cubierta de un barco aliado tuyo (no se le puede atacar sin querer)
  const _me = { local: true };
  F.friendly = function (c) {
    if (!c || !c.deck) return false;
    const s = G.Ships.byId(c.deck.ship);
    return !!(s && s.navy && !F.shipHostile(s, _me));
  };
  // Botín pirata: más doblones
  F.coinMul = () => (F.active() && F.side() === 'pirata' && F.chosen() ? 1.3 : 1);
  F.bonusLoot = (id, n) => (id === 'doblon' ? Math.ceil(n * F.coinMul()) : n);

  // ------------------------------------------------------------------ elegir bando
  const CARDS = {
    pirata: {
      intro: 'Eres el grumete de la <b>Gaviota Errante</b>, la tripulación de la capitana Mara.',
      pts: ['⚓ La <b>Marina Blanca</b> te persigue por mar, y tu cartel de <b>Se busca</b> sube con cada hazaña.',
        '🏴‍☠️ Las aguas están repartidas entre <b>hermandades piratas</b>: unas son aliadas (pelean a tu lado contra la Marina) y otras enemigas. Te avisamos al cruzarlas.',
        '💰 <b>Botín pirata</b>: +30 % de doblones de los enemigos y los tesoros.',
        '⛵ Aborda y captura barcos de la Marina y de los piratas enemigos.'],
      btn: 'Navegar como pirata',
    },
    marina: {
      intro: 'Eres un cadete de la <b>Marina Blanca</b> infiltrado en la Gaviota Errante. Tu propia flota hundió el barco sin saber que ibas a bordo… y los piratas de Mara creen que eres uno de ellos.',
      pts: ['⚓ Los barcos de la <b>Marina Blanca</b> son tus aliados: te saludan y pelean contra los piratas.',
        '☠️ <b>Todos los piratas</b> del mar son tus enemigos: sus barcos te darán caza.',
        '🎖️ Ganas <b>méritos</b> y subes de rango: de Recluta a Almirante.',
        '🪙 Cada día cobras tu <b>paga</b>, mayor cuanto más alto es tu rango.'],
      btn: 'Servir a la Marina',
    },
  };
  function buildWin() {
    if ($('factionWin')) return;
    const el = document.createElement('div');
    el.id = 'factionWin';
    el.className = 'fe-overlay hidden';
    const card = (k) => {
      const S = F.SIDES[k], C = CARDS[k];
      return `<div class="fac-card fac-${k}"><div class="fac-ic">${S.icon}</div><h3>${S.name === 'Pirata' ? 'Piratas' : S.name}</h3><p class="fac-intro">${C.intro}</p>
        <ul>${C.pts.map((p) => `<li>${p}</li>`).join('')}</ul><button class="btn primary" data-side="${k}">${C.btn}</button></div>`;
    };
    el.innerHTML = `<div class="fac-box"><h2>¿A qué bando perteneces?</h2><p class="muted">Cada jugador elige el suyo (en LAN podéis ser de bandos distintos). Elige bien: es para toda la partida.</p>
      <div class="fac-cards">${card('pirata')}${card('marina')}</div></div>`;
    document.body.appendChild(el);
    el.querySelectorAll('button[data-side]').forEach((b) => (b.onclick = () => F.choose(b.dataset.side)));
  }
  F.open = function () {
    if (G.state.mode !== 'playing') return;
    buildWin();
    G.state.mode = 'faction';
    G.Main.releasePointer();
    $('factionWin').classList.remove('hidden');
  };
  F.choose = function (side) {
    if (!F.SIDES[side]) return;
    G.state.fac = { side, payDay: G.state.day, zone: null };
    if ($('factionWin')) $('factionWin').classList.add('hidden');
    if (G.state.mode === 'faction') { G.state.mode = 'playing'; G.Main.lockPointer(); }
    G.Audio.init(); G.Audio.play('win');
    if (side === 'marina') G.UI.banner('⚓ Marina Blanca', 'Cadete infiltrado · Los barcos de la Marina son tus aliados y todos los piratas, tus enemigos');
    else G.UI.banner('🏴‍☠️ Pirata', 'La Marina te persigue · Atento a las aguas de cada hermandad: unas son aliadas y otras enemigas');
    setTimeout(() => G.UI.msg('⚔️ <b>Combate</b> (con un arma o las manos vacías): <kbd>Clic</kbd> combo · <kbd>Clic derecho</kbd> golpe pesado · <kbd>F</kbd> parar (mantener: bloquear) · <kbd>Q</kbd> esquivar · <kbd>T</kbd> fijar enemigo · <kbd>Z</kbd>/<kbd>R</kbd> técnica y definitivo.', 'info', 'parryTip'), 5000);
    G.Bounty.refresh();
    zoneT = 4;
  };

  // ------------------------------------------------------------------ fotograma: elegir, paga y avisos de zona
  let askT = 1.5, zoneT = 4, lastWorld = null;
  F.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; askT = 1.5; zoneT = 4; }
    if (!F.active()) return;
    const f = fac();
    if (!F.chosen()) {
      // Se pregunta en cuanto el jugador toma el control (tras la escena inicial y sin diálogos abiertos)
      if (G.state.mode === 'playing' && !(G.Cinema && G.Cinema.active) && !G.Story.dialog && !G.Player.dead && (askT -= dt) <= 0) F.open();
      return;
    }
    // Paga diaria de la Marina
    if (f.side === 'marina' && G.state.day > (f.payDay || 0)) {
      const days = Math.min(3, G.state.day - (f.payDay || G.state.day));
      f.payDay = G.state.day;
      const pay = (10 + G.Bounty.rankIdx() * 8) * Math.max(1, days);
      G.Profile.addCoins(pay, `Paga de la Marina (${G.Bounty.title()})`);
      G.UI.msg(`⚓ Paga de la Marina Blanca: 🪙 +${pay} (${G.Bounty.title()})`, 'good', 'pay');
    }
    // Aviso al cruzar de las aguas de una hermandad a las de otra
    if ((zoneT -= dt) > 0) return;
    zoneT = 1;
    const P = G.Player;
    if (P.dead) return;
    const z = F.zoneAt(P.pos.x, P.pos.z);
    if (f.zone === z.key) return;
    const first = !f.zone;
    f.zone = z.key;
    if (f.side === 'marina') {
      if (!first) G.UI.msg(`☠️ Aguas de <b>${z.the}</b>: territorio pirata. Sus barcos te atacarán.`, 'warn', 'zone');
    } else if (z.ally) G.UI.banner(`🏴‍☠️ Aguas de ${z.the}`, 'Piratas aliados: no te atacarán y pelearán contigo contra la Marina');
    else G.UI.banner(`☠️ Aguas de ${z.the}`, 'Piratas enemigos: si ves sus velas, prepara los cañones');
  };
  // Texto de la zona para el reloj del HUD (en el mar)
  F.seaLabel = function (x, z) {
    if (!F.active() || !F.chosen()) return '🌊 Alta mar';
    const c = F.zoneAt(x, z);
    return `🌊 Aguas ${c.of} ${F.crewHostile(c.key, F.side()) ? '☠️' : '🤝'}`;
  };
  F.badge = () => (F.active() && F.chosen() ? F.SIDES[F.side()].icon : '');
})();
