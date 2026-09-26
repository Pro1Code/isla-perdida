// Guardado en el navegador (localStorage). Solo el modo amistoso (y la partida individual) se guarda;
// las partidas versus duran una sesión.
//  - sp:     partida individual (mundo + jugador)
//  - host:   partida LAN amistosa del anfitrión (mundo + jugador)
//  - client: en LAN, cada invitado guarda solo su jugador e inventario
(function () {
  'use strict';
  const G = window.G;
  const Save = (G.Save = { mode: 'sp' });
  let key = 'isla_perdida_save_v1';

  Save.setMode = (mode, suffix) => {
    Save.mode = mode;
    key = mode === 'sp' ? 'isla_perdida_save_v1' : mode === 'host' ? 'isla_perdida_mp_v1' : 'isla_perdida_mpc_v1_' + suffix;
  };
  Save.has = () => { try { return !!localStorage.getItem(key); } catch (e) { return false; } };
  Save.clear = () => { try { localStorage.removeItem(key); } catch (e) { /* sin almacenamiento */ } };
  Save.load = () => {
    try { const d = JSON.parse(localStorage.getItem(key)); return d && (d.v === 1 || d.v === 2) ? d : null; } catch (e) { return null; }
  };
  Save.save = function () {
    const st = G.state;
    if (!['playing', 'inventory', 'map', 'paused', 'sleeping', 'dead', 'journal'].includes(st.mode)) return false;
    if (st.gm === 'versus') return false;
    const P = G.Player;
    const player = { x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, pitch: P.pitch, stats: Object.assign({}, P.stats), sick: P.sick, poison: P.poison, wet: P.wet, cam: P.cam, dead: P.dead,
      ship: P.ship ? P.ship.id : null, local: P.ship ? [P.local.x, P.local.y, P.local.z] : null };
    let data;
    if (Save.mode === 'client') {
      data = { v: 2, client: true, seed: st.seed, p: player, inv: G.Inv.slots, eq: G.Inv.equip, sel: G.Inv.sel, flags: st.flags, stats: st.stats, obj: st.obj, spawn: st.spawn, fruit: st.fruit };
    } else {
      data = {
        v: 2,
        st: { day: st.day, t: st.t, diff: st.diff, spawn: st.spawn, flags: st.flags, stats: st.stats, obj: st.obj, world: st.world, weather: [G.Weather.type, Math.round(G.Weather.timer)],
          seed: st.seed, cfg: st.cfg, clocks: st.clocks, pt: st.pt, pday: st.pday, fruit: st.fruit },
        p: player, inv: G.Inv.slots, eq: G.Inv.equip, sel: G.Inv.sel, b: G.Build.getState(), r: G.Res.getState(), ships: G.Ships.getState(), drops: G.Landmarks.getDrops(),
      };
    }
    try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; }
  };
})();
