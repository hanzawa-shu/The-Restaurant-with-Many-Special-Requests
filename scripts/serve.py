#!/usr/bin/env python3
"""
開発用サーバ。

python3 -m http.server は Cache-Control を送らないため、Chrome が
ES モジュールを古いまま使い続ける。Phase 3 で実際にこれが起き、
「配信ファイルは新しいのに、実行中のコードは古い」状態で
自動検証が古いコードを検証していた。

no-store を必ず付けて配信する。
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 404 だけ出す。ローダーは未生成アセットを fetch で確認するので
        # 200 のログが大量に流れると邪魔になる
        if args and str(args[1]).startswith('4'):
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    handler = partial(NoCacheHandler, directory='.')
    with ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'http://localhost:{port}/  （キャッシュ無効）')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
