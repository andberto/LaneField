"""Dependency-free checks for the complete static website."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re

ROOT = Path(__file__).resolve().parents[1] / 'dist'
errors = []

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.refs = []
        self.authors = []
        self.h1s = 0
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if 'id' in data:
            if data['id'] in self.ids:
                errors.append(f'Duplicate id: {data["id"]}')
            self.ids.add(data['id'])
        if tag == 'h1':
            self.h1s += 1
        if tag == 'img' and not data.get('alt'):
            errors.append('Image missing descriptive alt text')
        for attr in ('href', 'src', 'poster'):
            if attr in data:
                self.refs.append(data[attr])
        if tag == 'meta' and data.get('name') == 'citation_author':
            self.authors.append(data.get('content', ''))
        if tag == 'a' and data.get('target') == '_blank' and 'noopener' not in data.get('rel', ''):
            errors.append('External tab link missing noopener')

page = Page()
html = (ROOT / 'index.html').read_text()
page.feed(html)
for ref in page.refs:
    url = urlsplit(ref)
    if url.scheme or url.netloc:
        continue
    if url.path and not (ROOT / unquote(url.path)).is_file():
        errors.append(f'Missing asset: {ref}')
    if not url.path and url.fragment and url.fragment not in page.ids:
        errors.append(f'Broken anchor: {ref}')
for asset in re.findall(r'url\([\'"]?([^\)\'\"]+)', (ROOT / 'styles.css').read_text()):
    if not (ROOT / asset).is_file():
        errors.append(f'Missing CSS asset: {asset}')
if page.h1s != 1:
    errors.append('Page must have exactly one main heading')
if len(set(page.authors)) != 8:
    errors.append('Expected all eight unique author names in the publication metadata')
recipient = bytes.fromhex('616e647265612e626572746f67616c6c6940756e6970722e6974').decode()
if 'decodeContactRecipient' not in (ROOT / 'script.js').read_text():
    errors.append('Contact handler must reconstruct the recipient only on interaction')
if 'mailto:' in html:
    errors.append('Static HTML must not contain email links')
for file in ROOT.rglob('*'):
    if file.is_file() and file.suffix in {'.html', '.js', '.css', '.json', '.svg', '.md', '.txt'}:
        if recipient in file.read_text():
            errors.append(f'Contact address exposed in static asset: {file.relative_to(ROOT)}')
if html.count('data-media-slot=') != 3:
    errors.append('Expected the three research media slots')
for file in ROOT.rglob('*'):
    if file.is_file() and file.stat().st_size > 25 * 1024 * 1024:
        errors.append(f'Asset exceeds 25 MiB static hosting limit: {file.relative_to(ROOT)}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(page.refs)} references, eight authors, headings, contact configuration, research media slots, and hosting asset sizes.')
