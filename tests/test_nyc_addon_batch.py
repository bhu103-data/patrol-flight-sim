import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from nyc_addon_batch import analyze, check_glb, run


def tiny_glb():
    data = json.dumps({'asset': {'version': '2.0'}, 'accessors': [{'count': 3}],
                       'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}]},
                      separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    return struct.pack('<III', 0x46546c67, 2, 20 + len(data)) + struct.pack('<II', len(data), 0x4e4f534a) + data


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.root = Path(self.t.name)
        (self.root / 'archive').mkdir()
        (self.root / 'evidence').mkdir()

    def call(self, entry, stage=None):
        return analyze(entry, self.root / 'archive', self.root / 'evidence', stage)

    def test_missing_archive(self):
        self.assertEqual(self.call({'id': 20546})['status'], 'missing_archive')

    def test_public_download_not_redistribution_license(self):
        with ZipFile(self.root / 'archive' / '20546.zip', 'w') as z:
            z.writestr('scenery/landmark.glb', tiny_glb())
            z.writestr('scenery/test.bgl', b'compiled data')
        r = self.call({'id': 20546, 'archive': '20546.zip'}, self.root / 'stage')
        self.assertEqual(r['status'], 'rights_pending')
        self.assertEqual(len(r['files']), 2)
        self.assertEqual(r['glb_candidates'][0]['triangles'], 1)
        self.assertFalse((self.root / 'stage').exists())

    def test_evidence_required_even_with_flags(self):
        item = {'id': 20546, 'archive': '20546.zip', 'rights': {
            'modify': True, 'cross_game': True, 'redistribute': True, 'dependencies_clear': True},
            'rights_evidence': 'grant.txt'}
        with ZipFile(self.root / 'archive' / '20546.zip', 'w') as z:
            z.writestr('model.glb', tiny_glb())
        self.assertEqual(self.call(item)['status'], 'rights_pending')
        (self.root / 'evidence' / 'grant.txt').write_text('Permission notice for model and all dependencies.')
        r = self.call(item, self.root / 'stage')
        self.assertEqual(r['status'], 'local_review_only')
        self.assertTrue((self.root / 'stage' / '20546' / '001.glb').is_file())

    def test_zip_slip_rejected(self):
        with ZipFile(self.root / 'archive' / 'bad.zip', 'w') as z:
            z.writestr('../creds.txt', 'secret')
        r = self.call({'id': 20546, 'archive': 'bad.zip'})
        self.assertEqual(r['status'], 'unsafe_or_invalid_archive')

    def test_no_credentials_or_path_traversal(self):
        with self.assertRaises(ValueError):
            self.call({'id': 20546, 'archive': '../creds.txt'})
        with self.assertRaises(ValueError):
            self.call({'id': 20546, 'archive': 'creds.txt'})

    def test_duplicate_normalized_zip_name_rejected(self):
        with ZipFile(self.root / 'archive' / 'duplicate.zip', 'w') as z:
            z.writestr('models/bridge.glb', tiny_glb())
            z.writestr('./models/bridge.glb', tiny_glb())
        result = self.call({'id': 35245, 'archive': 'duplicate.zip'})
        self.assertEqual(result['status'], 'unsafe_or_invalid_archive')
        self.assertIn('duplicate', result['error'])

    def test_oversized_single_glb_skips_without_loading(self):
        oversized = self.root / 'archive' / 'oversized.glb'
        with oversized.open('wb') as stream:
            stream.truncate(8 * 1024**2 + 1)
        result = self.call({'id': 35245, 'archive': 'oversized.glb'})
        self.assertEqual(result['status'], 'oversized_glb')

    def test_bad_row_does_not_abort_remaining_addons(self):
        src = self.root / 'mixed.json'
        src.write_text(json.dumps({'addons': [
            {'id': 20546, 'archive': '../creds.txt'},
            {'id': 35245},
            'invalid',
            {'id': 35536, 'archive': 'missing.zip'}]}))
        result = run(src, self.root / 'archive', self.root / 'evidence',
                     self.root / 'mixed-report.json', None)
        self.assertEqual([row['status'] for row in result['entries']],
                         ['invalid_manifest_entry', 'missing_archive',
                          'invalid_manifest_entry', 'missing_archive'])
        self.assertNotIn('creds.txt',
                         (self.root / 'mixed-report.json').read_text(encoding='utf-8'))

    def test_invalid_glb(self):
        with self.assertRaises(ValueError):
            check_glb(b'not a model')

    def test_complete_manifest_order_and_duplicate_detection(self):
        src = self.root / 'list.json'
        src.write_text(json.dumps({'addons': [{'id': 35245}, {'id': 20546}]}))
        report = run(src, self.root / 'archive', self.root / 'evidence', self.root / 'report.json', None)
        self.assertEqual([i['id'] for i in report['entries']], [35245, 20546])
        self.assertTrue((self.root / 'report.json').is_file())
        src.write_text(json.dumps({'addons': [{'id': 20546}, {'id': 20546}]}))
        with self.assertRaises(ValueError):
            run(src, self.root / 'archive', self.root / 'evidence', self.root / 'out.json', None)


if __name__ == '__main__':
    unittest.main()
