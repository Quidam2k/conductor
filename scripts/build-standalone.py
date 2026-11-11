#!/usr/bin/env python3
"""Build a standalone conductor.html with all scripts inlined.

Reads docs/index.html, inlines all <script src="..."> tags,
removes the PWA manifest link and service worker registration,
and writes docs/conductor.html.
"""

import re
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # scripts/ -> repo root
DOCS = os.path.join(REPO, 'docs')
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

    # 3. Remove the service worker registration block (a standalone copy has
    #    no sw.js beside it). index.html brackets it with explicit markers; a
    #    regex guessing at its shape broke the standalone's main script once.
    html, n = re.subn(
        r'[ \t]*// @standalone-strip-begin.*?// @standalone-strip-end[^\n]*\n',
        '', html, flags=re.DOTALL)
    if n != 1:
        sys.exit(f'ERROR: expected 1 @standalone-strip block in index.html, found {n}')

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = os.path.getsize(OUT) / 1024
    print(f'Built {OUT}')
    print(f'  {script_count} scripts inlined')
    print(f'  {size_kb:.0f} KB')


if __name__ == '__main__':
    build()
