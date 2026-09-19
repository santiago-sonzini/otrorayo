import copy
import importlib.util
import json
import os
from pathlib import Path
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('contact_server', Path(__file__).resolve().parents[1] / 'server.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

VALID = dict(name='Cliente de prueba', eventType='Casamiento', eventDate='Marzo 2027', city='Villa María', guests=120, interests=['vr', 'invitacion'], budget=2500, phone='+54 9 3536 00-0000', email='cliente@example.com', requestId='test-consultation-123456', website='')

class ContactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def setUp(self):
        app.recent.clear()
        app.requests_by_ip.clear()

    def post(self, data=VALID, origin=app.SITE_URL):
        req = Request(self.base + '/api/contact', data=json.dumps(data).encode(), headers={'Content-Type':'application/json', 'Origin':origin})
        try:
            with urlopen(req) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            code, data = error.code, json.loads(error.read())
            error.close()
            return code, data

    def test_success_and_duplicate_only_deliver_once(self):
        with patch.object(app, 'deliver') as send:
            self.assertEqual(self.post(), (200, {'ok': True}))
            self.assertEqual(self.post(), (200, {'ok': True}))
            self.assertEqual(send.call_count, 1)
            other = dict(VALID, budget=5000)
            self.assertEqual(self.post(other)[0], 409)

    def test_provider_failure_keeps_retry_possible(self):
        with patch.object(app, 'deliver', side_effect=RuntimeError('private SMTP detail')):
            code, result = self.post()
            self.assertEqual(code, 503)
            self.assertNotIn('SMTP', str(result))
        with patch.object(app, 'deliver'):
            self.assertEqual(self.post()[0], 200)

    def test_invalid_requests_never_send(self):
        bad = [dict(VALID, phone=''), dict(VALID, email='x@y.com\nBcc: x@y.com'), dict(VALID, budget=499), dict(VALID, budget=10001), dict(VALID, guests=1.5), dict(VALID, interests=['unknown']), dict(VALID, name='a'*101), dict(VALID, website='bot'), dict(VALID, eventType='unknown'), []]
        with patch.object(app, 'deliver') as send:
            for item in bad:
                self.assertEqual(self.post(item)[0], 400)
            self.assertEqual(self.post(origin='https://example.com')[0], 403)
            send.assert_not_called()

    def test_rate_limit(self):
        with patch.object(app, 'deliver') as send:
            for i in range(5):
                self.assertEqual(self.post(dict(VALID, requestId=f'test-consultation-{i:06}'))[0], 200)
            self.assertEqual(self.post(dict(VALID, requestId='test-consultation-final'))[0], 429)
            self.assertEqual(send.call_count, 5)

    def test_private_destination_and_escaped_template(self):
        data = app.validate(dict(VALID, name='<b>Nombre</b>', phone='+54 9 3536 00-0000', email=''))
        with patch.dict(os.environ, SMTP_USER='sender@example.com', SMTP_PASS='test', CONTACT_TO='private@example.com'):
            mail = app.make_message(data)
            self.assertEqual(mail['To'], 'private@example.com')
            self.assertIsNone(mail['Reply-To'])
            self.assertIn('&lt;b&gt;Nombre&lt;/b&gt;', mail.get_body(('html',)).get_content())

    def test_static_never_serves_private_files(self):
        for path in ['/server/.env', '/.env', '/../server/.env', '/%2e%2e/server/.env', '/README.md', '/PROMPT_MAESTRO.md']:
            with self.assertRaises(HTTPError) as caught:
                urlopen(self.base + path)
            self.assertEqual(caught.exception.code, 404)
            caught.exception.close()
        for path in ['/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/assets/images/amper50-real.png']:
            with urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)

if __name__ == '__main__':
    unittest.main(verbosity=2)
