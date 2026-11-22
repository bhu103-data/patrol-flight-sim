#!/usr/bin/env python3
"""Unit tests for the bounded 2014 MN05 current-building facade pilot."""
from __future__ import annotations

import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path("tools/nyc/extract-mn05-current-facade-pilot.py")
SPEC = importlib.util.spec_from_file_location("mn05_facade_pilot", MODULE_PATH)
pilot = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(pilot)


class CurrentFacadePilotTests(unittest.TestCase):
    def test_local_projection_origin_and_metre_scale(self):
        self.assertEqual(pilot.wgs84_to_local(-73.9864883, 40.756421), (0.0, 0.0))
        east, north = pilot.wgs84_to_local(-73.9854883, 40.756421)
        self.assertAlmostEqual(east, 84.444, delta=0.15)
        self.assertAlmostEqual(north, 0.0, delta=0.001)

    def test_point_in_ring_is_boundary_inclusive(self):
        ring = [(0, 0), (20, 0), (20, 20), (0, 20)]
        self.assertTrue(pilot.point_in_ring(10, 10, ring))
        self.assertTrue(pilot.point_in_ring(0, 10, ring))
        self.assertFalse(pilot.point_in_ring(22, 10, ring))

    def test_mesh_face_tuple_normalisation(self):
        self.assertEqual(pilot.mesh_face_indices((0, 1, 2)), (0, 1, 2, 2))
        self.assertEqual(pilot.mesh_face_indices((0, 1, 2, 3)), (0, 1, 2, 3))

    def test_center_match_does_not_force_overlapping_footprints(self):
        ring = [(0, 0), (20, 0), (20, 20), (0, 20)]
        fid, status = pilot.match_center((10, 10), {1001: ring})
        self.assertEqual((fid, status), (1001, "center-contained"))
        fid, status = pilot.match_center((10, 10), {1001: ring, 1002: ring})
        self.assertIsNone(fid)
        self.assertEqual(status, "ambiguous")

    def test_mesh_match_requires_strong_unique_containment(self):
        # Source points use EPSG:2263 coordinates. Transform a local test ring
        # back through the module's origin so the matching path stays realistic.
        from pyproj import Transformer
        transform = Transformer.from_crs("EPSG:4326", "EPSG:2263", always_xy=True)
        ring_wgs = [
            (-73.9864883, 40.756421),
            (-73.98625, 40.756421),
            (-73.98625, 40.75660),
            (-73.9864883, 40.75660),
        ]
        ring_local = [pilot.wgs84_to_local(*p) for p in ring_wgs]
        raw_points = []
        for lon, lat in ring_wgs:
            x, y = transform.transform(lon, lat)
            raw_points.append((x, y, 100.0))
        fid, status = pilot.mesh_match(raw_points, {1001: ring_local})
        self.assertEqual(fid, 1001)
        self.assertEqual(status, "vertex-contained")

    def test_base_surface_z_summary_is_median_and_fail_closed(self):
        class BBoxPoint:
            def __init__(self, z):
                self.Z = z
        class BBox:
            Min = BBoxPoint(100.0)
            Max = BBoxPoint(100.0)
        class Geometry:
            def GetBoundingBox(self):
                return BBox()
        result = pilot.collect_base_z(Geometry())
        self.assertEqual(result["zMinRawFt"], 100.0)
        self.assertEqual(result["zMedianRawFt"], 100.0)
        self.assertEqual(result["zMaxRawFt"], 100.0)

    def test_candidate_budget_is_bounded(self):
        self.assertEqual(pilot.MAX_FACADE_TRIANGLES, 150000)
        self.assertEqual(pilot.MAX_FACADE_VERTICES, 250000)
        self.assertEqual(pilot.VERTICAL_TOLERANCE_FT, 1.6)


if __name__ == "__main__":
    unittest.main()
