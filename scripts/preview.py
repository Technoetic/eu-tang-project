"""Owned local static preview with the same cache intent and real 404 responses."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
from urllib.parse import urlsplit

class Handler(SimpleHTTPRequestHandler):
    base_path='/'
    def _check_path(self):
        parsed=urlsplit(self.path)
        if self.base_path!='/' and parsed.path==self.base_path[:-1]:
            self.send_response(301)
            self.send_header('Location',self.base_path+('?' + parsed.query if parsed.query else ''))
            self.end_headers();return False
        if not parsed.path.startswith(self.base_path):
            self.send_error(404);return False
        return True
    def do_GET(self):
        if self._check_path():super().do_GET()
    def do_HEAD(self):
        if self._check_path():super().do_HEAD()
    def translate_path(self,path):
        relative=path[len(self.base_path)-1:] if self.base_path!='/' else path
        return super().translate_path(relative)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store' if self.path.split('?')[0] == self.base_path+'version.json' else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=5185);parser.add_argument('--base',default='/'); options=parser.parse_args()
    if not options.base.startswith('/') or not options.base.endswith('/') or '..' in options.base:raise SystemExit('Use an absolute base path ending in slash.')
    Handler.base_path=options.base
    root=Path(__file__).resolve().parents[1]/'dist'
    if not (root/'index.html').is_file(): raise SystemExit('Build the site first.')
    print(f'Local: http://127.0.0.1:{options.port}{options.base}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',options.port),partial(Handler,directory=str(root))).serve_forever()
