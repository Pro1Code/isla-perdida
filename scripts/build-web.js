// Genera la carpeta docs/ para GitHub Pages:
//   docs/index.html  → página de descargas (botón "Descargar" con todas las versiones publicadas)
//   docs/jugar/      → el juego completo para jugar en el navegador
// Uso: node scripts/build-web.js
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const OUT = path.join(SRC, 'docs');
const GAME = ['index.html', 'js', 'css', 'lib', 'img', 'audio'];

function copyRec(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) copyRec(path.join(from, f), path.join(to, f));
  } else fs.copyFileSync(from, to);
}

const version = fs.readFileSync(path.join(SRC, 'js', 'version.js'), 'utf8');
const repo = (version.match(/G\.REPO = '([^']+)'/) || [])[1] || 'TU-USUARIO-GITHUB/isla-perdida';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'jugar'), { recursive: true });
for (const item of GAME) copyRec(path.join(SRC, item), path.join(OUT, 'jugar', item));
fs.writeFileSync(path.join(OUT, 'index.html'), fs.readFileSync(path.join(SRC, 'web', 'landing.html'), 'utf8').replace(/__REPO__/g, repo));
fs.copyFileSync(path.join(SRC, 'build', 'icon.png'), path.join(OUT, 'icon.png'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`✅ Página web lista en docs/ (repositorio: ${repo})`);
if (repo.startsWith('TU-USUARIO')) console.log('⚠ Cambia G.REPO en js/version.js por tu usuario de GitHub antes de publicar.');
