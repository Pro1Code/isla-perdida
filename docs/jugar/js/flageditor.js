// Pizarra para crear tu propia bandera (Tienda → Banderas → "Tu propia bandera"):
// pincel, borrador, cubo de pintura, formas (línea, rectángulo, círculo, triángulo, estrella),
// sellos piratas, texto, modo espejo, colores y deshacer/rehacer.
// La bandera se guarda en el perfil (imagen pequeña para los barcos + la grande para seguir editándola)
// y viaja con los datos del barco, así que en LAN los demás ven tu bandera.
(function () {
  'use strict';
  const G = window.G;
  const FE = (G.FlagEditor = {});
  const W = 480, H = 300;
  const $ = (id) => document.getElementById(id);

  const TOOLS = [
    ['brush', '✏️', 'Pincel'], ['eraser', '🧽', 'Borrador'], ['fill', '🪣', 'Cubo'], ['line', '╱', 'Línea'],
    ['rect', '▭', 'Rectángulo'], ['circle', '◯', 'Círculo'], ['tri', '△', 'Triángulo'], ['star', '★', 'Estrella'], ['text', '𝐀', 'Texto'],
  ];
  const STAMPS = [
    ['skull', '💀', 'Calavera'], ['bones', '🦴', 'Tibias'], ['swords', '⚔️', 'Sables'], ['anchor', '⚓', 'Ancla'],
    ['crown', '👑', 'Corona'], ['moon', '🌙', 'Luna'], ['bolt', '⚡', 'Rayo'], ['flame', '🔥', 'Llama'],
    ['wave', '🌊', 'Ola'], ['heart', '❤️', 'Corazón'], ['fruit', '🍈', 'Fruta del Abismo'], ['eye', '👁️', 'Ojo'],
  ];
  const PALETTE = ['#111111', '#f4f2ec', '#c8322a', '#7a1a1a', '#f08a2a', '#f2c830', '#d8b040', '#5fc46a', '#1e6a3a', '#3cc4b8',
    '#4f9de0', '#1e3a8a', '#8a4ae0', '#e070b0', '#8a5a30', '#7a7a80'];

  let cv, cx, ov, ox, tool = 'brush', stamp = null, color = '#f4f2ec', bg = '#111111', size = 10, fillShapes = true, mirror = false;
  let undo = [], redo = [], drag = null, onSave = null, built = false;

  // ------------------------------------------------------------------ interfaz
  function build() {
    if (built) return;
    built = true;
    const el = document.createElement('div');
    el.id = 'flagEd';
    el.className = 'fe-overlay hidden';
    el.innerHTML = `
      <div class="fe-card">
        <div class="fe-head"><h3>✏️ Crea tu bandera</h3><span class="muted">Dibuja lo que quieras: nadie más tendrá una igual.</span></div>
        <div class="fe-body">
          <div class="fe-tools" id="feTools">${TOOLS.map(([k, i, n]) => `<button data-t="${k}" title="${n}"><span>${i}</span><small>${n}</small></button>`).join('')}</div>
          <div class="fe-stage">
            <div class="fe-canvas"><canvas id="feMain" width="${W}" height="${H}"></canvas><canvas id="feOver" width="${W}" height="${H}"></canvas></div>
            <div class="fe-row">
              <label class="fe-size">Grosor <input type="range" id="feSize" min="2" max="60" step="1" value="${size}" /><b id="feSizeV">${size}</b></label>
              <button id="feFillT" class="fe-toggle on" title="Formas rellenas o solo el contorno">⬛ Relleno</button>
              <button id="feMirror" class="fe-toggle" title="Dibuja a la vez en el otro lado (simetría)">🪞 Espejo</button>
            </div>
            <div class="fe-row fe-palette" id="fePal">${PALETTE.map((c) => `<button data-c="${c}" style="background:${c}"></button>`).join('')}<label class="fe-pick" title="Otro color"><input type="color" id="feColor" value="${color}" />🎨</label></div>
          </div>
          <div class="fe-side">
            <div class="mp-label">Sellos</div>
            <div class="fe-stamps" id="feStamps">${STAMPS.map(([k, i, n]) => `<button data-s="${k}" title="${n}">${i}</button>`).join('')}</div>
            <div class="mp-label">Texto</div>
            <input id="feText" maxlength="18" placeholder="Escribe y haz clic en la bandera" />
            <div class="mp-label">Así se verá</div>
            <div class="fe-mast"><canvas id="fePrev" width="192" height="120"></canvas></div>
          </div>
        </div>
        <div class="fe-foot">
          <button id="feUndo" class="btn small" title="Ctrl+Z">↶ Deshacer</button>
          <button id="feRedo" class="btn small" title="Ctrl+Y">↷ Rehacer</button>
          <button id="feBg" class="btn small" title="Pinta todo el fondo con el color elegido">🖌️ Fondo de este color</button>
          <button id="feClear" class="btn small">🗑️ Empezar de nuevo</button>
          <span class="fe-grow"></span>
          <button id="feCancel" class="btn small">Cancelar</button>
          <button id="feSave" class="btn primary">💾 Guardar y usar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    cv = $('feMain'); cx = cv.getContext('2d', { willReadFrequently: true });
    ov = $('feOver'); ox = ov.getContext('2d');
    $('feTools').onclick = (e) => { const b = e.target.closest('button[data-t]'); if (b) { tool = b.dataset.t; stamp = null; sync(); } };
    $('feStamps').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (b) { stamp = b.dataset.s; tool = 'stamp'; sync(); } };
    $('fePal').onclick = (e) => { const b = e.target.closest('button[data-c]'); if (b) { color = b.dataset.c; $('feColor').value = color; sync(); } };
    $('feColor').oninput = () => { color = $('feColor').value; sync(); };
    $('feSize').oninput = () => { size = +$('feSize').value; $('feSizeV').textContent = size; };
    $('feFillT').onclick = () => { fillShapes = !fillShapes; sync(); };
    $('feMirror').onclick = () => { mirror = !mirror; sync(); };
    $('feUndo').onclick = doUndo; $('feRedo').onclick = doRedo;
    $('feBg').onclick = () => { push(); bg = color; cx.fillStyle = bg; cx.fillRect(0, 0, W, H); preview(); };
    $('feClear').onclick = () => { push(); bg = '#111111'; cx.fillStyle = bg; cx.fillRect(0, 0, W, H); preview(); };
    $('feCancel').onclick = FE.close;
    $('feSave').onclick = save;
    $('feText').onfocus = () => { tool = 'text'; stamp = null; sync(); };
    ov.addEventListener('pointerdown', down);
    ov.addEventListener('pointermove', move);
    ov.addEventListener('pointerup', up);
    ov.addEventListener('pointercancel', up);
    document.addEventListener('keydown', (e) => {
      if (el.classList.contains('hidden') || e.target.tagName === 'INPUT') return;
      if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); doUndo(); }
      else if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); doRedo(); }
      else if (e.code === 'Escape') { e.stopPropagation(); FE.close(); }
    }, true);
  }
  function sync() {
    document.querySelectorAll('#feTools button').forEach((b) => b.classList.toggle('on', b.dataset.t === tool));
    document.querySelectorAll('#feStamps button').forEach((b) => b.classList.toggle('on', tool === 'stamp' && b.dataset.s === stamp));
    document.querySelectorAll('#fePal button').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === color.toLowerCase()));
    $('feFillT').classList.toggle('on', fillShapes); $('feFillT').textContent = fillShapes ? '⬛ Relleno' : '⬜ Contorno';
    $('feMirror').classList.toggle('on', mirror);
    ov.style.cursor = tool === 'fill' ? 'cell' : tool === 'text' || tool === 'stamp' ? 'copy' : 'crosshair';
  }

  // ------------------------------------------------------------------ abrir / guardar
  // src: la bandera grande guardada (dataURL) para seguir editándola · done(img, src) al guardar
  FE.open = function (src, done) {
    build();
    onSave = done;
    undo = []; redo = [];
    bg = '#111111';
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
    if (src) { const im = new Image(); im.onload = () => { cx.drawImage(im, 0, 0, W, H); preview(); }; im.src = src; }
    else starter();
    $('flagEd').classList.remove('hidden');
    sync(); preview();
  };
  FE.close = () => { if ($('flagEd')) $('flagEd').classList.add('hidden'); };
  FE.isOpen = () => !!$('flagEd') && !$('flagEd').classList.contains('hidden');
  // Punto de partida: franja y una calavera, para que se entienda qué se puede hacer
  function starter() {
    cx.fillStyle = '#c8322a'; cx.fillRect(0, H - 34, W, 34);
    drawStamp(cx, 'skull', W / 2, H * 0.44, 90, '#f4f2ec');
  }
  function exportSmall() {
    const s = document.createElement('canvas');
    s.width = 192; s.height = 120;
    const c = s.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(cv, 0, 0, 192, 120);
    const png = s.toDataURL('image/png'), jpg = s.toDataURL('image/jpeg', 0.9);
    return png.length <= jpg.length ? png : jpg;
  }
  function save() {
    const img = exportSmall(), src = cv.toDataURL('image/png');
    if (onSave) onSave(img, src);
    FE.close();
  }
  function preview() {
    const p = $('fePrev');
    if (!p) return;
    const c = p.getContext('2d');
    c.clearRect(0, 0, p.width, p.height);
    c.drawImage(cv, 0, 0, p.width, p.height);
  }

  // ------------------------------------------------------------------ deshacer
  function push() { undo.push(cx.getImageData(0, 0, W, H)); if (undo.length > 30) undo.shift(); redo = []; }
  function doUndo() { if (!undo.length) return; redo.push(cx.getImageData(0, 0, W, H)); cx.putImageData(undo.pop(), 0, 0); preview(); }
  function doRedo() { if (!redo.length) return; undo.push(cx.getImageData(0, 0, W, H)); cx.putImageData(redo.pop(), 0, 0); preview(); }

  // ------------------------------------------------------------------ dibujo
  const pos = (e) => { const r = ov.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  // Dibuja algo y, en modo espejo, también su reflejo
  function both(c, fn) { fn(c); if (mirror) { c.save(); c.translate(W, 0); c.scale(-1, 1); fn(c); c.restore(); } }
  function down(e) {
    e.preventDefault();
    ov.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === 'fill') { push(); flood(Math.floor(p.x), Math.floor(p.y), color); if (mirror) flood(Math.floor(W - 1 - p.x), Math.floor(p.y), color); preview(); return; }
    if (tool === 'stamp') { push(); both(cx, (c) => drawStamp(c, stamp, p.x, p.y, Math.max(24, size * 3.2), color)); preview(); return; }
    if (tool === 'text') {
      const t = $('feText').value.trim();
      if (!t) { $('feText').focus(); return; }
      push(); both(cx, (c) => drawText(c, t, p.x, p.y)); preview(); return;
    }
    if (tool === 'brush' || tool === 'eraser') { push(); drag = { a: p, last: p }; stroke(p, p); return; }
    drag = { a: p, b: p };
  }
  function move(e) {
    if (!drag) return;
    const p = pos(e);
    if (tool === 'brush' || tool === 'eraser') { stroke(drag.last, p); drag.last = p; return; }
    drag.b = p;
    ox.clearRect(0, 0, W, H);
    both(ox, (c) => shape(c, drag.a, p, e.shiftKey));
  }
  function up(e) {
    if (!drag) return;
    const p = drag.b || pos(e);
    if (tool !== 'brush' && tool !== 'eraser') { push(); ox.clearRect(0, 0, W, H); both(cx, (c) => shape(c, drag.a, p, e.shiftKey)); }
    drag = null;
    preview();
  }
  function stroke(a, b) {
    both(cx, (c) => {
      c.strokeStyle = tool === 'eraser' ? bg : color; c.lineWidth = size; c.lineCap = c.lineJoin = 'round';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    });
  }
  // Formas entre dos puntos (Mayús: proporciones iguales)
  function shape(c, a, b, even) {
    let w = b.x - a.x, h = b.y - a.y;
    if (even) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    c.fillStyle = c.strokeStyle = color; c.lineWidth = Math.max(2, size * 0.6); c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    if (tool === 'line') { c.lineWidth = size; c.moveTo(a.x, a.y); c.lineTo(a.x + w, a.y + h); c.stroke(); return; }
    if (tool === 'rect') c.rect(a.x, a.y, w, h);
    else if (tool === 'circle') c.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    else if (tool === 'tri') { c.moveTo(a.x + w / 2, a.y); c.lineTo(a.x + w, a.y + h); c.lineTo(a.x, a.y + h); c.closePath(); }
    else if (tool === 'star') {
      const cx0 = a.x + w / 2, cy0 = a.y + h / 2, rx = Math.abs(w / 2), ry = Math.abs(h / 2);
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 1, an = -Math.PI / 2 + (i * Math.PI) / 5; c[i ? 'lineTo' : 'moveTo'](cx0 + Math.cos(an) * rx * r, cy0 + Math.sin(an) * ry * r); }
      c.closePath();
    }
    if (fillShapes) c.fill(); else c.stroke();
  }
  function drawText(c, t, x, y) {
    const px = Math.max(16, size * 2.4);
    c.font = `900 ${px}px Cinzel, Georgia, serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, px / 9); c.strokeStyle = bg; c.strokeText(t, x, y);
    c.fillStyle = color; c.fillText(t, x, y);
  }
  // Cubo de pintura (relleno por zonas del mismo color)
  function flood(x0, y0, hex) {
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const img = cx.getImageData(0, 0, W, H), d = img.data;
    const n = parseInt(hex.slice(1), 16), R = (n >> 16) & 255, Gc = (n >> 8) & 255, B = n & 255;
    const i0 = (y0 * W + x0) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2];
    if (Math.abs(r0 - R) + Math.abs(g0 - Gc) + Math.abs(b0 - B) < 6) return;
    const same = (i) => Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) < 96;
    const seen = new Uint8Array(W * H), st = [x0, y0];
    while (st.length) {
      const y = st.pop(); let x = st.pop();
      while (x > 0 && !seen[y * W + x - 1] && same((y * W + x - 1) * 4)) x--;
      let up = false, dn = false;
      for (; x < W && !seen[y * W + x] && same((y * W + x) * 4); x++) {
        const i = (y * W + x) * 4;
        d[i] = R; d[i + 1] = Gc; d[i + 2] = B; d[i + 3] = 255; seen[y * W + x] = 1;
        if (y > 0) { const s = !seen[(y - 1) * W + x] && same(((y - 1) * W + x) * 4); if (s && !up) st.push(x, y - 1); up = s; }
        if (y < H - 1) { const s = !seen[(y + 1) * W + x] && same(((y + 1) * W + x) * 4); if (s && !dn) st.push(x, y + 1); dn = s; }
      }
    }
    cx.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------------ sellos (dibujados en una caja de -1 a 1)
  // Los huecos (ojos de la calavera…) se recortan: dejan ver lo que había debajo
  const tmp = document.createElement('canvas');
  function drawStamp(c, k, x, y, s, col) {
    const px = Math.ceil(s * 2.2);
    tmp.width = tmp.height = px;
    const t = tmp.getContext('2d');
    t.clearRect(0, 0, px, px);
    t.save(); t.translate(px / 2, px / 2); t.scale(s, s);
    t.fillStyle = t.strokeStyle = col; t.lineCap = t.lineJoin = 'round';
    const cut = (fn) => { t.globalCompositeOperation = 'destination-out'; t.beginPath(); fn(); t.fill(); t.globalCompositeOperation = 'source-over'; };
    const bone = (x1, y1, x2, y2) => {
      t.lineWidth = 0.16; t.beginPath(); t.moveTo(x1, y1); t.lineTo(x2, y2); t.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * 0.1, ny = Math.cos(a) * 0.1;
      for (const [px2, py2] of [[x1, y1], [x2, y2]]) { t.beginPath(); t.arc(px2 + nx, py2 + ny, 0.12, 0, 7); t.arc(px2 - nx, py2 - ny, 0.12, 0, 7); t.fill(); }
    };
    switch (k) {
      case 'skull':
        t.beginPath(); t.ellipse(0, -0.18, 0.62, 0.56, 0, 0, 7); t.fill();
        t.beginPath(); t.roundRect(-0.36, 0.15, 0.72, 0.5, 0.12); t.fill();
        cut(() => { t.ellipse(-0.24, -0.14, 0.17, 0.2, 0.2, 0, 7); t.ellipse(0.24, -0.14, 0.17, 0.2, -0.2, 0, 7); });
        cut(() => { t.moveTo(0, 0.1); t.lineTo(-0.08, 0.28); t.lineTo(0.08, 0.28); t.closePath(); });
        cut(() => { for (const tx of [-0.2, -0.06, 0.08, 0.22]) t.rect(tx - 0.02, 0.44, 0.04, 0.22); });
        break;
      case 'bones': bone(-0.8, -0.55, 0.8, 0.55); bone(-0.8, 0.55, 0.8, -0.55); break;
      case 'swords':
        for (const sg of [-1, 1]) {
          t.save(); t.scale(sg, 1);
          t.lineWidth = 0.1; t.beginPath(); t.moveTo(-0.62, 0.62); t.quadraticCurveTo(0.05, 0.05, 0.72, -0.78); t.stroke();
          t.lineWidth = 0.08; t.beginPath(); t.moveTo(-0.82, 0.42); t.lineTo(-0.42, 0.82); t.stroke();
          t.lineWidth = 0.1; t.beginPath(); t.moveTo(-0.66, 0.66); t.lineTo(-0.86, 0.86); t.stroke();
          t.restore();
        }
        break;
      case 'anchor':
        t.lineWidth = 0.13;
        t.beginPath(); t.arc(0, -0.72, 0.14, 0, 7); t.stroke();
        t.beginPath(); t.moveTo(0, -0.58); t.lineTo(0, 0.72); t.moveTo(-0.34, -0.36); t.lineTo(0.34, -0.36); t.stroke();
        t.beginPath(); t.arc(0, 0.12, 0.6, 0.25, Math.PI - 0.25); t.stroke();
        for (const sg of [-1, 1]) { t.beginPath(); t.moveTo(sg * 0.7, 0.18); t.lineTo(sg * 0.5, 0.36); t.lineTo(sg * 0.46, 0.08); t.closePath(); t.fill(); }
        break;
      case 'crown':
        t.beginPath(); t.moveTo(-0.7, 0.45); t.lineTo(-0.78, -0.45); t.lineTo(-0.38, -0.05); t.lineTo(0, -0.62); t.lineTo(0.38, -0.05); t.lineTo(0.78, -0.45); t.lineTo(0.7, 0.45); t.closePath(); t.fill();
        t.fillRect(-0.74, 0.5, 1.48, 0.18);
        cut(() => { t.arc(-0.35, 0.22, 0.08, 0, 7); t.moveTo(0.08, 0.22); t.arc(0, 0.22, 0.08, 0, 7); t.moveTo(0.43, 0.22); t.arc(0.35, 0.22, 0.08, 0, 7); });
        break;
      case 'moon':
        t.beginPath(); t.arc(0, 0, 0.72, 0, 7); t.fill();
        cut(() => t.arc(0.32, -0.2, 0.62, 0, 7));
        break;
      case 'bolt':
        t.beginPath(); t.moveTo(0.18, -0.9); t.lineTo(-0.48, 0.12); t.lineTo(-0.02, 0.12); t.lineTo(-0.22, 0.9); t.lineTo(0.5, -0.2); t.lineTo(0.06, -0.2); t.closePath(); t.fill();
        break;
      case 'flame':
        t.beginPath(); t.moveTo(0, -0.92);
        t.bezierCurveTo(0.2, -0.5, 0.72, -0.3, 0.6, 0.3); t.bezierCurveTo(0.52, 0.72, 0.2, 0.88, 0, 0.88);
        t.bezierCurveTo(-0.2, 0.88, -0.56, 0.72, -0.6, 0.3); t.bezierCurveTo(-0.66, -0.1, -0.3, -0.2, -0.26, -0.56);
        t.bezierCurveTo(-0.08, -0.3, 0.02, -0.5, 0, -0.92); t.fill();
        cut(() => { t.moveTo(0, 0.1); t.bezierCurveTo(0.26, 0.3, 0.28, 0.66, 0, 0.7); t.bezierCurveTo(-0.28, 0.66, -0.26, 0.34, 0, 0.1); });
        break;
      case 'wave':
        t.lineWidth = 0.13;
        for (const oy of [-0.3, 0.25]) { t.beginPath(); for (let i = 0; i <= 40; i++) { const xx = -0.9 + i * 0.045; t.lineTo(xx, oy + Math.sin(xx * 7) * 0.14); } t.stroke(); }
        t.beginPath(); t.arc(-0.1, -0.62, 0.22, Math.PI * 0.2, Math.PI * 1.35); t.stroke();
        break;
      case 'heart':
        t.beginPath(); t.moveTo(0, 0.78); t.bezierCurveTo(-0.9, 0.1, -0.7, -0.78, 0, -0.34); t.bezierCurveTo(0.7, -0.78, 0.9, 0.1, 0, 0.78); t.fill();
        break;
      case 'fruit':
        t.beginPath(); t.ellipse(0, 0.08, 0.66, 0.6, 0, 0, 7); t.fill();
        t.lineWidth = 0.07; t.globalCompositeOperation = 'destination-out';
        for (const [ax, ay] of [[-0.3, -0.12], [0.26, -0.05], [-0.05, 0.36]]) { t.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.4, r = 0.02 + i * 0.006; t.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r); } t.stroke(); }
        t.globalCompositeOperation = 'source-over';
        t.lineWidth = 0.1; t.beginPath(); t.moveTo(0, -0.5); t.quadraticCurveTo(0.06, -0.72, 0.2, -0.8); t.stroke();
        t.beginPath(); t.ellipse(-0.2, -0.66, 0.2, 0.09, 0.5, 0, 7); t.fill();
        break;
      case 'eye':
        t.beginPath(); t.moveTo(-0.9, 0); t.quadraticCurveTo(0, -0.8, 0.9, 0); t.quadraticCurveTo(0, 0.8, -0.9, 0); t.fill();
        cut(() => { t.moveTo(-0.72, 0); t.quadraticCurveTo(0, -0.6, 0.72, 0); t.quadraticCurveTo(0, 0.6, -0.72, 0); });
        t.beginPath(); t.arc(0, 0, 0.3, 0, 7); t.fill();
        cut(() => t.arc(0.1, -0.1, 0.08, 0, 7));
        break;
    }
    t.restore();
    c.drawImage(tmp, x - px / 2, y - px / 2);
  }
  FE.drawStamp = drawStamp;
})();
