"""CI-only HTTPS bridge to the loopback synthetic API. Never deploy this fixture."""
import http.client
import http.server
import os
import ssl


class Proxy(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def forward(self):
        backend = http.client.HTTPConnection('127.0.0.1', 18091, timeout=45)
        length = int(self.headers.get('Content-Length', '0'))
        if length > 28 * 1024 * 1024:
            self.send_error(413)
            return
        headers = {key: value for key, value in self.headers.items() if key.lower() not in ('host', 'connection', 'transfer-encoding')}
        try:
            backend.request(self.command, self.path, self.rfile.read(length) if length else None, headers)
            response = backend.getresponse()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in ('connection', 'transfer-encoding', 'keep-alive'):
                    self.send_header(key, value)
            self.end_headers()
            while True:
                data = response.read1(16384)
                if not data:
                    break
                self.wfile.write(data)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            backend.close()

    do_GET = forward
    do_POST = forward
    do_PUT = forward
    do_PATCH = forward
    do_DELETE = forward


server = http.server.ThreadingHTTPServer(('127.0.0.1', 18443), Proxy)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain('.tools/native-tls/ca.crt', os.environ['NATIVE_QA_KEY'])
server.socket = tls.wrap_socket(server.socket, server_side=True)
server.serve_forever()
