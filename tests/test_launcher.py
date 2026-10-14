"""Exercise the request handler without a listening or preview server."""
import importlib.util
import io
import pathlib
import tempfile
import types
import unittest

spec = importlib.util.spec_from_file_location('launcher', pathlib.Path(__file__).parents[1] / 'local/launcher.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class Socket:
    def __init__(self, request):
        self.request = io.BytesIO(request)
        self.response = bytearray()

    def makefile(self, *_):
        return self.request

    def sendall(self, value):
        self.response.extend(value)


class LocalHandlerTests(unittest.TestCase):
    def request(self, path, host='127.0.0.1:12345', method='GET'):
        with tempfile.TemporaryDirectory() as temp:
            pathlib.Path(temp, 'index.html').write_text('PDF APP')
            pathlib.Path(temp, 'motor.wasm').write_bytes(b'\0asm')
            sock = Socket(f'{method} {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n'.encode())
            launcher.PDFHandler(sock, ('127.0.0.1', 1), types.SimpleNamespace(server_port=12345), token='test-token', directory=temp)
            return bytes(sock.response)

    def test_assets_and_wasm_type(self):
        self.assertIn(b'200 OK', self.request('/test-token/'))
        self.assertIn(b'PDF APP', self.request('/test-token/'))
        self.assertIn(b'application/wasm', self.request('/test-token/motor.wasm'))

    def test_host_token_traversal_and_upload_rejected(self):
        self.assertIn(b'403', self.request('/test-token/', 'elsewhere.example'))
        self.assertIn(b'404', self.request('/'))
        self.assertIn(b'404', self.request('/test-token/%2e%2e/private'))
        self.assertIn(b'501', self.request('/test-token/', method='POST'))


if __name__ == '__main__':
    unittest.main()
