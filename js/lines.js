// Frases habladas de los personajes y la voz de cada uno.
// Cada frase tiene su propio audio en audio/voces/ (voces neuronales Piper, generadas con scripts/voces.js):
// si cambias o añades una frase, vuelve a ejecutar  node scripts/voces.js
// Solo se oye lo que va entre «comillas» (lo de fuera, como los contadores, no se lee en voz alta).
(function () {
  'use strict';
  const G = window.G;

  // Voz de cada personaje: modelo de Piper (v, y s = hablante en los que tienen varios),
  // tono (p: <1 más grave) y ritmo (l: >1 más pausado). eco: voz de ultratumba.
  G.VOICES = {
    narrador: { name: '', v: 'davefx', p: 0.98, l: 1.1 },
    vigia: { name: 'Vigía', v: 'ald', p: 1.12, l: 0.85 },
    silvano: { name: 'Silvano, el ermitaño', v: 'davefx', p: 0.86, l: 1.02 },
    mara: { name: 'Capitana Mara', v: 'claude', p: 0.97, l: 0.95 },
    kaito: { name: 'Kaito', v: 'sharvard', s: 0, p: 1.04, l: 1.04 },
    crane: { name: 'Crane', v: 'ald', p: 1.0, l: 0.86 },
    bastian: { name: 'Bastián', v: 'sharvard', s: 0, p: 0.84, l: 0.92 },
    rogan: { name: 'Rogan D. Aldor', v: 'sharvard', s: 0, p: 0.8, l: 1.05, eco: true },
    hiena: { name: 'Capitana Hiena', v: 'daniela', p: 0.88, l: 0.9 },
    pirata1: { name: 'Pirata', v: 'davefx', p: 1.06, l: 0.86 },
    pirata2: { name: 'Pirata', v: 'ald', p: 0.86, l: 0.9 },
    pirata3: { name: 'Pirata', v: 'sharvard', s: 0, p: 1.18, l: 0.88 },
    kalgor: { name: 'Anciano Kalgor', v: 'ald', p: 0.8, l: 1.1 },
    genbu: { name: 'Genbu', v: 'davefx', p: 1.16, l: 0.84 },
    wypar: { name: 'Wypar', v: 'sharvard', s: 0, p: 0.94, l: 0.95 },
    kamakiro: { name: 'Kamakiro', v: 'ald', p: 0.93, l: 0.98 },
    brahan: { name: 'Brahan', v: 'davefx', p: 1.25, l: 0.92 },
    aisha: { name: 'Aisha', v: 'sharvard', s: 1, p: 1.0, l: 0.95 },
    laka: { name: 'Laka', v: 'daniela', p: 1.1, l: 0.92 },
  };

  const L = (G.LINES = {});

  // ------------------------------------------------------------------ cinemática de introducción
  L.cine = [
    ['narrador', 'Mar del Oeste. Hace tres noches…'],
    ['mara', '¡Mantened el rumbo! La isla está cerca… y la fruta de Rogan también.'],
    ['vigia', '¡Barco de la Marina Blanca a popa!'],
    ['mara', '¡Nos han encontrado! ¡Todos a cubierta!'],
    ['narrador', 'Y el mar se lo tragó todo.'],
    ['silvano', '¡Eh, tú! ¿Sigues vivo?'],
    ['silvano', 'Tranquilo, náufrago. Estás en la Isla Perdida… y no has llegado aquí por casualidad.'],
  ];

  // ------------------------------------------------------------------ Silvano, el ermitaño
  L.silvano = {
    meet: [
      '«¡Eh, náufrago! Creí que el mar te había llevado.»',
      '«En la Isla Perdida. Anoche vi cómo la Marina Blanca hundía vuestro barco. Algunos de los tuyos llegaron a la costa este, junto al viejo naufragio.»',
      '«Escucha primero: no naufragasteis aquí por casualidad. Rogan D. Aldor, el Rey de las Mareas, escondió en esta isla una Fruta del Abismo.»',
      '«Quien la come gana un poder… y el mar lo rechaza para siempre. Tu capitana la buscaba. Y los piratas de la Hiena, en la costa oeste, también.»',
      '«Haz fuego antes de que caiga la noche: los lobos salen con la oscuridad. Luego busca a tu gente. Yo vivo junto al lago… ven a verme cuando quieras aprender algo más que a sobrevivir.»',
    ],
    teach: '«Las mareas tienen memoria, y quien sabe escucharlas puede pedirles cosas. ¿Quieres aprender la magia de las mareas?»',
    how: '«Toma mi viejo bastón. Clic: lanzas una chispa arcana. Q: llamas al rayo. Gasta maná, que vuelve solo. Practica con el tótem de runas: 5 chispas.»',
    train: '«El tótem espera. Con el bastón en la mano, apunta y haz clic.»',
    done: '«Bien… las mareas ya te escuchan.»',
    clues: [
      '«Aún no tienes ninguna de las 3 pistas de Rogan. Él escribía como hablaba: en acertijos.»',
      '«Llevas una de las 3 pistas de Rogan. Él escribía como hablaba: en acertijos.»',
      '«Llevas dos de las 3 pistas de Rogan. Él escribía como hablaba: en acertijos.»',
    ],
    dig: '«Tres pistas… ¡entonces ya sabes dónde cavar! Ve antes que los piratas.»',
    fruit: '«Ya tienes la fruta… o ya la llevas dentro. Ahora el mar es tu enemigo y tu camino.»',
    tips: [
      '«En Isla Tahuri vive una tribu que sabe leer las piedras negras. Su jefe, Kalgor, sabe más de lo que cuenta.»',
      '«En el nivel 3 de la magia aprenderás la Marea curativa (Z). Tu tripulación te lo agradecerá.»',
      '«Rogan pasó por aquí hace veinte años. Nunca volvió a sonreír como aquel día.»',
    ],
    // Habla solo cuando pasas cerca de su cabaña
    solo: [
      '«Las mareas están inquietas hoy… algo se acerca.»',
      '«Veinte años esperando… y el mar por fin trae a alguien.»',
      '«Raíz de mangle, lodo del lago, una pluma de gaviota… no, eso era para la tos.»',
      '«Rogan, viejo loco. ¿Por qué aquí? ¿Por qué ahora?»',
      '«Si la luna sale roja, mañana habrá tormenta. Siempre pasa.»',
    ],
  };

  // ------------------------------------------------------------------ la tripulación
  L.mara = {
    meet: [
      '«¡Estás vivo! Por las mareas… creí que te habíamos perdido.»',
      '«La Marina Blanca nos hundió sin aviso. Iban tras lo mismo que nosotros: la fruta que Rogan escondió en esta isla.»',
      '«Rogan dejó tres pistas. La primera, bajo el ancla del viejo naufragio de esta playa. La segunda, en la piedra de la calavera del lago. La tercera… se la robó la Hiena.»',
      '«La capitana pirata de la costa oeste. No vayas a por ella sin saber pelear: Kaito, Crane y Bastián pueden enseñarte. Y el Log de Mareas está en los cofres del naufragio, cógelo.»',
    ],
    treasure: '«¿La tienes? Es tuya: tú la encontraste. Pero piénsalo bien antes de comerla. Ahora construye una balsa: el Log de Mareas nos guiará a la siguiente isla.»',
    clues3: '«¡Las tres pistas! Mira tu mapa: Rogan marcó el sitio con una ✖. ¡Ve a cavar!»',
    clue1: '«La primera pista está bajo el ancla oxidada, junto al viejo naufragio. Aquí mismo, en la playa.»',
    clue2: '«La segunda está en la piedra de la calavera, a la orilla del lago. El viejo Silvano vive cerca.»',
    clue3: [
      '«La última la tiene la Hiena, en la costa oeste. Aprende antes un estilo de combate con la tripulación.»',
      '«La última la tiene la Hiena, en la costa oeste. Ya sabes pelear: ve con cuidado y llévate comida.»',
    ],
  };
  L.kaito = {
    intro: '«¿Quieres aprender a usar una espada? No es levantar un palo y ya: es respirar con el acero.»',
    how: '«Toma mi katana de repuesto. Clic para cortar, Q para el corte volador. Golpea el muñeco de paja 10 veces.»',
    train: '«Sigue practicando con el muñeco de paja. El acero aprende a la vez que tú.»',
    done: '«Buen trabajo. Tu acero ya respira contigo.»',
    tips: ['«Una buena espada corta el viento. Literalmente: Q.»', '«En el nivel 3 te enseñaré el Torbellino (Z): perfecto cuando te rodean.»', '«Con el horno puedes forjar sables. Y con obsidiana, una katana de verdad.»'],
  };
  L.crane = {
    intro: '«¿Sabes lo que es una pistola de chispa? Ruido, humo… y un agujero donde apuntas. ¿Te enseño?»',
    how: '«Toma esta pistola y 15 balas. Clic para disparar: la bala va donde miras. Acierta 5 veces a la diana.»',
    train: '«Sigue disparando a la diana. Respira, apunta… y aprieta despacio.»',
    done: '«Buen pulso. Ya estás listo para la pólvora de verdad.»',
    tips: ['«Las balas se hacen en el horno: hierro y pólvora. La pólvora, con azufre y carbón.»', '«El mosquete pega fuerte y llega lejos, pero recarga despacio. Elige bien el momento.»', '«Q: disparo certero. Respira, apunta… y no falles.»'],
  };
  L.bastian = {
    intro: '«En la cocina y en la pelea lo importante son las piernas. ¿Te enseño a pelear sin armas?»',
    how: '«Deja las manos vacías (un hueco sin nada en la barra rápida). Clic para golpear, Q para la patada huracán. Dale 12 golpes al saco.»',
    train: '«¡Sigue dándole al saco! Los puños se hacen a golpes, como la masa del pan.»',
    done: '«¡Eso es! Ya pegas como un marinero de verdad.»',
    tips: ['«Las manos vacías también son un arma. Deja la barra rápida en un hueco sin nada.»', '«Cada tercer golpe es más fuerte. Cuenta: uno, dos… ¡tres!»', '«La Patada huracán (Q) aparta a cualquiera que se acerque demasiado.»'],
  };

  // ------------------------------------------------------------------ pistas de Rogan y lugares
  L.rogan = {
    pista_1: '«Primera palabra: al sur, donde la arena se vuelve roca.» — R. D. A.\n(En el reverso hay un dibujo: una calavera junto a un lago.)',
    pista_2: '«Segunda palabra: busca la palmera que se inclina hacia el mar.» — R. D. A.\n(Falta un trozo del pergamino. Hay marcas de cuchillo… y huellas de botas pirata.)',
    pista_3: '«Tercera palabra: a sus pies, donde la gaviota de piedra mira al horizonte, cava.» — R. D. A.',
  };
  L.narrador = {
    ancla: 'Entre la arena y el hierro oxidado hay una cajita de hojalata. Dentro, un pergamino enrollado con un sello: una R y un ancla.',
    calavera: 'Detrás de la calavera tallada hay un hueco. Alguien escondió un pergamino envuelto en hule.',
  };

  // ------------------------------------------------------------------ piratas de la Hiena
  L.hiena = {
    spot: ['«¡Así que tú eres el náufrago que busca MI fruta!»', '«¡Muchachos, que no salga vivo de aquí!»', '«¿Vienes a por la pista de Rogan? ¡Ven a quitármela!»'],
    rage: '«¡Ya basta de juegos! ¡Ahora vas a conocer a la Hiena de verdad!»',
    fall: '«Esto no ha terminado… Rogan… era mío…»',
  };
  // Gritos de los piratas (los tres tipos de voz dicen todas)
  const BARKS = ['«¡Eh! ¡Un intruso!»', '«¡A por él, muchachos!»', '«¡La capitana quiere su cabeza!»', '«¡Por la Hiena!»', '«¡Nadie toca nuestra fruta!»'];
  for (const k of ['pirata1', 'pirata2', 'pirata3']) L[k] = { spot: BARKS.slice() };

  // ------------------------------------------------------------------ tribu Shandara (Isla Tahuri)
  L.kalgor = {
    meet: '«Un náufrago con un Log de Mareas en la muñeca… Hacía veinte años que no veía uno. ¿Buscas las piedras que hablan?»',
    price: '«La escritura antigua no se regala. Tráeme 4 pescados asados y 2 mazorcas de cacao, y te enseñaré.»',
    offer: '«Buena ofrenda.» (Kalgor dibuja símbolos en la arena y te explica su significado durante horas.)',
    waiting: '«Te espero con 4 pescados asados y 2 mazorcas de cacao.»',
    stones: '«Aún te faltan piedras por leer. La del templo está en esta isla. Las demás, en la Isla Perdida, en Escarcha y en Brasa.»',
    twist: '«Así que la Marina Blanca hundió Aurea… y el Ancla del Mundo lo mantiene bajo el mar.» (Se quita el tocado. Debajo, una vieja cicatriz con forma de ancla.)',
    truth: '«Hace veinte años fui el segundo de a bordo de Rogan D. Aldor. Él encontró la Última Pieza y rió, porque el mundo aún no estaba listo. Tu naufragio no fue un accidente: la Marina Blanca iba tras ese Log. Ahora te toca decidir a ti.»',
    end: '«Construye un barco digno, reúne a tu tripulación y prepárate. Cuando el mar se calme en la Franja, zarparemos.»',
  };
  L.genbu = { hello: '«Perlas, doblones, pescado… todo tiene precio. ¿Qué me ofreces?»', deal: '«¡Trato hecho! ¿Algo más?»' };
  L.wypar = { talk: ['«La selva tiene ojos. No te alejes del sendero.»', '«Kalgor lleva años esperando a alguien como tú.»'] };
  L.kamakiro = { talk: ['«Los caimanes duermen junto al agua. No los despiertes.»', '«Si oyes tambores por la noche, no salgas de la aldea.»'] };
  L.aisha = { talk: ['«Las ranas azules son pequeñas, pero su veneno tumba a un jaguar.»', '«El mar se lleva a quien come las frutas malditas. Nunca lo olvides.»'] };
  L.laka = { talk: ['«Con cacao y agua caliente se hace algo delicioso. Pregúntale a Kalgor.»', '«¿Tú también vienes del mar? Hueles a sal y a madera quemada.»'] };
  L.brahan = { talk: ['«Dicen que en la isla del volcán la tierra sangra fuego.»', '«Algún día tendré mi propia canoa y veré el Lago Helado con mis ojos.»'] };
  for (const k of ['kalgor', 'genbu', 'wypar', 'kamakiro', 'aisha', 'laka', 'brahan']) L[k].hostil = '«¡Fuera de nuestra aldea, traidor!»';

  // ------------------------------------------------------------------ conversaciones entre personajes
  // Suenan solas cuando pasas cerca: los personajes se paran, se miran y hablan.
  // at: dónde ocurren · when(f): con qué banderas del prólogo · 'pirata' = cualquier pirata (A y B, distintos)
  const f0 = (f) => !f.metCrew, f1 = (f) => f.metCrew && !f.treasure, f2 = (f) => !!f.treasure;
  L.charlas = [
    // Campamento de la tripulación
    { at: 'crew', when: f0, lines: [
      ['mara', '«¿Alguien ha visto al novato? Iba en cubierta cuando nos alcanzó el cañonazo.»'],
      ['kaito', '«El mar no se lleva a los que tienen algo pendiente. Volverá.»'],
      ['crane', '«O está en la tripa de un tiburón. Perdón, capitana… es la costumbre.»'],
      ['bastian', '«Pues yo le guardo un plato de sopa. Por si acaso.»'],
    ] },
    { at: 'crew', lines: [
      ['bastian', '«Tres días en esta playa y ya he cocinado cangrejo de cuarenta maneras.»'],
      ['crane', '«Y las cuarenta sabían a cangrejo.»'],
      ['bastian', '«¡Porque es cangrejo, zoquete!»'],
      ['mara', '«Basta los dos. Guardad fuerzas: esta noche volverán los lobos.»'],
    ] },
    { at: 'crew', when: f1, lines: [
      ['crane', '«Esos piratas de la costa oeste tienen buenos mosquetes. Demasiado buenos para ser simples ladrones.»'],
      ['mara', '«La Hiena no trabaja sola. Alguien le paga… y apostaría a que lleva uniforme blanco.»'],
      ['kaito', '«Entonces, cuando llegue el momento, cortaremos los dos hilos a la vez.»'],
    ] },
    { at: 'crew', when: (f) => f.metCrew, lines: [
      ['kaito', '«El novato aprende rápido.»'],
      ['bastian', '«Ya lo creo. Ayer le enseñé a partir un coco de un puñetazo.»'],
      ['crane', '«Y hoy le duele la mano. Lo he visto frotársela.»'],
      ['bastian', '«¡Eso es entrenamiento!»'],
    ] },
    { at: 'crew', lines: [
      ['mara', '«Rogan D. Aldor… mi padre navegó con él, ¿sabéis? Decía que se reía como una tormenta.»'],
      ['kaito', '«¿Y por qué escondería una Fruta del Abismo en vez de comerla?»'],
      ['mara', '«Porque algunas cosas no se comen. Se protegen.»'],
    ] },
    { at: 'crew', lines: [
      ['crane', '«¿Habéis oído al viejo del lago? Habla solo por las noches.»'],
      ['kaito', '«No habla solo. Habla con el mar.»'],
      ['crane', '«Eso es todavía peor.»'],
    ] },
    { at: 'crew', lines: [
      ['bastian', '«¿Alguien quiere brochetas? Hay de jabalí… y de algo que no sé qué era.»'],
      ['crane', '«Yo paso. La última vez vi al algo moverse.»'],
      ['kaito', '«Yo sí. Un espadachín nunca rechaza la comida.»'],
    ] },
    { at: 'crew', when: f2, lines: [
      ['bastian', '«¡Una Fruta del Abismo de verdad! Dicen que saben a rayos.»'],
      ['crane', '«Y que si te caes al agua, te hundes como un ancla.»'],
      ['mara', '«Por eso necesitaremos un barco. Uno de verdad, no una balsa.»'],
      ['kaito', '«Y una tripulación que no se hunda con él.»'],
    ] },
    { at: 'crew', when: f2, lines: [
      ['mara', '«El Log de Mareas apunta al sur. Hacia Tahuri.»'],
      ['kaito', '«Dicen que allí vive una tribu que lee las piedras.»'],
      ['crane', '«Y que no les gustan los forasteros. Llevaré pólvora de sobra.»'],
    ] },
    // Campamento pirata (se oyen si los espías desde lejos)
    { at: 'piratas', lines: [
      ['pirata', '«¿Seguro que la fruta está en esta isla? Llevamos una semana cavando.»'],
      ['pirata', '«La capitana dice que sí. Y la capitana nunca se equivoca.»'],
      ['pirata', '«La capitana también dijo que el tesoro de Punta Negra era nuestro.»'],
      ['pirata', '«Baja la voz, idiota, que te oye.»'],
    ] },
    { at: 'piratas', lines: [
      ['pirata', '«Anoche vi luces en el lago. El brujo ese hace cosas raras.»'],
      ['pirata', '«Yo no me acerco a ese viejo ni loco. Dicen que convierte a la gente en cangrejos.»'],
      ['pirata', '«Eso explica por qué hay tantos cangrejos en esta isla…»'],
    ] },
    { at: 'piratas', when: (f) => !f.pirateBoss, lines: [
      ['hiena', '«¡Holgazanes! ¿Os pago para que miréis las olas?»'],
      ['pirata', '«No nos paga, capitana.»'],
      ['hiena', '«¡Exacto! ¡Así que a cavar!»'],
    ] },
    { at: 'piratas', when: (f) => !f.pirateBoss, lines: [
      ['hiena', '«Cuando tenga la fruta de Rogan, ni la Marina Blanca podrá tocarme.»'],
      ['pirata', '«¿Y nosotros, capitana?»'],
      ['hiena', '«Vosotros seguiréis cavando. Pero cavaréis para una leyenda.»'],
    ] },
    { at: 'piratas', when: (f) => f.pirateBoss, lines: [
      ['pirata', '«Sin la capitana… ¿quién manda ahora?»'],
      ['pirata', '«Yo. Porque tengo el mosquete más grande.»'],
      ['pirata', '«Ese mosquete es mío.»'],
    ] },
    // Aldea Shandara
    { at: 'aldea', lines: [
      ['aisha', '«Laka, ¿has visto el agua esta mañana? El mar ha cambiado de color.»'],
      ['laka', '«Kalgor dice que cuando el agua se oscurece, llegan forasteros.»'],
      ['aisha', '«Pues ya han llegado.»'],
    ] },
    { at: 'aldea', lines: [
      ['wypar', '«Kamakiro, anoche un jaguar rondaba el templo.»'],
      ['kamakiro', '«Los jaguares respetan el templo. Lo que me preocupa es otra cosa.»'],
      ['wypar', '«¿Los piratas?»'],
      ['kamakiro', '«La Marina Blanca. Sus velas se ven desde el acantilado.»'],
    ] },
    { at: 'aldea', lines: [
      ['genbu', '«Brahan, te cambio este collar de perlas por tu cerbatana.»'],
      ['brahan', '«¿Por un collar? ¡Mi cerbatana vale al menos tres!»'],
      ['genbu', '«Hecho. Tres collares… cuando encuentre más perlas.»'],
    ] },
    { at: 'aldea', lines: [
      ['kalgor', '«Las piedras negras hablan de un reino hundido, Laka.»'],
      ['laka', '«¿Aurea? Mi abuela cantaba canciones sobre Aurea.»'],
      ['kalgor', '«Tu abuela sabía más de lo que parecía.»'],
    ] },
    { at: 'aldea', lines: [
      ['brahan', '«Un día me iré al Lago Helado.»'],
      ['aisha', '«Te congelarás antes de llegar a la orilla.»'],
      ['brahan', '«Entonces llevaré dos mantas.»'],
    ] },
  ];
})();
