// Publica una versión nueva del juego en GitHub con un solo comando:
//   node scripts/release.js 2.1.0
// Antes de ejecutarlo, escribe las novedades en build/release-notes.md.
// Hace esto:
//   1) cambia la versión en package.json y js/version.js
//   2) regenera docs/ (página de descargas + versión para navegador)
//   3) guarda los cambios en git y los sube a GitHub
//   4) compila el instalador y lo publica como nueva versión: los juegos instalados se actualizan solos
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ver = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(ver || '')) { console.error('Uso: node scripts/release.js 2.1.0'); process.exit(1); }

const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
if (!newer(ver, pkg.version)) { console.error(`La versión ${ver} debe ser mayor que la actual (${pkg.version}).`); process.exit(1); }

// GitHub CLI: la copia portátil de la carpeta de compilación o la instalada en el sistema
const ghLocal = path.join(os.homedir(), 'isla-perdida-build', 'tools', 'gh', 'bin', 'gh.exe');
const gh = fs.existsSync(ghLocal) ? ghLocal : 'gh';
let token;
try { token = execFileSync(gh, ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch (e) { console.error('Inicia sesión primero:  gh auth login --web'); process.exit(1); }

const run = (cmd, env) => { console.log('> ' + cmd); execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: Object.assign({}, process.env, env || {}) }); };

pkg.version = ver;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const vPath = path.join(ROOT, 'js', 'version.js');
fs.writeFileSync(vPath, fs.readFileSync(vPath, 'utf8').replace(/G\.VERSION = '[^']+'/, `G.VERSION = '${ver}'`));
run('node scripts/build-web.js');
const helper = `credential.helper=!'${ghLocal.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (m, d) => '/' + d.toLowerCase())}' auth git-credential`;
run('git add -A');
run(`git commit -q -m "Versión ${ver}"`);
run(`git -c credential.helper= -c "${fs.existsSync(ghLocal) ? helper : 'credential.helper=!gh auth git-credential'}" push`);
run('node scripts/build-desktop.js --publish', { GH_TOKEN: token });
try { execFileSync(gh, ['release', 'edit', 'v' + ver, '-R', pkg.build.publish[0].owner + '/' + pkg.build.publish[0].repo, '--title', `Isla Perdida ${ver}`, '--notes-file', path.join(ROOT, 'build', 'release-notes.md')], { stdio: 'inherit' }); } catch (e) { /* las notas ya las pone electron-builder */ }
console.log(`\n✅ Versión ${ver} publicada. La página de descargas la mostrará en unos minutos.`);
