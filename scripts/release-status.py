"""Only a real 404 means a new release. API failures must not trigger packaging."""
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

repository = os.environ['GITHUB_REPOSITORY']
if repository != 'joinsnipe/PDF':
    raise SystemExit('Esta publicación está limitada a joinsnipe/PDF.')
version = json.loads(Path('package.json').read_text())['version']
tag = json.loads(Path('release.json').read_text())['tag']
if not re.fullmatch(r'v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', tag) or tag != 'v' + version:
    raise SystemExit('La versión y la etiqueta no coinciden.')
request = urllib.request.Request(f'https://api.github.com/repos/{repository}/releases/tags/{tag}', headers={
    'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
    'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
})
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        release = json.load(response)
    if release['draft']:
        raise SystemExit('Existe un borrador incompleto. Revísalo antes de repetir la publicación.')
    expected = {f'PDF-{version}-{platform}.zip' for platform in ('windows-x64', 'macos-arm64', 'macos-x64', 'web')} | {'SHA256SUMS.txt'}
    actual = {a['name'] for a in release['assets'] if a['state'] == 'uploaded' and a['size'] > 0}
    if not expected <= actual:
        raise SystemExit('La versión publicada está incompleta. No se sustituye automáticamente.')
    publish = False
except urllib.error.HTTPError as error:
    if error.code != 404:
        raise
    publish = True
with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
    output.write(f'publish={str(publish).lower()}\n')
print(f'{tag}: ' + ('nueva versión; se empaquetará.' if publish else 'ya publicada; no se generan otros ZIP.'))
