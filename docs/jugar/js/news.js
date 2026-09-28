// Novedades (menú principal): cada versión con su miniatura y el botón «Ver contenido», que despliega todas
// sus novedades y, debajo, capturas del juego con lo nuevo. Se leen de novedades/novedades.json: en la web,
// junto a la página de descargas; aquí en local, de web/novedades; en la app, de la página publicada.
(function () {
  'use strict';
  const G = window.G;
  const N = (G.News = {});
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Próximamente');

  // Notas en texto (como en build/release-notes.md): título, apartados EN MAYÚSCULAS y líneas con «- »
  N.format = function (txt, skipTitle) {
    const out = [];
    let list = false;
    const close = () => { if (list) { out.push('</ul>'); list = false; } };
    String(txt || '').split(/\r?\n/).forEach((raw, i) => {
      const l = raw.trim();
      if (!l) { close(); return; }
      if (i === 0 && skipTitle) return;
      if (l.startsWith('- ')) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${esc(l.slice(2))}</li>`); return; }
      close();
      const letters = l.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
      if (letters.length > 3 && letters === letters.toUpperCase()) out.push(`<h4>${esc(l)}</h4>`);
      else out.push(`<p>${esc(l)}</p>`);
    });
    close();
    return out.join('');
  };
  N.card = function (v, base, latest) {
    const img = (p) => (/^https?:/.test(p) ? p : base + p);
    const gal = (v.images || []).map((m) => `<figure><img loading="lazy" src="${esc(img(m.src))}" alt="" /><figcaption>${esc(m.text || '')}</figcaption></figure>`).join('');
    return `<article class="news${latest ? ' latest' : ''}${v.thumb ? '' : ' nothumb'}">
      ${v.thumb ? `<img class="news-thumb" src="${esc(img(v.thumb))}" alt="Miniatura de la versión ${esc(v.version)}" />` : ''}
      <div class="news-body">
        <div class="news-title">${esc(v.version)} · ${esc(v.name || '')}${latest ? ' <span class="news-badge">Última</span>' : ''}</div><div class="news-date">${esc(fmtDate(v.date))}</div>
        <button class="btn small news-more" data-a="more">📖 Ver contenido</button>
      </div>
      <div class="news-content">${N.format(v.notes, true)}${gal ? `<h4>📸 Imágenes</h4><div class="news-gallery">${gal}</div>` : ''}</div>
    </article>`;
  };
  // Primera fuente que responda: la web publicada (../novedades), el proyecto en local (web/novedades) o la página publicada
  async function load() {
    for (const base of ['../novedades/', 'web/novedades/', G.DOWNLOAD_URL + 'novedades/']) {
      try { const r = await fetch(base + 'novedades.json', { cache: 'no-cache' }); if (r.ok) return { base, list: await r.json() }; } catch (e) { /* siguiente */ }
    }
    return null;
  }
  N.open = async function () {
    G.Menus.show('menuNews');
    const box = document.getElementById('newsList');
    box.innerHTML = '<p class="muted">Cargando novedades…</p>';
    const d = await load();
    if (!d || !d.list.length) { box.innerHTML = '<p class="muted">No se pudieron cargar las novedades (hace falta conexión a internet).</p>'; return; }
    // Solo las versiones que ya existen (hasta la que estás jugando)
    const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0); return 0; };
    const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // probando en local: también la que está por salir
    const list = d.list.filter((v) => v.date || v.version === G.VERSION || dev).sort((a, b) => cmp(a.version, b.version));
    box.innerHTML = list.map((v, i) => N.card(v, d.base, i === 0)).join('');
    box.onclick = (e) => {
      const b = e.target.closest('button[data-a="more"]');
      if (!b) return;
      const card = b.closest('.news'), open = card.classList.toggle('open');
      b.textContent = open ? '🔼 Ocultar contenido' : '📖 Ver contenido';
    };
  };
})();
