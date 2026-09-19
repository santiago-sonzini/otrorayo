"""Exercise the actual Vercel handler without sending real messages."""
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch

from api.contact import handler
from server import server as backend

DATA = dict(name="Prueba", phone="+54 9 3536 00-0000", eventType="Casamiento",
            eventDate="2027", city="Villa María", guests=100, interests=["vr"],
            budget=2500, email="", requestId="vercel-test-request-123", website="")


class VercelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def setUp(self):
        backend.recent.clear()
        backend.requests_by_ip.clear()
        self.env = patch.dict(os.environ, VERCEL="1", VERCEL_URL="otrorayo-preview.vercel.app",
                              SITE_URL="https://otrorayo.com", SMTP_USER="sender@example.com",
                              SMTP_PASS="test-only", CONTACT_TO="recipient@example.com")
        self.env.start()
        self.addCleanup(self.env.stop)

    def request(self, origin="https://otrorayo.com", path="/api/contact", data=DATA):
        req = Request(self.base + path, data=json.dumps(data).encode() if data else None,
                      headers={"Content-Type": "application/json", "Origin": origin})
        try:
            with urlopen(req) as response:
                return response.status, json.loads(response.read()), response.headers
        except HTTPError as error:
            with error:
                return error.code, json.loads(error.read()), error.headers

    def test_production_and_exact_preview_origin(self):
        with patch.object(backend, "connect_smtp") as smtp:
            smtp.return_value.__enter__.return_value.send_message.return_value = {}
            code, body, headers = self.request()
            self.assertEqual((code, body), (200, {"ok": True}))
            self.assertEqual(headers["Cache-Control"], "no-store")
            sent = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertEqual(sent["To"], "recipient@example.com")
            self.assertNotIn("recipient@example.com", json.dumps(body))
            self.assertEqual(self.request(origin="https://otrorayo-preview.vercel.app")[0], 200)
            self.assertEqual(self.request(origin="https://unrelated.vercel.app")[0], 403)
            self.assertEqual(self.request(origin="http://localhost:4173")[0], 403)
            self.assertEqual(smtp.call_count, 1)

    def test_missing_configuration_and_wrong_method(self):
        with patch.dict(os.environ, SMTP_PASS=""), patch.object(backend, "connect_smtp") as smtp:
            self.assertEqual(self.request()[0], 503)
            smtp.assert_not_called()
        self.assertEqual(self.request(data=None)[0], 405)
        self.assertEqual(self.request(path="/server/.env", data=None)[0], 405)

    def test_smtp_host_and_port_come_from_environment(self):
        with patch.dict(os.environ, SMTP_HOST="smtp.example.com", SMTP_PORT="2525"), patch.object(backend.smtplib, "SMTP") as smtp:
            backend.connect_smtp()
            smtp.assert_called_once_with("smtp.example.com", 2525, timeout=15)
            smtp.return_value.starttls.assert_called_once()
            smtp.return_value.login.assert_called_once_with("sender@example.com", "test-only")
