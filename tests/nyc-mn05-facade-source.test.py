import sys
import unittest
from pathlib import Path
from shapely.geometry import Polygon

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "nyc"))
from mn05_facade_source_support import (
    cached_mesh_triangles, match_facade_patch, match_roof_triangles,
    relative_height_metres, plausible_height_ratio,
)


class Point:
    def __init__(self, x, y, z):
        self.X, self.Y, self.Z = x, y, z


class Faces:
    def __init__(self, rows):
        self.rows = rows
    def __len__(self):
        return len(self.rows)
    def GetFaceVertices(self, i):
        return (True, *(Point(*p) for p in self.rows[i]))


class Mesh:
    def __init__(self, rows):
        self.Faces = Faces(rows)


def building(fid, coords):
    polygon = Polygon(coords)
    return {"fid": fid, "heightMetres": 30.0, "geometry": polygon}


class Mn05FacadeSourceTests(unittest.TestCase):
    def test_cached_triangle_and_quad_are_original_face_geometry(self):
        tri = [(0, 0, 100), (10, 0, 100), (0, 10, 100), (0, 10, 100)]
        quad = [(0, 0, 110), (10, 0, 110), (10, 10, 110), (0, 10, 110)]
        rows, xy = cached_mesh_triangles(Mesh([tri, quad]), lambda x, y: (x, y))
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0][0], [0.0, 0.0, 100.0])
        self.assertEqual(rows[1][0], [0.0, 0.0, 110.0])
        self.assertEqual(rows[2][2], [0.0, 10.0, 110.0])
        self.assertGreaterEqual(len(xy), 8)

    def test_facade_matches_unique_building_boundary(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        b = building(22, [(20, 0), (30, 0), (30, 10), (20, 10)])
        result = match_facade_patch([(0, 0), (0, 5), (0, 10)], [a, b])
        self.assertIsNotNone(result)
        self.assertEqual(result["building"]["fid"], 11)
        self.assertAlmostEqual(result["coverage"], 1.0)

    def test_shared_party_wall_is_rejected_as_ambiguous(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        b = building(22, [(10, 0), (20, 0), (20, 10), (10, 10)])
        result = match_facade_patch([(10, 0), (10, 5), (10, 10)], [a, b])
        self.assertIsNone(result)

    def test_unmatched_facade_is_not_snapped_to_nearest_building(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        result = match_facade_patch([(20, 20), (20, 25), (20, 30)], [a])
        self.assertIsNone(result)

    def test_roof_source_requires_area_overlap(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        tri = [[(0, 0, 100), (10, 0, 100), (0, 10, 100)]]
        result = match_roof_triangles(tri, [a])
        self.assertEqual(result["building"]["fid"], 11)
        self.assertAlmostEqual(result["coverage"], 1.0)
        self.assertAlmostEqual(result["coverageMargin"], 1.0)
        self.assertIsNone(match_roof_triangles(
            [[(20, 20, 100), (30, 20, 100), (20, 30, 100)]], [a]))

    def test_duplicate_roof_footprints_are_rejected_as_ambiguous(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        b = building(22, [(0, 0), (10, 0), (10, 10), (0, 10)])
        square = [
            [(0, 0, 100), (10, 0, 100), (10, 10, 100)],
            [(0, 0, 100), (10, 10, 100), (0, 10, 100)],
        ]
        self.assertIsNone(match_roof_triangles(square, [a, b]))

    def test_near_tied_overlapping_roof_footprints_are_rejected(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        b = building(22, [(0.5, 0), (10.5, 0), (10.5, 10), (0.5, 10)])
        square = [
            [(0, 0, 100), (10, 0, 100), (10, 10, 100)],
            [(0, 0, 100), (10, 10, 100), (0, 10, 100)],
        ]
        self.assertIsNone(match_roof_triangles(square, [a, b]))

    def test_clear_roof_overlap_margin_is_recorded(self):
        a = building(11, [(0, 0), (10, 0), (10, 10), (0, 10)])
        b = building(22, [(2, 0), (12, 0), (12, 10), (2, 10)])
        square = [
            [(0, 0, 100), (10, 0, 100), (10, 10, 100)],
            [(0, 0, 100), (10, 10, 100), (0, 10, 100)],
        ]
        result = match_roof_triangles(square, [a, b])
        self.assertEqual(result["building"]["fid"], 11)
        self.assertAlmostEqual(result["coverage"], 1.0)
        self.assertAlmostEqual(result["secondBestCoverage"], 0.8)
        self.assertAlmostEqual(result["coverageMargin"], 0.2)


    def test_height_ratio_gate_rejects_grossly_mismatched_source_facades(self):
        self.assertTrue(plausible_height_ratio(100, 100))
        self.assertTrue(plausible_height_ratio(50, 100))
        self.assertTrue(plausible_height_ratio(175, 100))
        self.assertFalse(plausible_height_ratio(20, 100))
        self.assertFalse(plausible_height_ratio(300, 100))
        self.assertFalse(plausible_height_ratio(float("nan"), 100))

    def test_relative_z_uses_modern_height_anchor_not_unknown_absolute_datum(self):
        self.assertEqual(relative_height_metres(100, 100, 200, 30), 0)
        self.assertEqual(relative_height_metres(200, 100, 200, 30), 30)
        self.assertEqual(relative_height_metres(150, 100, 200, 30), 15)
        with self.assertRaisesRegex(ValueError, "invalid relative"):
            relative_height_metres(100, 100, 100, 30)


if __name__ == "__main__":
    unittest.main(verbosity=2)
