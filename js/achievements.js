// Logros: 100 en total (40 comunes, 20 especiales, 20 raros, 15 épicos y 5 legendarios).
// Se guardan en el perfil (valen para todas las partidas) y dan doblones para la tienda.
// En las partidas con trucos no se consiguen logros.
//  - Contadores de por vida (perfil): Ach.add('kill:boar'), Ach.add('sail', metros)…
//  - Comprobaciones del estado de la partida (f): se revisan cada segundo mientras juegas
(function () {
  'use strict';
  const G = window.G;
  const Ach = (G.Ach = {});
  const PR = G.Profile;

  Ach.TIERS = {
    c: { name: 'Común', plural: 'Comunes', color: '#c9c3b4', coins: 10 },
    e: { name: 'Especial', plural: 'Especiales', color: '#6fd37a', coins: 25 },
    r: { name: 'Raro', plural: 'Raros', color: '#5aaaf0', coins: 60 },
    p: { name: 'Épico', plural: 'Épicos', color: '#c07cf0', coins: 150 },
    l: { name: 'Legendario', plural: 'Legendarios', color: '#f5b83d', coins: 400 },
  };
  const cnt = (k) => PR.cnt(k);
  const distinct = (prefix, keys) => keys.filter((k) => cnt(prefix + k) > 0).length;
  const st = () => G.state || {};
  const story = () => (st().world && st().world.story) || {};
  const sflag = (k) => !!(story().flags && story().flags[k]);
  const coop = () => st().gm !== 'versus';
  const day = () => (coop() ? st().day || 0 : 0);
  const deaths = () => (st().stats && st().stats.deaths) || 0;
  const wkill = (t) => (st().stats && st().stats.k && st().stats.k[t]) || 0;
  const eqAll = () => G.Inv && G.Inv.SLOTS.every((s) => G.Inv.equip[s]);
  const ISLES = ['perdida', 'tahuri', 'escarcha', 'brasa', 'islote', 'arrecife'];
  const FRUITS = ['llama', 'hielo', 'muelle', 'humo', 'roca'];
  const SHIPS = ['balsa', 'canoa', 'velero', 'lancha', 'barco'];

  // t: rango · i: icono · n: nombre · d: descripción · c/n: contador y meta · f: comprobación
  const A = [
    // ================================================================= COMUNES (40)
    ['primer_palo', 'c', '🪵', 'Primeros pasos', 'Recoge tu primer palo.', 'get:palo', 1],
    ['hacha', 'c', '🪓', 'Leñador novato', 'Fabrica un hacha de piedra.', 'craft:hacha', 1],
    ['madera10', 'c', '🌳', '¡Madera!', 'Consigue 10 de madera.', 'get:madera', 10],
    ['pico', 'c', '⛏️', 'Picapiedra', 'Fabrica un pico de piedra.', 'craft:pico', 1],
    ['fogata', 'c', '🔥', 'Que se haga la luz', 'Coloca una fogata.', 'place:fogata', 1],
    ['asado', 'c', '🍖', 'Asado de náufrago', 'Cocina carne en una fogata.', 'cook:carne_cocida', 1],
    ['hervir', 'c', '💧', 'Agua potable', 'Hierve agua en una fogata.', 'cook:agua_limpia', 1],
    ['techo', 'c', '🏠', 'Techo propio', 'Coloca un techo de paja.', 'place:techo', 1],
    ['dormir', 'c', '🛏️', 'Dulces sueños', 'Duerme en una cama.', 'sleep', 1],
    ['dia2', 'c', '🌅', 'Primer amanecer', 'Llega al día 2 en una partida.', null, 0, () => day() >= 2],
    ['caza1', 'c', '🏹', 'Cazador', 'Caza tu primer animal.', 'kill', 1],
    ['cangrejo', 'c', '🦀', 'Pinzas fuera', 'Caza un cangrejo.', 'kill:crab', 1],
    ['jabali', 'c', '🐗', 'Jabalí a la vista', 'Caza un jabalí.', 'kill:boar', 1],
    ['pez1', 'c', '🐟', 'Pescador', 'Pesca tu primer pez.', 'get:pez_crudo', 1],
    ['cana', 'c', '🎣', 'Caña en mano', 'Fabrica una caña de pescar.', 'craft:cana', 1],
    ['antorcha', 'c', '🔦', 'Luz en la noche', 'Fabrica una antorcha.', 'craft:antorcha', 1],
    ['coco', 'c', '🥥', 'Coco loco', 'Consigue un coco.', 'get:coco', 1],
    ['bayas', 'c', '🫐', 'Bayas silvestres', 'Come bayas.', 'eat:baya', 1],
    ['venda', 'c', '🩹', 'Primeros auxilios', 'Fabrica una venda.', 'craft:venda', 1],
    ['cofre1', 'c', '📦', 'Cazatesoros', 'Abre tu primer cofre, barril o bolsa del mundo.', 'loot', 1],
    ['botella', 'c', '🍾', 'Mensaje en una botella', 'Encuentra y lee una botella a la deriva.', 'loot:bottle', 1],
    ['banco', 'c', '🪚', 'Carpintero', 'Coloca un banco de carpintero.', 'place:banco', 1],
    ['horno', 'c', '🧱', 'Herrero', 'Coloca un horno de piedra.', 'place:horno', 1],
    ['lingote', 'c', '🔩', 'Hierro forjado', 'Funde un lingote de hierro.', 'craft:lingote', 1],
    ['cofre_propio', 'c', '🗃️', 'Guardado seguro', 'Coloca tu propio cofre.', 'place:cofre', 1],
    ['arquitecto', 'c', '🏗️', 'Arquitecto', 'Coloca 15 construcciones.', 'place', 15],
    ['balsa', 'c', '🛟', '¡A la mar!', 'Fabrica una balsa.', 'ship:balsa', 1],
    ['bordo', 'c', '⚓', 'Grumete', 'Súbete a un barco.', 'board', 1],
    ['navega500', 'c', '🌊', 'Navegante', 'Navega 500 metros.', 'sail', 500],
    ['otra_isla', 'c', '🏝️', 'Tierra a la vista', 'Pisa dos islas distintas.', null, 0, () => distinct('visit:', ISLES) >= 2],
    ['bucear', 'c', '🤿', 'Chapuzón', 'Bucea bajo el agua (C o Ctrl).', 'dive', 1],
    ['vestido', 'c', '👕', 'Bien vestido', 'Ponte una prenda de equipo.', 'equip', 1],
    ['sastre', 'c', '🧵', 'Sastre', 'Fabrica 3 prendas de ropa.', 'craftRopa', 3],
    ['cueva', 'c', '🕳️', 'Espeleólogo', 'Entra en una cueva.', 'cave', 1],
    ['dia5', 'c', '📅', 'Superviviente', 'Llega al día 5 en una partida.', null, 0, () => day() >= 5],
    ['comer25', 'c', '🍽️', 'Buen provecho', 'Come o bebe 25 veces.', 'eat', 25],
    ['recolector', 'c', '🧺', 'Recolector', 'Consigue 200 objetos en total.', 'get', 200],
    ['artesano', 'c', '🛠️', 'Artesano', 'Fabrica 30 objetos.', 'craft', 30],
    ['lluvia', 'c', '🌧️', 'Lluvia bendita', 'Recoge agua de lluvia con un cuenco.', 'rain', 1],
    ['catalejo', 'c', '🔭', 'Mirada lejana', 'Mira por un catalejo (clic derecho).', 'spy', 1],
    // ================================================================= ESPECIALES (20)
    ['aldea', 'e', '🛖', 'La aldea escondida', 'Encuentra la aldea de la tribu Shandara.', null, 0, () => sflag('village')],
    ['kalgor', 'e', '👴', 'Audiencia con el jefe', 'Habla con el Anciano Kalgor.', null, 0, () => sflag('metChief')],
    ['ofrenda', 'e', '🎁', 'Ofrenda aceptada', 'Entrega a Kalgor la ofrenda de pescado y cacao.', null, 0, () => sflag('script')],
    ['mono1', 'e', '🗿', 'Lector de piedras', 'Lee tu primer Monoglifo.', 'mono', 1],
    ['trueque5', 'e', '🤝', 'Comerciante', 'Haz 5 trueques con los aldeanos.', 'trade', 5],
    ['jaguar', 'e', '🐆', 'Cazador de la selva', 'Caza un jaguar.', 'kill:jaguar', 1],
    ['caiman', 'e', '🐊', 'Dientes de pantano', 'Caza un caimán.', 'kill:caiman', 1],
    ['escarcha', 'e', '❄️', 'Frío polar', 'Pisa la Isla Escarcha.', 'visit:escarcha', 1],
    ['brasa', 'e', '🌋', 'Tierra de fuego', 'Pisa la Isla Brasa.', 'visit:brasa', 1],
    ['obsidiana', 'e', '🖤', 'Cristal volcánico', 'Consigue obsidiana.', 'get:obsidiana', 1],
    ['plata', 'e', '🥈', 'Veta de plata', 'Consigue mineral de plata.', 'get:mineral_plata', 1],
    ['canoa', 'e', '🛶', 'Remo a remo', 'Fabrica una canoa.', 'ship:canoa', 1],
    ['velero', 'e', '⛵', 'Con viento a favor', 'Termina un bote de vela.', 'ship:velero', 1],
    ['canon1', 'e', '💣', 'Artillero', 'Dispara un cañón.', 'cannon', 1],
    ['buzo', 'e', '🥽', 'Buzo profesional', 'Ponte el casco de buceo.', 'equip:casco_buceo', 1],
    ['polar', 'e', '🧥', 'Abrigado', 'Ponte el abrigo polar.', 'equip:abrigo_grueso', 1],
    ['lava', 'e', '🥾', 'Pies de fuego', 'Camina sobre la lava con botas de obsidiana.', 'lavaWalk', 1],
    ['termal', 'e', '♨️', 'Aguas termales', 'Báñate en una fuente termal.', 'spring', 1],
    ['dia7', 'e', '🗓️', 'Una semana en el mar', 'Llega al día 7 en una partida.', null, 0, () => day() >= 7],
    ['equipo4', 'e', '🛡️', 'De punta en blanco', 'Lleva equipo en las 4 ranuras a la vez.', null, 0, () => eqAll()],
    // ================================================================= RAROS (20)
    ['jefe_jabali', 'r', '🐗', 'Rey de la pradera', 'Derrota al jabalí gigante.', 'kill:boss', 1],
    ['oso', 'r', '🐻‍❄️', 'Oso blanco', 'Caza un oso blanco.', 'kill:bear', 1],
    ['ballena', 'r', '🐋', 'Ballena a la vista', 'Acércate a una ballena en alta mar.', 'whale', 1],
    ['fruta', 'r', '🍇', 'Fruta del Abismo', 'Come una Fruta del Abismo.', 'fruit', 1],
    ['poder20', 'r', '✨', 'Usuario del poder', 'Usa el poder de una fruta 20 veces.', 'power', 20],
    ['monos4', 'r', '📜', 'Coleccionista de piedras', 'Lee 4 Monoglifos distintos.', null, 0, () => distinct('mono:', ['m:perdida', 'm:tahuri', 'm:escarcha', 'm:brasa', 'm:ruinas']) >= 4],
    ['receta', 'r', '🎯', 'Saber shandara', 'Aprende las recetas secretas de la tribu.', null, 0, () => !!(story().learned && story().learned.cerbatana)],
    ['lancha', 'r', '🚤', 'Motor de vapor', 'Termina una lancha de vapor.', 'ship:lancha', 1],
    ['barco', 'r', '🏴‍☠️', 'Capitán pirata', 'Termina un barco pirata.', 'ship:barco', 1],
    ['navega10k', 'r', '🧭', 'Lobo de mar', 'Navega 10 kilómetros.', 'sail', 10000],
    ['punteria', 'r', '🎯', 'Tirador certero', 'Acierta 10 disparos de cañón.', 'cannonHit', 10],
    ['pesca50', 'r', '🐠', 'Pescador experto', 'Pesca 50 peces.', 'get:pez_crudo', 50],
    ['dia30', 'r', '🌕', 'Un mes de supervivencia', 'Llega al día 30 en una partida.', null, 0, () => day() >= 30],
    ['perlas', 'r', '🦪', 'Perlas del arrecife', 'Consigue 5 perlas.', 'get:perla', 5],
    ['oro', 'r', '💰', 'Oro pirata', 'Consigue 10 monedas de oro antiguas.', 'get:doblon', 10],
    ['dardos', 'r', '🪃', 'Silencioso y letal', 'Acierta 5 dardos con la cerbatana.', 'dart', 5],
    ['tiburon', 'r', '🦈', 'Mandíbulas', 'Caza un tiburón.', 'kill:shark', 1],
    ['tripulacion', 'r', '👥', 'Tripulación completa', 'Juega una partida LAN con 4 jugadores o más.', 'crew4', 1],
    ['rescate', 'r', '🛟', 'Hombre al agua', 'Rescata a un compañero que se hunde.', 'rescue', 1],
    ['obsidiana_coraza', 'r', '🦺', 'Armadura volcánica', 'Fabrica la coraza de obsidiana.', 'craft:coraza_obsidiana', 1],
    // ================================================================= ÉPICOS (15)
    ['historia', 'p', '📖', 'El secreto de Kalgor', 'Completa la historia principal.', null, 0, () => sflag('twist')],
    ['serpiente', 'p', '🐉', 'Terror de las profundidades', 'Derrota a la serpiente marina.', 'kill:serpent', 1],
    ['frutas3', 'p', '🍎', 'Maestro de las frutas', 'Come 3 Frutas del Abismo distintas (en cualquier partida).', null, 0, () => distinct('fruit:', FRUITS) >= 3],
    ['astillero', 'p', '🚢', 'Almirante del astillero', 'Construye los 5 tipos de barco.', null, 0, () => distinct('ship:', SHIPS) >= 5],
    ['hundir', 'p', '💥', 'Hundidor', 'Hunde un barco enemigo en versus.', 'vs:sink', 1],
    ['vs_win', 'p', '🏆', 'Campeón del versus', 'Gana una partida versus.', 'vs:win', 1],
    ['banderas', 'p', '🚩', 'Ladrón de banderas', 'Captura 3 banderas enemigas.', 'vs:cap', 3],
    ['tesoro', 'p', '🗺️', 'X marca el lugar', 'Desentierra el tesoro en versus.', 'vs:dig', 1],
    ['dia100', 'p', '💯', 'Cien días', 'Llega al día 100 en una partida.', null, 0, () => day() >= 100],
    ['caza500', 'p', '☠️', 'Depredador', 'Caza 500 animales.', 'kill', 500],
    ['craft1000', 'p', '⚒️', 'Gran artesano', 'Fabrica 1000 objetos.', 'craft', 1000],
    ['navega50k', 'p', '🌐', 'Navegante incansable', 'Navega 50 kilómetros.', 'sail', 50000],
    ['sin_morir', 'p', '💪', 'Piel de hierro', 'Llega al día 25 sin morir en una partida.', null, 0, () => day() >= 25 && deaths() === 0],
    ['archipielago', 'p', '🗾', 'Cartógrafo', 'Pisa todos los tipos de isla: Perdida, Tahuri, Escarcha, Brasa, islote y arrecife.', null, 0, () => distinct('visit:', ISLES) >= ISLES.length],
    ['moda', 'p', '🎩', 'Pirata a la moda', 'Consigue 10 cosméticos de la tienda.', null, 0, () => PR.data.owned.length >= 10],
    // ================================================================= LEGENDARIOS (5)
    ['ultima_pieza', 'l', '👑', 'La ruta de la Última Pieza', 'Completa la historia principal en dificultad Difícil.', null, 0, () => sflag('twist') && st().diff === 2],
    ['inmortal', 'l', '🔱', 'Inmortal', 'Llega al día 50 sin morir en dificultad Difícil.', null, 0, () => day() >= 50 && deaths() === 0 && st().diff === 2],
    ['bestias', 'l', '🐲', 'Señor de las bestias', 'En una misma partida, derrota al jabalí gigante, a la serpiente marina y a un oso blanco.', null, 0, () => wkill('boss') > 0 && wkill('serpent') > 0 && wkill('bear') > 0],
    ['siete_mares', 'l', '🌊', 'Leyenda de los siete mares', 'Navega 100 kilómetros.', 'sail', 100000],
    ['completista', 'l', '🌟', 'Leyenda del archipiélago', 'Consigue los otros 99 logros.', null, 0, () => Ach.count() >= 99],
  ];
  Ach.LIST = A.map(([id, t, i, n, d, c, goal, f]) => ({ id, t, i, n, d, c, goal, f }));
  Ach.byId = (id) => Ach.LIST.find((a) => a.id === id);
  Ach.count = () => Ach.LIST.filter((a) => PR.hasAch(a.id)).length;
  // Progreso de un logro de contador (para la barra de la lista)
  Ach.progress = (a) => (a.c ? Math.min(1, cnt(a.c) / a.goal) : PR.hasAch(a.id) ? 1 : 0);

  // En partidas con trucos no se consigue nada
  Ach.blocked = () => !!(G.Cheats && G.Cheats.enabled());

  function unlock(a) {
    if (PR.hasAch(a.id) || Ach.blocked()) return;
    PR.data.ach[a.id] = Date.now();
    PR.save();
    const T = Ach.TIERS[a.t];
    PR.addCoins(T.coins, null, true);
    if (G.UI && G.UI.achievement) G.UI.achievement(a, T);
    // El completista se revisa al desbloquear cualquier otro
    setTimeout(check, 50);
  }
  function checkCounter(key) {
    for (const a of Ach.LIST) if (a.c === key && !PR.hasAch(a.id) && cnt(key) >= a.goal) unlock(a);
  }
  function check() {
    if (Ach.blocked()) return;
    for (const a of Ach.LIST) {
      if (PR.hasAch(a.id)) continue;
      if (a.c ? cnt(a.c) >= a.goal : a.f && safe(a.f)) unlock(a);
    }
  }
  const safe = (f) => { try { return f(); } catch (e) { return false; } };

  // Suma a un contador de por vida (y a su total, p. ej. "kill:boar" también cuenta en "kill")
  Ach.add = function (key, n = 1, withTotal) {
    if (Ach.blocked() || !n) return;
    const c = PR.data.cnt;
    c[key] = (c[key] || 0) + n;
    checkCounter(key);
    if (withTotal) { const base = key.split(':')[0]; c[base] = (c[base] || 0) + n; checkCounter(base); }
    PR.save();
  };
  // Marca algo que solo cuenta una vez (visitar una isla, leer un Monoglifo concreto…)
  Ach.flag = function (key) { if (!PR.cnt(key)) Ach.add(key, 1); };

  // Animal cazado por el jugador local (cuenta para la partida y para el perfil)
  const BIG = ['wolf', 'snowwolf', 'jaguar', 'bear', 'shark', 'caiman', 'serpent', 'boss'];
  Ach.onKill = function (type) {
    const s = (G.state.stats = G.Game.fixStats(G.state.stats));
    s.k[type] = (s.k[type] || 0) + 1;
    Ach.add('kill:' + type, 1, true);
    Ach.earn(type === 'boss' || type === 'serpent' ? 'boss' : BIG.includes(type) ? 'killBig' : 'kill');
  };
  // Doblones que se ganan jugando (además de los logros)
  const EARN = { day: [5, '🌅 Día superado'], loot: [3, null], kill: [1, null], killBig: [8, null], boss: [60, '👑 Jefe derrotado'], mono: [20, '🗿 Monoglifo'], ship: [25, '⛵ Barco terminado'], vsWin: [100, '🏆 Victoria'] };
  Ach.earn = (what) => { const e = EARN[what]; if (e) PR.addCoins(e[0], e[1]); };

  // ------------------------------------------------------------------ comprobaciones periódicas
  let pollT = 0, sailAcc = 0;
  Ach.tick = function (dt) {
    const s = st();
    if (!['playing', 'inventory', 'map', 'journal'].includes(s.mode) || Ach.blocked()) return;
    pollT -= dt;
    if (pollT > 0) return;
    pollT = 1;
    const P = G.Player;
    // Isla que pisas
    const isl = G.Arch && G.Arch.landOf ? G.Arch.landOf(P.pos.x, P.pos.z) : null;
    if (isl && isl.type && !P.swimming && !P.ship) Ach.flag('visit:' + isl.type);
    if (P.diving) Ach.flag('dive');
    if (G.Landmarks.inCave(P.pos.x, P.pos.z)) Ach.flag('cave');
    if (P.zoom) Ach.flag('spy');
    const L = G.World.lakeAt && G.World.lakeAt(P.pos.x, P.pos.z);
    if (L && L.kind === 'hot' && P.swimming) Ach.flag('spring');
    if (!P.ship && G.Inv.eqStat('lava') > 0.5 && G.Landmarks.lavaAt(P.pos.x, P.pos.z, P.pos.y)) Ach.flag('lavaWalk');
    if (G.Net.active && G.Net.inWorld && G.Net.peers.size >= 3) Ach.flag('crew4');
    for (const c of G.Creatures.list) if (c.type === 'whale' && !c.dead && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 30) { Ach.flag('whale'); break; }
    const m = Math.floor(sailAcc);
    if (m > 0) { Ach.add('sail', m); sailAcc -= m; }
    check();
  };
  // Metros navegados (se suman de a poco para no escribir el perfil en cada fotograma)
  Ach.sailed = (m) => { if (!Ach.blocked()) sailAcc += m; };
})();
