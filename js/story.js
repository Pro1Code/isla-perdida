// Historia principal "La Última Pieza": objetivos, diálogos (cortos) con la tribu Shandara, Monoglifos,
// botellas con mensajes, la Gaviota Noticiera, la bitácora con curiosidades de One Piece
// y las Frutas del Abismo (poderes que se pierden al morir).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const St = (G.Story = { dialog: null, powerCd: 0, carried: 0, carrier: null, iceFx: [] });

  // ------------------------------------------------------------------ textos
  const MONO = {
    'm:perdida': { title: 'Monoglifo de la Isla Perdida', text: '«El Rey de las Mareas pasó por aquí. Quien lea las cuatro piedras sabrá dónde duerme la Última Pieza.»', fact: 3 },
    'm:tahuri': { title: 'Monoglifo del Templo Shandara', text: '«Hace 800 años el Reino de Aurea brillaba sobre estas aguas. En un solo día, el mar se lo tragó.»', fact: 0 },
    'm:escarcha': { title: 'Monoglifo del Lago Helado', text: '«No fue el mar. Los fundadores de la Marina Blanca hundieron el reino para borrar su nombre de la historia.»', fact: 2 },
    'm:brasa': { title: 'Monoglifo del Cráter', text: '«Bajo el último horizonte descansa el Ancla del Mundo. Quien la levante, levantará el reino… y también la guerra.»', fact: 4 },
    'm:ruinas': { title: 'Gran Monoglifo', text: '«Aquí estuvo el palacio de Aurea. Los que buscan la Última Pieza deben unir los cuatro fragmentos del mapa.»', fact: 1 },
  };
  St.FACTS = [
    'En One Piece, los Poneglyphs son bloques indestructibles escritos en un idioma antiguo que casi nadie sabe leer.',
    'Gol D. Roger fue el Rey de los Piratas. Sus últimas palabras dieron inicio a la Gran Era de la Piratería.',
    'El «Siglo Vacío» es un periodo de 100 años borrado a propósito de la historia del mundo de One Piece.',
    'Nico Robin es la única de la tripulación de Luffy que sabe leer los Poneglyphs.',
    'La Grand Line es tan peligrosa que las brújulas normales no funcionan: por eso se usa el Log Pose.',
    'La tribu Shandia de Skypiea, que protegía la ciudad dorada de Shandora, inspiró a los Shandara.',
    'Quien come una Fruta del Diablo gana un poder, pero el mar lo rechaza: nunca más podrá nadar.',
    'Cuando muere quien comió una Fruta del Diablo, la fruta vuelve a aparecer en algún lugar del mundo.',
    'El Going Merry, el primer barco de los Sombrero de Paja, tenía un mascarón de oveja.',
    'El Thousand Sunny, su segundo barco, tiene un mascarón de león y lo construyó Franky.',
    'Los Reyes Marinos viven en el Calm Belt, una franja de mar sin viento que rodea la Grand Line.',
    'Los Den Den Mushi son caracoles que funcionan como teléfonos en el mundo de One Piece.',
    'Los News Coo son gaviotas mensajeras que reparten el periódico por todo el mar.',
    'Las recompensas de One Piece se miden en berries, la moneda de ese mundo.',
    'Drum Island, una isla de invierno eterno, inspiró a la Isla Escarcha.',
    'En One Piece, cada isla de la Grand Line tiene su propio clima: primavera, verano, otoño o invierno.',
  ];
  const BOTTLES = [
    'Si lees esto: los shandara de Isla Tahuri conocen la escritura antigua. Llévales una ofrenda. —Un náufrago',
    'Las aguas termales de Isla Escarcha curan y quitan el frío. Aun así, lleva un abrigo polar.',
    'Lejos de la costa vive una serpiente marina. Lleva siempre repuestos en la caja del barco.',
    'Vi un submarino hundido, oxidado y enorme… y algo brillaba dentro. Necesitarás aguantar la respiración.',
    'En el cráter de Brasa la lava no perdona. Salvo, dicen, a quien comió la Fruta Llama-Llama.',
    'Las gaviotas vuelan en círculo sobre los bancos de peces. Echa la red justo ahí.',
  ];
  const NEWS = [
    'La Marina Blanca ofrece una recompensa por cualquiera que sepa leer los Monoglifos.',
    'Pescadores avistan ballenas jorobadas entre las islas. Traen buena suerte… y bancos de peces.',
    'Un remolino gigante se ha tragado dos barcas mercantes. ¡Evítenlo!',
    'Los shandara celebran la luna llena con chocolate caliente y tambores.',
    'Se rumorea que una Fruta del Abismo duerme dentro de un cofre helado.',
    'Un barco pirata con mascarón de oveja fue visto cerca de las ruinas de Aurea.',
    'El volcán de Isla Brasa ha vuelto a rugir. La ceniza cubre sus playas negras.',
    'Tormentas al oeste. Los capitanes sensatos echan el ancla antes del anochecer.',
  ];
  const TRADES = [
    { give: { doblon: 3 }, get: ['cacao', 3] }, { give: { pez_asado: 3 }, get: ['veneno', 2] }, { give: { perla: 2 }, get: ['red_pesca', 1] },
    { give: { cuero: 3 }, get: ['dardo', 6] }, { give: { doblon: 8 }, get: ['plano_velero', 1] }, { give: { perla: 4 }, get: ['catalejo', 1] },
    { give: { piel_gruesa: 2 }, get: ['chocolate', 2] }, { give: { doblon: 5 }, get: ['tela_vela', 2] },
    { give: { perla: 3 }, get: ['tocado_shandara', 1] }, { give: { cuero: 5 }, get: ['pantalon_cuero', 1] }, { give: { doblon: 6 }, get: ['aletas', 1] },
    { give: { doblon: 8 }, get: ['mapa_tesoro', 1] },
  ];
  const FRUITS = {
    llama: { item: 'fruta_llama', name: 'Llama-Llama', icon: '🔥', power: 'Bola de fuego', desc: 'Inmune al frío y a la lava, brillas de noche y tus golpes queman.' },
    hielo: { item: 'fruta_hielo', name: 'Hielo-Hielo', icon: '❄️', power: 'Onda helada', desc: 'Inmune al frío y caminas sobre el mar congelándolo.' },
    muelle: { item: 'fruta_muelle', name: 'Muelle-Muelle', icon: '🌀', power: 'Súper salto', desc: 'Saltos enormes y sin daño por caída.' },
    humo: { item: 'fruta_humo', name: 'Humo-Humo', icon: '💨', power: 'Nube de humo', desc: 'De noche los animales no te ven. Te vuelves muy veloz un momento.' },
    roca: { item: 'fruta_roca', name: 'Roca-Roca', icon: '🪨', power: 'Golpe sísmico', desc: 'Piel de piedra: recibes mucho menos daño y golpeas más fuerte.' },
  };
  St.FRUITS = FRUITS;
  // Dónde aparece cada fruta al principio
  const FRUIT_SPOTS = { llama: 'c:brasa:rim', hielo: 'c:escarcha:cave', muelle: 'c:tahuri:temple', humo: 'sub', roca: 'sw1' };

  // ------------------------------------------------------------------ estado
  // Compartido (mundo): G.state.world.story = { step, monos, bottles, rep, learned, fruits, disc, facts }
  // Personal: G.state.fruit (fruta comida), G.state.journal
  const W = () => (G.state.world.story = G.state.world.story || { step: 0, monos: {}, bottles: {}, rep: 0, learned: {}, fruits: {}, disc: { 0: 1 }, facts: {}, seen: {} });
  St.init = function () {
    const w = W();
    const fresh = !Object.keys(w.fruits).length;
    for (const id in FRUITS) if (!w.fruits[id]) w.fruits[id] = { at: FRUIT_SPOTS[id] };
    // En las partidas nuevas una de las cinco frutas está en el cofre escondido de Rogan (Isla Perdida)
    if (fresh && St.coop()) { const ks = Object.keys(FRUITS); w.fruits[ks[Math.floor(Math.random() * ks.length)]] = { at: 'rogan' }; }
    G.state.fruit = G.state.fruit || null;
  };
  St.coop = () => !(G.Modes && G.Modes.active);
  St.fruitOf = () => G.state.fruit || null;
  const myKey = () => (G.Net.active ? G.Net.name : 'solo');

  // ------------------------------------------------------------------ objetivos
  // Prólogo (la Fruta de Rogan en la Isla Perdida) y actos de la historia.
  // Las partidas antiguas que ya habían salido de la isla se saltan el prólogo.
  const legacy = (w, f) => !!(f.raft || (w.disc && Object.keys(w.disc).length > 1));
  const PRO = () => !!(G.Prologue && G.Prologue.active());
  const OBJ = [
    { id: 'hermit', t: 'Habla con <b>Silvano</b>, el viejo que te encontró en la playa (<kbd>E</kbd>)', done: (I, f, w) => !PRO() || w.flags.metHermit || legacy(w, f) },
    { id: 'gather', t: 'Recoge palos, piedras y fibra del suelo (<kbd>E</kbd>)', done: (I, f) => (I.count('palo') >= 2 && I.count('piedra') >= 2 && I.count('fibra') >= 3) || f.axe },
    { id: 'axe', t: 'Abre el inventario (<kbd>Tab</kbd>) y fabrica un <b>hacha de piedra</b>', done: (I, f) => f.axe || I.count('hacha') > 0 },
    { id: 'wood', t: 'Tala árboles para conseguir <b>8 de madera</b>', done: (I, f) => I.count('madera') >= 8 || f.fire },
    { id: 'fire', t: 'Fabrica una <b>fogata</b> y colócala (clic derecho)', done: (I, f) => f.fire },
    { id: 'crew', t: 'Reúnete con tu <b>tripulación</b> en la costa este, junto al viejo barco naufragado', done: (I, f, w) => !PRO() || w.flags.metCrew || legacy(w, f) },
    { id: 'style', t: 'Aprende un <b>estilo de combate</b>: Kaito ⚔️, Crane 🔫 o Bastián 👊 (en el campamento) o Silvano 🔮 (junto al lago)', done: (I, f, w) => !PRO() || G.Styles.any() || legacy(w, f) },
    { id: 'clues', t: 'Encuentra las <b>3 pistas de Rogan</b>: el ancla del naufragio, la piedra del lago… y la capitana Hiena', done: (I, f, w) => !PRO() || G.Prologue.clues() >= 3 || w.flags.treasure || legacy(w, f) },
    { id: 'dig', t: 'Desentierra el <b>cofre de Rogan</b> en la ✖ de tu mapa (<kbd>M</kbd>)', done: (I, f, w) => !PRO() || w.flags.treasure || legacy(w, f) },
    { id: 'shelter', t: 'Construye un refugio: <b>piso, paredes, techo y cama</b>', done: (I, f) => (f.bed && f.roof) || f.raft },
    { id: 'leather', t: 'Caza jabalíes o lobos hasta tener <b>4 de cuero</b>', done: (I, f) => I.count('cuero') >= 4 || f.raft },
    { id: 'raft', t: 'Fabrica una <b>balsa</b> (pestaña ⚓ Barcos) y colócala en la orilla', done: (I, f) => f.raft },
    { id: 'sail', t: 'Súbete a la balsa y zarpa. Sigue la aguja del <b>Log de Mareas</b> 🧭 hacia otra isla', done: (I, f, w) => w.disc && Object.keys(w.disc).length > 1 },
    { id: 'village', t: 'Busca la <b>aldea de la tribu Shandara</b> en la Isla Tahuri', done: (I, f, w) => w.flags && w.flags.village },
    { id: 'chief', t: 'Habla con el <b>Anciano Kalgor</b>, jefe de los Shandara', done: (I, f, w) => w.flags && w.flags.metChief },
    { id: 'offer', t: 'Lleva una ofrenda a Kalgor: <b>4 pescados asados</b> y <b>2 mazorcas de cacao</b>', done: (I, f, w) => w.flags && w.flags.script },
    { id: 'temple', t: 'Lee el <b>Monoglifo del templo</b> de Tahuri', done: (I, f, w) => w.monos['m:tahuri'] },
    { id: 'monos', t: 'Lee los Monoglifos de la <b>Isla Perdida</b> (cueva), <b>Escarcha</b> y <b>Brasa</b>', done: (I, f, w) => w.monos['m:perdida'] && w.monos['m:escarcha'] && w.monos['m:brasa'] },
    { id: 'twist', t: 'Vuelve con el <b>Anciano Kalgor</b> y cuéntale lo que dicen las piedras', done: (I, f, w) => w.flags && w.flags.twist },
    { id: 'end', t: '', done: () => false },
  ];
  St.objectiveId = () => { const w = W(); return (OBJ[w.step || 0] || OBJ[0]).id; };
  St.objective = function () {
    const w = W(), st = G.state;
    w.flags = w.flags || {};
    let i = Math.min(w.step || 0, OBJ.length - 1);
    while (i < OBJ.length - 1 && OBJ[i].done(G.Inv, st.flags, w)) i++;
    const changed = i !== w.step;
    w.step = i;
    let text = OBJ[i].t;
    const id = OBJ[i].id;
    if (id === 'monos') text += ` <span class="muted">(${['m:perdida', 'm:escarcha', 'm:brasa'].filter((k) => w.monos[k]).length}/3)</span>`;
    if (id === 'clues') text += ` <span class="muted">(${G.Prologue.clues()}/3)</span>`;
    if (id === 'end') {
      const fr = Object.keys(FRUITS).filter((k) => w.fruits[k] && w.fruits[k].holder).length;
      text = 'Explora el archipiélago con tu tripulación: construye el <b>barco pirata</b>, busca las <b>Frutas del Abismo</b> ' + `(${fr}/5 encontradas)` + ' y los tesoros hundidos.<br><span class="muted">La ruta de Rogan sigue más allá de la Franja de Calma… (continuará)</span>';
    }
    if (changed && i > 0 && G.Net.authority()) G.Net.send({ t: 'story', w });
    return { text, changed };
  };
  // Destino al que apunta el Log de Mareas (en el prólogo apunta aunque aún no lo tengas)
  St.target = function () {
    const w = W(), A = G.Arch, id = St.objectiveId();
    const find = (type) => A.islands.find((s) => s.type === type);
    if (!St.coop()) return G.Modes ? G.Modes.target() : null;
    if (['hermit', 'crew', 'style', 'clues', 'dig'].includes(id)) return G.Prologue.target(id);
    if (['sail', 'village', 'chief', 'offer'].includes(id)) { const t = find('tahuri'); if (!t) return null; const v = t.feat.village; return v ? { x: v.wx, z: v.wz, name: 'Aldea Shandara' } : { x: t.x, z: t.z, name: t.name }; }
    if (id === 'temple') { const t = find('tahuri'); return t && t.feat.temple ? { x: t.feat.temple.wx, z: t.feat.temple.wz, name: 'Templo de Tahuri' } : null; }
    if (id === 'monos') {
      for (const [k, type] of [['m:perdida', 'perdida'], ['m:escarcha', 'escarcha'], ['m:brasa', 'brasa']]) {
        if (w.monos[k]) continue;
        const L = G.Landmarks.byId(k);
        if (L) return { x: L.x, z: L.z, name: MONO[k].title };
        const s = find(type); if (s) return { x: s.x, z: s.z, name: s.name };
      }
    }
    if (id === 'twist') { const t = find('tahuri'); const v = t && t.feat.village; return v ? { x: v.wx, z: v.wz, name: 'Anciano Kalgor' } : null; }
    if (['gather', 'axe', 'wood', 'fire', 'shelter', 'leather', 'raft'].includes(id)) return null;
    return G.UI.waypoint ? { x: G.UI.waypoint.x, z: G.UI.waypoint.z, name: 'Destino marcado' } : null;
  };

  // ------------------------------------------------------------------ descubrimientos y lecturas
  St.update = function (dt) {
    const w = W(), P = G.Player.pos;
    w.flags = w.flags || {};
    St.powerCd = Math.max(0, St.powerCd - dt);
    const z = G.Arch.zoneOf(P.x, P.z);
    if (z && !w.disc[z.id]) {
      w.disc[z.id] = 1;
      const T = G.Arch.TYPES[z.type];
      G.UI.banner(`${T.icon} ${z.name}`, T.desc);
      G.Audio.play('day');
      G.Net.send({ t: 'story', w });
      if (Math.random() < 0.7) setTimeout(() => St.fact(), 4000);
    }
    // Islotes y arrecife también se anotan en el mapa al verlos de cerca
    for (const s of G.Arch.islands) if (!s.main && !w.disc[s.id] && Math.hypot(P.x - s.x, P.z - s.z) < s.r + 90) { w.disc[s.id] = 1; G.UI.msg(`🗺️ Anotado en el mapa: ${s.name}`, 'info'); }
    const t = G.Arch.islands.find((s) => s.type === 'tahuri');
    if (t && t.feat.village && !w.flags.village && Math.hypot(P.x - t.feat.village.wx, P.z - t.feat.village.wz) < t.feat.village.r + 12) {
      w.flags.village = 1; G.Net.send({ t: 'story', w });
      G.UI.banner('Aldea Shandara', 'Guerreros de la selva. No los ataques…');
    }
    // Lugares vistos (aparecen en el mapa)
    w.seen = w.seen || {};
    if ((St.seenT = (St.seenT || 0) - dt) <= 0) {
      St.seenT = 1;
      for (const c of G.Landmarks.loot) if (!w.seen[c.id] && Math.abs(c.x - P.x) < 120 && Math.hypot(c.x - P.x, c.z - P.z) < 120) w.seen[c.id] = 1;
    }
    // Te sujeta un compañero (rescate de quien comió una fruta)
    if (St.carried > 0) {
      St.carried -= dt;
      const c = G.Net.peers.get(St.carrier);
      if (c) { G.Player.pos.set(c.x + 0.8, G.World.waveHeight(c.x, c.z) - 1.1, c.z + 0.8); G.Player.sinking = false; G.Player.oxy = Math.min(100, G.Player.oxy + dt * 30); }
    }
    // Reputación con la tribu: se recupera poco a poco
    if (w.rep < 0) w.rep = Math.min(0, w.rep + dt * 0.05);
    for (let i = St.iceFx.length - 1; i >= 0; i--) {
      const f = St.iceFx[i];
      f.t -= dt;
      f.m.material.opacity = Math.min(0.85, f.t);
      if (f.t <= 0) { G.scene.remove(f.m); St.iceFx.splice(i, 1); }
    }
  };
  St.fact = function (i) {
    const w = W();
    if (i === undefined) { const left = St.FACTS.map((_, k) => k).filter((k) => !w.facts[k]); if (!left.length) return; i = left[Math.floor(Math.random() * left.length)]; }
    w.facts[i] = 1;
    G.UI.msg(`📖 <b>¿Sabías que…?</b> ${St.FACTS[i]}`, 'info');
  };
  St.readMono = function (c) {
    const w = W(), m = MONO[c.id];
    if (!m) return;
    if (!w.flags || !w.flags.script) {
      St.show({ who: '🗿 ' + m.title, text: 'Símbolos antiguos grabados en una piedra negra e indestructible. No entiendes nada… Quizá alguien del archipiélago sepa leerlos.' });
      G.Audio.play('mono');
      return;
    }
    const first = !w.monos[c.id];
    w.monos[c.id] = 1;
    G.Audio.play('mono');
    if (!G.Profile.cnt('mono:' + c.id)) G.Ach.add('mono');
    G.Ach.flag('mono:' + c.id);
    if (first) G.Ach.earn('mono');
    St.show({ who: '🗿 ' + m.title, text: m.text, fact: first ? m.fact : undefined });
    if (first) { w.facts[m.fact] = 1; G.Net.send({ t: 'story', w }); }
  };
  St.readBottle = function (c) {
    const w = W();
    w.bottles[c.id] = 1;
    St.show({ who: '🍾 Mensaje en una botella', text: BOTTLES[(c.n || 0) % BOTTLES.length] });
    G.Audio.play('pickup');
  };
  St.readItem = function (id) {
    if (id && id.startsWith('pista_')) { G.Prologue.readClue(id); return true; }
    if (id === 'mapa_tesoro') { G.Treasure.read(); return true; }
    if (id !== 'diario') return false;
    const w = W();
    w.flags = w.flags || {};
    St.show({ who: '📔 Diario del capitán', text: 'Día 34. El capitán jura que la Última Pieza existe. Rogan D. Aldor, el Rey de las Mareas, la encontró… y se echó a reír. Nadie sabe por qué. Si nos hundimos, que quien lea esto siga la aguja del Log de Mareas.', fact: 1 });
    if (!w.flags.diary) { w.flags.diary = 1; G.Net.send({ t: 'story', w }); }
    return true;
  };
  St.news = function () {
    if (Math.random() < 0.55) setTimeout(() => { G.UI.msg(`📰 <b>La Gaviota Noticiera</b>: ${NEWS[Math.floor(Math.random() * NEWS.length)]}`, 'info'); G.Audio.play('gull'); }, 5000);
  };
  // Objetos que la historia pone en los cofres (diario, Log de Mareas y Frutas del Abismo)
  St.lootExtra = function (id) {
    const out = [];
    if (!G.state.world) return out;
    const w = W();
    if (id === 1 && St.coop()) out.push(['diario', 1], ['log_mareas', 1]);
    for (const k in FRUITS) if (w.fruits[k] && w.fruits[k].at === id) out.push([FRUITS[k].item, 1]);
    return out;
  };
  St.onLootOpened = function (id) {
    const w = W();
    for (const k in FRUITS) if (w.fruits[k] && w.fruits[k].at === id) w.fruits[k] = { found: 1 };
  };
  St.onShipPlaced = function () {};

  // ------------------------------------------------------------------ diálogos
  // St.show({ who, text, fact, options: [[texto, fn], ...] })
  St.show = function (d) {
    St.dialog = d;
    G.UI.showDialog(d);
    G.Voice.dialog(d);
    if (d.fact !== undefined) setTimeout(() => St.fact(d.fact), 1200);
  };
  St.close = function () { St.dialog = null; G.UI.hideDialog(); G.Voice.stop('dialog'); };
  St.choose = function (i) {
    const d = St.dialog;
    if (!d || !d.options || !d.options[i]) { St.close(); return; }
    const fn = d.options[i][1];
    St.close();
    if (fn) fn();
  };
  St.tribeHostile = () => (G.state.world && W().rep < -20);
  St.tribeHurt = function (c, who) {
    const w = W();
    const before = w.rep;
    w.rep = Math.max(-100, w.rep - 25);
    if (before >= -20 && w.rep < -20) { G.UI.banner('¡Traición!', 'La tribu Shandara te declara la guerra'); G.Net.send({ t: 'story', w }); }
  };
  St.tribeKilled = function () { const w = W(); w.rep = -100; G.Net.send({ t: 'story', w }); };
  // Frases de cada aldeano (js/lines.js): cada uno dice las suyas, con su voz
  const lineOf = (c) => G.LINES[G.Voice.speakerOf(c.name)] || G.LINES.wypar;
  St.talk = function (c) {
    if (c.type === 'npc') return G.Prologue.talk(c);
    const w = W();
    w.flags = w.flags || {};
    G.Audio.play('talk');
    // Con el tocado shandara puesto, la tribu te perdona y te trata como a uno de los suyos
    if (G.Inv.eqStat('tribe') && w.rep < 0) { w.rep = 0; G.Net.send({ t: 'story', w }); G.UI.msg('🪶 Los shandara reconocen tu tocado y te perdonan.', 'good'); }
    if (St.tribeHostile()) { St.show({ who: c.name, text: lineOf(c).hostil, options: [['Ofrecer 5 doblones de paz', () => peace()], ['Irse', null]] }); return; }
    if (c.type === 'npc') return G.Prologue.talk(c);
    if (c.role === 'chief') return chief(c, w);
    if (c.role === 'trader') return trader(c);
    // Si eres famoso, la primera vez te comentan tu cartel de "Se busca"
    const L = lineOf(c), recog = (G.state.recog = G.state.recog || {});
    if (L.fama && G.Bounty.famous() && !recog[c.name]) { recog[c.name] = 1; St.show({ who: c.name, text: L.fama }); return; }
    const pool = L.talk;
    St.show({ who: c.name, text: pool[Math.floor(Math.random() * pool.length)] });
  };
  function peace() {
    if (G.Inv.count('doblon') < 5) { G.UI.msg('Necesitas 5 doblones.', 'warn'); return; }
    G.Inv.remove('doblon', 5);
    const w = W(); w.rep = 0; G.Net.send({ t: 'story', w });
    G.UI.msg('🤝 Los Shandara aceptan tu ofrenda de paz.', 'good');
  }
  function chief(c, w) {
    const step = w.step || 0, K = G.LINES.kalgor;
    if (!w.flags.metChief) {
      St.show({ who: 'Anciano Kalgor', text: K.meet, options: [['«Quiero leerlas.»', () => {
        w.flags.metChief = 1; G.Net.send({ t: 'story', w });
        St.show({ who: 'Anciano Kalgor', text: K.price });
      }], ['«Solo estoy de paso.»', null]] });
      return;
    }
    if (!w.flags.script) {
      if (G.Inv.count('pez_asado') >= 4 && G.Inv.count('cacao') >= 2) {
        St.show({ who: 'Anciano Kalgor', text: K.offer, options: [['Entregar la ofrenda', () => {
          G.Inv.remove('pez_asado', 4); G.Inv.remove('cacao', 2);
          w.flags.script = 1; w.learned.cerbatana = 1; w.learned.chocolate = 1; w.rep = Math.max(w.rep, 20);
          G.Net.send({ t: 'story', w });
          G.UI.banner('Escritura antigua', 'Ya puedes leer los Monoglifos');
          G.UI.msg('📜 Aprendiste recetas shandara: <b>Cerbatana</b>, <b>Dardos venenosos</b> y <b>Chocolate caliente</b>.', 'good');
          St.fact(5);
        }]] });
      } else St.show({ who: 'Anciano Kalgor', text: `${K.waiting} (Llevas ${G.Inv.count('pez_asado')}/4 pescados y ${G.Inv.count('cacao')}/2 de cacao.)` });
      return;
    }
    const read = ['m:tahuri', 'm:perdida', 'm:escarcha', 'm:brasa'].filter((k) => w.monos[k]).length;
    if (read < 4) { St.show({ who: 'Anciano Kalgor', text: `${K.stones} (Has leído ${read} de 4.)` }); return; }
    if (!w.flags.twist) {
      St.show({ who: 'Anciano Kalgor', text: K.twist, options: [['«¿Quién eres en realidad?»', () => {
        w.flags.twist = 1; G.Net.send({ t: 'story', w });
        St.show({ who: 'Kalgor', text: K.truth, fact: 2 });
        G.UI.banner('Continuará…', 'La ruta sigue más allá de la Franja de Calma');
      }]] });
      return;
    }
    St.show({ who: 'Kalgor', text: K.end });
  }
  function trader(c, again) {
    const opts = TRADES.map((tr) => {
      const give = Object.entries(tr.give).map(([id, n]) => `${n} ${G.icon(id, 'xs')}`).join(' + ');
      const ok = Object.entries(tr.give).every(([id, n]) => G.Inv.count(id) >= n);
      return [`${ok ? '' : '✗ '}${give} → ${tr.get[1]} ${G.icon(tr.get[0], 'xs')} ${G.ITEMS[tr.get[0]].n}`, () => {
        if (!Object.entries(tr.give).every(([id, n]) => G.Inv.count(id) >= n)) { G.UI.msg('No tienes lo necesario.', 'warn'); G.Audio.play('error'); return; }
        for (const [id, n] of Object.entries(tr.give)) G.Inv.remove(id, n);
        G.Game.give(tr.get[0], tr.get[1]);
        G.Ach.add('trade');
        G.Audio.play('loot');
        trader(c, true);
      }, 'html'];
    });
    opts.push(['Adiós', null]);
    St.show({ who: 'Genbu (comerciante)', text: again ? G.LINES.genbu.deal : G.LINES.genbu.hello, options: opts });
  }

  // ------------------------------------------------------------------ Frutas del Abismo
  St.eatFruit = function (itemId) {
    const it = G.ITEMS[itemId], k = it.fruit;
    if (G.state.fruit) { St.show({ who: '⚠️ Fruta del Abismo', text: 'Ya comiste una Fruta del Abismo. Dicen que comer una segunda te destrozaría por dentro. No te atreves.' }); return false; }
    St.show({ who: `${FRUITS[k].icon} Fruta ${FRUITS[k].name}`, text: `Sabe horrible… pero sientes un poder nuevo: ${FRUITS[k].desc} A cambio, el mar te rechazará para siempre.`, fact: 6,
      options: [['Comerla', () => {
        G.Inv.remove(itemId, 1);
        G.state.fruit = k;
        G.Ach.add('fruit:' + k, 1, true);
        const w = W(); w.fruits[k] = { holder: myKey() };
        G.Net.send({ t: 'fruit', k, holder: myKey() });
        G.Audio.play('eatfruit');
        G.UI.banner(`Fruta ${FRUITS[k].name}`, `Poder: ${FRUITS[k].power} (tecla <kbd>G</kbd>)`);
        G.Player.shake = 0.6;
      }], ['Guardarla', null]] });
    return true;
  };
  // Al morir se pierde el poder y la fruta renace en otro cofre del archipiélago
  St.onDeath = function () {
    const k = G.state.fruit;
    if (!k) return;
    G.state.fruit = null;
    G.UI.msg(`🍇 Perdiste el poder de la Fruta ${FRUITS[k].name}. Renacerá en algún lugar del archipiélago…`, 'bad');
    if (G.Net.authority()) respawnFruit(k); else G.Net.send({ t: 'fruitLost', k });
  };
  function respawnFruit(k) {
    const w = W();
    const chests = G.Landmarks.loot.filter((c) => c.kind === 'chest' && typeof c.id === 'string' && !Object.values(w.fruits).some((f) => f.at === c.id));
    if (!chests.length) return;
    const c = chests[Math.floor(Math.random() * chests.length)];
    w.fruits[k] = { at: c.id };
    if (G.state.world.loot[c.id]) { delete G.state.world.loot[c.id]; G.Landmarks.setOpened(c.id, false); G.Net.send({ t: 'lootReset', id: c.id }); }
    G.Net.send({ t: 'story', w });
  }
  St.onNet = function (m, from) {
    if (m.t === 'story' && m.w && G.state.world) {
      const cur = W(), prevStep = cur.step;
      G.state.world.story = Object.assign(cur, m.w, { step: Math.max(prevStep || 0, m.w.step || 0) });
    } else if (m.t === 'fruit') { W().fruits[m.k] = { holder: m.holder }; G.UI.msg(`🍇 ${G.Net.esc(m.holder)} comió la Fruta ${FRUITS[m.k].name}.`, 'info'); }
    else if (m.t === 'fruitLost' && G.Net.isHost) respawnFruit(m.k);
    else if (m.t === 'rescue' && m.to === G.Net.myId) { St.carried = 8; St.carrier = from; G.UI.msg(`🛟 ${G.Net.esc(G.Net.nameOf(from))} te sujeta. ¡Aguanta!`, 'good'); if (m.ship && G.Ships) { const s = G.Ships.byId(m.ship); if (s) { St.carried = 0; G.Ships.board(s); } } }
  };
  // Efectos de los poderes
  St.jumpPower = (base) => (St.fruitOf() === 'muelle' ? base * 1.75 : base);
  St.noFallDamage = () => St.fruitOf() === 'muelle';
  St.speedMul = () => (St.smokeT > performance.now() ? 1.6 : 1);
  St.damageMul = () => (St.fruitOf() === 'roca' ? 0.55 : 1);
  St.meleeMul = () => (St.fruitOf() === 'roca' ? 1.4 : St.fruitOf() === 'llama' ? 1.3 : 1);
  St.hiddenFromBeasts = () => St.fruitOf() === 'humo' && G.World.night > 0.5;
  St.iceStep = function (x, z, level) {
    const last = St.iceFx[St.iceFx.length - 1];
    if (last && Math.hypot(last.x - x, last.z - z) < 1.2) { last.t = 3; return; }
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.3, 10), new THREE.MeshStandardMaterial({ color: 0xd8f0ff, roughness: 0.2, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, level + 0.03, z);
    G.scene.add(m);
    St.iceFx.push({ m, x, z, t: 3 });
    if (St.iceFx.length > 40) { const o = St.iceFx.shift(); G.scene.remove(o.m); }
  };
  // Tecla G: poder de la fruta
  St.usePower = function () {
    const k = St.fruitOf(), P = G.Player;
    if (!k) { G.UI.msg('No tienes ningún poder. Las Frutas del Abismo están escondidas en cofres del archipiélago.', 'info', 'power'); return; }
    if (St.powerCd > 0) { G.UI.msg(`Poder recargando (${Math.ceil(St.powerCd)} s)`, 'warn', 'power'); return; }
    const near = (r) => { const out = []; G.Creatures.forEachAlive((c) => { if (G.Creatures.distTo(c, P.pos.x, P.pos.z) < r && !c.d.npc) out.push(c); }); return out; };
    G.Ach.add('power');
    if (k === 'llama') {
      St.powerCd = 3;
      const d = P.lookDir(new THREE.Vector3()), o = P.eyePos(new THREE.Vector3());
      G.Creatures.forEachAlive((c) => { if (c.d.npc) return; const t = G.Creatures.rayHit(c, o, d, 1); if (t >= 0 && t < 16) G.Creatures.hurt(c, 35); });
      for (let i = 1; i < 8; i++) setTimeout(() => G.Ships && G.Ships.puff(o.x + d.x * i * 2, o.y + d.y * i * 2, o.z + d.z * i * 2, 0xff7a20, 1.2, 0.5, 1), i * 30);
      G.Audio.play('ignite');
    } else if (k === 'hielo') {
      St.powerCd = 10;
      for (const c of near(9)) { G.Creatures.hurt(c, 15); c.frozen = 5; }
      if (G.Ships) G.Ships.puff(P.pos.x, P.pos.y + 0.5, P.pos.z, 0xcfeaff, 8, 0.5, 8);
      G.Audio.play('break');
    } else if (k === 'muelle') {
      St.powerCd = 3;
      const d = P.lookDir(new THREE.Vector3());
      P.vel.set(d.x * 14, 11, d.z * 14); P.onGround = false;
      G.Audio.play('swing');
    } else if (k === 'humo') {
      St.powerCd = 12;
      St.smokeT = performance.now() + 4000;
      for (const c of near(15)) { c.aggro = 0; c.fear = true; }
      if (G.Ships) G.Ships.puff(P.pos.x, P.pos.y + 1, P.pos.z, 0xb8b0c8, 6, 1, 10);
    } else if (k === 'roca') {
      St.powerCd = 8;
      for (const c of near(5)) G.Creatures.hurt(c, 40);
      P.shake = 0.6;
      if (G.Ships) G.Ships.puff(P.pos.x, P.pos.y, P.pos.z, 0x8a7a60, 6, 0.8, 8);
      G.Audio.play('rockbreak');
    }
  };
  // Rescatar a un compañero que se hunde por culpa de su fruta
  St.rescue = function (peer) {
    const P = G.Player;
    G.Net.send({ t: 'rescue', to: peer.id, ship: P.ship ? P.ship.id : null });
    G.UI.msg(`🛟 Sujetas a ${G.Net.esc(peer.name)}.`, 'good');
    G.Ach.add('rescue');
  };
  // Sin historia en versus (salvo los Monoglifos y las curiosidades)
  St.getState = () => W();
})();
