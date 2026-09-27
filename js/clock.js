// Relojes del archipiélago: cada isla principal tiene su propio día y hora.
// En el mar cada jugador lleva su "reloj personal"; al acercarse a una isla con otra hora,
// una niebla marina espesa oculta el cielo mientras el reloj se ajusta al de la isla.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Clock = (G.Clock = { zone: null, mist: 0 });
  const circ = (a, b) => { let d = b - a; if (d > 0.5) d -= 1; else if (d < -0.5) d += 1; return d; }; // diferencia horaria (fracción de día)

  // Estado guardado en G.state.clocks = { [idIsla]: { t, day } }, G.state.pt / G.state.pday = reloj personal en el mar
  Clock.init = function (seed, t0) {
    const st = G.state, rnd = U.rng((seed || 1) + 77);
    st.clocks = {};
    for (const s of G.Arch.islands) if (s.main) st.clocks[s.id] = { t: s.id === 0 ? t0 : (t0 + 0.2 + rnd() * 0.6) % 1, day: 1 };
    st.pt = t0; st.pday = 1;
    Clock.zone = null;
  };
  Clock.ensure = function () {
    const st = G.state;
    if (!st.clocks) Clock.init(G.Arch.seed, st.t || 0.3);
    for (const s of G.Arch.islands) if (s.main && !st.clocks[s.id]) st.clocks[s.id] = { t: st.clocks[0] ? st.clocks[0].t : 0.3, day: st.day || 1 };
    if (st.pt === undefined) { st.pt = st.t || 0.3; st.pday = st.day || 1; }
  };
  const clk = (id) => (G.state.clocks ? G.state.clocks[id] : null);
  Clock.of = clk;
  Clock.dayOf = (id) => { const c = clk(id); return c ? c.day : G.state.day; };
  Clock.hourOf = (id) => { const c = clk(id); return (c ? c.t : G.state.t) * 24; };
  Clock.nightAt = (id) => { const h = Clock.hourOf(id); return h >= 20 || h < 5.5; };
  Clock.islandOf = (x, z) => { const s = G.Arch.zoneOf(x, z); return s ? s.id : -1; };
  // Velocidad del tiempo (fracción de día por segundo real): un día completo dura 10 minutos,
  // de los que la noche (20:00 a 5:30) dura solo 3 y el día 7
  const DAY_S = 420, NIGHT_S = 180, NIGHT_H = 9.5;
  Clock.rate = (t) => { const h = t * 24; return h >= 20 || h < 5.5 ? NIGHT_H / 24 / NIGHT_S : (24 - NIGHT_H) / 24 / DAY_S; };

  // Avance de los relojes de todas las islas (solo quien tiene la autoridad cambia de día)
  Clock.tick = function (dt) {
    const st = G.state;
    for (const id in st.clocks) {
      const c = st.clocks[id];
      c.t += dt * Clock.rate(c.t);
      if (c.t >= 1) {
        c.t -= 1;
        if (G.Net.authority()) { c.day++; G.Game.onNewDay(+id); }
        else c.t = 0.9999; // espera a que el anfitrión anuncie el día nuevo
      }
    }
  };

  // Hora que ve el jugador local: la de su isla, la de su reloj personal en el mar o una mezcla oculta por la niebla
  Clock.updateLocal = function (dt) {
    const st = G.state, P = G.Player.pos;
    const prevDay = st.day;
    st.pt += dt * Clock.rate(st.pt);
    if (st.pt >= 1) { st.pt -= 1; st.pday++; }
    const z = G.Arch.zoneOf(P.x, P.z);
    let t = st.pt, day = st.pday, mist = 0;
    if (z && clk(z.id)) {
      const c = clk(z.id), d = Math.hypot(P.x - z.x, P.z - z.z);
      const inner = z.r * 1.12, k = U.smooth(z.zoneR, inner, d);
      if (k >= 0.999) { st.pt = c.t; st.pday = c.day; t = c.t; day = c.day; }
      else {
        const diff = circ(st.pt, c.t), need = U.smooth(0.012, 0.04, Math.abs(diff));
        const s = U.smooth(0.42, 0.58, k);
        t = (st.pt + diff * s + 1) % 1;
        day = s > 0.5 ? c.day : st.pday;
        mist = need * U.smooth(0.12, 0.32, k) * U.smooth(0.9, 0.68, k);
      }
      Clock.zone = z.id;
    } else Clock.zone = -1;
    Clock.mist += (mist - Clock.mist) * Math.min(1, dt * 4);
    G.World.mist = Clock.mist;
    st.t = t; st.day = day;
    if (day > prevDay && G.state.mode !== 'menu' && prevDay > 0) G.Game.dayBanner();
  };

  // Dormir: salta la noche de una isla (o el reloj personal si duermes en un barco)
  Clock.skipNight = function (islId) {
    const c = clk(islId);
    if (!c) return false;
    const newDay = c.t * 24 >= 19;
    c.t = 6.5 / 24;
    if (newDay) c.day++;
    return newDay;
  };
  Clock.skipPersonal = function () {
    const st = G.state;
    const newDay = st.pt * 24 >= 19;
    st.pt = 6.5 / 24;
    if (newDay) st.pday++;
    return newDay;
  };

  // Red: el anfitrión envía todos los relojes; los invitados corrigen la deriva
  Clock.pack = () => { const o = {}; for (const id in G.state.clocks) { const c = G.state.clocks[id]; o[id] = [Math.round(c.t * 1e5) / 1e5, c.day]; } return o; };
  Clock.apply = function (o) {
    if (!o) return;
    const st = G.state;
    if (!st.clocks) st.clocks = {};
    for (const id in o) {
      const [t, day] = o[id];
      const c = st.clocks[id] || (st.clocks[id] = { t, day });
      if (Math.abs(circ(c.t, t)) > 0.003 || day !== c.day) c.t = t;
      c.day = day;
    }
  };
})();
