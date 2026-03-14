#!/usr/bin/env python3
"""Build a standalone conductor.html with all scripts inlined.

Reads docs/index.html, inlines all <script src="..."> tags,
removes the PWA manifest link and service worker registration,
and writes docs/conductor.html.
"""

import re
import os
import sys

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs')
SRC = os.path.join(DOCS, 'index.html')
OUT = os.path.join(DOCS, 'conductor.html')


def build():
    with open(SRC, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Inline all <script src="..."></script> tags
    script_count = 0

    def inline_script(m):
        nonlocal script_count
        src = m.group(1)
        path = os.path.join(DOCS, src.replace('/', os.sep))
        if not os.path.isfile(path):
            print(f'  WARNING: {src} not found, skipping')
            return m.group(0)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Escape </script> in inlined content to prevent HTML parser breakage
        content = content.replace('</script', '<\\/script')
        script_count += 1
        return f'<script>/* {src} */\n{content}\n</script>'

    html = re.sub(r'<script\s+src="([^"]+)">\s*</script>', inline_script, html)

    # 2. Remove <link rel="manifest" ...> line
    html = re.sub(r'[ \t]*<link\s+rel="manifest"\s+[^>]*>\n?', '', html)

    # 3. Remove service worker registration block
    html = re.sub(
        r"[ \t]*// Register Service Worker.*?\n"
        r"[ \t]*if \('serviceWorker'.*?\n"
        r"[ \t]*navigator\.serviceWorker\.register.*?\n"
        r"[ \t]*\}\n",
        '',
        html,
        flags=re.DOTALL
    )

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = os.path.getsize(OUT) / 1024
    print(f'Built {OUT}')
    print(f'  {script_count} scripts inlined')
    print(f'  {size_kb:.0f} KB')


if __name__ == '__main__':
    build()
