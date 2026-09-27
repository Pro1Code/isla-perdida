// Frases habladas de los personajes y la voz de cada uno.
// Cada frase tiene su propio audio en audio/voces/ (voces neuronales Piper, generadas con scripts/voces.js):
// si cambias o añades una frase, vuelve a ejecutar  node scripts/voces.js
// Solo se oye lo que va entre «comillas» (lo de fuera, como los contadores, no se lee en voz alta).
// La marca del principio {emoción} dice CÓMO se dice la frase (no se ve en el juego):
//   {mando} con autoridad · {grito} gritando · {furia} con rabia · {miedo} asustado, con voz temblorosa
//   {susurro} en voz baja, para historias misteriosas o aterradoras · {triste} · {alegre} · {burla} · {calma}
(function () {
  'use strict';
  const G = window.G;

  // Quita la marca de emoción para mostrar el texto
  G.stripMood = (t) => String(t == null ? '' : t).replace(/^\{\w+\}/, '');

  // Voz de cada personaje: modelo de Piper (v, y s = hablante en los que tienen varios),
  // tono (p: <1 más grave), ritmo (l: >1 más pausado), rudo: voz rasposa de lobo de mar (0 a 1),
  // viejo: temblor de la edad, lobo: marinero (marca mucho las erres), eco: voz de ultratumba.
  // Los marineros hablan con acento de España (como en el doblaje de piratas); la tribu Shandara, con otros.
  G.VOICES = {
    narrador: { name: '', v: 'davefx', p: 0.9, l: 1.12, lobo: true },
    vigia: { name: 'Vigía', v: 'sharvard', s: 0, p: 1.15, l: 0.9, lobo: true },
    silvano: { name: 'Silvano, el ermitaño', v: 'davefx', p: 0.86, l: 1.05, viejo: true, lobo: true },
    mara: { name: 'Capitana Mara', v: 'sharvard', s: 1, p: 0.95, l: 0.97, lobo: true },
    kaito: { name: 'Kaito', v: 'sharvard', s: 0, p: 1.02, l: 1.06, lobo: true },
    crane: { name: 'Crane', v: 'davefx', p: 1.1, l: 0.9, rudo: 0.1, lobo: true },
    bastian: { name: 'Bastián', v: 'sharvard', s: 0, p: 0.84, l: 0.95, rudo: 0.2, lobo: true },
    rogan: { name: 'Rogan D. Aldor', v: 'sharvard', s: 0, p: 0.8, l: 1.05, eco: true, lobo: true },
    hiena: { name: 'Capitana Hiena', v: 'sharvard', s: 1, p: 0.86, l: 0.92, rudo: 0.35, lobo: true },
    pirata1: { name: 'Pirata', v: 'davefx', p: 1.02, l: 0.88, rudo: 0.4, lobo: true },
    pirata2: { name: 'Pirata', v: 'sharvard', s: 0, p: 0.92, l: 0.9, rudo: 0.45, lobo: true },
    pirata3: { name: 'Pirata', v: 'davefx', p: 1.2, l: 0.86, rudo: 0.35, lobo: true },
    genbu: { name: 'Genbu', v: 'davefx', p: 1.16, l: 0.86, rudo: 0.1, lobo: true },
    wypar: { name: 'Wypar', v: 'davefx', p: 0.92, l: 1.0 },
    kalgor: { name: 'Anciano Kalgor', v: 'ald', p: 0.8, l: 1.1, viejo: true },
    kamakiro: { name: 'Kamakiro', v: 'ald', p: 1.0, l: 0.98 },
    brahan: { name: 'Brahan', v: 'ald', p: 1.25, l: 0.92 },
    aisha: { name: 'Aisha', v: 'claude', p: 1.02, l: 0.95 },
    laka: { name: 'Laka', v: 'daniela', p: 1.1, l: 0.92 },
  };

  const L = (G.LINES = {});

  // ------------------------------------------------------------------ cinemática de introducción
  L.cine = [
    ['narrador', '{susurro}Mar del Oeste. Hace tres noches…'],
    ['mara', '{grito}¡Mantened el rumbo, perros de mar! La isla está cerca… y la fruta de Rogan también.'],
    ['vigia', '{miedo}¡Ba… barco de la Marina Blanca a popa!'],
    ['mara', '{grito}¡Nos han encontrado! ¡Todos a cubierta, rápido!'],
    ['narrador', '{triste}Y la mar se lo tragó todo.'],
    ['silvano', '{alegre}¡Eh, tú! ¿Sigues vivo, grumete?'],
    ['silvano', '{calma}Tranquilo, náufrago. Estás en la Isla Perdida… y la mar no te trajo por casualidad.'],
  ];

  // ------------------------------------------------------------------ Silvano, el ermitaño
  L.silvano = {
    meet: [
      '{alegre}«¡Por las barbas de Neptuno! Creí que la mar te había llevado, grumete.»',
      '{calma}«Estás en la Isla Perdida. Anoche vi a la Marina Blanca hundir vuestro barco. Algunos de los tuyos llegaron a la costa este, junto al viejo naufragio.»',
      '{susurro}«Escucha bien: no naufragasteis aquí por casualidad. Rogan D. Aldor, el Rey de las Mareas, escondió en esta isla una Fruta del Abismo.»',
      '{miedo}«Quien la come gana un poder… y la mar lo rechaza para siempre. Tu capitana la buscaba. Y los perros de la Hiena, en la costa oeste, también.»',
      '{mando}«Enciende un fuego antes del anochecer: los lobos salen con la oscuridad. Luego busca a tu gente. Yo vivo junto al lago… ven cuando quieras aprender algo más que a sobrevivir.»',
    ],
    teach: '{susurro}«Las mareas tienen memoria, grumete, y quien sabe escucharlas puede pedirles favores. ¿Quieres aprender la magia de las mareas?»',
    how: '{mando}«Toma mi viejo bastón. Clic: lanzas una chispa arcana. Q: llamas al rayo. Gasta maná, que vuelve solo. Practica con el tótem de runas: 5 chispas.»',
    train: '{calma}«El tótem espera, grumete. Bastón en mano, apunta y haz clic.»',
    done: '{alegre}«Bien hecho… las mareas ya te escuchan.»',
    clues: [
      '{calma}«Aún no tienes ninguna de las 3 pistas de Rogan. Ese viejo lobo de mar escribía en acertijos.»',
      '{calma}«Llevas una de las 3 pistas de Rogan. Ese viejo lobo de mar escribía en acertijos.»',
      '{calma}«Llevas dos de las 3 pistas de Rogan. Ya casi lo tienes, grumete.»',
    ],
    dig: '{alegre}«¡Tres pistas! ¡Entonces ya sabes dónde cavar! Date prisa, antes que los piratas.»',
    fruit: '{susurro}«Ya tienes la fruta… o ya la llevas dentro. Desde hoy la mar es tu enemiga… y tu camino.»',
    tips: [
      '{calma}«En Isla Tahuri vive una tribu que sabe leer las piedras negras. Su jefe, Kalgor, sabe más de lo que cuenta.»',
      '{calma}«En el nivel 3 de la magia aprenderás la Marea curativa (Z). Tu tripulación te lo agradecerá.»',
      '{triste}«Rogan pasó por aquí hace veinte años. Nunca volvió a sonreír como aquel día.»',
    ],
    // Habla solo cuando pasas cerca de su cabaña
    solo: [
      '{susurro}«Las mareas están inquietas hoy… algo se acerca desde el fondo.»',
      '{triste}«Veinte años esperando… y la mar por fin trae a alguien.»',
      '{calma}«Raíz de mangle, lodo del lago, pluma de gaviota… no, no, eso era para la tos.»',
      '{triste}«Rogan, viejo loco. ¿Por qué aquí? ¿Por qué ahora?»',
      '{miedo}«Si la luna sale roja, mañana habrá tormenta. Y algo peor…»',
    ],
  };

  // ------------------------------------------------------------------ la tripulación
  L.mara = {
    meet: [
      '{alegre}«¡Por los siete mares, estás vivo! Creí que te habíamos perdido, grumete.»',
      '{furia}«La Marina Blanca nos hundió sin aviso, ¡malditas ratas de sentina! Iban tras lo mismo que nosotros: la fruta que Rogan escondió en esta isla.»',
      '{mando}«Rogan dejó tres pistas. La primera, bajo el ancla del viejo naufragio de esta playa. La segunda, en la piedra de la calavera del lago. La tercera… se la robó la Hiena.»',
      '{mando}«La capitana pirata de la costa oeste. No vayas a por ella sin saber pelear: Kaito, Crane y Bastián te enseñarán. Y coge el Log de Mareas de los cofres del naufragio. ¡Es una orden!»',
    ],
    treasure: '{mando}«¿La tienes? Es tuya: tú la encontraste. Piénsalo bien antes de comerla. Ahora construye una balsa: el Log de Mareas nos guiará a la siguiente isla.»',
    clues3: '{grito}«¡Las tres pistas, por Neptuno! Mira tu mapa: Rogan marcó el sitio con una ✖. ¡A cavar, grumete!»',
    clue1: '{mando}«La primera pista está bajo el ancla oxidada, junto al viejo naufragio. Aquí mismo, en la playa.»',
    clue2: '{mando}«La segunda está en la piedra de la calavera, a la orilla del lago. El viejo Silvano vive cerca.»',
    clue3: [
      '{mando}«La última la tiene la Hiena, en la costa oeste. Aprende antes a pelear con la tripulación: no quiero enterrarte en esta playa.»',
      '{mando}«La última la tiene la Hiena, en la costa oeste. Ya sabes pelear: ve con cuidado y llévate comida.»',
    ],
  };
  L.kaito = {
    intro: '{calma}«¿Quieres aprender a usar una espada? No es agitar un palo, compañero: es respirar con el acero.»',
    how: '{mando}«Toma mi katana de repuesto. Clic para cortar, Q para el corte volador. Golpea el muñeco de paja 10 veces.»',
    train: '{calma}«Sigue con el muñeco de paja. El acero aprende a la vez que tú.»',
    done: '{alegre}«Buen trabajo. Tu acero ya respira contigo.»',
    tips: [
      '{calma}«Una buena espada corta hasta el viento. Literalmente: Q.»',
      '{calma}«En el nivel 3 te enseñaré el Torbellino (Z): perfecto cuando te rodean los piratas.»',
      '{calma}«En el horno puedes forjar sables. Y con obsidiana, una katana digna de un capitán.»',
    ],
  };
  L.crane = {
    intro: '{burla}«¿Sabes lo que es una pistola de chispa, marinero de agua dulce? Ruido, humo… y un agujero donde apuntas. ¿Te enseño?»',
    how: '{mando}«Toma esta pistola y 15 balas. Clic para disparar: la bala va donde miras. Acierta 5 veces a la diana.»',
    train: '{burla}«Sigue disparando a la diana. Respira, apunta… y no le des a una gaviota.»',
    done: '{alegre}«¡Rayos y truenos, buen pulso! Ya estás listo para la pólvora de verdad.»',
    tips: [
      '{calma}«Las balas se hacen en el horno: hierro y pólvora. La pólvora, con azufre y carbón.»',
      '{calma}«El mosquete pega fuerte y llega lejos, pero recarga despacio. Elige bien el momento.»',
      '{burla}«Q: disparo certero. Respira, apunta… y no falles, que la pólvora cuesta doblones.»',
    ],
  };
  L.bastian = {
    intro: '{alegre}«¡Jo, jo! En la cocina y en la pelea lo que cuenta son las piernas. ¿Te enseño a pelear sin armas, grumete?»',
    how: '{mando}«Deja las manos vacías (un hueco sin nada en la barra rápida). Clic para golpear, Q para la patada huracán. Dale 12 golpes al saco.»',
    train: '{alegre}«¡Sigue dándole al saco! Los puños se hacen a golpes, como la masa del pan.»',
    done: '{alegre}«¡Eso es, por mil ollas hirviendo! Ya pegas como un marinero de verdad.»',
    tips: [
      '{calma}«Las manos vacías también son un arma. Deja la barra rápida en un hueco sin nada.»',
      '{alegre}«Cada tercer golpe pega más fuerte. Cuenta conmigo: uno, dos… ¡tres!»',
      '{alegre}«La Patada huracán (Q) aparta a cualquier rata que se acerque demasiado.»',
    ],
  };

  // ------------------------------------------------------------------ pistas de Rogan y lugares
  L.rogan = {
    pista_1: '{susurro}«Primera palabra: al sur, donde la arena se vuelve roca.» — R. D. A.\n(En el reverso hay un dibujo: una calavera junto a un lago.)',
    pista_2: '{susurro}«Segunda palabra: busca la palmera que se inclina hacia la mar.» — R. D. A.\n(Falta un trozo del pergamino. Hay marcas de cuchillo… y huellas de botas pirata.)',
    pista_3: '{susurro}«Tercera palabra: a sus pies, donde la gaviota de piedra mira al horizonte, cava.» — R. D. A.',
  };
  L.narrador = {
    ancla: '{susurro}Entre la arena y el hierro oxidado hay una cajita de hojalata. Dentro, un pergamino enrollado con un sello: una R y un ancla.',
    calavera: '{susurro}Detrás de la calavera tallada hay un hueco. Alguien escondió un pergamino envuelto en hule.',
  };

  // ------------------------------------------------------------------ piratas de la Hiena
  L.hiena = {
    spot: [
      '{burla}«¡Jajaja! ¡Así que tú eres el náufrago que busca MI fruta!»',
      '{furia}«¡Muchachos, que no salga vivo de aquí! ¡A por él!»',
      '{burla}«¿Vienes a por la pista de Rogan? ¡Ven a quitármela, rata de playa!»',
    ],
    rage: '{furia}«¡Ya basta de juegos! ¡Ahora vas a conocer a la Hiena de verdad!»',
    fall: '{triste}«Esto no ha terminado… Rogan… era mío…»',
  };
  // Gritos de los piratas (los tres tipos de voz dicen todas)
  const BARKS = ['{grito}«¡Eh! ¡Un intruso en el campamento!»', '{furia}«¡A por él, perros sarnosos!»', '{grito}«¡La capitana quiere su cabeza!»', '{furia}«¡Por la Hiena y por el oro!»', '{burla}«¡Arrr! ¡Nadie toca nuestra fruta!»'];
  for (const k of ['pirata1', 'pirata2', 'pirata3']) L[k] = { spot: BARKS.slice() };

  // ------------------------------------------------------------------ tribu Shandara (Isla Tahuri)
  L.kalgor = {
    meet: '{calma}«Un náufrago con un Log de Mareas en la muñeca… Hacía veinte años que la marea no traía uno. ¿Buscas las piedras que hablan?»',
    price: '{mando}«La escritura antigua no se regala. Tráeme 4 pescados asados y 2 mazorcas de cacao, y te enseñaré.»',
    offer: '{alegre}«Buena ofrenda.» (Kalgor dibuja símbolos en la arena y te explica su significado durante horas.)',
    waiting: '{calma}«Te espero con 4 pescados asados y 2 mazorcas de cacao.»',
    stones: '{calma}«Aún te faltan piedras por leer. La del templo está en esta isla. Las demás, en la Isla Perdida, en Escarcha y en Brasa.»',
    twist: '{susurro}«Así que la Marina Blanca hundió Aurea… y el Ancla del Mundo lo mantiene bajo la mar.» (Se quita el tocado. Debajo, una vieja cicatriz con forma de ancla.)',
    truth: '{calma}«Hace veinte años fui el segundo de a bordo de Rogan D. Aldor. Él encontró la Última Pieza y rió, porque el mundo aún no estaba listo. Tu naufragio no fue un accidente: la Marina Blanca iba tras ese Log. Ahora te toca decidir a ti.»',
    end: '{mando}«Construye un barco digno, reúne a tu tripulación y prepárate. Cuando la mar se calme en la Franja, zarparemos.»',
  };
  L.genbu = { hello: '{alegre}«¡Perlas, doblones, pescado… todo tiene su precio en esta costa, marinero! ¿Qué me ofreces?»', deal: '{alegre}«¡Trato hecho, por Neptuno! ¿Algo más?»' };
  L.wypar = { talk: ['{mando}«La selva tiene ojos. No te alejes del sendero.»', '{calma}«Kalgor lleva años esperando a alguien como tú.»'] };
  L.kamakiro = { talk: ['{miedo}«Los caimanes duermen junto al agua. No los despiertes.»', '{susurro}«Si oyes tambores por la noche, no salgas de la aldea.»'] };
  L.aisha = { talk: ['{calma}«Las ranas azules son pequeñas, pero su veneno tumba a un jaguar.»', '{triste}«La mar se lleva a quien come las frutas malditas. Nunca lo olvides.»'] };
  L.laka = { talk: ['{alegre}«Con cacao y agua caliente se hace algo delicioso. Pregúntale a Kalgor.»', '{alegre}«¿Tú también vienes del mar? Hueles a sal y a madera quemada.»'] };
  L.brahan = { talk: ['{miedo}«Dicen que en la isla del volcán la tierra sangra fuego.»', '{alegre}«Algún día tendré mi propia canoa y veré el Lago Helado con mis propios ojos.»'] };
  for (const k of ['kalgor', 'genbu', 'wypar', 'kamakiro', 'aisha', 'laka', 'brahan']) L[k].hostil = '{furia}«¡Fuera de nuestra aldea, traidor!»';

  // ------------------------------------------------------------------ conversaciones entre personajes
  // Suenan solas cuando pasas cerca: los personajes se paran, se miran y hablan.
  // at: dónde ocurren · when(f): con qué banderas del prólogo · 'pirata' = cualquier pirata (A y B, distintos)
  const f0 = (f) => !f.metCrew, f1 = (f) => f.metCrew && !f.treasure, f2 = (f) => !!f.treasure;
  L.charlas = [
    // Campamento de la tripulación
    { at: 'crew', when: f0, lines: [
      ['mara', '{triste}«¿Alguien ha visto al novato? Estaba en cubierta cuando nos alcanzó el cañonazo.»'],
      ['kaito', '{calma}«La mar no se lleva a los que tienen algo pendiente. Volverá.»'],
      ['crane', '{burla}«O está en la tripa de un tiburón. Perdón, capitana… es la costumbre.»'],
      ['bastian', '{triste}«Pues yo le guardo un plato de sopa. Por si acaso.»'],
    ] },
    { at: 'crew', lines: [
      ['bastian', '{alegre}«¡Tres días en esta playa y ya he cocinado cangrejo de cuarenta maneras!»'],
      ['crane', '{burla}«Y las cuarenta sabían a cangrejo.»'],
      ['bastian', '{furia}«¡Porque es cangrejo, zoquete!»'],
      ['mara', '{mando}«¡Basta los dos! Guardad fuerzas: esta noche volverán los lobos.»'],
    ] },
    { at: 'crew', when: f1, lines: [
      ['crane', '{calma}«Esos piratas de la costa oeste tienen buenos mosquetes. Demasiado buenos para ser simples ladrones.»'],
      ['mara', '{mando}«La Hiena no trabaja sola. Alguien le paga… y apuesto mi sombrero a que viste uniforme blanco.»'],
      ['kaito', '{calma}«Entonces, cuando llegue el momento, cortaremos los dos cabos a la vez.»'],
    ] },
    { at: 'crew', when: (f) => f.metCrew, lines: [
      ['kaito', '{calma}«El novato aprende rápido.»'],
      ['bastian', '{alegre}«¡Ya lo creo! Ayer le enseñé a partir un coco de un puñetazo.»'],
      ['crane', '{burla}«Y hoy le duele la mano. Lo he visto frotársela.»'],
      ['bastian', '{alegre}«¡Eso es entrenamiento, marinero!»'],
    ] },
    { at: 'crew', lines: [
      ['mara', '{triste}«Rogan D. Aldor… mi padre navegó con él, ¿sabéis? Decía que se reía como una tormenta.»'],
      ['kaito', '{calma}«¿Y por qué escondería una Fruta del Abismo en vez de comerla?»'],
      ['mara', '{mando}«Porque hay cosas que no se comen, Kaito. Se protegen.»'],
    ] },
    { at: 'crew', lines: [
      ['crane', '{miedo}«¿Habéis oído al viejo del lago? Habla solo por las noches.»'],
      ['kaito', '{calma}«No habla solo. Habla con la mar.»'],
      ['crane', '{miedo}«Eso es todavía peor.»'],
    ] },
    { at: 'crew', lines: [
      ['bastian', '{alegre}«¿Alguien quiere brochetas? Hay de jabalí… y de algo que no sé qué era.»'],
      ['crane', '{burla}«Yo paso. La última vez vi al algo moverse.»'],
      ['kaito', '{calma}«Yo sí. Un espadachín nunca rechaza la comida.»'],
    ] },
    { at: 'crew', lines: [
      ['crane', '{susurro}«¿Sabéis por qué los marineros viejos no silban en cubierta?»'],
      ['bastian', '{miedo}«¿Por qué?»'],
      ['crane', '{susurro}«Porque el silbido llama a la serpiente del fondo… y ella siempre contesta.»'],
      ['bastian', '{miedo}«¡Por mil ollas! Pues yo no vuelvo a silbar en mi vida.»'],
    ] },
    { at: 'crew', lines: [
      ['mara', '{triste}«Perdimos a buena gente en ese naufragio.»'],
      ['kaito', '{triste}«Que la mar les dé el descanso que merecen.»'],
      ['mara', '{furia}«Y que la Marina Blanca pague por cada uno de ellos. ¡Lo juro por mi barco!»'],
    ] },
    { at: 'crew', when: f2, lines: [
      ['bastian', '{alegre}«¡Una Fruta del Abismo de verdad! Dicen que saben a rayos.»'],
      ['crane', '{burla}«Y que si te caes al agua, te hundes como un ancla.»'],
      ['mara', '{mando}«Por eso necesitaremos un barco. Uno de verdad, no una balsa.»'],
      ['kaito', '{calma}«Y una tripulación que no se hunda con él.»'],
    ] },
    { at: 'crew', when: f2, lines: [
      ['mara', '{mando}«El Log de Mareas apunta al sur. Hacia Tahuri. ¡Preparad las velas!»'],
      ['kaito', '{calma}«Dicen que allí vive una tribu que lee las piedras.»'],
      ['crane', '{calma}«Y que no les gustan los forasteros. Llevaré pólvora de sobra.»'],
    ] },
    // Campamento pirata (se oyen si los espías desde lejos)
    { at: 'piratas', lines: [
      ['pirata', '{triste}«¿Seguro que la fruta está en esta isla? Llevamos una semana cavando.»'],
      ['pirata', '{mando}«La capitana dice que sí. Y la capitana nunca se equivoca.»'],
      ['pirata', '{burla}«La capitana también dijo que el tesoro de Punta Negra era nuestro.»'],
      ['pirata', '{miedo}«¡Baja la voz, idiota, que te oye!»'],
    ] },
    { at: 'piratas', lines: [
      ['pirata', '{miedo}«Anoche vi luces en el lago. El brujo ese hace cosas raras.»'],
      ['pirata', '{miedo}«Yo no me acerco a ese viejo ni loco. Dicen que convierte a la gente en cangrejos.»'],
      ['pirata', '{burla}«Eso explica por qué hay tantos cangrejos en esta isla…»'],
    ] },
    { at: 'piratas', lines: [
      ['pirata', '{susurro}«¿Has oído hablar del Holandés de las Mareas? Un barco sin tripulación que navega contra el viento.»'],
      ['pirata', '{miedo}«Cállate… esas historias traen mala suerte.»'],
      ['pirata', '{susurro}«Dicen que quien lo ve… no vuelve a pisar tierra.»'],
    ] },
    { at: 'piratas', when: (f) => !f.pirateBoss, lines: [
      ['hiena', '{furia}«¡Holgazanes! ¿Os pago para que miréis las olas?»'],
      ['pirata', '{miedo}«No nos paga, capitana…»'],
      ['hiena', '{furia}«¡Exacto! ¡Así que a cavar, ratas de sentina!»'],
    ] },
    { at: 'piratas', when: (f) => !f.pirateBoss, lines: [
      ['hiena', '{burla}«Cuando tenga la fruta de Rogan, ni la Marina Blanca podrá tocarme. ¡Jajaja!»'],
      ['pirata', '{miedo}«¿Y nosotros, capitana?»'],
      ['hiena', '{burla}«Vosotros seguiréis cavando. Pero cavaréis para una leyenda.»'],
    ] },
    { at: 'piratas', when: (f) => f.pirateBoss, lines: [
      ['pirata', '{triste}«Sin la capitana… ¿quién manda ahora?»'],
      ['pirata', '{mando}«Yo. Porque tengo el mosquete más grande.»'],
      ['pirata', '{furia}«¡Ese mosquete es mío, bribón!»'],
    ] },
    // Aldea Shandara
    { at: 'aldea', lines: [
      ['aisha', '{calma}«Laka, ¿has visto el agua esta mañana? La mar ha cambiado de color.»'],
      ['laka', '{susurro}«Kalgor dice que cuando el agua se oscurece, llegan forasteros.»'],
      ['aisha', '{miedo}«Pues ya han llegado.»'],
    ] },
    { at: 'aldea', lines: [
      ['wypar', '{miedo}«Kamakiro, anoche un jaguar rondaba el templo.»'],
      ['kamakiro', '{calma}«Los jaguares respetan el templo. Lo que me preocupa es otra cosa.»'],
      ['wypar', '{miedo}«¿Los piratas?»'],
      ['kamakiro', '{susurro}«La Marina Blanca. Sus velas se ven desde el acantilado.»'],
    ] },
    { at: 'aldea', lines: [
      ['genbu', '{alegre}«Brahan, te cambio este collar de perlas por tu cerbatana.»'],
      ['brahan', '{furia}«¿Por un collar? ¡Mi cerbatana vale al menos tres!»'],
      ['genbu', '{alegre}«Hecho. Tres collares… cuando encuentre más perlas.»'],
    ] },
    { at: 'aldea', lines: [
      ['kalgor', '{susurro}«Las piedras negras hablan de un reino hundido, Laka.»'],
      ['laka', '{alegre}«¿Aurea? Mi abuela cantaba canciones sobre Aurea.»'],
      ['kalgor', '{calma}«Tu abuela sabía más de lo que parecía.»'],
    ] },
    { at: 'aldea', lines: [
      ['brahan', '{alegre}«Un día me iré al Lago Helado.»'],
      ['aisha', '{burla}«Te congelarás antes de llegar a la orilla.»'],
      ['brahan', '{alegre}«Entonces llevaré dos mantas.»'],
    ] },
  ];
})();
