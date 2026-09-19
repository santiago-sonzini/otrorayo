"""Vercel entrypoint: same validation and SMTP delivery as the local server."""
from server.server import Handler


class handler(Handler):
    def do_GET(self):
        self.respond(405, {"error": "Usá el formulario para enviar tu consulta."})
