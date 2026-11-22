#!/usr/bin/env python3
"""Validate actual 2014 NYC DCP rooftop and facade cached Rhino mesh sources.

No current 2026 photo-realism asserted and no unknown 2014 source Z
converted into a 2022 roadbed absolute height.
"""
import json,math,pathlib,unittest

ROOT=pathlib.Path("artifacts/nyc-official-mn05")
SHA="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"

class AuthenticNYCMunicipalFacadeMeshes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.facades=json.loads((ROOT/"times-square-original-facade-mesh.json").read_text())
        cls.roofs=json.loads((ROOT/"times-square-original-roof-mesh.json").read_text())
        cls.roi=json.loads((ROOT/"times-square-roof-source-roi.json").read_text())

    def test_source_identity_year_origin_and_unverified_vertical_datum(self):
        walls=self.facades;roofs=self.roofs
        self.assertEqual(walls["schema"],"patrol-mn05-authentic-2014-cached-facade-mesh-qa-v1")
        self.assertEqual(walls["role"],"ORIGINAL_2014_MUNICIPAL_FACADE_CACHED_MESH_NOT_2026_PATROL_GAME")
        self.assertEqual(walls["source3dmSHA256"],SHA)
        self.assertEqual(walls["source3dmSHA256"],roofs["source3dmSHA256"])
        self.assertEqual(walls["sourceCRS"],roofs["sourceCRS"])
        self.assertEqual(walls["originLonLat"],roofs["originLonLat"])
        self.assertEqual(walls["facadeZInterpretation"],
            "RAW_2014_RHINO_SOURCE_FOOT_UNKNOWN_VERTICAL_DATUM")
        self.assertFalse(self.roi["sourceVerticalDatumVerified"])
        self.assertTrue(self.roi["facadeMeshAccepted"])

    def test_real_cached_mesh_faces_and_bounds_from_official_2014_source(self):
        walls=self.facades
        parts=walls["sourceFacade3dMeshPatches"]
        self.assertGreater(len(parts),1000)
        self.assertLessEqual(len(parts),24000)
        self.assertGreater(self.roi["layerStats"]["facadeInsideROI"],8000)
        valid_triangles=0
        valid_vertices=0
        for p in parts:
            self.assertRegex(p["sourceObjectUUID"],r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
            self.assertGreaterEqual(p["brepFaceIndex"],0)
            vertices=p["vertices"]
            faces=p["sourceTriangles"]
            self.assertEqual(len(vertices),p["vertexCount"]*3)
            self.assertEqual(len(faces),p["triangleCount"]*3)
            self.assertGreater(p["triangleCount"],0)
            self.assertTrue(all(math.isfinite(t) for t in vertices))
            self.assertTrue(all(0<=k<p["vertexCount"] for k in faces))
            valid_triangles+=p["triangleCount"]
            valid_vertices+=p["vertexCount"]
        self.assertGreater(valid_triangles,2000)
        self.assertLess(valid_triangles,250001)
        self.assertEqual(valid_triangles,walls["counts"]["actualFacadeSourceTriangles"])
        self.assertEqual(valid_vertices,walls["counts"]["actualFacadeSourceVertices"])
        self.assertEqual(valid_vertices,self.roi["facadeMeshStats"]["actualFacadeSourceVertices"])

if __name__=="__main__":
    unittest.main()
