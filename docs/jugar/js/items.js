// Objetos, recetas, inventario y modelos 3D de los objetos en la mano
(function () {
  'use strict';
  const G = window.G, U = G.U;

  G.ITEMS = {
    palo:        { n: 'Palo', i: '🥢', stack: 30, d: 'Rama resistente. Base de casi todas las herramientas.' },
    madera:      { n: 'Madera', i: '🪵', stack: 50, d: 'Se consigue talando árboles con un hacha.' },
    piedra:      { n: 'Piedra', i: '🪨', stack: 30, d: 'Recógela del suelo o pica rocas con un pico.' },
    silex:       { n: 'Sílex', i: '🔷', stack: 20, d: 'Piedra afilada. Aparece cerca de las rocas y en la playa.' },
    fibra:       { n: 'Fibra vegetal', i: '🌾', stack: 50, d: 'De la hierba alta. Sirve para atar y tejer.' },
    baya:        { n: 'Bayas', i: '🍒', stack: 20, d: 'Un bocado dulce.', use: { hunger: 7, thirst: 3 } },
    coco:        { n: 'Coco', i: '🥥', stack: 10, d: 'Comida y agua a la vez. Caen de las palmeras.', use: { hunger: 10, thirst: 22 } },
    carne_cruda: { n: 'Carne cruda', i: '🥩', stack: 10, d: 'Mejor cocinarla en una fogata (E con la carne en la mano).', use: { hunger: 12, health: -6, sick: 0.45 } },
    carne_cocida:{ n: 'Carne asada', i: '🍖', stack: 10, d: 'Muy nutritiva.', use: { hunger: 38, health: 5 } },
    cuero:       { n: 'Cuero', i: '🟤', stack: 10, d: 'Se obtiene cazando jabalíes y lobos. Sirve de vela.' },
    cuenco:      { n: 'Cuenco de madera', i: '🥣', stack: 5, d: 'Llénalo en un lago: con el cuenco en la mano, mira al agua y pulsa E.' },
    agua_sucia:  { n: 'Agua sin hervir', i: '🫗', stack: 5, d: 'Puede enfermarte. Hiérvela en una fogata.', use: { thirst: 28, health: -4, sick: 0.35, ret: 'cuenco' } },
    agua_limpia: { n: 'Agua hervida', i: '💧', stack: 5, d: 'Agua potable y segura.', use: { thirst: 45, ret: 'cuenco' } },
    venda:       { n: 'Venda', i: '🩹', stack: 10, d: 'Cura heridas.', use: { health: 25 } },
    hacha:       { n: 'Hacha de piedra', i: '🪓', tool: true, toolType: 'hacha', power: 1, dur: 120, dmg: 12, d: 'Tala árboles. También sirve como arma.' },
    pico:        { n: 'Pico de piedra', i: '⛏️', tool: true, toolType: 'pico', power: 1, dur: 120, dmg: 10, d: 'Rompe rocas y extrae mineral de hierro.' },
    lanza:       { n: 'Lanza de sílex', i: '🔱', tool: true, dur: 70, dmg: 24, reach: 4.2, d: 'Buena arma con mayor alcance.' },
    antorcha:    { n: 'Antorcha', i: '🔥', tool: true, dur: 180, dmg: 6, torch: true, d: 'Ilumina la noche y las cuevas. Se consume con el tiempo.' },
    // --- Pesca y cocina
    cana:        { n: 'Caña de pescar', i: '🎣', tool: true, dur: 60, dmg: 3, fishing: true, d: 'Apunta al agua y haz clic para lanzar. Cuando pique, ¡clic otra vez!' },
    pez_crudo:   { n: 'Pescado crudo', i: '🐟', stack: 10, d: 'Ásalo en una fogata.', use: { hunger: 8, health: -3, sick: 0.3 } },
    pez_asado:   { n: 'Pescado asado', i: '🍤', stack: 10, d: 'Nutritivo y ligero.', use: { hunger: 26, health: 3 } },
    almeja:      { n: 'Almejas', i: '🦪', stack: 20, d: 'Se recogen en la orilla. Mejor cocinadas.', use: { hunger: 5, sick: 0.25 } },
    almeja_asada:{ n: 'Almejas asadas', i: '🥘', stack: 20, d: 'Un bocado de mar.', use: { hunger: 14, thirst: 2 } },
    brocheta:    { n: 'Brocheta de pescado', i: '🍢', stack: 10, d: 'Pescado ensartado y dorado al fuego.', use: { hunger: 32, health: 5 } },
    sopa:        { n: 'Sopa de coco y pescado', i: '🍲', stack: 5, d: 'Llena, hidrata y calienta el cuerpo.', use: { hunger: 34, thirst: 30, health: 10, warm: 22, ret: 'cuenco' } },
    hierba:      { n: 'Hierba medicinal', i: '🌿', stack: 20, d: 'Crece a la sombra de los árboles. En la nieve, busca liquen.' },
    infusion:    { n: 'Infusión de hierbas', i: '🍵', stack: 5, d: 'Cura enfermedad y veneno, y te calienta.', use: { thirst: 20, health: 15, cure: true, warm: 25, ret: 'cuenco' } },
    cataplasma:  { n: 'Cataplasma de hierbas', i: '💊', stack: 10, d: 'Cura heridas graves y neutraliza el veneno.', use: { health: 40, cure: true } },
    bambu:       { n: 'Bambú', i: '🎋', stack: 40, d: 'Caña hueca y resistente de la selva de Tahuri.' },
    cacao:       { n: 'Mazorca de cacao', i: '🫘', stack: 20, d: 'Fruto de la selva de Tahuri. Amargo, pero da energía.', use: { hunger: 6, stamina: 25 } },
    chocolate:   { n: 'Chocolate caliente', i: '☕', stack: 5, d: 'Receta shandara: calienta muchísimo. Ideal en Isla Escarcha.', use: { hunger: 12, thirst: 18, health: 6, warm: 40, ret: 'cuenco' } },
    // --- Metal y exploración
    mineral_hierro: { n: 'Mineral de hierro', i: '🔶', stack: 30, d: 'Vetas oxidadas en cuevas y montañas. Fúndelo en un horno.' },
    mineral_plata:  { n: 'Mineral de plata', i: '🥈', stack: 30, d: 'Vetas brillantes de Isla Escarcha. Para instrumentos finos.' },
    obsidiana:   { n: 'Obsidiana', i: '⬛', stack: 20, d: 'Vidrio volcánico muy afilado. Requiere pico de hierro.' },
    lingote:     { n: 'Lingote de hierro', i: '🔩', stack: 20, d: 'Hierro fundido listo para forjar herramientas.' },
    carbon:      { n: 'Carbón', i: '🌑', stack: 30, d: 'De las vetas de Isla Brasa o quemando madera en un horno.' },
    azufre:      { n: 'Azufre', i: '🟡', stack: 30, d: 'Cristales amarillos del volcán. Ingrediente de la pólvora.' },
    polvora:     { n: 'Pólvora', i: '🧂', stack: 40, d: 'Azufre y carbón molidos. Munición para los cañones.' },
    bala_canon:  { n: 'Bala de cañón', i: '⚫', stack: 30, d: 'Esfera de hierro macizo. Se dispara con pólvora.' },
    clavos:      { n: 'Clavos', i: '📌', stack: 60, d: 'Para unir tablas. Imprescindibles en el astillero.' },
    tabla:       { n: 'Tabla', i: '📏', stack: 50, d: 'Madera cepillada en el banco de carpintero.' },
    cuerda:      { n: 'Cuerda', i: '🧵', stack: 40, d: 'Fibra trenzada. Jarcias, redes y velas.' },
    tela_vela:   { n: 'Lona', i: '🏳️', stack: 20, d: 'Tela resistente para velas.' },
    cristal_hielo: { n: 'Cristal de hielo', i: '🧊', stack: 20, d: 'Nunca se derrite. Transparente como el vidrio.' },
    perla:       { n: 'Perla', i: '⚪', stack: 30, d: 'Tesoro del arrecife. Los shandara la valoran mucho.' },
    doblon:      { n: 'Moneda de oro antigua', i: '🥇', stack: 99, d: 'Moneda antigua del Reino de Aurea. Sirve para comerciar con la tribu.' },
    piel_gruesa: { n: 'Piel gruesa', i: '🐾', stack: 10, d: 'De osos y lobos de las nieves. Muy abrigada.' },
    grasa:       { n: 'Grasa de foca', i: '🧈', stack: 20, d: 'Arde mucho tiempo. Sirve para antorchas.' },
    veneno:      { n: 'Veneno de rana', i: '🧪', stack: 20, d: 'De las ranas azules de Tahuri. Para dardos.' },
    colmillo:    { n: 'Colmillo gigante', i: '🦷', stack: 5, d: 'Trofeo del jabalí gigante. ¡Presúmelo!' },
    hacha_hierro:{ n: 'Hacha de hierro', i: '🪓', tool: true, toolType: 'hacha', power: 2, dur: 300, dmg: 20, d: 'Tala el doble de rápido y da el doble de madera.' },
    pico_hierro: { n: 'Pico de hierro', i: '⛏️', tool: true, toolType: 'pico', power: 2, dur: 300, dmg: 16, d: 'Pica el doble de rápido y puede extraer obsidiana.' },
    lanza_obsidiana: { n: 'Lanza de obsidiana', i: '🗡️', tool: true, dur: 120, dmg: 38, reach: 4.4, d: 'Arma letal de filo volcánico.' },
    cerbatana:   { n: 'Cerbatana', i: '🎐', tool: true, dur: 200, dmg: 2, blowgun: true, d: 'Arma shandara. Clic: dispara un dardo venenoso a distancia.' },
    dardo:       { n: 'Dardo venenoso', i: '📍', stack: 40, d: 'Munición de la cerbatana. Envenena a la presa.' },
    arpon:       { n: 'Arpón', i: '🪝', tool: true, dur: 150, dmg: 30, reach: 4.8, harpoon: true, d: 'Pesca peces grandes y hiere a las bestias del mar.' },
    catalejo:    { n: 'Catalejo', i: '🔭', tool: true, dur: 9999, dmg: 1, spyglass: true, d: 'Clic derecho: mirar a lo lejos (zoom).' },
    pala:        { n: 'Pala', i: '⚒️', tool: true, dur: 200, dmg: 8, shovel: true, d: 'Para desenterrar tesoros marcados con una X.' },
    log_mareas:  { n: 'Log de Mareas', i: '🧭', stack: 1, compass: true, d: 'Brújula de pulsera. Su aguja señala tu siguiente destino.' },
    diario:      { n: 'Diario del capitán', i: '📔', stack: 1, read: 'diario', d: 'Páginas mojadas de un viejo diario. Clic derecho: leer.' },
    fragmento_mapa: { n: 'Fragmento de mapa', i: '🗺️', stack: 4, d: 'Un trozo del mapa del tesoro. Llévalo a la bandera de tu equipo.' },
    // --- Frutas del Abismo (se pierden al morir)
    fruta_llama:  { n: 'Fruta Llama-Llama', i: '🍊', stack: 1, fruit: 'llama', d: 'Fruta del Abismo. Poder del fuego. No podrás nadar nunca más.' },
    fruta_hielo:  { n: 'Fruta Hielo-Hielo', i: '🍇', stack: 1, fruit: 'hielo', d: 'Fruta del Abismo. Congela el mar bajo tus pies. No podrás nadar.' },
    fruta_muelle: { n: 'Fruta Muelle-Muelle', i: '🍐', stack: 1, fruit: 'muelle', d: 'Fruta del Abismo. Saltos enormes. No podrás nadar.' },
    fruta_humo:   { n: 'Fruta Humo-Humo', i: '🍈', stack: 1, fruit: 'humo', d: 'Fruta del Abismo. Los animales no te ven de noche. No podrás nadar.' },
    fruta_roca:   { n: 'Fruta Roca-Roca', i: '🥭', stack: 1, fruit: 'roca', d: 'Fruta del Abismo. Piel de piedra: mucho menos daño. No podrás nadar.' },
    // --- Equipo (ranuras de cabeza, pecho, piernas y pies)
    // eq: { slot, armor (fracción de daño que evita), cold, heat (protección), speed/swim/oxy (multiplicadores), lava, snow, tribe }
    sombrero_paja: { n: 'Sombrero de paja', i: '👒', stack: 1, eq: { slot: 'head', armor: 0.02, heat: 0.35 }, d: 'Fibra trenzada con cinta roja. Protege del sol… y dicen que da suerte a los futuros reyes del mar.' },
    casco_cuero:  { n: 'Casco de cuero', i: '🪖', stack: 1, eq: { slot: 'head', armor: 0.08 }, d: 'Cuero endurecido. Protección básica.' },
    gorro_piel:   { n: 'Gorro de piel', i: '🧢', stack: 1, eq: { slot: 'head', armor: 0.04, cold: 0.3 }, d: 'Con orejeras. Imprescindible en la nieve.' },
    casco_hierro: { n: 'Casco de hierro', i: '⛑️', stack: 1, eq: { slot: 'head', armor: 0.15, speed: 0.99 }, d: 'Acero con protector nasal. Mucha protección.' },
    casco_buceo:  { n: 'Casco de buceo', i: '🤿', stack: 1, eq: { slot: 'head', armor: 0.05, oxy: 3 }, d: 'Equípalo en la cabeza: triplica el aire bajo el agua.' },
    tocado_shandara: { n: 'Tocado shandara', i: '🪶', stack: 1, eq: { slot: 'head', armor: 0.06, tribe: true }, d: 'Plumas de guerrero. Los shandara te tratan como a uno de los suyos.' },
    bicornio:     { n: 'Bicornio de capitán', i: '🎩', stack: 1, eq: { slot: 'head', armor: 0.07, cold: 0.1 }, d: 'Sombrero de capitán pirata con calavera dorada.' },
    chaleco_fibra: { n: 'Chaleco de fibra', i: '🦺', stack: 1, eq: { slot: 'chest', armor: 0.03, heat: 0.1 }, d: 'Ligero y fresco. Algo es algo.' },
    chaqueta_cuero: { n: 'Chaqueta de cuero', i: '🥋', stack: 1, eq: { slot: 'chest', armor: 0.1 }, d: 'Resistente a arañazos y mordiscos.' },
    abrigo:       { n: 'Abrigo de piel', i: '🧥', stack: 1, eq: { slot: 'chest', armor: 0.06, cold: 0.5, rain: true }, d: 'Equípalo en el pecho: te protege del frío y de la lluvia.' },
    abrigo_grueso: { n: 'Abrigo polar', i: '🥼', stack: 1, eq: { slot: 'chest', armor: 0.08, cold: 0.8, rain: true }, d: 'Pieles de oso blanco. Aguanta el frío de Isla Escarcha.' },
    coraza_hierro: { n: 'Coraza de hierro', i: '🛡️', stack: 1, eq: { slot: 'chest', armor: 0.25, speed: 0.95 }, d: 'Planchas de hierro remachadas. Pesada pero muy segura.' },
    coraza_obsidiana: { n: 'Coraza de obsidiana', i: '🔰', stack: 1, eq: { slot: 'chest', armor: 0.32, heat: 0.3, speed: 0.95 }, d: 'Vidrio volcánico sobre hierro. La mejor armadura del archipiélago.' },
    casaca_capitan: { n: 'Casaca de capitán', i: '🧣', stack: 1, eq: { slot: 'chest', armor: 0.12, cold: 0.3, rain: true }, d: 'Casaca roja con botones dorados, rescatada de un naufragio.' },
    pantalon_fibra: { n: 'Pantalón de fibra', i: '🩳', stack: 1, eq: { slot: 'legs', armor: 0.02, heat: 0.1 }, d: 'Fresco y cómodo.' },
    pantalon_cuero: { n: 'Pantalón de cuero', i: '👖', stack: 1, eq: { slot: 'legs', armor: 0.07 }, d: 'Protege de espinas y serpientes.' },
    pantalon_piel: { n: 'Pantalón de piel', i: '🐻', stack: 1, eq: { slot: 'legs', armor: 0.06, cold: 0.25 }, d: 'Forrado con piel gruesa.' },
    grebas_hierro: { n: 'Grebas de hierro', i: '🦿', stack: 1, eq: { slot: 'legs', armor: 0.14, speed: 0.97 }, d: 'Placas de hierro para muslos y espinillas.' },
    sandalias:    { n: 'Sandalias', i: '🩴', stack: 1, eq: { slot: 'feet', speed: 1.05 }, d: 'Ligeras: corres un poco más rápido.' },
    botas_cuero:  { n: 'Botas de cuero', i: '👢', stack: 1, eq: { slot: 'feet', armor: 0.04, speed: 1.02 }, d: 'Buenas para cualquier terreno.' },
    botas_nieve:  { n: 'Botas de nieve', i: '🥾', stack: 1, eq: { slot: 'feet', armor: 0.03, cold: 0.2, snow: true }, d: 'Con suela ancha: no te hundes en la nieve de Isla Escarcha.' },
    botas_lava:   { n: 'Botas de obsidiana', i: '🌋', stack: 1, eq: { slot: 'feet', armor: 0.05, heat: 0.3, lava: 0.85 }, d: 'Aguantan casi todo el calor de la lava de Isla Brasa.' },
    botas_hierro: { n: 'Botas de hierro', i: '🥿', stack: 1, eq: { slot: 'feet', armor: 0.08, speed: 0.97 }, d: 'Pesadas y muy protectoras.' },
    aletas:       { n: 'Aletas de buceo', i: '🦆', stack: 1, eq: { slot: 'feet', swim: 1.6, speed: 0.9 }, d: 'Nadas y buceas mucho más rápido (en tierra, más lento).' },
    // --- Construcción
    horno:       { n: 'Horno de piedra', i: '♨️', stack: 3, place: 'horno', d: 'Funde mineral, forja metal y hace carbón. Acércate para usarlo.' },
    banco:       { n: 'Banco de carpintero', i: '🛠️', stack: 3, place: 'banco', d: 'Tablas, piezas de barco y planos. Acércate para usarlo.' },
    cofre:       { n: 'Cofre de madera', i: '📦', stack: 5, place: 'cofre', d: 'Guarda hasta 16 objetos. Compartido en LAN.' },
    fogata:      { n: 'Fogata', i: '🏕️', stack: 5, place: 'fogata', d: 'Luz, calor y cocina. Los lobos le temen.' },
    piso:        { n: 'Piso de madera', i: '🟫', stack: 20, place: 'piso', d: 'Base del refugio. Se ajusta a una cuadrícula.' },
    pared:       { n: 'Pared de madera', i: '🧱', stack: 20, place: 'pared', d: 'Apunta al borde de una casilla para colocarla.' },
    puerta:      { n: 'Marco de puerta', i: '🚪', stack: 10, place: 'puerta', d: 'Una pared con hueco para entrar.' },
    techo:       { n: 'Techo de paja', i: '🛖', stack: 20, place: 'techo', d: 'Necesita una pared o techo adyacente.' },
    cama:        { n: 'Cama de hojas', i: '🛏️', stack: 3, place: 'cama', d: 'Duerme de noche y marca tu punto de reaparición. Mejor bajo techo.' },
    // --- Barcos
    balsa:       { n: 'Balsa', i: '⛵', stack: 1, ship: 'balsa', d: 'Colócala en la orilla del mar. Lenta pero te lleva a otras islas.' },
    canoa:       { n: 'Canoa', i: '🛶', stack: 1, ship: 'canoa', d: 'Tronco tallado con remos. Rápida si remas con ganas (usa energía).' },
    plano_velero:{ n: 'Plano: Bote de vela', i: '📜', stack: 1, plano: 'velero', d: 'Colócalo en el agua: aparece el diseño del barco y colocas cada pieza donde brilla.' },
    plano_lancha:{ n: 'Plano: Lancha de vapor', i: '📜', stack: 1, plano: 'lancha', d: 'Lancha a motor de carbón con cañón de proa. No depende del viento.' },
    plano_barco: { n: 'Plano: Barco pirata', i: '📜', stack: 1, plano: 'barco', d: 'El gran barco de tu tripulación: 4 cañones, camarote y bodega.' },
    pieza_casco: { n: 'Casco de madera', i: '🚢', stack: 4, d: 'Pieza de astillero. Colócala en el diseño del barco.' },
    pieza_casco_hierro: { n: 'Casco reforzado', i: '🛳️', stack: 2, d: 'Casco con planchas de hierro para la lancha de vapor.' },
    pieza_mastil:{ n: 'Mástil', i: '⛳', stack: 4, d: 'Pieza de astillero: palo mayor con su verga.' },
    pieza_vela:  { n: 'Vela', i: '⛵', stack: 4, d: 'Pieza de astillero: vela de lona con jarcias.' },
    pieza_timon: { n: 'Timón', i: '☸️', stack: 2, d: 'Pieza de astillero: rueda del timón.' },
    pieza_camarote: { n: 'Camarote', i: '🏠', stack: 1, d: 'Pieza de astillero: cabina con dos literas.' },
    pieza_caldera: { n: 'Caldera de vapor', i: '🏭', stack: 1, d: 'Pieza de astillero: motor que quema carbón.' },
    pieza_helice:{ n: 'Hélice', i: '🌀', stack: 1, d: 'Pieza de astillero: hélice de tres palas.' },
    canon:       { n: 'Cañón', i: '💣', stack: 4, d: 'Pieza de astillero. Dispara balas de cañón con pólvora.' },
    mascaron:    { n: 'Mascarón de proa', i: '🐑', stack: 1, d: 'Una cabeza tallada para la proa. ¡Da suerte!' },
    bandera:     { n: 'Bandera pirata', i: '🏴‍☠️', stack: 2, d: 'La calavera de tu tripulación para el mástil.' },
    red_pesca:   { n: 'Red de pesca', i: '🕸️', stack: 2, d: 'Instálala en la popa de un bote: pesca sola mientras navegas.' },
    rep_balsa:   { n: 'Repuesto de balsa', i: '🧰', stack: 10, rep: 'balsa', d: 'Troncos y fibra para reparar la balsa.' },
    rep_canoa:   { n: 'Repuesto de canoa', i: '🧰', stack: 10, rep: 'canoa', d: 'Parches de madera para la canoa.' },
    rep_velero:  { n: 'Repuesto de velero', i: '🧰', stack: 10, rep: 'velero', d: 'Tablas y clavos para el bote de vela.' },
    rep_lancha:  { n: 'Repuesto de lancha', i: '🧰', stack: 10, rep: 'lancha', d: 'Planchas y tornillos para la lancha.' },
    rep_barco:   { n: 'Repuesto de barco', i: '🧰', stack: 10, rep: 'barco', d: 'Tablones, clavos y brea para el barco pirata.' },
  };

  G.CRAFT_CATS = [['herr', '🪓 Herramientas'], ['cons', '🏠 Construcción'], ['nav', '⚓ Barcos'], ['ropa', '🛡️ Ropa y armadura'], ['cook', '🍳 Cocina'], ['surv', '🩹 Supervivencia']];
  // station: 'fire' (fogata encendida), 'horno' o 'banco' cerca · n: cantidad que se obtiene · learn: receta que hay que aprender
  G.RECIPES = [
    { id: 'hacha', cat: 'herr', req: { palo: 2, piedra: 2, fibra: 3 } },
    { id: 'pico', cat: 'herr', req: { palo: 2, piedra: 3, fibra: 3 } },
    { id: 'lanza', cat: 'herr', req: { palo: 3, silex: 2, fibra: 2 } },
    { id: 'antorcha', cat: 'herr', req: { palo: 1, fibra: 2 } },
    { id: 'antorcha', cat: 'herr', req: { palo: 1, grasa: 1 }, n: 2 },
    { id: 'cana', cat: 'herr', req: { palo: 3, fibra: 5 } },
    { id: 'cuenco', cat: 'herr', req: { madera: 2 } },
    { id: 'lingote', cat: 'herr', req: { mineral_hierro: 2, madera: 1 }, station: 'horno' },
    { id: 'carbon', cat: 'herr', req: { madera: 3 }, n: 2, station: 'horno' },
    { id: 'clavos', cat: 'herr', req: { lingote: 1 }, n: 8, station: 'horno' },
    { id: 'hacha_hierro', cat: 'herr', req: { palo: 2, lingote: 2, cuero: 1 } },
    { id: 'pico_hierro', cat: 'herr', req: { palo: 2, lingote: 3 } },
    { id: 'lanza_obsidiana', cat: 'herr', req: { palo: 3, obsidiana: 2, fibra: 3 } },
    { id: 'cerbatana', cat: 'herr', req: { bambu: 3, fibra: 2 }, learn: 'cerbatana' },
    { id: 'dardo', cat: 'herr', req: { palo: 1, veneno: 1 }, n: 4, learn: 'cerbatana' },
    { id: 'arpon', cat: 'herr', req: { lingote: 1, palo: 2, cuerda: 1 } },
    { id: 'pala', cat: 'herr', req: { lingote: 1, palo: 2 } },
    { id: 'catalejo', cat: 'herr', req: { lingote: 1, mineral_plata: 2, cristal_hielo: 1 }, station: 'banco' },

    { id: 'fogata', cat: 'cons', req: { piedra: 5, madera: 3 } },
    { id: 'piso', cat: 'cons', req: { madera: 4 } },
    { id: 'pared', cat: 'cons', req: { madera: 5 } },
    { id: 'puerta', cat: 'cons', req: { madera: 4 } },
    { id: 'techo', cat: 'cons', req: { madera: 3, fibra: 4 } },
    { id: 'cama', cat: 'cons', req: { madera: 3, fibra: 8 } },
    { id: 'cofre', cat: 'cons', req: { madera: 8 } },
    { id: 'horno', cat: 'cons', req: { piedra: 12, madera: 4 } },
    { id: 'banco', cat: 'cons', req: { madera: 12, piedra: 4 } },
    { id: 'tabla', cat: 'cons', req: { madera: 2 }, n: 2, station: 'banco' },
    { id: 'cuerda', cat: 'nav', req: { fibra: 4 } },
    { id: 'balsa', cat: 'nav', req: { madera: 35, fibra: 20, cuero: 4 } },
    { id: 'canoa', cat: 'nav', req: { madera: 16, fibra: 8, cuero: 1 } },
    { id: 'tela_vela', cat: 'nav', req: { fibra: 8, cuero: 2 }, station: 'banco' },
    { id: 'red_pesca', cat: 'nav', req: { cuerda: 6, fibra: 8 }, station: 'banco' },
    { id: 'plano_velero', cat: 'nav', req: { tabla: 2, cuerda: 2, carbon: 1 }, station: 'banco' },
    { id: 'plano_lancha', cat: 'nav', req: { tabla: 2, lingote: 2, carbon: 1 }, station: 'banco' },
    { id: 'plano_barco', cat: 'nav', req: { tabla: 4, cuerda: 3, carbon: 2, cuero: 2 }, station: 'banco' },
    { id: 'pieza_casco', cat: 'nav', req: { tabla: 20, clavos: 8, cuerda: 2 }, station: 'banco' },
    { id: 'pieza_casco_hierro', cat: 'nav', req: { pieza_casco: 1, lingote: 6, clavos: 6 }, station: 'banco' },
    { id: 'pieza_mastil', cat: 'nav', req: { madera: 14, cuerda: 3 }, station: 'banco' },
    { id: 'pieza_vela', cat: 'nav', req: { tela_vela: 3, cuerda: 3 }, station: 'banco' },
    { id: 'pieza_timon', cat: 'nav', req: { tabla: 6, clavos: 3 }, station: 'banco' },
    { id: 'pieza_camarote', cat: 'nav', req: { tabla: 18, clavos: 6, fibra: 8 }, station: 'banco' },
    { id: 'mascaron', cat: 'nav', req: { madera: 10, tabla: 4 }, station: 'banco' },
    { id: 'bandera', cat: 'nav', req: { tela_vela: 1, cuero: 1, carbon: 1 }, station: 'banco' },
    { id: 'pieza_caldera', cat: 'nav', req: { lingote: 8, carbon: 4 }, station: 'horno' },
    { id: 'pieza_helice', cat: 'nav', req: { lingote: 3 }, station: 'horno' },
    { id: 'canon', cat: 'nav', req: { lingote: 5, madera: 4 }, station: 'horno' },
    { id: 'bala_canon', cat: 'nav', req: { lingote: 1 }, n: 3, station: 'horno' },
    { id: 'polvora', cat: 'nav', req: { azufre: 1, carbon: 2 }, n: 3 },
    { id: 'rep_balsa', cat: 'nav', req: { madera: 4, fibra: 3 } },
    { id: 'rep_canoa', cat: 'nav', req: { madera: 4, fibra: 2 } },
    { id: 'rep_velero', cat: 'nav', req: { tabla: 4, clavos: 2 }, station: 'banco' },
    { id: 'rep_lancha', cat: 'nav', req: { tabla: 3, lingote: 1 }, station: 'banco' },
    { id: 'rep_barco', cat: 'nav', req: { tabla: 6, clavos: 3, cuerda: 1 }, station: 'banco' },
    { id: 'carne_cocida', cat: 'cook', req: { carne_cruda: 1 }, station: 'fire' },
    { id: 'pez_asado', cat: 'cook', req: { pez_crudo: 1 }, station: 'fire' },
    { id: 'almeja_asada', cat: 'cook', req: { almeja: 2 }, station: 'fire' },
    { id: 'brocheta', cat: 'cook', req: { pez_crudo: 1, palo: 1 }, station: 'fire' },
    { id: 'agua_limpia', cat: 'cook', req: { agua_sucia: 1 }, station: 'fire' },
    { id: 'agua_limpia', cat: 'cook', req: { cristal_hielo: 1, cuenco: 1 }, station: 'fire' },
    { id: 'sopa', cat: 'cook', req: { coco: 1, pez_crudo: 1, agua_limpia: 1 }, station: 'fire' },
    { id: 'infusion', cat: 'cook', req: { hierba: 2, agua_limpia: 1 }, station: 'fire' },
    { id: 'chocolate', cat: 'cook', req: { cacao: 2, agua_limpia: 1 }, station: 'fire', learn: 'chocolate' },
    { id: 'venda', cat: 'surv', req: { fibra: 4 } },
    { id: 'cataplasma', cat: 'surv', req: { hierba: 2, fibra: 2 } },
    // Ropa y armadura: cuanto más protege, más difíciles son los materiales
    { id: 'sombrero_paja', cat: 'ropa', req: { fibra: 10 } },
    { id: 'chaleco_fibra', cat: 'ropa', req: { fibra: 12 } },
    { id: 'pantalon_fibra', cat: 'ropa', req: { fibra: 10 } },
    { id: 'sandalias', cat: 'ropa', req: { fibra: 6, madera: 1 } },
    { id: 'casco_cuero', cat: 'ropa', req: { cuero: 3, fibra: 2 } },
    { id: 'chaqueta_cuero', cat: 'ropa', req: { cuero: 5, fibra: 4 } },
    { id: 'pantalon_cuero', cat: 'ropa', req: { cuero: 4, fibra: 2 } },
    { id: 'botas_cuero', cat: 'ropa', req: { cuero: 3 } },
    { id: 'abrigo', cat: 'ropa', req: { cuero: 4, fibra: 6 } },
    { id: 'gorro_piel', cat: 'ropa', req: { piel_gruesa: 2, fibra: 3 } },
    { id: 'abrigo_grueso', cat: 'ropa', req: { piel_gruesa: 3, fibra: 6, cuero: 1 } },
    { id: 'pantalon_piel', cat: 'ropa', req: { piel_gruesa: 2, cuero: 1 } },
    { id: 'botas_nieve', cat: 'ropa', req: { piel_gruesa: 2, cuero: 1 } },
    { id: 'aletas', cat: 'ropa', req: { cuero: 2, bambu: 2 } },
    { id: 'casco_buceo', cat: 'ropa', req: { cristal_hielo: 2, lingote: 2, cuero: 2 }, station: 'banco' },
    { id: 'casco_hierro', cat: 'ropa', req: { lingote: 3, cuero: 1 }, station: 'horno' },
    { id: 'coraza_hierro', cat: 'ropa', req: { lingote: 6, cuero: 2 }, station: 'horno' },
    { id: 'grebas_hierro', cat: 'ropa', req: { lingote: 4, cuero: 1 }, station: 'horno' },
    { id: 'botas_hierro', cat: 'ropa', req: { lingote: 3, cuero: 1 }, station: 'horno' },
    { id: 'botas_lava', cat: 'ropa', req: { obsidiana: 2, cuero: 3, azufre: 1 }, station: 'horno' },
    { id: 'coraza_obsidiana', cat: 'ropa', req: { obsidiana: 6, lingote: 2, cuero: 2 }, station: 'horno' },
  ];
  G.STATION_NAMES = { fire: '🔥 junto a fogata', horno: '♨️ junto a horno', banco: '🛠️ junto a banco' };
  // Al pulsar E en una fogata con esto en la mano, se cocina directamente
  G.COOK = { carne_cruda: 'carne_cocida', agua_sucia: 'agua_limpia', pez_crudo: 'pez_asado', almeja: 'almeja_asada' };

  // ------------------------------------------------------------------ inventario
  const Inv = (G.Inv = { slots: new Array(32).fill(null), sel: 0, listeners: [], equip: { head: null, chest: null, legs: null, feet: null } });
  Inv.SLOTS = ['head', 'chest', 'legs', 'feet'];
  Inv.SLOT_NAMES = { head: 'Cabeza', chest: 'Pecho', legs: 'Piernas', feet: 'Pies' };
  Inv.SLOT_ICONS = { head: '🪖', chest: '👕', legs: '👖', feet: '👢' };
  // Suma (armadura, frío, calor, lava) o multiplica (velocidad, nado, aire) los efectos del equipo puesto
  const MULT = { speed: 1, swim: 1, oxy: 1 };
  Inv.eqStat = function (k) {
    let v = k in MULT ? 1 : 0;
    for (const s of Inv.SLOTS) {
      const e = Inv.equip[s], q = e && G.ITEMS[e.id] && G.ITEMS[e.id].eq;
      if (!q || q[k] === undefined) continue;
      if (k in MULT) v *= q[k]; else if (typeof q[k] === 'boolean') v = v || q[k]; else v += q[k];
    }
    return k === 'armor' ? Math.min(0.6, v) : v;
  };
  Inv.eqIds = () => Inv.SLOTS.map((s) => (Inv.equip[s] ? Inv.equip[s].id : null));
  // Ponerse la prenda de la casilla idx (intercambia con la que había)
  Inv.equipFrom = function (idx) {
    const it = Inv.slots[idx], q = it && G.ITEMS[it.id].eq;
    if (!q) return false;
    const old = Inv.equip[q.slot];
    Inv.equip[q.slot] = { id: it.id, n: 1 };
    Inv.slots[idx] = old ? { id: old.id, n: 1 } : null;
    Inv.changed();
    if (G.Ach) G.Ach.add('equip:' + it.id, 1, true);
    return true;
  };
  Inv.unequip = function (slot) {
    const e = Inv.equip[slot];
    if (!e) return false;
    const free = Inv.slots.findIndex((s) => !s);
    if (free < 0) { G.UI.msg('No hay espacio en el inventario.', 'warn', 'full'); return false; }
    Inv.slots[free] = { id: e.id, n: 1 };
    Inv.equip[slot] = null;
    Inv.changed();
    return true;
  };
  Inv.changed = () => Inv.listeners.forEach((f) => f());
  Inv.maxStack = (id) => (G.ITEMS[id].tool ? 1 : G.ITEMS[id].stack || 20);
  Inv.add = function (id, n = 1) {
    const it = G.ITEMS[id];
    if (!it) return 0;
    let left = n;
    if (!it.tool) {
      for (const s of Inv.slots) {
        if (s && s.id === id && s.n < Inv.maxStack(id)) {
          const k = Math.min(left, Inv.maxStack(id) - s.n);
          s.n += k; left -= k;
          if (!left) break;
        }
      }
    }
    for (let i = 0; i < Inv.slots.length && left > 0; i++) {
      if (!Inv.slots[i]) {
        const k = Math.min(left, Inv.maxStack(id));
        Inv.slots[i] = { id, n: k, d: it.tool ? it.dur : undefined };
        left -= k;
      }
    }
    Inv.changed();
    return n - left;
  };
  Inv.count = (id) => Inv.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  Inv.has = (id) => Inv.slots.some((s) => s && s.id === id);
  Inv.remove = function (id, n) {
    for (let i = Inv.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = Inv.slots[i];
      if (s && s.id === id) {
        const k = Math.min(n, s.n);
        s.n -= k; n -= k;
        if (s.n <= 0) Inv.slots[i] = null;
      }
    }
    Inv.changed();
  };
  Inv.held = () => Inv.slots[Inv.sel];
  Inv.heldId = () => (Inv.slots[Inv.sel] ? Inv.slots[Inv.sel].id : null);
  Inv.wear = function (amt, silent) {
    const s = Inv.held();
    if (!s || s.d === undefined) return;
    s.d -= amt;
    if (s.d <= 0) {
      G.UI.msg(`Tu ${G.ITEMS[s.id].n.toLowerCase()} se ha roto.`, 'warn');
      G.Audio.play('break');
      Inv.slots[Inv.sel] = null;
      Inv.changed();
    } else if (!silent) Inv.changed();
  };
  Inv.consumeHeld = () => {
    const s = Inv.held();
    if (!s) return;
    s.n--;
    if (s.n <= 0) Inv.slots[Inv.sel] = null;
    Inv.changed();
  };
  Inv.canCraft = (rec) => (G.Cheats && G.Cheats.flag('free')) || Object.entries(rec.req).every(([id, n]) => Inv.count(id) >= n);
  Inv.clear = () => { Inv.slots.fill(null); Inv.sel = 0; for (const s of Inv.SLOTS) Inv.equip[s] = null; Inv.changed(); };

  // ------------------------------------------------------------------ modelos en la mano
  const M = {};
  function mat(key, color, extra) {
    if (!M[key]) M[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, extra || {}));
    return M[key];
  }
  const vcMat = () => mat('__vc', 0xffffff, { vertexColors: true, roughness: 0.7 });
  function part(g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  // Pieza con color por vértice (usa el modelador orgánico)
  const vpart = (g, geos, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => part(g, U.merge([].concat(geos).flat()), vcMat(), x, y, z, rx, ry, rz);
  const D = () => G.Mdl;
  // Fruta del Abismo: fruta con espirales en relieve de color y un tallo rizado
  function devilFruit(g, a, b, shape) {
    const Md = D(), ca = new THREE.Color(a), cb = new THREE.Color(b);
    const body = Md.lathe(shape, 20, (x, y, z) => {
      const ang = Math.atan2(z, x);
      return Math.sin(ang * 3 + y * 55) > 0.15 ? ca : cb;
    });
    const stem = Md.tube([[0, 0.14, 0], [0.02, 0.17, 0], [0.035, 0.18, 0.02], [0.02, 0.16, 0.035]], [0.008, 0.005], 5, 0x3a5a2a, 10);
    const leaf = Md.xf(Md.fin([[0, 0], [0.04, 0.02], [0.08, 0], [0.04, -0.015]], 0.004, 0x4a8a2a), 0.01, 0.16, 0, 0, 0, 0.4);
    vpart(g, [body, stem, leaf], 0, 0.02, 0);
  }
  // El mango apunta a +Y y el agarre queda en el origen
  G.makeItemMesh = function (id) {
    if (!id) return null;
    const it = G.ITEMS[id];
    if (!it || it.place) return null;
    const g = new THREE.Group(), Md = D();
    const wood = mat('wood', 0x7a5634), stone = mat('stone', 0x8a857c, { flatShading: true }), fiber = mat('fiber', 0xb9a060), flint = mat('flint', 0x3e4b5e, { roughness: 0.4, flatShading: true });
    const handle = () => part(g, new THREE.CylinderGeometry(0.022, 0.028, 0.72, 6), wood, 0, 0.22, 0);
    const iron = mat('iron', 0x9aa0a6, { metalness: 0.7, roughness: 0.35 }), leather = mat('leatherB', 0x5a3a22);
    const brass = mat('brass', 0xc8a050, { metalness: 0.8, roughness: 0.3 });
    const obs = mat('obs', 0x15121c, { roughness: 0.15, metalness: 0.2, flatShading: true });
    const glass = mat('glassI', 0x9ad8f0, { roughness: 0.05, transparent: true, opacity: 0.6 });
    switch (id) {
      case 'hacha': case 'hacha_hierro': {
        handle();
        const hm = id === 'hacha' ? stone : iron;
        part(g, new THREE.BoxGeometry(0.2, 0.13, id === 'hacha' ? 0.05 : 0.03), hm, 0.09, 0.52, 0, 0, 0, 0.1);
        part(g, new THREE.CylinderGeometry(0.036, 0.036, 0.1, 6), id === 'hacha' ? fiber : leather, 0, 0.52, 0);
        break;
      }
      case 'pico': case 'pico_hierro': {
        handle();
        const hm = id === 'pico' ? stone : iron;
        part(g, new THREE.BoxGeometry(0.5, 0.06, 0.06), hm, 0, 0.55, 0);
        part(g, new THREE.ConeGeometry(0.04, 0.12, 4), hm, 0.3, 0.55, 0, 0, 0, -Math.PI / 2);
        part(g, new THREE.ConeGeometry(0.04, 0.12, 4), hm, -0.3, 0.55, 0, 0, 0, Math.PI / 2);
        part(g, new THREE.CylinderGeometry(0.036, 0.036, 0.1, 6), id === 'pico' ? fiber : leather, 0, 0.55, 0);
        break;
      }
      case 'lanza': case 'lanza_obsidiana':
        part(g, new THREE.CylinderGeometry(0.02, 0.024, 1.7, 6), wood, 0, 0.45, 0);
        part(g, new THREE.ConeGeometry(id === 'lanza' ? 0.05 : 0.06, id === 'lanza' ? 0.22 : 0.3, 4), id === 'lanza' ? flint : obs, 0, id === 'lanza' ? 1.4 : 1.44, 0);
        part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), fiber, 0, 1.27, 0);
        break;
      case 'arpon':
        part(g, new THREE.CylinderGeometry(0.02, 0.024, 1.6, 6), wood, 0, 0.42, 0);
        part(g, new THREE.ConeGeometry(0.045, 0.24, 6), iron, 0, 1.33, 0);
        for (const s of [-1, 1]) part(g, new THREE.ConeGeometry(0.018, 0.1, 4), iron, s * 0.035, 1.2, 0, 0, 0, s * 2.6);
        part(g, new THREE.TorusGeometry(0.05, 0.012, 6, 12), fiber, 0, 0.1, 0.04, Math.PI / 2);
        break;
      case 'cerbatana':
        vpart(g, [Md.xf(Md.paint(new THREE.CylinderGeometry(0.02, 0.022, 1.1, 8), (x, y) => (Math.abs(((y + 0.55) % 0.28) - 0.14) < 0.012 ? 0x5e7424 : 0x9ab84a)), 0, 0.3, 0),
          Md.xf(Md.paint(new THREE.CylinderGeometry(0.026, 0.026, 0.06, 8), 0xa0302a), 0, 0.72, 0)]);
        break;
      case 'dardo':
        vpart(g, [Md.xf(Md.paint(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), 0x8a6a40), 0, 0.1, 0), Md.xf(Md.paint(new THREE.ConeGeometry(0.008, 0.04, 4), 0x2a6ae0), 0, 0.22, 0),
          Md.xf(Md.paint(new THREE.ConeGeometry(0.02, 0.05, 5), 0xc0302a), 0, 0.01, 0, Math.PI)]);
        break;
      case 'catalejo':
        vpart(g, [Md.xf(Md.paint(new THREE.CylinderGeometry(0.028, 0.03, 0.2, 12), 0x5a3a22), 0, 0.1, 0), Md.xf(Md.paint(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12), 0xc8a050), 0, 0.21, 0),
          Md.xf(Md.paint(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 12), 0xc8a050), 0, 0.3, 0), Md.xf(Md.paint(new THREE.CylinderGeometry(0.019, 0.019, 0.12, 12), 0xd8b060), 0, 0.43, 0)]);
        break;
      case 'pala':
        part(g, new THREE.CylinderGeometry(0.02, 0.024, 0.9, 6), wood, 0, 0.3, 0);
        part(g, new THREE.BoxGeometry(0.14, 0.02, 0.05), wood, 0, -0.15, 0);
        vpart(g, [Md.lathe([[0.001, 0], [0.09, 0.02], [0.1, 0.18], [0.06, 0.24], [0.001, 0.25]], 6, 0x9aa0a6)], 0, 0.72, 0, 0, 0, 0).scale.set(1, 1, 0.2);
        break;
      case 'cana': {
        part(g, new THREE.CylinderGeometry(0.01, 0.022, 1.6, 6), wood, 0, 0.55, 0);
        part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), fiber, 0, 0.05, 0.03, Math.PI / 2);
        g.userData.tip = new THREE.Object3D();
        g.userData.tip.position.set(0, 1.35, 0);
        g.add(g.userData.tip);
        break;
      }
      case 'pez_crudo': case 'pez_asado': {
        const fc = id === 'pez_crudo' ? 0x7f9fb0 : 0xb07a3a;
        vpart(g, [Md.loft({ z0: -0.14, z1: 0.14, n: 10, m: 10, prof: (t) => ({ rx: 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), ry: 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), y: 0 }), color: (t, a, ca, sa) => (sa < -0.3 ? 0xe8e4d8 : fc) }),
          Md.xf(Md.fin([[0, 0], [-0.08, 0.05], [-0.08, -0.05]], 0.006, fc), 0, 0, -0.14, 0, Math.PI / 2, 0), Md.ball(0.01, 0x111111, 0.03, 0.02, 0.1)], 0, 0.06, 0);
        break;
      }
      case 'almeja': case 'almeja_asada':
        part(g, new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.5, 1), mat('clam', 0xd8c8b8, { side: THREE.DoubleSide }), 0, 0.05, 0);
        break;
      case 'hierba': for (let i = 0; i < 4; i++) part(g, new THREE.SphereGeometry(0.03, 6, 4).scale(1, 0.4, 2), mat('herb', 0x4e8a3a), 0, 0.05 + i * 0.03, 0, 0, i * 1.5, 0); break;
      case 'mineral_hierro': part(g, new THREE.DodecahedronGeometry(0.08), mat('ore', 0x8a5a3a, { flatShading: true }), 0, 0.05, 0); break;
      case 'mineral_plata':
        vpart(g, [Md.paint(new THREE.DodecahedronGeometry(0.08), (x, y, z) => (Math.sin(x * 90) * Math.sin(z * 80) > 0.3 ? 0xeef2f6 : 0x6a6e74), 0.1)], 0, 0.05, 0);
        break;
      case 'carbon': vpart(g, [Md.paint(new THREE.DodecahedronGeometry(0.07), 0x1a1818, 0.2)], 0, 0.05, 0); break;
      case 'azufre': vpart(g, [Md.xf(Md.paint(new THREE.OctahedronGeometry(0.07), 0xe8d23a, 0.2), 0, 0, 0, 0, 0, 0, [1, 1.3, 1]), Md.xf(Md.paint(new THREE.OctahedronGeometry(0.04), 0xd8c020), 0.05, 0.02, 0)], 0, 0.06, 0); break;
      case 'polvora':
        vpart(g, [Md.lathe([[0.001, 0], [0.06, 0.01], [0.07, 0.06], [0.05, 0.1], [0.02, 0.12], [0.03, 0.15], [0.001, 0.15]], 12, (x, y) => (y > 0.11 && y < 0.125 ? 0xb89a60 : 0x3a3a3a))], 0, 0.02, 0);
        break;
      case 'bala_canon': part(g, new THREE.SphereGeometry(0.075, 14, 10), mat('ball', 0x1e1e20, { metalness: 0.6, roughness: 0.4 }), 0, 0.075, 0); break;
      case 'clavos': for (let i = 0; i < 4; i++) { part(g, new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), iron, (i - 1.5) * 0.02, 0.05, 0, 0, 0, (i - 1.5) * 0.15); part(g, new THREE.CylinderGeometry(0.009, 0.009, 0.006, 8), iron, (i - 1.5) * 0.02 + (i - 1.5) * 0.008, 0.1, 0); } break;
      case 'tabla': part(g, new THREE.BoxGeometry(0.09, 0.4, 0.02), mat('plank', 0xb08a58), 0, 0.15, 0); break;
      case 'cuerda': for (let i = 0; i < 3; i++) part(g, new THREE.TorusGeometry(0.06 - i * 0.004, 0.012, 6, 16), fiber, 0, 0.02 + i * 0.022, 0, Math.PI / 2); break;
      case 'tela_vela': part(g, new THREE.BoxGeometry(0.18, 0.05, 0.13), mat('canvas', 0xe8e0cc), 0, 0.04, 0); part(g, new THREE.BoxGeometry(0.16, 0.012, 0.13), mat('canvas2', 0xd0c8b4), 0, 0.072, 0); break;
      case 'cristal_hielo':
        vpart(g, [0, 1, 2, 3].map((k) => Md.xf(Md.paint(new THREE.OctahedronGeometry(0.04 - k * 0.005), 0xb8ecff), (k - 1.5) * 0.025, 0.04 + (k % 2) * 0.02, 0, 0, 0, (k - 1.5) * 0.3, [0.6, 2, 0.6])), 0, 0.02, 0);
        break;
      case 'perla': part(g, new THREE.SphereGeometry(0.035, 16, 12), mat('pearl', 0xf8f4ee, { roughness: 0.15, metalness: 0.3 }), 0, 0.04, 0); break;
      case 'doblon': part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.008, 18), mat('gold', 0xe0b040, { metalness: 0.9, roughness: 0.25 }), 0, 0.04, 0, Math.PI / 2); break;
      case 'piel_gruesa': vpart(g, [Md.xf(Md.loft({ z0: -0.1, z1: 0.1, n: 6, m: 10, prof: () => ({ rx: 0.12, ry: 0.035, y: 0 }), color: () => 0xf0ece0 }), 0, 0.04, 0)]); break;
      case 'grasa': vpart(g, [Md.lathe([[0.001, 0], [0.05, 0], [0.055, 0.08], [0.04, 0.1], [0.045, 0.12], [0.001, 0.12]], 12, (x, y) => (y > 0.1 ? 0x7a5a34 : 0xe8dcb0))]); break;
      case 'veneno': vpart(g, [Md.lathe([[0.001, 0], [0.03, 0], [0.032, 0.06], [0.012, 0.09], [0.012, 0.12], [0.001, 0.12]], 10, (x, y) => (y < 0.055 ? 0x3aa0e0 : y > 0.1 ? 0x8a6a40 : 0xcfe8f0))]); break;
      case 'brocheta':
        part(g, new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), wood, 0, 0.15, 0);
        for (let i = 0; i < 3; i++) part(g, new THREE.SphereGeometry(0.03, 8, 6), mat('pez_asado', 0xb07a3a), 0, 0.12 + i * 0.07, 0);
        break;
      case 'sopa': case 'infusion': case 'chocolate':
        part(g, new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('bowl', 0x8a6440, { side: THREE.DoubleSide }), 0, 0.1, 0);
        part(g, new THREE.CircleGeometry(0.09, 12), mat(id, id === 'sopa' ? 0xe0c890 : id === 'chocolate' ? 0x4a2a14 : 0x8a9a4a, { roughness: 0.2 }), 0, 0.07, 0, -Math.PI / 2);
        break;
      case 'cacao':
        vpart(g, [Md.lathe([[0.001, 0], [0.035, 0.03], [0.05, 0.09], [0.045, 0.15], [0.02, 0.2], [0.001, 0.21]], 10, (x, y, z) => (Math.sin(Math.atan2(z, x) * 5) > 0.6 ? 0xc07a18 : 0xe0a020))], 0, 0, 0, 0, 0, 0.3);
        break;
      case 'bambu':
        vpart(g, [Md.paint(new THREE.CylinderGeometry(0.03, 0.032, 0.6, 8), (x, y) => (Math.abs(y % 0.2) < 0.015 ? 0x5e7424 : 0x9ab84a))], 0, 0.2, 0);
        break;
      case 'abrigo': case 'abrigo_grueso': case 'cataplasma': case 'colmillo':
        part(g, new THREE.BoxGeometry(0.12, 0.06, 0.1), mat(id, id === 'abrigo' ? 0x7a5230 : id === 'abrigo_grueso' ? 0xe8e4d8 : id === 'colmillo' ? 0xeee6d0 : 0x7aa05a), 0, 0.05, 0);
        break;
      case 'casco_buceo':
        part(g, new THREE.SphereGeometry(0.1, 14, 10), brass, 0, 0.1, 0);
        part(g, new THREE.CircleGeometry(0.05, 14), glass, 0, 0.1, 0.1);
        part(g, new THREE.TorusGeometry(0.055, 0.01, 6, 14), brass, 0, 0.1, 0.1);
        break;
      case 'log_mareas':
        part(g, new THREE.TorusGeometry(0.05, 0.012, 6, 16), leather, 0, 0.03, 0, Math.PI / 2);
        part(g, new THREE.SphereGeometry(0.035, 14, 10), glass, 0, 0.07, 0);
        part(g, new THREE.BoxGeometry(0.004, 0.004, 0.05), mat('needle', 0xc02020), 0, 0.07, 0);
        part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), brass, 0, 0.04, 0);
        break;
      case 'diario': part(g, new THREE.BoxGeometry(0.14, 0.04, 0.18), mat('book', 0x5a2a1a), 0, 0.03, 0); part(g, new THREE.BoxGeometry(0.13, 0.034, 0.17), mat('paper', 0xe8dcb8), 0.006, 0.03, 0); break;
      case 'fragmento_mapa': part(g, new THREE.BoxGeometry(0.16, 0.004, 0.12), mat('parch', 0xd8c088), 0, 0.03, 0, 0, 0.2, 0); break;
      case 'fruta_llama': devilFruit(g, 0xe04a18, 0xf0a030, [[0.001, 0], [0.06, 0.01], [0.085, 0.06], [0.08, 0.12], [0.04, 0.155], [0.001, 0.15]]); break;
      case 'fruta_hielo': devilFruit(g, 0x5aa8e8, 0xe0f4ff, [[0.001, 0], [0.07, 0.02], [0.085, 0.07], [0.07, 0.13], [0.03, 0.15], [0.001, 0.145]]); break;
      case 'fruta_muelle': devilFruit(g, 0x6ac040, 0xe8e060, [[0.001, 0], [0.05, 0.01], [0.075, 0.05], [0.06, 0.1], [0.045, 0.14], [0.001, 0.15]]); break;
      case 'fruta_humo': devilFruit(g, 0x8a7ab0, 0xd8d0e8, [[0.001, 0], [0.075, 0.02], [0.09, 0.08], [0.075, 0.13], [0.03, 0.15], [0.001, 0.14]]); break;
      case 'fruta_roca': devilFruit(g, 0x8a6a4a, 0xc8b090, [[0.001, 0], [0.065, 0.015], [0.085, 0.07], [0.08, 0.12], [0.04, 0.15], [0.001, 0.145]]); break;
      case 'red_pesca':
        vpart(g, [Md.paint(new THREE.SphereGeometry(0.09, 12, 8).scale(1, 0.55, 1), (x, y, z) => (Math.abs(Math.sin(x * 70)) < 0.25 || Math.abs(Math.sin(z * 70)) < 0.25 ? 0x6a4a2a : 0xa89060))], 0, 0.05, 0);
        break;
      case 'pieza_timon':
        part(g, new THREE.TorusGeometry(0.14, 0.018, 6, 20), wood, 0, 0.18, 0);
        for (let i = 0; i < 8; i++) part(g, new THREE.CylinderGeometry(0.01, 0.012, 0.36, 5), wood, 0, 0.18, 0, 0, 0, (i / 8) * Math.PI);
        part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), brass, 0, 0.18, 0, Math.PI / 2);
        break;
      case 'pieza_helice':
        for (let i = 0; i < 3; i++) vpart(g, [Md.xf(Md.fin([[0, 0], [0.12, 0.03], [0.14, -0.02], [0.02, -0.03]], 0.008, 0xc8a050), 0, 0, 0, 0.4, 0, i * 2.09)], 0, 0.15, 0);
        part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), brass, 0, 0.15, 0, Math.PI / 2);
        break;
      case 'pieza_mastil': part(g, new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), wood, 0, 0.3, 0); part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), wood, 0, 0.6, 0, 0, 0, Math.PI / 2); break;
      case 'pieza_vela': part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), mat('canvas', 0xe8e0cc), 0, 0.15, 0); for (const y of [0.02, 0.28]) part(g, new THREE.TorusGeometry(0.052, 0.008, 5, 12), fiber, 0, y, 0, Math.PI / 2); break;
      case 'pieza_casco': case 'pieza_casco_hierro':
        vpart(g, [Md.loft({ z0: -0.15, z1: 0.15, n: 6, m: 12, prof: () => ({ rx: 0.12, ry: 0.08, y: 0 }), color: (t, a, ca, sa) => (sa > 0 ? 0x3a2a1a : id === 'pieza_casco' ? 0x9a6a3a : 0x7a7e84), caps: true })], 0, 0.08, 0);
        break;
      case 'pieza_camarote': part(g, new THREE.BoxGeometry(0.16, 0.1, 0.12), mat('plank', 0xb08a58), 0, 0.05, 0); part(g, new THREE.ConeGeometry(0.12, 0.07, 4), mat('roof', 0x6a4a2c), 0, 0.135, 0, 0, Math.PI / 4, 0); break;
      case 'pieza_caldera': part(g, new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), iron, 0, 0.08, 0); part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), iron, 0.03, 0.2, 0); break;
      case 'canon':
        part(g, new THREE.CylinderGeometry(0.03, 0.04, 0.3, 12), mat('cannon', 0x2a2a2c, { metalness: 0.6, roughness: 0.4 }), 0, 0.12, 0, 0.2, 0, 0);
        part(g, new THREE.BoxGeometry(0.1, 0.05, 0.14), wood, 0, 0.02, 0);
        break;
      case 'mascaron':
        vpart(g, [Md.ball(0.07, 0xf4f0e8, 0, 0.08, 0, [1, 0.9, 1.2]), Md.ball(0.035, 0xf4f0e8, 0, 0.07, 0.07), Md.tube([[0.05, 0.1, -0.02], [0.09, 0.08, 0.02], [0.07, 0.04, 0.03]], [0.015, 0.01], 5, 0xd8c890), Md.tube([[-0.05, 0.1, -0.02], [-0.09, 0.08, 0.02], [-0.07, 0.04, 0.03]], [0.015, 0.01], 5, 0xd8c890), Md.ball(0.008, 0x111111, 0.025, 0.1, 0.07), Md.ball(0.008, 0x111111, -0.025, 0.1, 0.07)]);
        break;
      case 'bandera':
        part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), wood, 0, 0.2, 0);
        part(g, new THREE.PlaneGeometry(0.2, 0.13), mat('flag', 0x111111, { side: THREE.DoubleSide }), 0.1, 0.38, 0);
        part(g, new THREE.SphereGeometry(0.022, 8, 6), mat('skull', 0xf0f0f0), 0.1, 0.39, 0.004);
        break;
      case 'rep_balsa': case 'rep_canoa': case 'rep_velero': case 'rep_lancha': case 'rep_barco':
        part(g, new THREE.BoxGeometry(0.18, 0.09, 0.1), mat('toolbox', 0xa03a2a), 0, 0.045, 0);
        part(g, new THREE.TorusGeometry(0.04, 0.008, 5, 10, Math.PI), iron, 0, 0.09, 0);
        break;
      case 'plano_velero': case 'plano_lancha': case 'plano_barco':
        part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), mat('parch', 0xd8c088), 0, 0.12, 0, 0, 0, Math.PI / 2);
        part(g, new THREE.TorusGeometry(0.027, 0.006, 5, 10), mat('ribbon', 0xa02020), 0, 0.12, 0, 0, Math.PI / 2, 0);
        break;
      case 'antorcha': {
        part(g, new THREE.CylinderGeometry(0.022, 0.03, 0.55, 6), wood, 0, 0.15, 0);
        part(g, new THREE.CylinderGeometry(0.05, 0.042, 0.15, 7), mat('char', 0x2a2018), 0, 0.46, 0);
        const fl = new THREE.Group(); fl.position.y = 0.52; g.add(fl);
        if (!M.flameA) {
          M.flameA = new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
          M.flameB = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        }
        const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 7, 1, true), M.flameA);
        f1.position.y = 0.12; fl.add(f1);
        const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 7, 1, true), M.flameB);
        f2.position.y = 0.07; fl.add(f2);
        g.userData.flame = fl;
        break;
      }
      case 'palo': part(g, new THREE.CylinderGeometry(0.025, 0.03, 0.6, 5), wood, 0, 0.15, 0); break;
      case 'madera': part(g, new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), mat('log', 0x6a4a2c), 0, 0.1, 0, 0, 0, Math.PI / 2); break;
      case 'piedra': part(g, new THREE.DodecahedronGeometry(0.09), stone, 0, 0.05, 0); break;
      case 'silex': part(g, new THREE.OctahedronGeometry(0.08), flint, 0, 0.05, 0); break;
      case 'fibra': for (let i = 0; i < 5; i++) part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.35, 3), fiber, (i - 2) * 0.015, 0.12, 0, 0, 0, (i - 2) * 0.08); break;
      case 'baya': for (let i = 0; i < 5; i++) part(g, new THREE.SphereGeometry(0.035, 8, 6), mat('berry', 0xb8142a, { roughness: 0.35 }), Math.cos(i * 1.3) * 0.04, 0.05 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.04); break;
      case 'coco': part(g, new THREE.SphereGeometry(0.1, 10, 8), mat('coco', 0x5b3f22), 0, 0.08, 0); break;
      case 'carne_cruda': part(g, new THREE.SphereGeometry(0.09, 8, 6).scale(1.3, 0.6, 1), mat('raw', 0xb33a3a, { roughness: 0.5 }), 0, 0.06, 0); break;
      case 'carne_cocida': part(g, new THREE.SphereGeometry(0.09, 8, 6).scale(1.3, 0.6, 1), mat('cooked', 0x6b3a1c, { roughness: 0.6 }), 0, 0.06, 0); break;
      case 'cuero': part(g, new THREE.BoxGeometry(0.22, 0.02, 0.16), mat('leather', 0x9a7048), 0, 0.05, 0); break;
      case 'venda': part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), mat('band', 0xeee8dc), 0, 0.05, 0, 0, 0, Math.PI / 2); break;
      case 'lingote': part(g, new THREE.BoxGeometry(0.14, 0.04, 0.06), iron, 0, 0.04, 0); break;
      case 'obsidiana': part(g, new THREE.OctahedronGeometry(0.08).scale(1, 1.4, 0.7), obs, 0, 0.06, 0); break;
      case 'cuenco': case 'agua_sucia': case 'agua_limpia': {
        part(g, new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('bowl', 0x8a6440, { side: THREE.DoubleSide }), 0, 0.1, 0);
        if (id !== 'cuenco') part(g, new THREE.CircleGeometry(0.09, 12), mat(id, id === 'agua_limpia' ? 0x7fc8e8 : 0x7a7a4a, { roughness: 0.1 }), 0, 0.07, 0, -Math.PI / 2);
        break;
      }
      default: return null;
    }
    return g;
  };
})();
