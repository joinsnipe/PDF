import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import Mock
import urllib.error

spec = importlib.util.spec_from_file_location('pdf_ai', Path(__file__).parents[1] / 'local/ai.py')
ai = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai)


class Response(io.BytesIO):
    def __init__(self, status, body):
        super().__init__(body)
        self.status = status


class AITransportTests(unittest.TestCase):
    def setUp(self):
        self.request = {'url': 'https://api.deepseek.com/models', 'method': 'GET',
                        'headers': {'Content-Type': 'application/json', 'Authorization': 'Bearer fake-only-testing'}}

    def test_fixed_destinations_and_headers(self):
        ai.validate_request(self.request)
        for url in ['https://api.deepseek.com.evil.example/models', 'https://127.0.0.1/models',
                    'http://api.deepseek.com/models', 'https://api.deepseek.com:443/models',
                    'https://api.deepseek.com/models?key=secret', 'https://api.deepseek.com/models#x']:
            with self.assertRaises(ValueError):
                ai.validate_request({**self.request, 'url': url})
        for headers in [{'Host': 'elsewhere.example'}, {'Authorization': 'Bearer fake\r\nX: unsafe'}]:
            with self.assertRaises(ValueError):
                ai.validate_request({**self.request, 'headers': {**self.request['headers'], **headers}})

    def test_direct_request_and_bounded_response(self):
        opener = Mock()
        opener.open.return_value = Response(200, b'{"data":[]}')
        result = ai.forward(self.request, opener)
        self.assertEqual(result, {'status': 200, 'body': '{"data":[]}'})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, self.request['url'])
        self.assertEqual(request.get_header('Authorization'), 'Bearer fake-only-testing')
        self.assertEqual(opener.open.call_count, 1)
        opener.open.return_value = Response(200, b'x' * (1024 * 1024 + 1))
        self.assertEqual(ai.forward(self.request, opener)['code'], 'AI_SIZE')

    def test_no_redirect_no_retry_and_no_raw_network_details(self):
        opener = Mock()
        opener.open.side_effect = urllib.error.HTTPError(self.request['url'], 302, 'redirect', {'Location': 'https://evil.example'}, io.BytesIO())
        self.assertEqual(ai.forward(self.request, opener)['code'], 'AI_REDIRECT')
        self.assertEqual(opener.open.call_count, 1)
        self.assertIsNone(ai.NoRedirect().redirect_request(None, None, 302, None, None, 'https://evil.example'))
        opener.open.side_effect = OSError('private secret and document')
        result = ai.forward(self.request, opener)
        self.assertEqual(result['code'], 'AI_NETWORK')
        self.assertNotIn('private secret', json.dumps(result))
