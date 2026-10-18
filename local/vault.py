"""Store only a browser-encrypted envelope in the OS user's persistent directory."""
import json
import os
from pathlib import Path
import re
import secrets

def vault_path():
    return Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local/state')) / 'PDF-Herramientas' / 'state' / 'ai-vault-v1.json'

def validate_record(value):
    if (not isinstance(value, dict) or set(value) != {'v', 'salt', 'iv', 'data'} or type(value['v']) is not int or value['v'] != 1
            or not isinstance(value['salt'], str) or not re.fullmatch(r'[A-Za-z0-9+/]{22}==', value['salt'])
            or not isinstance(value['iv'], str) or not re.fullmatch(r'[A-Za-z0-9+/]{16}', value['iv'])
            or not isinstance(value['data'], str) or not 24 <= len(value['data']) <= 4096
            or not re.fullmatch(r'(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?', value['data'])):
        raise ValueError('Invalid vault')
    return value

def read_vault(file=None):
    try:
        with (file or vault_path()).open('r', encoding='utf-8') as stream:
            data = stream.read(5001)
        if len(data) > 5000:
            raise ValueError('Too large')
        return validate_record(json.loads(data))
    except FileNotFoundError:
        return None

def write_vault(value, file=None):
    data = json.dumps(validate_record(value))
    file = file or vault_path()
    file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = file.with_name(file.name + '.' + secrets.token_hex(12))
    try:
        fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(data)
        os.replace(temp, file)
    finally:
        temp.unlink(missing_ok=True)

def delete_vault(file=None):
    (file or vault_path()).unlink(missing_ok=True)
