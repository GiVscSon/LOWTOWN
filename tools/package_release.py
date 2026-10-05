"""Package a clean committed source tree and its production build, using stdlib."""
import argparse, hashlib, io, json, re, subprocess, zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root.parent / 'releases'))
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
version = json.loads((root / 'package.json').read_text())['version']
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
if git('status', '--porcelain').strip():
    raise SystemExit('Commit source changes before packaging; reports and archives must be ignored.')
head = git('rev-parse', 'HEAD').decode().strip()
tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
dist = root / 'dist'
index = (dist / 'index.html').read_text()
module = re.search(r'<script[^>]*src="([^"]+)"', index).group(1)
if '__LOWTOWN_BUILD__' in (dist / 'sw.js').read_text():
    raise SystemExit('Run npm run build before packaging.')
launcher = '''#!/usr/bin/env python3
import argparse, functools, http.server, webbrowser
from pathlib import Path
parser = argparse.ArgumentParser(description="LOWTOWN local game server")
parser.add_argument("--port", type=int, default=8080)
parser.add_argument("--no-browser", action="store_true")
args = parser.parse_args()
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent))
with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
    url = "http://127.0.0.1:%d/" % server.server_port
    print("LOWTOWN:", url, "(Ctrl+C to stop)", flush=True)
    if not args.no_browser: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
'''
manifest = {'version': version, 'commit': head, 'tree': tree, 'module': module,
            'module_sha256': hashlib.sha256((dist / module).read_bytes()).hexdigest(), 'archives': {}}
game = out / f'LOWTOWN-{version}-game.zip'
source = out / f'LOWTOWN-{version}-source.zip'
with zipfile.ZipFile(game, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(dist.rglob('*')):
        if file.is_file() and not file.name.endswith('.map') and file.relative_to(dist).parts[0] not in {'debug', 'screenshots'}:
            archive.write(file, file.relative_to(dist))
    archive.writestr('start.py', launcher)
    archive.writestr('START.bat', '@echo off\r\ncd /d "%~dp0"\r\npy -3 start.py\r\nif errorlevel 1 pause\r\n')
    archive.writestr('README-RU.md', (root / f'docs/RELEASE_{version}.md').read_bytes())
    archive.write(root / 'ASSET_SOURCES.md', 'ASSET_SOURCES.md')
    archive.writestr('build-info.json', json.dumps(manifest, indent=2)+'\n')
source.write_bytes(git('archive', '--format=zip', '--prefix=LOWTOWN/', head))
for file in (game, source):
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None
    manifest['archives'][file.name] = {'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
(out / 'release-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest, indent=2))
