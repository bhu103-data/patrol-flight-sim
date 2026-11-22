#!/usr/bin/env python3
"""Fail-closed source integrity checks on exact 2014 municipal roof mesh JSON.

These checks do not assert source absolute Z, 2026 chronology, source
geographic registration against independent photos, or real-time game FPS.
"""
from __future__ import annotations
import json
import math
import pathlib
import unittest

SOURCE=pathlib.Path("artifacts/nyc-official-mn05/times-square-original-roof-mesh.json")
REPORT=pathlib.Path("artifacts/nyc-official-mn05/times-square-roof-source-roi.json")
EXPECTED_RHINO_SHA="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"

class ActualRhinoCachedMeshSourceQA(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mesh=json.loads(SOURCE.read_text())
        cls.report=json.loads(REPORT.read_text())

    def test_official_source_hash_units_year_and_explicit_unknown_vertical_datum(self):
        source=self.mesh
        self.assertEqual(source["schema"],"patrol-mn05-authentic-2014-cached-roof-mesh-qa-v1")
        self.assertEqual(source["source3dmSHA256"],EXPECTED_RHINO_SHA)
        self.assertEqual(source["sourceCRS"],"EPSG:2263 (US survey feet)")
        self.assertEqual(source["originLonLat"],[-73.9864883,40.756421])
        self.assertEqual(source["roofZInterpretation"],
          "RAW_2014_RHINO_SOURCE_FOOT_UNKNOWN_VERTICAL_DATUM")
        self.assertNotIn("current2026Roof",str(source))
        self.assertTrue(self.report["meshAccepted"])
        self.assertFalse(self.report["sourceVerticalDatumVerified"])
        self.assertTrue(self.report["readyForBoundedMeshConversion"])

    def test_actual_mesh_triangles_and_source_object_uuids(self):
        roofs=self.mesh["sourceRooftop3dMeshPatches"]
        self.assertGreater(len(roofs),50)
        self.assertLessEqual(len(roofs),2500)
        total_faces=0
        total_vertices=0
        self.assertGreater(self.report["layerStats"]["roofInsideROI"],100)
        self.assertGreater(self.report["layerStats"]["facadeInsideROI"],100)
        for roof in roofs:
            self.assertRegex(roof["sourceObjectUUID"],
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
            self.assertGreaterEqual(roof["brepFaceIndex"],0)
            coords=roof["vertices"]
            idx=roof["sourceTriangles"]
            self.assertEqual(len(coords),3*roof["vertexCount"])
            self.assertEqual(len(idx),3*roof["triangleCount"])
            self.assertTrue(all(math.isfinite(t) for t in coords))
            self.assertGreater(len(idx),0)
            self.assertTrue(all(0<=i<roof["vertexCount"] for i in idx))
            self.assertLess(roof["vertexCount"],12001)
            # Original planar X/Y already converted to local metres while Z is
            # deliberately kept raw in Rhino source feet, not world Y.
            self.assertTrue(all(abs(coords[i])<5000 for i in range(0,len(coords),3)))
            self.assertTrue(all(abs(coords[i])<5000 for i in range(1,len(coords),3)))
            total_faces+=roof["triangleCount"]
            total_vertices+=roof["vertexCount"]
        self.assertEqual(total_faces,self.mesh["counts"]["actualSourceTriangles"])
        self.assertEqual(total_vertices,self.mesh["counts"]["actualSourceVertices"])
        self.assertGreater(total_faces,100)
        self.assertLessEqual(total_faces,150000)

if __name__=="__main__":
    unittest.main()
