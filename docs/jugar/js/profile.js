// Perfil del jugador (común a todas las partidas): nombre, aspecto, doblones, cosméticos de la tienda,
// logros conseguidos, contadores de por vida y ajustes (sensibilidad, campo de visión, volumen…).
// Se guarda en el navegador (localStorage); la app de escritorio y el navegador tienen perfiles distintos.
(function () {
  'use strict';
  const G = window.G;
  const KEY = 'isla_profile_v1';
  const Profile = (G.Profile = {});

  Profile.SKINS = ['#f3d2b4', '#e6b48e', '#c68d67', '#a8704a', '#7e4d30', '#553421'];
  Profile.SHIRTS = ['#e6dfcc', '#f4f4f0', '#e05a4f', '#a01e1e', '#f08a3c', '#e8b83c', '#5fc46a', '#2e7a4a', '#3cc4b8', '#4f9de0', '#2a4a8a', '#b36ee0', '#d86aa0', '#8a5a3a', '#6a6a6a', '#2a2a2e'];
  Profile.PANTS = ['#3b5270', '#2a2a2e', '#5a4632', '#6a4a2a', '#4a5a3a', '#8a8070', '#c8b890', '#7a2a2a', '#2a3a6a', '#e6dfcc'];
  Profile.DEFAULT_SET = { sens: 1, invY: false, fov: 70, vol: 80, sfx: 100, amb: 100, voz: 100, subs: true, fps: true, touch: 'auto' };

  function fresh() {
    let name = 'Náufrago' + Math.floor(Math.random() * 90 + 10), shirt = '#e6dfcc';
    try { name = localStorage.getItem('isla_mp_name') || name; shirt = localStorage.getItem('isla_mp_color') || shirt; } catch (e) { /* sin almacenamiento */ }
    return { v: 1, name, look: { skin: '#c68d67', shirt, pants: '#3b5270' }, coins: 0, earned: 0, owned: [], cos: {}, ach: {}, cnt: {}, set: Object.assign({}, Profile.DEFAULT_SET) };
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* nada */ }
    const f = fresh();
    if (!d || d.v !== 1) return f;
    d.look = Object.assign(f.look, d.look);
    d.set = Object.assign(f.set, d.set);
    for (const k of ['owned']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['cos', 'ach', 'cnt']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    d.coins = Math.max(0, d.coins | 0);
    return d;
  }
  const D = (Profile.data = load());

  let saveT = null;
  Profile.save = function (now) {
    clearTimeout(saveT);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* sin almacenamiento */ } };
    if (now) write(); else saveT = setTimeout(write, 400);
  };
  window.addEventListener('beforeunload', () => Profile.save(true));

  // ------------------------------------------------------------------ nombre y aspecto
  Profile.name = () => D.name;
  Profile.setName = (n) => { D.name = String(n || '').trim().slice(0, 14) || 'Náufrago'; Profile.save(); };
  Profile.look = () => D.look;
  Profile.setLook = (k, v) => { D.look[k] = v; Profile.save(); };
  // Colores del personaje en números (para Character.create)
  Profile.lookHex = (look) => {
    const l = look || D.look, h = (c) => new THREE.Color(c).getHex();
    return { shirt: h(l.shirt), skin: h(l.skin), pants: h(l.pants) };
  };
  Profile.set = (k) => (D.set[k] !== undefined ? D.set[k] : Profile.DEFAULT_SET[k]);
  Profile.setSetting = (k, v) => { D.set[k] = v; Profile.save(); if (Profile.onSettings) Profile.onSettings(k, v); };

  // ------------------------------------------------------------------ doblones
  // Los doblones se ganan jugando y con logros (no en partidas con trucos)
  Profile.coins = () => D.coins;
  Profile.addCoins = function (n, reason, quiet) {
    if (!n || n <= 0) return 0;
    if (G.Cheats && G.Cheats.enabled()) return 0;
    D.coins += n; D.earned = (D.earned || 0) + n;
    Profile.save();
    if (!quiet && G.UI && G.UI.coin) G.UI.coin(n, reason);
    if (Profile.onCoins) Profile.onCoins();
    return n;
  };
  Profile.spend = function (n) {
    if (D.coins < n) return false;
    D.coins -= n;
    Profile.save();
    if (Profile.onCoins) Profile.onCoins();
    return true;
  };

  // ------------------------------------------------------------------ cosméticos
  Profile.owns = (id) => D.owned.includes(id);
  Profile.grant = (id) => { if (!Profile.owns(id)) { D.owned.push(id); Profile.save(); } };
  Profile.equipped = (slot) => D.cos[slot] || null;
  Profile.equip = (slot, id) => { if (id && !Profile.owns(id)) return; D.cos[slot] = id || null; Profile.save(); if (Profile.onLook) Profile.onLook(); };
  // Bandera dibujada en la pizarra: img (pequeña, para los barcos) y src (grande, para seguir editándola)
  Profile.customFlag = () => (D.flag && D.flag.img) || null;
  Profile.customFlagSrc = () => (D.flag && D.flag.src) || null;
  Profile.setCustomFlag = function (img, src) {
    D.flag = { img, src };
    if (!Profile.owns('flag_custom')) D.owned.push('flag_custom');
    Profile.save(true);
    if (Profile.onLook) Profile.onLook();
  };
  // Cosméticos del personaje que se ven sobre el modelo (sombrero, rostro, espalda, mascota)
  Profile.cosIds = () => ['hat', 'face', 'back', 'pet'].map((s) => D.cos[s]).filter(Boolean);

  // ------------------------------------------------------------------ logros y contadores de por vida
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  Profile.cnt = (k) => (own(D.cnt, k) ? D.cnt[k] : 0);
  Profile.hasAch = (id) => own(D.ach, id) && !!D.ach[id];
})();
