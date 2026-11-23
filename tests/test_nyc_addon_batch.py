import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from nyc_addon_batch import analyze, check_glb, run


def tiny_glb(mutate=None, *, with_bin=True):
    positions = struct.pack('<9f', 0.0, 0.0, 0.0,
                             1.0, 0.0, 0.0,
                             0.0, 1.0, 0.0)
    doc = {
        'asset': {'version': '2.0'},
        'buffers': [{'byteLength': len(positions)}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0,
                         'byteLength': len(positions)}],
        'accessors': [{'bufferView': 0, 'componentType': 5126,
                       'count': 3, 'type': 'VEC3'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
        'nodes': [{'mesh': 0}],
        'scenes': [{'nodes': [0]}],
        'scene': 0
    }
    if mutate is not None:
        mutate(doc)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    content = struct.pack('<II', len(data), 0x4e4f534a) + data
    if with_bin:
        content += struct.pack('<II', len(positions), 0x004e4942) + positions
    return struct.pack('<III', 0x46546c67, 2, 12 + len(content)) + content


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

    def test_scene_reachable_bin_backed_glb_is_accepted(self):
        self.assertEqual(check_glb(tiny_glb()), 1)

    def test_missing_binary_chunk_rejected(self):
        with self.assertRaisesRegex(ValueError, 'invalid GLB JSON chunk'):
            check_glb(tiny_glb(with_bin=False))

    def test_external_binary_uri_rejected(self):
        with self.assertRaisesRegex(ValueError, 'external or invalid GLB buffer'):
            check_glb(tiny_glb(lambda d: d['buffers'][0].update(
                uri='https://example.invalid/scene.bin')))

    def test_scene_with_no_mesh_rejected(self):
        with self.assertRaisesRegex(ValueError, 'empty'):
            check_glb(tiny_glb(lambda d: d['scenes'][0].update(nodes=[])))

    def test_out_of_bounds_accessor_rejected(self):
        with self.assertRaisesRegex(ValueError, 'exceeds'):
            check_glb(tiny_glb(lambda d: d['accessors'][0].update(byteOffset=100)))

    def test_cyclic_node_tree_rejected(self):
        with self.assertRaisesRegex(ValueError, 'cyclic'):
            check_glb(tiny_glb(lambda d: d['nodes'][0].update(children=[0])))

    def test_textured_model_without_uv_rejected(self):
        def make_textured(doc):
            doc['materials'] = [{
                'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}]
            doc['meshes'][0]['primitives'][0]['material'] = 0
        with self.assertRaisesRegex(ValueError, 'TEXCOORD_0'):
            check_glb(tiny_glb(make_textured))

    def test_required_extensions_rejected(self):
        with self.assertRaisesRegex(ValueError, 'required extensions'):
            check_glb(tiny_glb(lambda d: d.update(
                extensionsRequired=['KHR_draco_mesh_compression'])))

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
