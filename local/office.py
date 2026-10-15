"""Optional, local LibreOffice conversion. No uploads or arbitrary executable paths."""
import io
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import zipfile
import xml.etree.ElementTree as ET

MAX_INPUT = 25 * 1024 * 1024
MAX_PART = 20 * 1024 * 1024
MAX_EXPANDED = 80 * 1024 * 1024
LOCK = threading.Lock()
PARTS = {'docx': 'word/document.xml', 'xlsx': 'xl/workbook.xml', 'pptx': 'ppt/presentation.xml'}
PROFILE = '''<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>'''

class OfficeError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

def validate_office(data, extension):
    if extension not in PARTS or not 0 < len(data) <= MAX_INPUT:
        raise OfficeError('OFFICE_FORMAT', 'Selecciona DOCX, XLSX o PPTX de hasta 25 MB, sin contraseña ni macros.')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if (not 0 < len(entries) <= 5000 or len(set(names)) != len(names) or
                    PARTS[extension] not in names or '[Content_Types].xml' not in names or
                    sum(e.file_size for e in entries) > MAX_EXPANDED):
                raise ValueError()
            for entry in entries:
                name = entry.filename.lower()
                if (entry.flag_bits & 1 or entry.file_size > MAX_PART or entry.compress_type not in (0, 8) or
                        name.startswith('/') or '\\' in name or '..' in name.split('/') or
                        any(x in name for x in ('vbaproject', '/embeddings/', '/externallinks/', '/activex/'))):
                    raise ValueError()
                if not name.endswith(('.xml', '.rels')):
                    continue
                text = archive.read(entry).decode('utf-8-sig')
                if re.search(r'<!DOCTYPE|<!ENTITY|macroEnabled|\bDDE(?:AUTO)?\b|INCLUDE(?:TEXT|PICTURE)|WEBSERVICE\s*\(', text, re.I):
                    raise ValueError()
                root = ET.fromstring(text)
                if re.search(r'\bDDE(?:AUTO)?\b|INCLUDE(?:TEXT|PICTURE)|WEBSERVICE\s*\(', ''.join(root.itertext()), re.I):
                    raise ValueError()
                if name.endswith('.rels'):
                    for rel in root:
                        if rel.attrib.get('TargetMode', '').lower() == 'external' and not rel.attrib.get('Type', '').endswith('/hyperlink'):
                            raise ValueError()
    except (ValueError, OSError, zipfile.BadZipFile, ET.ParseError, RuntimeError, UnicodeError) as error:
        raise OfficeError('OFFICE_UNSUPPORTED', 'El archivo no es un Office compatible. No se admiten macros, objetos incrustados, vínculos de datos externos, documentos cifrados ni archivos dañados.') from error

def find_office():
    candidates = []
    if os.name == 'nt':
        for var in ('ProgramFiles', 'ProgramFiles(x86)'):
            if os.environ.get(var):
                candidates.append(Path(os.environ[var]) / 'LibreOffice/program/soffice.com')
    candidates += [Path('/Applications/LibreOffice.app/Contents/MacOS/soffice')]
    found = shutil.which('soffice') or shutil.which('libreoffice')
    if found:
        candidates.append(Path(found))
    return next((str(p) for p in candidates if p.is_file()), None)

def convert_office(data, extension):
    validate_office(data, extension)
    executable = find_office()
    if not executable:
        raise OfficeError('OFFICE_MISSING', 'Instala LibreOffice en este ordenador y pulsa Comprobar instalación.')
    if not LOCK.acquire(blocking=False):
        raise OfficeError('OFFICE_BUSY', 'Ya hay una conversión de Office en curso. Espera a que termine.')
    try:
        with tempfile.TemporaryDirectory(prefix='pdf-contigo-office-') as folder:
            root = Path(folder)
            profile = root / 'profile'
            (profile / 'user').mkdir(parents=True)
            (profile / 'user/registrymodifications.xcu').write_text(PROFILE, encoding='utf-8')
            source = root / ('document.' + extension)
            source.write_bytes(data)
            output = root / 'output'
            output.mkdir()
            args = [executable, '-env:UserInstallation=' + profile.as_uri(), '--headless', '--nologo', '--nodefault', '--nolockcheck', '--nofirststartwizard', '--convert-to', 'pdf', '--outdir', str(output), str(source)]
            process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                       start_new_session=os.name != 'nt',
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            try:
                code = process.wait(timeout=90)
            except subprocess.TimeoutExpired:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                raise OfficeError('OFFICE_TIMEOUT', 'LibreOffice superó 90 segundos. Prueba un documento más pequeño.')
            result = output / 'document.pdf'
            if code or not result.is_file() or not 0 < result.stat().st_size <= 100 * 1024 * 1024:
                raise OfficeError('OFFICE_CONVERT', 'LibreOffice no pudo convertir el documento. Ábrelo en LibreOffice, revisa sus fuentes y guarda una copia nueva.')
            pdf = result.read_bytes()
            if not pdf.startswith(b'%PDF-'):
                raise OfficeError('OFFICE_CONVERT', 'No se generó un PDF válido.')
            return pdf
    except OfficeError:
        raise
    except OSError as error:
        raise OfficeError('OFFICE_CONVERT', 'No se pudo ejecutar LibreOffice o guardar su archivo temporal.') from error
    finally:
        LOCK.release()
