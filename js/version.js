// Versión del juego (la usan el menú, la página de descargas y el actualizador de la app de escritorio)
window.G = window.G || {};
G.VERSION = '2.0.0';
G.VERSION_NAME = 'El Archipiélago';
// Página de descargas (GitHub Pages) y repositorio donde se publican las versiones
G.REPO = 'Pro1Code/isla-perdida';
G.DOWNLOAD_URL = 'https://' + G.REPO.split('/')[0].toLowerCase() + '.github.io/' + G.REPO.split('/')[1] + '/';
