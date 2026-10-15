"""Per-user Windows install. Copy verified app files; never modify user documents."""
import hashlib
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import secrets
import shutil
import subprocess
import sys

PROGID = 'PDF.Herramientas'
CAPABILITIES = r'Software\PDF-Herramientas\Capabilities'


def association_entries(destination):
    root = PureWindowsPath(destination)
    icon = '"' + str(root / 'app/icons/pdf.ico') + '",0'
    command = '"' + str(root / 'runtime/pythonw.exe') + '" -I -B "' + str(root / 'launcher.py') + '" --open "%1"'
    prog = 'Software\\Classes\\' + PROGID
    return [
        (prog, '', 'Documento PDF'),
        (prog + r'\DefaultIcon', '', icon),
        (prog + r'\shell\open\command', '', command),
        (prog + r'\Application', 'ApplicationName', 'PDF'),
        (prog + r'\Application', 'ApplicationDescription', 'Lector y herramientas PDF locales'),
        (prog + r'\Application', 'ApplicationIcon', icon),
        (CAPABILITIES, 'ApplicationName', 'PDF Herramientas'),
        (CAPABILITIES, 'ApplicationDescription', 'Leer y trabajar con documentos PDF en este equipo'),
        (CAPABILITIES, 'ApplicationIcon', icon),
        (CAPABILITIES + r'\FileAssociations', '.pdf', PROGID),
        (r'Software\RegisteredApplications', 'PDF Herramientas', CAPABILITIES),
        (r'Software\Classes\.pdf\OpenWithProgids', PROGID, ''),
    ]


def register_reader(destination, registry=None):
    if registry is None:
        import winreg as registry
    # Add an option; never write .pdf's default value or Explorer's UserChoice.
    for path, name, value in association_entries(destination):
        with registry.CreateKeyEx(registry.HKEY_CURRENT_USER, path, 0, registry.KEY_WRITE) as key:
            registry.SetValueEx(key, name, 0, registry.REG_SZ, value)


def unregister_reader(destination, registry=None):
    if registry is None:
        import winreg as registry
    prog = 'Software\\Classes\\' + PROGID
    # An old version must not remove another version's current integration.
    try:
        with registry.OpenKey(registry.HKEY_CURRENT_USER, prog + r'\shell\open\command') as key:
            current = registry.QueryValueEx(key, '')[0]
    except FileNotFoundError:
        return
    if current != association_entries(destination)[2][2]:
        raise RuntimeError('Usa Quitar_integracion_Windows.cmd de la versión instalada actualmente.')
    entries = association_entries(destination)
    for path, name, _value in reversed(entries):
        try:
            with registry.OpenKey(registry.HKEY_CURRENT_USER, path, 0, registry.KEY_SET_VALUE) as key:
                registry.DeleteValue(key, name)
        except FileNotFoundError:
            pass
    # Only remove empty app-owned keys; preserve shared extension and app lists.
    owned = {path for path, _, _ in entries if path.startswith(prog) or path.startswith(CAPABILITIES)}
    owned.update({prog + r'\shell\open', prog + r'\shell'})
    for path in sorted(owned, key=len, reverse=True):
        try:
            registry.DeleteKey(registry.HKEY_CURRENT_USER, path)
        except OSError:
            pass


def refresh_associations():
    import ctypes
    ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)

SHORTCUT_SCRIPT = r'''
$ErrorActionPreference = 'Stop'
$root = $env:PDF_INSTALL_ROOT
$base = Join-Path $env:LOCALAPPDATA 'PDF-Herramientas\versions\'
if (-not $root.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid install root' }
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
$programs = [Environment]::GetFolderPath('Programs')
if (-not $desktop -or -not $programs) { throw 'User folders unavailable' }
$menu = Join-Path $programs 'PDF Herramientas'
[IO.Directory]::CreateDirectory($menu) | Out-Null
$removeLink = Join-Path $menu 'Quitar integracion de PDF.lnk'
$locations = @((Join-Path $desktop 'PDF.lnk'), (Join-Path $menu 'PDF.lnk'), $removeLink)
foreach ($location in $locations) {
    if (Test-Path -LiteralPath $location) {
        $previous = $shell.CreateShortcut($location)
        if (-not $previous.TargetPath.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'An unrelated shortcut named PDF already exists'
        }
    }
}
foreach ($location in $locations) {
    $link = $shell.CreateShortcut($location)
    $link.TargetPath = Join-Path $root 'runtime\pythonw.exe'
    $link.Arguments = '-I -B "' + (Join-Path $root 'launcher.py') + '"'
    if ($location -eq $removeLink) { $link.Arguments = '-I -B "' + (Join-Path $root 'install.py') + '" --unregister' }
    $link.WorkingDirectory = $root
    $link.IconLocation = (Join-Path $root 'app\icons\pdf.ico') + ',0'
    $link.Description = 'PDF - Herramientas de documentos'
    $link.Save()
}
'''


def checked_files(source):
    manifest = source / 'FILES-SHA256.txt'
    raw = manifest.read_bytes()
    files = []
    seen = set()
    for line in raw.decode('utf-8').splitlines():
        digest, relative = line.split('  ', 1)
        path = PurePosixPath(relative)
        if (not re.fullmatch(r'[a-f0-9]{64}', digest) or not relative or
                path.is_absolute() or '..' in path.parts or '\\' in relative or ':' in relative or
                relative.casefold() in seen):
            raise ValueError('Invalid manifest')
        seen.add(relative.casefold())
        file = source.joinpath(*path.parts)
        if not file.resolve().is_relative_to(source.resolve()) or not file.is_file():
            raise ValueError('Invalid package path')
        if any(parent.is_symlink() for parent in [file, *file.parents] if parent != source.parent):
            raise ValueError('Symbolic links are not allowed')
        with file.open('rb') as handle:
            if hashlib.file_digest(handle, 'sha256').hexdigest() != digest:
                raise ValueError('Package integrity check failed')
        files.append(path)
    required = {'app/index.html', 'app/desktop.js', 'runtime/pythonw.exe', 'launcher.py', 'app/icons/pdf.ico'}
    if not required.issubset({str(path) for path in files}):
        raise ValueError('Incomplete package')
    return raw, files


def install_files(source, base):
    source, base = Path(source).resolve(), Path(base)
    raw, files = checked_files(source)
    versions = base / 'versions'
    versions.mkdir(parents=True, exist_ok=True)
    destination = versions / hashlib.sha256(raw).hexdigest()[:20]
    if destination.exists():
        existing, _ = checked_files(destination)
        if existing != raw:
            raise ValueError('Existing installation differs')
        return destination
    staging = versions / ('.install-' + secrets.token_hex(8))
    staging.mkdir()
    try:
        for relative in files:
            target = staging.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source.joinpath(*relative.parts), target)
        (staging / 'FILES-SHA256.txt').write_bytes(raw)
        checked_files(staging)
        try:
            staging.rename(destination)
        except OSError:
            # Another installer may have completed the exact same immutable version.
            if not destination.exists() or checked_files(destination)[0] != raw:
                raise
        return destination
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def notify(message, error=False):
    if os.name == 'nt':
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, message, 'PDF', 0x10 if error else 0x40)
    elif sys.stderr:
        print(message, file=sys.stderr)


def main(remove=False):
    if os.name != 'nt' or not os.environ.get('LOCALAPPDATA'):
        raise RuntimeError('Este instalador es para Windows 10/11 de 64 bits.')
    source = Path(__file__).resolve().parent
    if remove:
        unregister_reader(source)
        refresh_associations()
        notify('PDF ya no se ofrece en «Abrir con».\n\nPara quitar la aplicación, ciérrala con '
               '«Salir de PDF», elimina sus accesos directos y la carpeta %LOCALAPPDATA%\\PDF-Herramientas. '
               'No se han borrado tus documentos.')
        return
    base = Path(os.environ['LOCALAPPDATA']) / 'PDF-Herramientas'
    destination = install_files(source, base)
    env = os.environ.copy()
    env['PDF_INSTALL_ROOT'] = str(destination)
    powershell = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    result = subprocess.run([str(powershell), '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', SHORTCUT_SCRIPT],
                            env=env, stdin=subprocess.DEVNULL, capture_output=True,
                            creationflags=subprocess.CREATE_NO_WINDOW, timeout=45)
    if result.returncode:
        notify('PDF se ha copiado, pero Windows no ha permitido crear sus accesos directos. '
               'Puedes abrir PDF.cmd en esta carpeta:\n\n' + str(destination), error=True)
        return
    try:
        register_reader(destination)
        refresh_associations()
    except OSError:
        notify('PDF está instalado y tiene accesos directos, pero Windows no ha permitido añadirlo '
               'a «Abrir con». Puedes seleccionar los documentos desde el visor de la app.', error=True)
        return
    notify('PDF está instalado para tu usuario.\n\nÁbrelo desde el icono PDF del escritorio '
           'o desde Inicio. No necesitas mantener ninguna consola abierta.\n\n'
           'Puedes elegir PDF en «Abrir con» sobre cualquier documento .pdf. '
           'El lector predeterminado lo eliges tú.\n\nPara cerrar la aplicación usa «Salir de PDF».')
    subprocess.Popen([str(destination / 'runtime/pythonw.exe'), '-I', '-B', str(destination / 'launcher.py')],
                     cwd=destination, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)


if __name__ == '__main__':
    try:
        if sys.argv[1:] not in ([], ['--unregister']):
            raise RuntimeError('Abre Instalar_PDF.cmd para instalar PDF.')
        main(remove=sys.argv[1:] == ['--unregister'])
    except Exception as error:
        notify(str(error) if isinstance(error, RuntimeError) else
               'No se ha podido instalar PDF. Extrae TODO el ZIP en una carpeta nueva y vuelve a intentarlo. '
               'También puedes usar PDF.cmd desde esa carpeta.', error=True)
        sys.exit(1)
