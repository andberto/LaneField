"""Validate and publish the static website to the gh-pages branch without force-pushing."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='https://andberto.github.io/LaneField/')
args = parser.parse_args()


def run(command, cwd=ROOT, capture=False, check=True):
    return subprocess.run(command, cwd=cwd, check=check, text=True,
                          stdout=subprocess.PIPE if capture else None)


if run(['git', 'status', '--porcelain'], capture=True).stdout.strip():
    raise SystemExit('Commit your source changes before publishing.')
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js is required for the JavaScript checks; put node on PATH.')
run([sys.executable, 'scripts/check_site.py'])
run([node, '--check', 'dist/script.js'])
run([node, '--check', 'dist/field-lab.js'])
run([node, 'scripts/check_field_math.mjs'])
remote = run(['git', 'remote', 'get-url', 'origin'], capture=True).stdout.strip()
identity = {
    key: run(['git', 'config', '--get', key], capture=True).stdout.strip()
    for key in ('user.name', 'user.email')
}
with tempfile.TemporaryDirectory(prefix='lanefield-pages-') as directory:
    build = Path(directory) / 'build'
    checkout = Path(directory) / 'repository'
    run([sys.executable, 'scripts/prepare_pages.py', '--base-url', args.base_url,
         '--output', str(build)])
    checkout.mkdir()
    run(['git', 'init', '--quiet', '--initial-branch=gh-pages'], cwd=checkout)
    for key, value in identity.items():
        run(['git', 'config', key, value], cwd=checkout)
    if shutil.which('gh') and remote.startswith('https://github.com/'):
        run(['git', 'config', 'credential.https://github.com.helper',
             '!gh auth git-credential'], cwd=checkout)
    run(['git', 'remote', 'add', 'origin', remote], cwd=checkout)
    existing = run(['git', 'ls-remote', '--exit-code', '--heads', 'origin',
                    'refs/heads/gh-pages'], cwd=checkout, capture=True, check=False)
    if existing.returncode not in (0, 2):
        raise SystemExit('Cannot read the gh-pages branch; publication stopped.')
    if existing.returncode == 0:
        run(['git', 'fetch', '--quiet', '--depth=1', 'origin', 'gh-pages'], cwd=checkout)
        run(['git', 'update-ref', 'refs/heads/gh-pages', 'FETCH_HEAD'], cwd=checkout)
    shutil.copytree(build, checkout, dirs_exist_ok=True)
    run(['git', 'add', '--all', '.'], cwd=checkout)
    changed = run(['git', 'diff', '--cached', '--quiet'], cwd=checkout, check=False)
    if changed.returncode == 0:
        print('The published files already match this source.')
    elif changed.returncode == 1:
        run(['git', 'commit', '--quiet', '-m', 'Update GitHub Pages website'], cwd=checkout)
        run(['git', 'push', 'origin', 'HEAD:refs/heads/gh-pages'], cwd=checkout)
    else:
        raise SystemExit('Cannot compare the publication files; publication stopped.')
print(f'GitHub Pages source updated: {args.base_url}')
