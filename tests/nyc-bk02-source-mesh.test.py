#!/usr/bin/env python3
"""Validate exact source-mesh provenance and safe DUMBO metric coordinates."""
import json,math,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
ART=pathlib.Path("artifacts/nyc-official-bk02")
REPORT=ART/"dumbo-2014-source-roi.json"
MESH=ART/"dumbo-2014-source-mesh.json"
class BK02SourceMeshTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report=json.loads(REPORT.read_text())
        cls.mesh=json.loads(MESH.read_text())
    def test_original_source_identity_and_vertical_datum_caveat(self):
        self.assertTrue(self.report["meshAccepted"])
        self.assertEqual(self.mesh["schema"],
          "patrol-nyc-dumbo-bk02-2014-cached-roof-facade-mesh-v1")
        self.assertEqual(self.mesh["source3dmSha256"],self.report["source3dmSha256"])
        self.assertEqual(self.mesh["sourceZipSha256"],self.report["sourceZipSha256"])
        self.assertEqual(self.mesh["sourceCRS"],
          "EPSG:2263 (US survey feet XY; raw Z datum unverified)")
        self.assertFalse(self.mesh["verticalDatumVerified"])
        self.assertFalse(self.report["sourceVerticalDatumVerified"])
        self.assertEqual(self.mesh["originWGS84"],[-73.989,40.702])
    def test_both_real_roof_and_facade_layers_are_extracted(self):
        counts=self.mesh["counts"]
        patches=self.mesh["meshPatches"]
        self.assertGreater(counts["roofPatches"],10)
        self.assertGreater(counts["facadePatches"],50)
        self.assertEqual(counts["roofPatches"],
          sum(p["kind"]=="roof" for p in patches))
        self.assertEqual(counts["facadePatches"],
          sum(p["kind"]=="facade" for p in patches))
        self.assertEqual(counts["footprintPatches"],
          sum(p["kind"]=="footprint" for p in patches))
        self.assertGreater(counts["triangles"],500)
        self.assertGreater(counts["vertices"],500)
    def test_all_cached_mesh_vertices_are_finite_and_inside_dumbo_roi(self):
        bounds=self.mesh["boundsMeters"]
        minx,minz,maxx,maxz=bounds
        for patch in self.mesh["meshPatches"]:
            self.assertRegex(patch["sourceObjectUUID"],
              r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
            self.assertGreaterEqual(patch["brepFaceIndex"],0)
            self.assertEqual(len(patch["vertices"]),patch["vertexCount"]*3)
            self.assertEqual(len(patch["triangles"]),patch["triangleCount"]*3)
            self.assertTrue(all(math.isfinite(x) for x in patch["vertices"]))
            self.assertTrue(all(0<=i<patch["vertexCount"] for i in patch["triangles"]))
            for i in range(0,len(patch["vertices"]),3):
                east,south,z=patch["vertices"][i:i+3]
                self.assertTrue(minx-30<=east<=maxx+30)
                self.assertTrue(minz-30<=south<=maxz+30)
    def test_raw_source_z_is_preserved_not_claimed_as_2026_elevation(self):
        lo,hi=self.mesh["rawSourceZFeetRange"]
        self.assertTrue(math.isfinite(lo) and math.isfinite(hi) and hi>lo)
        self.assertEqual(self.report["sourceZInterpretation"],
          "RAW_2014_RHINO_Z_UNVERIFIED_VERTICAL_DATUM")
        self.assertNotIn("2026_as_built",str(self.mesh).lower())
    def test_48_current_oti_buildings_remain_separate_reference(self):
        source=json.loads((ROOT/"assets/nyc/dumbo-oti-metric-48.json").read_text())
        self.assertEqual(len(source["features"]),48)
        self.assertEqual(self.mesh["role"],
          "ISOLATED_2014_DCP_SOURCE_MESH_PREVIEW_NOT_2026_PATROL_GAME")
if __name__=="__main__":unittest.main()
