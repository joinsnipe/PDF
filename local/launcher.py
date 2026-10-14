"""PDF local: serve bundled assets on loopback only, without upload endpoints."""
import functools
import http.server
import secrets
import threading
import urllib.parse
import webbrowser
from pathlib import Path


class PDFHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'text/javascript', '.js': 'text/javascript',
                      '.wasm': 'application/wasm', '.gz': 'application/gzip'}

    def __init__(self, *args, token, directory, **kwargs):
        self.token = token
        super().__init__(*args, directory=directory, **kwargs)

    def send_head(self):
        host = f'127.0.0.1:{self.server.server_port}'
        if self.headers.get('Host') != host:
            self.send_error(403)
            return None
        path = urllib.parse.urlsplit(self.path).path
        prefix = '/' + self.token + '/'
        if not path.startswith(prefix):
            self.send_error(404)
            return None
        decoded = urllib.parse.unquote(path[len(prefix):])
        if any(part in ('.', '..') for part in decoded.split('/')) or '\\' in decoded:
            self.send_error(404)
            return None
        self.path = '/' + decoded
        candidate = Path(self.translate_path(self.path)).resolve()
        if not candidate.is_relative_to(Path(self.directory).resolve()):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *_):
        pass


def make_server(directory):
    token = secrets.token_urlsafe(24)
    handler = functools.partial(PDFHandler, token=token, directory=str(directory))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    server.daemon_threads = True
    return server, f'http://127.0.0.1:{server.server_port}/{token}/'


def main():
    root = Path(__file__).resolve().parent
    assets = root / 'app'
    if not (assets / 'index.html').is_file():
        assets = root.parent / 'dist'
    if not (assets / 'index.html').is_file():
        raise SystemExit('Faltan archivos. Extrae todo el ZIP antes de abrir PDF.cmd.')
    server, url = make_server(assets)
    print('PDF - Herramientas locales\n')
    print('Abriendo el navegador. Si no se abre, copia esta direccion:')
    print(url)
    print('\nMantén esta ventana abierta mientras utilizas PDF.')
    print('Para salir, cierra esta ventana o pulsa Ctrl+C.\n')
    threading.Timer(0.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
