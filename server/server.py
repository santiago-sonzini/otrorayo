"""OTRORAYO: static landing + private SMTP contact endpoint. Standard library only."""
from __future__ import annotations

import hashlib
import html
import json
import mimetypes
import os
from pathlib import Path
import re
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "landing"
# Hosted deployments read only platform environment variables. Local values
# never replace variables supplied by the shell or Vercel.
if not os.environ.get("VERCEL"):
    for env_file in (ROOT / ".env.local", Path(__file__).parent / ".env"):
        if not env_file.exists():
            continue
        for row in env_file.read_text().splitlines():
            key, sep, value = row.partition("=")
            if sep and key.strip() and not key.lstrip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

SITE_URL = os.environ.get("SITE_URL", "https://otrorayo.com").rstrip("/")
PORT = int(os.environ.get("PORT", "4173"))
EVENT_TYPES = {"Fiesta de 15", "Casamiento", "Celebración privada", "Evento de marca", "Otro"}
SERVICES = {"vr": "Experiencias inmersivas", "interaccion": "Interacción en vivo", "visuales": "Visuales y contenido", "invitacion": "Invitaciones web", "integral": "Experiencia integral", "otro": "Lo imaginamos juntos"}
EMAIL = re.compile(r"^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$")
locks = threading.Lock()
requests_by_ip: dict[str, list[float]] = {}
recent: dict[str, tuple[float, str, str]] = {}


def validate(data):
    if not isinstance(data, dict):
        raise ValueError("Revisá los datos de la consulta.")
    result = {}
    for key, limit in [("name", 100), ("eventType", 50), ("eventDate", 100), ("city", 100), ("phone", 32), ("email", 160)]:
        value = data.get(key, "")
        if not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 for c in value):
            raise ValueError("Revisá los datos de la consulta.")
        result[key] = value.strip()
    if not result["name"] or not result["city"] or result["eventType"] not in EVENT_TYPES:
        raise ValueError("Completá tu nombre, ciudad y tipo de evento.")
    phone = result["phone"]
    is_phone = bool(re.fullmatch(r"[+()\d .-]+", phone)) and 8 <= len(re.sub(r"\D", "", phone)) <= 16
    if not is_phone:
        raise ValueError("Ingresá un WhatsApp válido para que podamos responderte.")
    if result["email"] and not EMAIL.fullmatch(result["email"]):
        raise ValueError("Revisá el formato del email.")
    result["replyEmail"] = result["email"] or None
    interests = data.get("interests")
    if not isinstance(interests, list) or not 1 <= len(interests) <= len(SERVICES) or any(not isinstance(item, str) or item not in SERVICES for item in interests):
        raise ValueError("Elegí al menos una experiencia.")
    result["interests"] = list(dict.fromkeys(interests))
    budget = data.get("budget")
    if type(budget) is not int or not 500 <= budget <= 10000 or budget % 250:
        raise ValueError("El presupuesto debe estar entre 500 y 10.000 USD.")
    result["budget"] = budget
    guests = data.get("guests", "")
    if guests not in ("", None) and (type(guests) is not int or not 1 <= guests <= 1000000):
        raise ValueError("Revisá la cantidad de invitados.")
    result["guests"] = guests or "A definir"
    key = data.get("requestId", "")
    if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9-]{16,80}", key):
        raise ValueError("Volvé a intentar el envío.")
    result["requestId"] = key
    return result


def make_message(data):
    recipient = os.environ.get("CONTACT_TO", "")
    user = os.environ.get("SMTP_USER", "")
    if not recipient or not user or not os.environ.get("SMTP_PASS"):
        raise RuntimeError("SMTP configuration missing")
    message = EmailMessage()
    message["From"] = f"OTRORAYO <{user}>"
    message["To"] = recipient
    message["Subject"] = f"Nueva consulta OTRORAYO · {data['eventType']} · {data['name']}"
    if data["replyEmail"]:
        message["Reply-To"] = data["replyEmail"]
    rows = [
        ("Nombre", data["name"]), ("WhatsApp", data["phone"]), ("Email", data["email"] or "No indicado"),
        ("Evento", data["eventType"]), ("Fecha aproximada", data["eventDate"] or "A definir"),
        ("Ciudad", data["city"]), ("Invitados", str(data["guests"])),
        ("Experiencias", ", ".join(SERVICES[key] for key in data["interests"])),
        ("Presupuesto para la experiencia", f"{data['budget']:,} USD"),
    ]
    message.set_content("Nueva consulta desde OTRORAYO\n\n" + "\n".join(f"{label}: {value}" for label, value in rows))
    message.add_alternative('<h1>Nueva consulta · OTRORAYO</h1>' + ''.join(f'<p><strong>{html.escape(label)}:</strong> {html.escape(value)}</p>' for label, value in rows), subtype="html")
    return message


def connect_smtp():
    connection = smtplib.SMTP(os.environ.get("SMTP_HOST", "smtp.gmail.com"), int(os.environ.get("SMTP_PORT", "587")), timeout=15)
    try:
        connection.ehlo()
        connection.starttls(context=ssl.create_default_context())
        connection.ehlo()
        connection.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    except Exception:
        connection.close()
        raise
    return connection


def deliver(data):
    message = make_message(data)
    with connect_smtp() as connection:
        rejected = connection.send_message(message)
        if rejected:
            raise RuntimeError("Recipient rejected")


class Handler(BaseHTTPRequestHandler):
    server_version = "OTRORAYO"
    def log_message(self, *_args):
        pass  # Never log contact details, addresses, bodies or secrets.

    def respond(self, status, content, mime="application/json; charset=utf-8"):
        payload = json.dumps(content, ensure_ascii=False).encode() if isinstance(content, dict) else content
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path.startswith("/api/"):
            return self.respond(405, {"error": "Usá el formulario para enviar tu consulta."})
        if path == "/":
            path = "/index.html"
        target = (PUBLIC / path.lstrip("/")).resolve()
        allowed_suffix = target.suffix in {".html", ".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico", ".woff2"}
        allowed_document = path in {"/robots.txt", "/sitemap.xml", "/llms.txt"}
        if not target.is_relative_to(PUBLIC) or any(part.startswith(".") for part in Path(path).parts) or not target.is_file() or not (allowed_suffix or allowed_document):
            return self.respond(404, b"No encontrado", "text/plain; charset=utf-8")
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if mime.startswith("text/") or target.suffix == ".js":
            mime += "; charset=utf-8"
        self.respond(200, target.read_bytes(), mime)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/contact":
            return self.respond(404, {"error": "No encontrado."})
        allowed_origins = {os.environ.get("SITE_URL", SITE_URL).rstrip("/")}
        if os.environ.get("VERCEL"):
            for key in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_BRANCH_URL"):
                host = os.environ.get(key, "")
                if host and re.fullmatch(r"[a-zA-Z0-9.-]+", host):
                    allowed_origins.add(f"https://{host}")
        else:
            allowed_origins.update({f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"})
        if self.headers.get("Origin") not in allowed_origins:
            return self.respond(403, {"error": "Abrí el formulario desde OTRORAYO."})
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self.respond(415, {"error": "Formato de consulta inválido."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= 12000:
                return self.respond(413, {"error": "La consulta es demasiado extensa."})
            self.connection.settimeout(10)
            raw = json.loads(self.rfile.read(length))
            if isinstance(raw, dict) and raw.get("website"):
                return self.respond(400, {"error": "No pudimos validar la consulta."})
            data = validate(raw)
        except (ValueError, UnicodeError) as error:
            message = str(error) if type(error) is ValueError else "Revisá los datos de la consulta."
            return self.respond(400, {"error": message})
        except (TimeoutError, OSError):
            return self.respond(408, {"error": "El envío tardó demasiado. Volvé a intentar."})
        key = data["requestId"]
        digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        ip = self.client_address[0]
        if os.environ.get("VERCEL"):
            # Vercel supplies this header; ignore forwarded headers locally.
            ip = self.headers.get("x-vercel-forwarded-for", ip).split(",")[0].strip()
        now = time.monotonic()
        with locks:
            for old in list(recent):
                if now - recent[old][0] > 3600:
                    del recent[old]
            for old in list(requests_by_ip):
                requests_by_ip[old] = [t for t in requests_by_ip[old] if now - t < 900]
                if not requests_by_ip[old]:
                    del requests_by_ip[old]
            if key in recent:
                _, fingerprint, state = recent[key]
                if fingerprint != digest or state != "sent":
                    return self.respond(409, {"error": "La consulta ya se está procesando. Esperá unos segundos."})
                return self.respond(200, {"ok": True})
            attempts = requests_by_ip.setdefault(ip, [])
            if len(attempts) >= 5 or sum(map(len, requests_by_ip.values())) >= 60:
                return self.respond(429, {"error": "Esperá unos minutos o continuá por WhatsApp."})
            attempts.append(now)
            recent[key] = (now, digest, "pending")
        try:
            deliver(data)
        except Exception:
            with locks:
                recent.pop(key, None)
            return self.respond(503, {"error": "No pudimos enviar la consulta. Intentá de nuevo o escribinos por WhatsApp."})
        with locks:
            recent[key] = (now, digest, "sent")
        self.respond(200, {"ok": True})


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"OTRORAYO disponible en http://{host}:{PORT}", flush=True)
    ThreadingHTTPServer((host, PORT), Handler).serve_forever()
