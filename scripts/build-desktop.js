// Compila el instalador .exe de Windows.
// Copia el juego a una carpeta de compilación FUERA de OneDrive (para no sincronizar cientos de MB de node_modules),
// instala las dependencias la primera vez y ejecuta electron-builder.
//
// Uso:  node scripts/build-desktop.js            → crea el instalador en <carpeta de compilación>/dist
//       node scripts/build-desktop.js --publish  → además lo sube como nueva versión a GitHub (necesita GH_TOKEN)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, '..');
const WORK = process.env.ISLA_BUILD_DIR || path.join(os.homedir(), 'isla-perdida-build');
const COPY = ['index.html', 'js', 'css', 'lib', 'img', 'audio', 'desktop', 'build', 'LEEME.txt', 'package.json'];

function copyRec(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) copyRec(path.join(from, f), path.join(to, f));
  } else fs.copyFileSync(from, to);
}

fs.mkdirSync(WORK, { recursive: true });
for (const item of COPY) {
  const dst = path.join(WORK, item);
  if (item !== 'package.json' && fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
  copyRec(path.join(SRC, item), dst);
}
// La versión del juego (js/version.js) debe coincidir con la del instalador
const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
const ver = fs.readFileSync(path.join(SRC, 'js', 'version.js'), 'utf8').match(/G\.VERSION = '([^']+)'/);
if (ver && ver[1] !== pkg.version) {
  console.error(`\n⚠ La versión de package.json (${pkg.version}) no coincide con js/version.js (${ver[1]}). Cámbialas a la misma y vuelve a compilar.\n`);
  process.exit(1);
}
const run = (cmd) => { console.log('> ' + cmd); execSync(cmd, { cwd: WORK, stdio: 'inherit', env: process.env }); };
// Instala (o actualiza) las dependencias si cambió package.json
const depsKey = JSON.stringify([pkg.dependencies, pkg.devDependencies]), stamp = path.join(WORK, 'node_modules', '.isla-deps');
if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== depsKey) { run('npm install --no-audit --no-fund'); fs.writeFileSync(stamp, depsKey); }
const publish = process.argv.includes('--publish');
run(`npx electron-builder --win nsis --x64 --publish ${publish ? 'always' : 'never'}`);
console.log(`\n✅ Instalador listo en: ${path.join(WORK, 'dist')}`);
