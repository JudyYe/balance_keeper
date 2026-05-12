"""Local dev server with GitHub API proxy.

Serves static files and proxies /api/github/* to api.github.com
through the HTTPS_PROXY (required on this machine).

Usage: python3 server.py
"""
import http.server
import urllib.request
import urllib.error
import json

class ProxyHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith('/api/github/'):
            self._proxy('GET')
        else:
            super().do_GET()

    def do_PUT(self):
        if self.path.startswith('/api/github/'):
            self._proxy('PUT')
        else:
            self.send_error(405)

    def do_OPTIONS(self):
        if self.path.startswith('/api/github/'):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.end_headers()
        else:
            super().do_OPTIONS()

    def _proxy(self, method):
        github_url = 'https://api.github.com/' + self.path[len('/api/github/'):]

        body = None
        if method == 'PUT':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)

        req = urllib.request.Request(github_url, data=body, method=method)
        req.add_header('User-Agent', 'BalanceKeeper')
        req.add_header('Accept', 'application/vnd.github.v3+json')
        for hdr in ('Authorization', 'Content-Type'):
            val = self.headers.get(hdr)
            if val:
                req.add_header(hdr, val)

        try:
            resp = urllib.request.urlopen(req)
            self._send_proxy_response(resp.status, resp.read())
        except urllib.error.HTTPError as e:
            self._send_proxy_response(e.code, e.read())
        except Exception as e:
            self._send_proxy_response(502, json.dumps({'message': str(e)}).encode())

    def _send_proxy_response(self, status, body):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Show proxy requests clearly
        if '/api/github/' in (args[0] if args else ''):
            print(f'[PROXY] {fmt % args}')
        else:
            super().log_message(fmt, *args)

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 8080), ProxyHandler)
    print('Balance Keeper dev server on http://localhost:8080')
    print('GitHub API proxy: /api/github/* -> api.github.com (via HTTPS_PROXY)')
    server.serve_forever()
