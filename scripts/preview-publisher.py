#!/usr/bin/env python3
"""Serve isolated portal drafts locally; never commit or publish them."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import webbrowser
from urllib.parse import urlsplit

PROJECT = Path(__file__).resolve().parents[1]
PREVIEW = PROJECT / '.publisher-preview'


def prepare_preview():
    PREVIEW.mkdir(exist_ok=True)
    for name in ('index.html', 'publisher.html', 'app.js', 'styles.css'):
        if not (PREVIEW / name).exists():
            shutil.copy2(PROJECT / name, PREVIEW / name)
    if not (PREVIEW / 'assets').exists():
        shutil.copytree(PROJECT / 'assets', PREVIEW / 'assets')


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        route = urlsplit(path).path
        if route in ('/data/fixtures.json', '/data/winter-fixtures.json'):
            # Draft field mappings may supply their own data; otherwise show
            # the latest live workbook data without allowing writes to it.
            draft = PREVIEW / route.lstrip('/')
            return str(draft if draft.exists() else PROJECT / route.lstrip('/'))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    prepare_preview()
    handler = partial(PreviewHandler, directory=str(PREVIEW))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        url = f'http://127.0.0.1:{server.server_port}/publisher.html'
        print(f'LOCAL DRAFT PREVIEW: {url}', flush=True)
        print('Captain view here is also a draft. Nothing is published. Ctrl+C stops the preview.', flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
