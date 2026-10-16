"""Private desktop AI transport: only fixed HTTPS APIs, never an open proxy."""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

MAX_INPUT = 512 * 1024
POLICY = json.loads(Path(__file__).with_name('ai-policy.json').read_text())


def validate_request(data):
    if not isinstance(data, dict) or data.get('method') not in ('GET', 'POST') or not isinstance(data.get('url'), str):
        raise ValueError('request')
    url, method = data['url'], data['method']
    matched = None
    for base, rule in POLICY.items():
        if method == 'GET':
            valid = url == base + rule['get']
        elif rule['auth'] == 'x-goog-api-key':
            valid = url.startswith(base + rule['post']) and re.fullmatch(r'[A-Za-z0-9._-]+:generateContent', url[len(base + rule['post']):])
        else:
            valid = url == base + rule['post']
        if valid:
            matched = rule
            break
    if not matched:
        raise ValueError('destination')
    auth, headers = matched['auth'], data.get('headers')
    allowed = {'Content-Type', auth} | ({'anthropic-version', 'anthropic-workspace-id'} if auth == 'x-api-key' else set())
    if not isinstance(headers, dict) or set(headers) - allowed or headers.get('Content-Type') != 'application/json':
        raise ValueError('headers')
    if not all(isinstance(v, str) and len(v) <= 600 and not any(c in v for c in ('\r', '\n', '\0')) for v in headers.values()):
        raise ValueError('headers')
    key = headers.get(auth, '')
    if len(key) < 12 or (auth == 'Authorization' and not re.fullmatch(r'Bearer [^\s]+', key)):
        raise ValueError('key')
    if auth == 'x-api-key' and (headers.get('anthropic-version') != '2023-06-01' or (headers.get('anthropic-workspace-id') and not re.fullmatch(r'wrkspc_[A-Za-z0-9]{10,80}', headers['anthropic-workspace-id']))):
        raise ValueError('headers')
    body = data.get('body')
    if method == 'GET':
        if body is not None:
            raise ValueError('body')
    else:
        if not isinstance(body, str) or len(body.encode()) > MAX_INPUT:
            raise ValueError('body')
        parsed = json.loads(body)
        if not isinstance(parsed, dict) or parsed.get('stream'):
            raise ValueError('body')
    return urllib.request.Request(url, data=body.encode() if body is not None else None, headers=headers, method=method)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def forward(data, opener=None):
    try:
        request = validate_request(data)
    except (ValueError, TypeError):
        return {'code': 'AI_LOCAL_REQUEST', 'error': 'El conector local ha rechazado una petición no válida.'}
    try:
        # Do not inherit an HTTP proxy from the environment. TLS validation stays enabled.
        opener = opener or urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        try:
            response = opener.open(request, timeout=75)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status = response.status
            if 300 <= status < 400:
                return {'code': 'AI_REDIRECT', 'error': 'El proveedor ha intentado redirigir la petición. No se ha seguido ni enviado la clave a otra dirección.'}
            limit = 1024 * 1024 if 200 <= status < 300 else 16384
            raw = response.read(limit + 1)
            if len(raw) > limit:
                return {'code': 'AI_SIZE', 'error': 'La respuesta del proveedor supera el límite permitido.'}
            return {'status': status, 'body': raw.decode('utf-8', errors='replace')}
    except Exception:
        return {'code': 'AI_NETWORK', 'error': 'Tu ordenador no ha podido contactar con el proveedor. Revisa la red y el cortafuegos. No se ha reintentado; podría haber consumo si la petición llegó.'}
