"""Regenerate fictitious interop fixtures: Python 3 + pypdf 6.10.0 + cryptography.
The fixture passwords below are public test data, not credentials.
"""
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject

folder = Path(__file__).resolve().parent
cases = [
    ('aes256-unicode', 'AES-256', 'Contraseña-á€2026'),
    ('aes128-latin1', 'AES-128', 'Señal-2026'),
    ('rc4-128', 'RC4-128', 'Clave-2026'),
    ('rc4-40', 'RC4-40', 'Clave-2026'),
    ('aes256-empty', 'AES-256', ''),
]
for name, algorithm, password in cases:
    writer = PdfWriter()
    page = writer.add_blank_page(width=320, height=240)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    content = DecodedStreamObject()
    content.set_data(b'BT /F1 14 Tf 20 180 Td (PRUEBA SEGURIDAD PDF) Tj ET')
    page[NameObject('/Contents')] = writer._add_object(content)
    writer.add_metadata({'/Title': 'Documento ficticio de seguridad'})
    writer.encrypt(password, 'Propietario-2026', algorithm=algorithm)
    writer.write(folder / (name + '.pdf'))
