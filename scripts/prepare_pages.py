"""Copy the static website and set metadata to the actual GitHub Pages URL."""
import argparse
from html import escape
from pathlib import Path
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', required=True, help='URL returned by actions/configure-pages')
parser.add_argument('--output', type=Path, default=ROOT / '_site', help='New output directory')
args = parser.parse_args()
base_url = args.base_url.strip().rstrip('/') + '/'
url = urlsplit(base_url)
if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
    parser.error('--base-url must be an absolute HTTP(S) URL without credentials, query, or fragment')
if args.output.exists():
    parser.error('The output directory already exists; choose a new --output directory.')

html = (ROOT / 'dist/index.html').read_text(encoding='utf-8')
for key, relative_path in (
    ('property="og:image"', 'assets/media/hd-map-poster.jpg'),
    ('name="citation_pdf_url"', 'assets/papers/paper.pdf'),
):
    original = f'<meta {key} content="{relative_path}">'
    if key == 'name="citation_pdf_url"' and 'citation_pdf_url' not in html:
        continue  # No PDF metadata until the camera-ready file is supplied.
    if html.count(original) != 1:
        raise SystemExit(f'Expected exactly one relative metadata tag: {key}')
    html = html.replace(original, f'<meta {key} content="{escape(base_url + relative_path, quote=True)}">')
publication_url = escape(base_url, quote=True)
html = html.replace('</head>', f'  <meta property="og:url" content="{publication_url}">\n'
                    f'  <link rel="canonical" href="{publication_url}">\n</head>')
shutil.copytree(ROOT / 'dist', args.output)
(args.output / 'index.html').write_text(html, encoding='utf-8')
(args.output / '.nojekyll').touch()
print(f'GitHub Pages files prepared in {args.output} for {base_url}')
