"""Exercise the request handler without a listening or preview server."""
import importlib.util
import io
import pathlib
import tempfile
import types
import unittest
import json
from unittest.mock import patch, Mock

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

    def settimeout(self, _timeout):
        pass


class LocalHandlerTests(unittest.TestCase):
    def test_ai_connector_only_accepts_own_origin_session_and_bounded_json(self):
        endpoint = '/test-token/_desktop/ai'
        body = b'{"url":"https://api.deepseek.com/models"}'
        headers = {'Origin': 'http://127.0.0.1:12345', 'X-PDF-Local': '1',
                   'Content-Type': 'application/json', 'Content-Length': str(len(body))}
        with patch.object(launcher.ai, 'forward', return_value={'status': 200, 'body': '{"data":[]}'}) as forward:
            for bad in [{'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}, {'X-PDF-Local': '0'}]:
                self.assertIn(b'403', self.request(endpoint, method='POST', headers={**headers, **bad}, body=body))
            self.assertIn(b'404', self.request('/wrong/_desktop/ai', method='POST', headers=headers, body=body))
            self.assertIn(b'400', self.request(endpoint, method='POST', headers={**headers, 'Content-Length': '9999999'}))
            forward.assert_not_called()
            response = self.request(endpoint, method='POST', headers=headers, body=body)
            self.assertIn(b'200 OK', response)
            self.assertIn(b'Cache-Control: no-store', response)
            forward.assert_called_once_with(json.loads(body))

    def request(self, path, host='127.0.0.1:12345', method='GET', headers=None, body=b'', documents=None):
        with tempfile.TemporaryDirectory() as temp:
            pathlib.Path(temp, 'index.html').write_text('PDF APP')
            pathlib.Path(temp, 'motor.wasm').write_bytes(b'\0asm')
            extra = ''.join(f'{key}: {value}\r\n' for key, value in (headers or {}).items())
            sock = Socket(f'{method} {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n{extra}\r\n'.encode()+body)
            self.shutdown = Mock()
            server = types.SimpleNamespace(server_port=12345, shutdown=self.shutdown,
                                           launcher_secret='s'*43, documents=documents or launcher.PendingDocuments())
            launcher.PDFHandler(sock, ('127.0.0.1', 1), server, token='test-token', directory=temp)
            return bytes(sock.response)

    def test_assets_and_wasm_type(self):
        self.assertIn(b'200 OK', self.request('/test-token/'))
        self.assertIn(b'PDF APP', self.request('/test-token/'))
        self.assertIn(b'application/wasm', self.request('/test-token/motor.wasm'))

    def test_host_token_traversal_and_upload_rejected(self):
        self.assertIn(b'403', self.request('/test-token/', 'elsewhere.example'))
        self.assertIn(b'404', self.request('/'))
        self.assertIn(b'404', self.request('/test-token/%2e%2e/private'))
        self.assertIn(b'405', self.request('/test-token/', method='POST'))

    def test_health_and_stop_require_local_token_origin_and_empty_body(self):
        self.assertIn(b'pdf-desktop-1', self.request('/test-token/_desktop/ping'))
        self.assertIn(b'404', self.request('/wrong/_desktop/ping'))
        headers = {'Origin': 'http://127.0.0.1:12345', 'X-PDF-Local': '1'}
        self.assertIn(b'403', self.request('/test-token/_desktop/stop', method='POST'))
        self.assertIn(b'403', self.request('/test-token/_desktop/stop', method='POST', headers={**headers, 'Origin': 'https://elsewhere.example'}))
        self.assertIn(b'403', self.request('/test-token/_desktop/stop', method='POST', headers={**headers, 'Sec-Fetch-Site': 'cross-site'}))
        self.assertIn(b'400', self.request('/test-token/_desktop/stop', method='POST', headers={**headers, 'Content-Length': '10'}))
        with patch.object(launcher.threading, 'Thread') as thread:
            self.assertIn(b'204', self.request('/test-token/_desktop/stop', method='POST', headers=headers))
            thread.assert_called_once_with(target=self.shutdown, daemon=True)

    def test_office_endpoint_requires_origin_and_converts_only_selected_bytes(self):
        endpoint = '/test-token/_desktop/office/convert'
        headers = {'Origin': 'http://127.0.0.1:12345', 'X-PDF-Local': '1',
                   'Content-Type': 'application/octet-stream', 'Content-Length': '3', 'X-PDF-Extension': 'docx'}
        with patch.object(launcher.office, 'convert_office', return_value=b'%PDF-fake') as convert:
            self.assertIn(b'403', self.request(endpoint, method='POST', headers={**headers, 'Origin': 'https://evil.example'}, body=b'abc'))
            self.assertIn(b'400', self.request(endpoint, method='POST', headers={**headers, 'Content-Length': str(launcher.office.MAX_INPUT+1)}))
            convert.assert_not_called()
            response = self.request(endpoint, method='POST', headers=headers, body=b'abc')
            self.assertIn(b'application/pdf', response)
            self.assertTrue(response.endswith(b'%PDF-fake'))
            convert.assert_called_once_with(b'abc', 'docx')
        self.assertIn(b'403', self.request('/test-token/_desktop/office/status'))
        with patch.object(launcher.office, 'find_office', return_value='/private/location/soffice'):
            response = self.request('/test-token/_desktop/office/status', headers={'X-PDF-Local': '1'})
            self.assertIn(b'"available": true', response)
            self.assertNotIn(b'/private/location', response)

    def test_no_session_or_file_directory_leak(self):
        response = self.request('/test-token/_desktop/ping')
        self.assertIn(b'Cache-Control: no-store', response)
        self.assertNotIn(b'test-token', response)
        self.assertIn(b'404', self.request('/test-token/%00'))

    def test_native_open_transfers_only_pdf_bytes_once(self):
        pdf = b'%PDF-1.7\nFake fixture bytes'
        documents = launcher.PendingDocuments()
        headers = {'X-PDF-Launcher': 's'*43, 'X-PDF-Name': 'Presupuesto%20Mu%C3%B1oz.pdf',
                   'Content-Type': 'application/pdf', 'Content-Length': str(len(pdf))}
        response = self.request('/test-token/_desktop/open', method='POST', headers=headers, body=pdf, documents=documents)
        self.assertIn(b'201 Created', response)
        key = json.loads(response.split(b'\r\n\r\n', 1)[1])['id']
        path = '/test-token/_desktop/document/'+key
        self.assertIn(b'403', self.request(path, documents=documents))
        response = self.request(path, headers={'X-PDF-Local': '1'}, documents=documents)
        self.assertIn(b'X-PDF-Name: Presupuesto%20Mu%C3%B1oz.pdf', response)
        self.assertEqual(response.split(b'\r\n\r\n', 1)[1], pdf)
        self.assertIn(b'404', self.request(path, headers={'X-PDF-Local': '1'}, documents=documents))

    def test_browser_cannot_submit_paths_or_documents_to_native_handoff(self):
        endpoint = '/test-token/_desktop/open'
        headers = {'X-PDF-Launcher': 's'*43, 'X-PDF-Name': 'test.pdf', 'Content-Type': 'application/pdf', 'Content-Length': '10'}
        for extra in [{'X-PDF-Launcher': ''}, {'X-PDF-Launcher': 'z'*43}, {'Origin': 'http://127.0.0.1:12345'}, {'Sec-Fetch-Site': 'same-origin'}]:
            self.assertIn(b'403', self.request(endpoint, method='POST', headers={**headers, **extra}))
        for extra, body in [({'Content-Length': str(launcher.MAX_PDF+1)}, b''),
                            ({'Transfer-Encoding': 'chunked'}, b''),
                            ({'X-PDF-Name': '..%2Fprivate.pdf'}, b'%PDF-1.7\na'),
                            ({}, b'C:\\a.p12xx'), ({}, b'%PDF-')]:
            self.assertIn(b'400', self.request(endpoint, method='POST', headers={**headers, **extra}, body=body))
        self.assertNotIn(b's'*43, self.request('/test-token/_desktop/ping'))


class DesktopLifecycleTests(unittest.TestCase):
    def test_instance_lock_releases_for_reopening(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp, 'lock')
            first, second = launcher.InstanceLock(path), launcher.InstanceLock(path)
            self.assertTrue(first.acquire())
            try:
                self.assertFalse(second.acquire())
            finally:
                first.release()
            self.assertTrue(second.acquire())
            second.release()

    def test_state_rejects_remote_urls_before_network_request(self):
        token = 'a' * 32
        good = f'http://127.0.0.1:12345/{token}/'
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp, 'state.json')
            for url in ['https://example.com/', f'http://user@127.0.0.1:12345/{token}/', good+'?redirect=1', 'file:///secret', 'http://127.0.0.1:bad/']:
                path.write_text(json.dumps({'app': launcher.PROTOCOL, 'url': url}))
                with patch.object(launcher, 'local_request') as request:
                    self.assertIsNone(launcher.read_instance(path))
                    request.assert_not_called()
            launcher.save_instance(path, good)
            with patch.object(launcher, 'local_request', return_value=True):
                self.assertEqual(launcher.read_instance(path), good)
            with patch.object(launcher, 'local_request', side_effect=OSError()):
                self.assertIsNone(launcher.read_instance(path))

    def test_second_open_reuses_running_instance_without_creating_server(self):
        with tempfile.TemporaryDirectory() as temp:
            url = 'http://127.0.0.1:12345/' + 'a'*32 + '/'
            with patch.object(launcher.InstanceLock, 'acquire', return_value=False), patch.object(launcher, 'read_instance', return_value=url), patch.object(launcher, 'open_app') as opened, patch.object(launcher, 'make_server') as server:
                launcher.main(root=temp, state_base=pathlib.Path(temp, 'state'))
                opened.assert_called_once_with(url)
                server.assert_not_called()

    def test_start_and_shutdown_clean_state_without_console(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            (root/'app').mkdir()
            (root/'app/index.html').write_text('PDF')
            state = root/'state'
            server = Mock()
            server.launcher_secret = 's'*43
            with patch.object(launcher, 'make_server', return_value=(server, 'http://127.0.0.1:12345/'+'a'*32+'/')), patch.object(launcher.threading, 'Timer') as timer, patch.object(launcher.sys, 'stdout', None):
                launcher.main(root=root, state_base=state)
                server.serve_forever.assert_called_once()
                server.server_close.assert_called_once()
                timer.return_value.start.assert_called_once()
            self.assertEqual(list(state.glob('*.json')), [])
            lock = launcher.InstanceLock(next(state.glob('*.lock')))
            self.assertTrue(lock.acquire())
            lock.release()

    def test_selected_document_is_read_only_and_handoff_expires(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp, 'Mi documento ñ.pdf')
            data = b'%PDF-1.7\nfixture'
            path.write_bytes(data)
            name, result = launcher.selected_document(path)
            self.assertEqual((name, result), (path.name, data))
            self.assertEqual(path.read_bytes(), data)
            clock = Mock(return_value=0)
            documents = launcher.PendingDocuments(clock)
            key = documents.add(name, result)
            clock.return_value = 121
            self.assertIsNone(documents.take(key))
            self.assertEqual(documents.items, {})
            path.with_suffix('.p12').write_bytes(data)
            with self.assertRaises(RuntimeError):
                launcher.selected_document(path.with_suffix('.p12'))

    def test_open_from_explorer_passes_document_to_existing_instance(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp, 'Firma.pdf')
            path.write_bytes(b'%PDF-1.7\nfixture')
            url = 'http://127.0.0.1:12345/'+'a'*32+'/'
            with patch.object(launcher.InstanceLock, 'acquire', return_value=False), patch.object(launcher, 'read_instance', return_value=url), patch.object(launcher, 'handoff', return_value=url+'#open='+'b'*32) as transfer, patch.object(launcher, 'open_app') as opened:
                launcher.main(root=temp, state_base=pathlib.Path(temp, 'state'), open_file=path)
                self.assertEqual(transfer.call_args.args[2], (path.name, path.read_bytes()))
                opened.assert_called_once_with(url+'#open='+'b'*32)

    def test_failed_start_releases_lock_and_is_retryable(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            for _ in range(2):
                with self.assertRaisesRegex(RuntimeError, 'Faltan archivos'):
                    launcher.main(root=root, state_base=root/'state')


if __name__ == '__main__':
    unittest.main()
