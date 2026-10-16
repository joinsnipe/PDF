import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('actions_cleanup', ROOT / 'scripts/actions-cleanup.py')
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)

class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.row = json.loads((ROOT / 'scripts/actions-cleanup-20261016.json').read_text())[0]
        self.artifact = {'id': self.row['id'], 'name': 'PDF-distributions', 'size_in_bytes': self.row['bytes'], 'workflow_run': {
            'id': self.row['run_id'], 'head_sha': self.row['sha'], 'head_branch': 'main', 'repository_id': cleanup.REPO_ID, 'head_repository_id': cleanup.REPO_ID}}
        self.release = {'tag_name': self.row['tag'], 'draft': False, 'assets': [
            {'name': f"PDF-{self.row['tag'][1:]}-{p}.zip", 'state': 'uploaded', 'size': 100} for p in ('windows-x64', 'macos-arm64', 'macos-x64', 'web')]
            + [{'name': 'SHA256SUMS.txt', 'state': 'uploaded', 'size': 100}]}
        self.run = {'status': 'completed', 'conclusion': 'success'}

    def test_only_verified_completed_artifacts_with_complete_releases_are_accepted(self):
        cleanup.verify_artifact(self.artifact, self.row, self.release, self.run)
        for field, value in [('name', 'unrelated'), ('size_in_bytes', 1), ('id', 1)]:
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                cleanup.verify_artifact({**self.artifact, field: value}, self.row, self.release, self.run)
        for field, value in [('repository_id', 1), ('head_repository_id', 1), ('head_sha', 'different'), ('head_branch', 'other')]:
            artifact = copy.deepcopy(self.artifact)
            artifact['workflow_run'][field] = value
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                cleanup.verify_artifact(artifact, self.row, self.release, self.run)
        for release in [{**self.release, 'draft': True}, {**self.release, 'assets': []}, {**self.release, 'tag_name': 'v0.0.0'}]:
            with self.assertRaises(RuntimeError):
                cleanup.verify_artifact(self.artifact, self.row, release, self.run)
        with self.assertRaises(RuntimeError):
            cleanup.verify_artifact(self.artifact, self.row, self.release, {'status': 'in_progress'})

if __name__ == '__main__':
    unittest.main()
