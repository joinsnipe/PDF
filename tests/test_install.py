"""Installation file handling on a temporary tree; no Windows UI claims."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock
from PIL import Image

spec = importlib.util.spec_from_file_location('install', Path(__file__).parents[1]/'local/install.py')
install = importlib.util.module_from_spec(spec)
spec.loader.exec_module(install)


class InstallTests(unittest.TestCase):
    def test_open_with_registration_never_forces_a_default_and_quotes_paths(self):
        registry = MagicMock()
        destination = r'C:\Users\Ana Muñoz\AppData\Local\PDF-Herramientas\versions\abc'
        install.register_reader(destination, registry)
        entries = install.association_entries(destination)
        self.assertEqual(registry.SetValueEx.call_count, len(entries))
        self.assertTrue(all(call.args[0] == registry.HKEY_CURRENT_USER for call in registry.CreateKeyEx.call_args_list))
        command = next(value for path, name, value in entries if path.endswith(r'\open\command'))
        self.assertEqual(command, '"'+destination+'\\runtime\\pythonw.exe" -I -B "'+destination+'\\launcher.py" --open "%1"')
        self.assertIn((r'Software\Classes\.pdf\OpenWithProgids', 'PDF.Herramientas', ''), entries)
        self.assertFalse(any('UserChoice' in path or (path == r'Software\Classes\.pdf' and name == '') for path, name, _ in entries))

    def test_old_uninstaller_does_not_remove_current_associations(self):
        registry = MagicMock()
        registry.QueryValueEx.return_value = ('newer version command', 1)
        with self.assertRaisesRegex(RuntimeError, 'actualmente'):
            install.unregister_reader(r'C:\old', registry)
        registry.DeleteValue.assert_not_called()
        registry.DeleteKey.assert_not_called()

    def test_windows_icon_decodes_at_desktop_and_high_dpi_sizes(self):
        icon = Path(__file__).parents[1] / 'dist/icons/pdf.ico'
        with Image.open(icon) as image:
            self.assertEqual(image.ico.sizes(), {(n, n) for n in [16, 24, 32, 48, 64, 128, 256]})
            for size in image.ico.sizes():
                rendered = image.ico.getimage(size).convert('RGBA')
                self.assertEqual(rendered.size, size)
                self.assertEqual(rendered.getextrema()[3], (0, 255))
                self.assertGreater(len(rendered.getcolors(size[0] * size[1])), 2)

    def fixture(self, root):
        files = {'app/index.html': b'PDF', 'app/desktop.js': b'JS', 'runtime/pythonw.exe': b'FAKE TEST RUNTIME', 'launcher.py': b'TEST', 'app/icons/pdf.ico': b'TEST ICON'}
        for name, data in files.items():
            file = root/name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        (root/'FILES-SHA256.txt').write_text(''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name, data in files.items()))

    def test_install_is_independent_of_zip_folder_and_repeat_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, base = root/'Fuente con espacios y ñ', root/'Usuario con espacios/PDF-Herramientas'
            self.fixture(source)
            (source/'no-copiar.p12').write_bytes(b'not app data')
            first = install.install_files(source, base)
            second = install.install_files(source, base)
            self.assertEqual(first, second)
            self.assertEqual((first/'app/index.html').read_bytes(), b'PDF')
            self.assertFalse((first/'no-copiar.p12').exists())
            self.assertEqual(len(list((base/'versions').iterdir())), 1)

    def test_corruption_is_rejected_before_installation(self):
        with tempfile.TemporaryDirectory() as temp:
            source, base = Path(temp)/'source', Path(temp)/'destination'
            self.fixture(source)
            (source/'launcher.py').write_text('altered')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                install.install_files(source, base)
            self.assertFalse(base.exists())

    def test_path_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp)/'source'
            self.fixture(source)
            for name in ['../private', '/absolute', 'C:/absolute', 'app\\..\\private']:
                (source/'FILES-SHA256.txt').write_text('a'*64+'  '+name+'\n')
                with self.assertRaises(ValueError):
                    install.checked_files(source)

    def test_new_version_does_not_overwrite_running_version(self):
        with tempfile.TemporaryDirectory() as temp:
            source, base = Path(temp)/'source', Path(temp)/'destination'
            self.fixture(source)
            old = install.install_files(source, base)
            (source/'app/index.html').write_bytes(b'PDF NEW')
            manifest = source/'FILES-SHA256.txt'
            manifest.write_text(manifest.read_text().replace(hashlib.sha256(b'PDF').hexdigest(), hashlib.sha256(b'PDF NEW').hexdigest()))
            new = install.install_files(source, base)
            self.assertNotEqual(old, new)
            self.assertEqual((old/'app/index.html').read_bytes(), b'PDF')
            self.assertEqual((new/'app/index.html').read_bytes(), b'PDF NEW')


if __name__ == '__main__':
    unittest.main()
