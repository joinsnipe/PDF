"""Build portable ZIPs. Official runtime archives are verified before extraction."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RUNTIMES = {
    'windows-x64': ('https://www.python.org/ftp/python/3.14.8/python-3.14.8-embed-amd64.zip', 'a93abe456ab01bd96d7a085b3cdb6566b3063f4241360d114142fbdb07f0a310'),
    'macos-arm64': ('https://nodejs.org/download/release/v24.19.0/node-v24.19.0-darwin-arm64.tar.gz', '8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d'),
    'macos-x64': ('https://nodejs.org/download/release/v24.19.0/node-v24.19.0-darwin-x64.tar.gz', 'd1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316'),
}


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def runtime(target, destination):
    url, digest = RUNTIMES[target]
    cache = ROOT / 'release-cache'
    cache.mkdir(exist_ok=True)
    archive = cache / url.rsplit('/', 1)[1]
    if not archive.exists():
        print('Descargando', archive.name, flush=True)
        with urllib.request.urlopen(url, timeout=90) as response, archive.open('wb') as output:
            shutil.copyfileobj(response, output)
    if sha(archive) != digest:
        raise RuntimeError(f'Hash incorrecto: {archive.name}. Elimina la copia de release-cache y revisa su origen.')
    destination.mkdir(parents=True, exist_ok=True)
    if target.startswith('windows'):
        with zipfile.ZipFile(archive) as z:
            for entry in z.infolist():
                final = (destination / entry.filename).resolve()
                if not final.is_relative_to(destination.resolve()):
                    raise RuntimeError('Ruta insegura en el runtime')
            z.extractall(destination)
    else:
        # Only ship Node itself and its full license; npm is unnecessary at runtime.
        with tarfile.open(archive) as t:
            prefix = archive.name.removesuffix('.tar.gz')
            for name in ['bin/node', 'LICENSE']:
                member = t.getmember(prefix + '/' + name)
                if not member.isfile():
                    raise RuntimeError('Runtime inesperado')
                output = destination / name
                output.parent.mkdir(parents=True, exist_ok=True)
                with t.extractfile(member) as source, output.open('wb') as dest:
                    shutil.copyfileobj(source, dest)
                output.chmod(0o755 if name == 'bin/node' else 0o644)


def build(target, version):
    staging = ROOT / 'release-build' / target
    if staging.exists():
        shutil.rmtree(staging)
    package = staging / ('PDF-web' if target == 'web' else 'PDF')
    package.mkdir(parents=True)
    shutil.copytree(ROOT / 'dist', package if target == 'web' else package / 'app', dirs_exist_ok=True, ignore=shutil.ignore_patterns('client', 'server', '.openai'))
    for name in ['README.md', 'LICENSE', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md', 'SECURITY.md']:
        shutil.copy2(ROOT / name, package / name)
    shutil.copytree(ROOT / 'docs', package / 'docs', ignore=shutil.ignore_patterns('rea-attempt.json'))
    if target != 'web':
        runtime(target, package / 'runtime')
        names = ['PDF.cmd', 'launcher.py', 'office.py', 'install.py', 'Instalar_PDF.cmd', 'Cerrar_PDF.cmd', 'Quitar_integracion_Windows.cmd'] if target.startswith('windows') else ['PDF.command', 'server.mjs', 'office.mjs']
        for name in names:
            shutil.copy2(ROOT / 'local' / name, package / name)
        launcher = names[0]
        opening = ('Abre Instalar_PDF.cmd una vez. Después usa el icono PDF del escritorio o de Inicio.\n'
                   'También puedes abrir PDF.cmd sin instalar. No necesitas una consola abierta.\n'
                   'Para leer un documento: botón derecho > Abrir con > PDF. Tú eliges el lector predeterminado.\n'
                   'Para cerrar la aplicación usa Salir de PDF.\n') if target.startswith('windows') else f'Abre {launcher}. Mantén abierta la consola mientras trabajas.\n'
        (package / 'LEEME.txt').write_text(
            f'PDF {version}\n\nExtrae TODO el ZIP en una carpeta.\n' + opening +
            'No abras index.html directamente. No necesitas instalar lenguajes de programación.\n'
            'Las herramientas habituales son locales. Office a PDF requiere LibreOffice instalado. La IA es opcional, usa internet y tu propia API.\n\n'
            'Instrucciones: docs/INSTALACION.md\nFunciones y límites: docs/FUNCIONES.md\n'
            'Esta es una beta: todavía requiere comprobación en dispositivos reales.\n'
            'Proyecto: https://github.com/joinsnipe/PDF\n', encoding='utf-8')
    manifest = ''.join(f'{sha(f)}  {f.relative_to(package).as_posix()}\n' for f in sorted(package.rglob('*')) if f.is_file())
    (package / 'FILES-SHA256.txt').write_text(manifest, encoding='utf-8')
    out = ROOT / 'artifacts'
    out.mkdir(exist_ok=True)
    archive = out / f'PDF-{version}-{target}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for file in sorted(package.rglob('*')):
            if file.is_file():
                relative = file.relative_to(staging).as_posix()
                info = zipfile.ZipInfo.from_file(file, relative)
                info.create_system = 3
                mode = 0o100755 if relative in ['PDF/PDF.command', 'PDF/runtime/bin/node'] else 0o100644
                info.external_attr = mode << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, file.read_bytes(), compresslevel=6)
    with zipfile.ZipFile(archive) as z:
        if z.testzip():
            raise RuntimeError('ZIP corrupto')
        if target.startswith('macos'):
            for name in ['PDF/PDF.command', 'PDF/runtime/bin/node']:
                if not (z.getinfo(name).external_attr >> 16) & 0o111:
                    raise RuntimeError('ZIP sin permiso de ejecución')
    print(f'{archive.name}: {archive.stat().st_size:,} bytes — integridad correcta', flush=True)
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=['all', 'web', *RUNTIMES], default='all')
    args = parser.parse_args()
    version = json.loads((ROOT / 'package.json').read_text())['version']
    targets = [*RUNTIMES, 'web'] if args.platform == 'all' else [args.platform]
    archives = [build(target, version) for target in targets]
    (ROOT / 'artifacts' / 'SHA256SUMS.txt').write_text(''.join(f'{sha(f)}  {f.name}\n' for f in archives), encoding='utf-8')
