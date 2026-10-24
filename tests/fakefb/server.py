"""Static file server + a tiny in-memory document store used by the fake Firebase SDK in tests."""
import json, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = sys.argv[1]
PORT = int(sys.argv[2])
DB = {}           # path -> {"v": int, "data": dict}
LOCK = threading.Lock()


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == '/__db/get':
            p = q['path'][0]
            with LOCK:
                d = DB.get(p)
            return self._json(d or {'v': 0, 'data': None})
        if u.path == '/__db/list':
            pre = q['prefix'][0].rstrip('/') + '/'
            with LOCK:
                items = [{'path': k, 'v': v['v'], 'data': v['data']} for k, v in DB.items()
                         if k.startswith(pre) and '/' not in k[len(pre):] and v['data'] is not None]
            return self._json(items)
        if u.path == '/__db/dump':
            with LOCK:
                return self._json({k: v['data'] for k, v in DB.items() if v['data'] is not None})
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(n) or b'{}')
        if u.path == '/__db/commit':
            # body: {writes: [{path, expect (int or null = any), data (obj or null = delete)}]}
            with LOCK:
                for w in body['writes']:
                    cur = DB.get(w['path'], {'v': 0, 'data': None})
                    if w.get('expect') is not None and cur['v'] != w['expect']:
                        return self._json({'ok': False, 'conflict': w['path']}, 409)
                for w in body['writes']:
                    cur = DB.get(w['path'], {'v': 0, 'data': None})
                    DB[w['path']] = {'v': cur['v'] + 1, 'data': w['data']}
            return self._json({'ok': True})
        self.send_error(404)


ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
