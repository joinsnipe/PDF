"""PDF desktop: loopback assets and a one-use handoff of explicitly opened PDFs."""
import functools
import importlib.util
import hashlib
import http.server
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

PROTOCOL = 'pdf-desktop-1'
MAX_PDF = 100 * 1024 * 1024
_spec = importlib.util.spec_from_file_location('pdf_office', Path(__file__).with_name('office.py'))
office = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(office)
_ai_spec = importlib.util.spec_from_file_location('pdf_ai', Path(__file__).with_name('ai.py'))
ai = importlib.util.module_from_spec(_ai_spec)
_ai_spec.loader.exec_module(ai)
_vault_spec = importlib.util.spec_from_file_location('pdf_vault', Path(__file__).with_name('vault.py'))
vault = importlib.util.module_from_spec(_vault_spec)
_vault_spec.loader.exec_module(vault)


def pdf_bytes(data):
    return 0 < len(data) <= MAX_PDF and b'%PDF-' in data[:1024]


class PendingDocuments:
    """Memory-only handoff. No filesystem paths, history or browser uploads."""
    def __init__(self, clock=time.monotonic):
        self.items = {}
        self.lock = threading.Lock()
        self.clock = clock

    def expire(self):
        with self.lock:
            self.items = {key: item for key, item in self.items.items() if item[0] > self.clock()}

    def add(self, name, data):
        if (not pdf_bytes(data) or not isinstance(name, str) or len(name) > 255 or
                any(c in name for c in ('/', '\\', '\0', '\r', '\n')) or not name.lower().endswith('.pdf')):
            raise ValueError('Invalid PDF')
        self.expire()
        with self.lock:
            if len(self.items) >= 8 or sum(len(item[2]) for item in self.items.values()) + len(data) > MAX_PDF:
                raise RuntimeError('Hay documentos pendientes de abrir. Espera a que se muestre el visor y vuelve a intentarlo.')
            key = secrets.token_urlsafe(24)
            self.items[key] = (self.clock() + 120, name, data)
            return key

    def take(self, key):
        self.expire()
        with self.lock:
            item = self.items.pop(key, None)
            return (item[1], item[2]) if item else None


class PDFServer(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def service_actions(self):
        self.documents.expire()


class PDFHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'text/javascript', '.js': 'text/javascript',
                      '.wasm': 'application/wasm', '.gz': 'application/gzip',
                      '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json',
                      '.png': 'image/png', '.svg': 'image/svg+xml'}

    def __init__(self, *args, token, directory, **kwargs):
        self.token = token
        super().__init__(*args, directory=directory, **kwargs)

    def local_path(self):
        if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
            self.send_error(403)
            return None
        path = urllib.parse.urlsplit(self.path).path
        prefix = '/' + self.token + '/'
        if not path.startswith(prefix):
            self.send_error(404)
            return None
        decoded = urllib.parse.unquote(path[len(prefix):])
        if any(part in ('.', '..') for part in decoded.split('/')) or '\\' in decoded or '\0' in decoded:
            self.send_error(404)
            return None
        return decoded

    def send_head(self):
        decoded = self.local_path()
        if decoded is None:
            return None
        if decoded == '_desktop/ai-vault':
            if self.vault_allowed():
                try:
                    self.office_reply(vault.read_vault())
                except (ValueError, OSError):
                    self.send_error(400)
            return None
        if decoded == '_desktop/office/status':
            if self.headers.get('X-PDF-Local') != '1' or self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin':
                self.send_error(403)
                return None
            self.office_reply({'available': bool(office.find_office())})
            return None
        if decoded == '_desktop/ping':
            content = json.dumps({'app': PROTOCOL}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(content)
            return None
        if decoded.startswith('_desktop/document/'):
            if (self.command != 'GET' or self.headers.get('X-PDF-Local') != '1' or
                    self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin'):
                self.send_error(403)
                return None
            key = decoded.removeprefix('_desktop/document/')
            item = self.server.documents.take(key) if re.fullmatch(r'[A-Za-z0-9_-]{32}', key) else None
            if item is None:
                self.send_error(404)
                return None
            name, data = item
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('X-PDF-Name', urllib.parse.quote(name, safe=''))
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return None
        if decoded.startswith('_desktop/'):
            self.send_error(404)
            return None
        self.path = '/' + decoded
        candidate = Path(self.translate_path(self.path)).resolve()
        if not candidate.is_relative_to(Path(self.directory).resolve()):
            self.send_error(404)
            return None
        return super().send_head()

    def vault_allowed(self):
        origin = f'http://127.0.0.1:{self.server.server_port}'
        if (self.headers.get('X-PDF-Local') != '1' or
                self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin' or
                self.headers.get('Origin', origin) != origin or
                (self.command not in ('GET', 'HEAD') and self.headers.get('Origin') != origin)):
            self.send_error(403)
            return False
        return True

    def do_PUT(self):
        self.vault_change()

    def do_DELETE(self):
        self.vault_change()

    def vault_change(self):
        decoded = self.local_path()
        if decoded is None:
            return
        if decoded != '_desktop/ai-vault':
            self.send_error(405)
            return
        if not self.vault_allowed():
            return
        try:
            length = self.headers.get('Content-Length', '0')
            if not re.fullmatch(r'[0-9]{1,5}', length) or self.headers.get('Transfer-Encoding'):
                raise ValueError()
            if self.command == 'DELETE':
                if int(length) != 0:
                    raise ValueError()
                vault.delete_vault()
            else:
                if not 0 < int(length) <= 5000 or self.headers.get('Content-Type') != 'application/json':
                    raise ValueError()
                self.connection.settimeout(15)
                raw = self.rfile.read(int(length))
                if len(raw) != int(length):
                    raise ValueError()
                vault.write_vault(json.loads(raw))
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
        except (ValueError, OSError):
            self.send_error(400)

    def do_POST(self):
        decoded = self.local_path()
        if decoded is None:
            return
        if decoded == '_desktop/ai':
            if (self.headers.get('Origin') != f'http://127.0.0.1:{self.server.server_port}' or
                    self.headers.get('X-PDF-Local') != '1' or
                    self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin'):
                self.send_error(403)
                return
            length = self.headers.get('Content-Length', '')
            if (not re.fullmatch(r'[0-9]{1,9}', length) or not 0 < int(length) <= ai.MAX_INPUT or
                    self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type') != 'application/json'):
                self.send_error(400)
                return
            try:
                self.connection.settimeout(15)
                raw = self.rfile.read(int(length))
                if len(raw) != int(length):
                    raise ValueError('incomplete')
                self.office_reply(ai.forward(json.loads(raw)))
            except (ValueError, OSError):
                self.send_error(400)
            return
        if decoded == '_desktop/office/convert':
            if (self.headers.get('Origin') != f'http://127.0.0.1:{self.server.server_port}' or
                    self.headers.get('X-PDF-Local') != '1' or
                    self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin'):
                self.send_error(403)
                return
            length = self.headers.get('Content-Length', '')
            if (not re.fullmatch(r'[0-9]{1,9}', length) or not 0 < int(length) <= office.MAX_INPUT or
                    self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type') != 'application/octet-stream'):
                self.office_reply({'code': 'OFFICE_SIZE', 'error': 'Selecciona un archivo Office de hasta 25 MB.'}, 400)
                return
            try:
                self.connection.settimeout(15)
                data = self.rfile.read(int(length))
                if len(data) != int(length):
                    raise OSError()
                result = office.convert_office(data, self.headers.get('X-PDF-Extension', ''))
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Length', str(len(result)))
                self.end_headers()
                self.wfile.write(result)
            except office.OfficeError as error:
                self.office_reply({'code': error.code, 'error': str(error)}, 400)
            except OSError:
                self.office_reply({'code': 'OFFICE_INPUT', 'error': 'No se pudo leer el archivo completo.'}, 400)
            return
        if decoded == '_desktop/open':
            # This secret is in the per-user state file, NEVER in the browser.
            key = self.headers.get('X-PDF-Launcher', '')
            if (not re.fullmatch(r'[A-Za-z0-9_-]{43}', key) or
                    not secrets.compare_digest(key, self.server.launcher_secret) or
                    self.headers.get('Origin') or self.headers.get('Sec-Fetch-Site')):
                self.send_error(403)
                return
            length = self.headers.get('Content-Length', '')
            if (not re.fullmatch(r'[0-9]{1,9}', length) or not 0 < int(length) <= MAX_PDF or
                    self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type') != 'application/pdf'):
                self.send_error(400)
                return
            try:
                self.connection.settimeout(15)
                name = urllib.parse.unquote(self.headers.get('X-PDF-Name', ''), errors='strict')
                data = self.rfile.read(int(length))
                if len(data) != int(length):
                    raise ValueError('Incomplete PDF')
                document = self.server.documents.add(name, data)
            except (ValueError, OSError):
                self.send_error(400)
                return
            except RuntimeError:
                self.send_error(409)
                return
            content = json.dumps({'id': document}).encode()
            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        if decoded != '_desktop/stop':
            self.send_error(405)
            return
        origin = f'http://127.0.0.1:{self.server.server_port}'
        if (self.headers.get('Origin') != origin or
                self.headers.get('X-PDF-Local') != '1' or
                self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin'):
            self.send_error(403)
            return
        if self.headers.get('Content-Length', '0') != '0' or self.headers.get('Transfer-Encoding'):
            self.send_error(400)
            return
        self.send_response(204)
        self.send_header('Content-Length', '0')
        self.end_headers()
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def office_reply(self, data, status=200):
        content = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)

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
    server = PDFServer(('127.0.0.1', 0), handler)
    server.documents = PendingDocuments()
    server.launcher_secret = secrets.token_urlsafe(32)
    return server, f'http://127.0.0.1:{server.server_port}/{token}/'


class InstanceLock:
    """The OS releases this lock after a crash; no stale PID guessing."""
    def __init__(self, path):
        self.file = None
        self.path = path

    def acquire(self):
        self.file = self.path.open('a+b')
        self.file.seek(0, 2)
        if self.file.tell() == 0:
            self.file.write(b'0')
            self.file.flush()
        self.file.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            self.file.close()
            self.file = None
            return False

    def release(self):
        if self.file:
            self.file.close()
            self.file = None


def state_paths(root, base=None):
    if base is None:
        base = Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local/state')) / 'PDF-Herramientas' / 'state'
    base = Path(base)
    base.mkdir(parents=True, exist_ok=True, mode=0o700)
    identity = hashlib.sha256(os.path.normcase(str(root.resolve())).encode()).hexdigest()[:24]
    return base / (identity + '.json'), base / (identity + '.lock')


def valid_url(value):
    if not isinstance(value, str):
        return False
    try:
        parsed = urllib.parse.urlsplit(value)
        return (parsed.scheme == 'http' and parsed.hostname == '127.0.0.1' and
                parsed.username is None and parsed.password is None and
                parsed.port is not None and 0 < parsed.port < 65536 and
                not parsed.query and not parsed.fragment and
                re.fullmatch(r'/[A-Za-z0-9_-]{32}/', parsed.path) is not None)
    except ValueError:
        return False


def local_opener():
    # Never route the local session token through an environment-configured proxy.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args, **_kwargs):
            return None
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def local_request(url, stop=False):
    opener = local_opener()
    headers = {}
    if stop:
        parsed = urllib.parse.urlsplit(url)
        headers = {'Origin': f'http://{parsed.netloc}', 'X-PDF-Local': '1'}
    request = urllib.request.Request(url + ('_desktop/stop' if stop else '_desktop/ping'),
                                     data=b'' if stop else None, headers=headers)
    with opener.open(request, timeout=1) as response:
        return response.status == 204 if stop else json.loads(response.read(1024)).get('app') == PROTOCOL


def read_instance(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        url = data.get('url')
        if data.get('app') == PROTOCOL and valid_url(url) and local_request(url):
            return url
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return None


def save_instance(path, url, launcher_secret=None):
    temporary = path.with_suffix('.tmp')
    try:
        temporary.write_text(json.dumps({'app': PROTOCOL, 'url': url, 'launcher_secret': launcher_secret}), encoding='utf-8')
        temporary.chmod(0o600)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def notify(message, error=False):
    if os.name == 'nt':
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, message, 'PDF', 0x10 if error else 0x40)
    elif sys.stderr:
        print(message, file=sys.stderr)


def open_app(url):
    if not webbrowser.open(url):
        notify('PDF está abierto. Copia esta dirección en tu navegador:\n\n' + url)


def selected_document(path):
    file = Path(path)
    if not file.is_file() or file.suffix.lower() != '.pdf':
        raise RuntimeError('Selecciona un archivo PDF para abrirlo en el visor.')
    with file.open('rb') as handle:
        data = handle.read(MAX_PDF + 1)
    if not pdf_bytes(data):
        raise RuntimeError('El archivo no es un PDF reconocido o supera el límite de 100 MB.')
    return file.name, data


def handoff(state, url, document):
    key = json.loads(state.read_text(encoding='utf-8')).get('launcher_secret')
    if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', key):
        raise RuntimeError('Cierra PDF con «Salir de PDF» y vuelve a abrir el documento.')
    name, data = document
    request = urllib.request.Request(url + '_desktop/open', data=data, headers={
        'X-PDF-Launcher': key, 'X-PDF-Name': urllib.parse.quote(name, safe=''), 'Content-Type': 'application/pdf'})
    try:
        with local_opener().open(request, timeout=20) as response:
            identity = json.loads(response.read(1024)).get('id')
            if response.status != 201 or not isinstance(identity, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32}', identity):
                raise ValueError('Invalid response')
    except (OSError, ValueError) as error:
        raise RuntimeError('No se ha podido abrir el documento en PDF. Espera a que termine de abrirse el visor y vuelve a intentarlo.') from error
    return url + '#open=' + identity


def main(root=None, stop=False, state_base=None, open_file=None):
    root = Path(root) if root else Path(__file__).resolve().parent
    state, lock_path = state_paths(root, state_base)
    if stop:
        url = read_instance(state)
        if url:
            local_request(url, stop=True)
        return
    document = selected_document(open_file) if open_file is not None else None
    lock = InstanceLock(lock_path)
    if not lock.acquire():
        for _ in range(30):
            url = read_instance(state)
            if url:
                if document:
                    url = handoff(state, url, document)
                open_app(url)
                return
            time.sleep(0.1)
        raise RuntimeError('PDF está iniciándose o cerrándose. Espera unos segundos y vuelve a abrirlo.')
    server = None
    try:
        assets = root / 'app'
        if not (assets / 'index.html').is_file():
            assets = root.parent / 'dist'
        if not (assets / 'index.html').is_file():
            raise RuntimeError('Faltan archivos. Extrae todo el ZIP antes de abrir PDF.cmd.')
        server, url = make_server(assets)
        save_instance(state, url, server.launcher_secret)
        if document:
            url += '#open=' + server.documents.add(*document)
            document = None
        threading.Timer(0.3, open_app, args=(url,)).start()
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if server:
            server.server_close()
            server.documents.items.clear()
        state.unlink(missing_ok=True)
        lock.release()


if __name__ == '__main__':
    try:
        args = sys.argv[1:]
        if args and args != ['--stop'] and not (len(args) == 2 and args[0] == '--open'):
            raise RuntimeError('Abre PDF desde su icono o selecciona un documento con «Abrir con → PDF».')
        main(stop=args == ['--stop'], open_file=args[1] if len(args) == 2 else None)
    except Exception as error:
        notify(str(error) if isinstance(error, RuntimeError) else
               'No se ha podido abrir PDF. Extrae todo el ZIP en una carpeta nueva y vuelve a intentarlo.', error=True)
        sys.exit(1)
