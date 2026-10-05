// Duelos entre amigos (LAN, partida amistosa): mira a otro jugador y pulsa E para retarle; si acepta (E sobre ti),
// hay una cuenta atrás de 3 s y a pelear con todo el sistema de combate (combat.js, parry.js). Nadie muere: quien
// se queda sin vida pierde, y los dos recuperan la salud. Se cancela si os alejáis más de 60 m o uno se va.
(function () {
  'use strict';
  const G = window.G;
  const Du = (G.Duel = { st: null, req: {}, sent: null, wins: 0 });
  const now = () => performance.now() / 1000;
  const $ = (id) => document.getElementById(id);

  Du.available = () => !!(G.Net.active && G.state && G.state.world && !(G.Modes && G.Modes.active) && G.state.gm !== 'versus');
  Du.with = (id) => !!(Du.st && Du.st.with === id && Du.st.phase === 'fight');
  const nameOf = (id) => G.Net.esc(G.Net.nameOf(id));

  // Texto del aviso al mirar a otro jugador
  Du.promptFor = function (p) {
    if (Du.st && Du.st.with === p.id) return '⚔️ En duelo';
    if (Du.st) return '';
    if (Du.req[p.id] > now()) return '<kbd>E</kbd> ⚔️ Aceptar el duelo';
    if (Du.sent && Du.sent.to === p.id && Du.sent.until > now()) return '⚔️ Reto enviado…';
    return '<kbd>E</kbd> ⚔️ Retar a duelo';
  };
  // E sobre otro jugador: retarle o aceptar su reto
  Du.interact = function (p) {
    if (Du.st) { G.UI.msg('Ya estás en un duelo.', 'info', 'duel'); return; }
    if (p.dead || G.Player.dead) return;
    if (Du.req[p.id] > now()) {
      delete Du.req[p.id];
      G.Net.send({ t: 'duelAcc', to: p.id });
      start(p.id);
      return;
    }
    if (Du.sent && Du.sent.to === p.id && Du.sent.until > now()) return;
    Du.sent = { to: p.id, until: now() + 20 };
    G.Net.send({ t: 'duelReq', to: p.id });
    G.UI.msg(`⚔️ Has retado a <b>${nameOf(p.id)}</b> a un duelo. Si acepta, empezará la cuenta atrás.`, 'info', 'duel');
    G.Audio.play('select');
  };

  function start(id) {
    Du.sent = null;
    Du.st = { with: id, phase: 'count', t: 3.2, shown: 4 };
    const P = G.Player;
    P.stats.health = 100; P.stats.stamina = 100;
    G.Audio.play('bell');
    hud(true);
  }
  function finish(won, text) {
    const st = Du.st;
    if (!st) return;
    Du.st = null;
    hud(false);
    const P = G.Player;
    P.stats.health = 100; P.stats.stamina = 100;
    if (G.Combat.lock && G.Combat.lock.kind === 'p') G.Combat.toggleLock();
    if (text) { G.UI.msg(text, 'info', 'duel'); return; }
    if (won) { Du.wins++; G.UI.banner('🏆 ¡Victoria!', `Ganaste el duelo contra ${nameOf(st.with)}`); G.Audio.play('win'); }
    else { G.UI.banner('⚔️ Derrota', `${nameOf(st.with)} ganó el duelo. ¡La revancha espera!`); G.Audio.play('death'); }
  }
  // Te quedaste sin vida por un golpe de tu rival (player.js)
  Du.lost = function (by) {
    if (!Du.st || Du.st.with !== by) return;
    G.Net.send({ t: 'duelEnd', to: by, win: by });
    finish(false);
  };
  function cancel(text, notify) {
    if (!Du.st) return;
    if (notify) G.Net.send({ t: 'duelNo', to: Du.st.with });
    finish(false, text);
  }

  // ------------------------------------------------------------------ red
  Du.onNet = function (m, from) {
    if (m.to !== G.Net.myId) return;
    if (m.t === 'duelReq') {
      if (Du.st) return;
      Du.req[from] = now() + 20;
      G.UI.banner('⚔️ ¡Reto a duelo!', `${nameOf(from)} te reta · mírale y pulsa <kbd>E</kbd> para aceptar`);
      G.Audio.play('bell');
    } else if (m.t === 'duelAcc') {
      if (Du.sent && Du.sent.to === from && !Du.st) start(from);
    } else if (m.t === 'duelEnd') {
      if (Du.st && Du.st.with === from) finish(m.win === G.Net.myId);
    } else if (m.t === 'duelNo') {
      if (Du.st && Du.st.with === from) finish(false, `⚔️ El duelo con ${nameOf(from)} se ha cancelado.`);
    }
  };

  // ------------------------------------------------------------------ marcador y cuenta atrás
  function hud(on) {
    let el = $('duelHud');
    if (!el) { el = document.createElement('div'); el.id = 'duelHud'; el.className = 'hidden'; (document.getElementById('hud') || document.body).appendChild(el); }
    el.classList.toggle('hidden', !on);
  }
  Du.update = function (dt) {
    const st = Du.st;
    if (!st) return;
    const p = G.Net.peers.get(st.with), P = G.Player;
    if (!G.Net.active || !p || p.out) { cancel('⚔️ Tu rival se ha ido: duelo cancelado.'); return; }
    if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 60) { cancel('⚔️ Os habéis alejado demasiado: duelo cancelado.', true); return; }
    if (P.dead) { cancel('⚔️ Duelo cancelado.', true); return; }
    if (st.phase === 'count') {
      st.t -= dt;
      const n = Math.ceil(st.t);
      if (n !== st.shown && n > 0) { st.shown = n; G.UI.banner(`⚔️ ${n}`, `Duelo contra ${nameOf(st.with)}`); G.Audio.play('select'); }
      if (st.t <= 0) { st.phase = 'fight'; G.UI.banner('⚔️ ¡A luchar!', `Duelo contra ${nameOf(st.with)} · <kbd>T</kbd> para fijarle`); G.Audio.play('bell'); }
    }
    const el = $('duelHud');
    if (el) {
      const hp = Math.max(0, Math.min(100, p.hp ?? 100)), me = Math.max(0, Math.min(100, P.stats.health));
      el.innerHTML = `<div class="dh-side me"><b>${G.Net.esc(G.Net.name)}</b><i style="width:${me}%"></i></div><span>⚔️</span><div class="dh-side foe"><b>${nameOf(st.with)}</b><i style="width:${hp}%"></i></div>`;
    }
  };
  Du.clear = function () { Du.st = null; Du.req = {}; Du.sent = null; hud(false); };
})();
