#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import pathlib
import unittest

from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree

SCRIPT_PATH = pathlib.Path("tools/nyc/match-mn05-components-via-footprints.py")
SPEC = importlib.util.spec_from_file_location("mn05_component_spatial_join", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class MN05ComponentSpatialJoinUnitTests(unittest.TestCase):
    def test_mesh_triangles_reconstruct_footprint_polygon(self):
        patch = {
            "vertices": [0, 0, 52, 10, 0, 52, 10, 10, 52, 0, 10, 52],
            "sourceTriangles": [0, 1, 2, 0, 2, 3],
        }
        polygon = MODULE.mesh_polygon(patch)
        self.assertAlmostEqual(polygon.area, 100.0, places=4)

    def test_vertical_facade_projects_to_wall_line(self):
        patch = {
            "vertices": [0, 0, 10, 0, 0, 40, 0, 10, 40, 0, 10, 10],
            "sourceTriangles": [0, 1, 2, 0, 2, 3],
        }
        line, length, z_span = MODULE.facade_projection(patch)
        self.assertEqual(line.geom_type, "LineString")
        self.assertAlmostEqual(length, 10.0, places=3)
        self.assertAlmostEqual(z_span, 30.0, places=3)

    def test_facade_matches_unique_original_footprint_boundary(self):
        polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        footprints = [{"polygon": polygon}]
        tree = STRtree([polygon.boundary.buffer(MODULE.FACADE_BOUNDARY_TOLERANCE_M)])
        index, reason, score, distance = MODULE.choose_facade_footprint(
            LineString([(0, 1), (0, 9)]), tree, footprints)
        self.assertEqual(index, 0)
        self.assertEqual(reason, "matched")
        self.assertGreaterEqual(score, MODULE.FACADE_MIN_SCORE)
        self.assertLessEqual(distance, MODULE.FACADE_BOUNDARY_TOLERANCE_M)

    def test_shared_wall_is_rejected_as_ambiguous(self):
        left = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        right = Polygon([(10, 0), (20, 0), (20, 10), (10, 10)])
        footprints = [{"polygon": left}, {"polygon": right}]
        tree = STRtree([
            left.boundary.buffer(MODULE.FACADE_BOUNDARY_TOLERANCE_M),
            right.boundary.buffer(MODULE.FACADE_BOUNDARY_TOLERANCE_M),
        ])
        index, reason, score, distance = MODULE.choose_facade_footprint(
            LineString([(10, 1), (10, 9)]), tree, footprints)
        self.assertIsNone(index)
        self.assertEqual(reason, "ambiguous_adjacent_footprints")

    def test_roof_patch_matches_footprint_by_area_overlap(self):
        footprint = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        roof = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])
        footprints = [{"polygon": footprint}]
        tree = STRtree([footprint])
        index, reason, score, distance = MODULE.choose_roof_footprint(
            roof, tree, footprints)
        self.assertEqual(index, 0)
        self.assertEqual(reason, "matched")
        self.assertAlmostEqual(score, 1.0, places=5)

    def test_real_component_spatial_join_artifact(self):
        path = pathlib.Path("artifacts/nyc-official-mn05/mn05-component-spatial-join.json")
        self.assertTrue(path.is_file(), "component spatial join report was not generated")
        report = json.loads(path.read_text())
        self.assertTrue(report["spatialJoinAccepted"])
        self.assertFalse(report["rawZMappingVerified"])
        counts = report["counts"]
        self.assertGreater(counts["validFootprintSurfaces"], 100)
        self.assertGreater(counts["totalFacadePatches"], 1000)
        self.assertGreater(counts["matchedFacadePatches"], 0)
        self.assertGreater(counts["matchedRoofPatches"], 0)
        self.assertEqual(
            counts["matchedFacadePatches"] + counts["unmatchedOrRejectedFacadePatches"],
            counts["totalFacadePatches"],
        )
        self.assertEqual(
            counts["matchedRoofPatches"] + counts["unmatchedOrRejectedRoofPatches"],
            counts["totalRoofPatches"],
        )
        footprint_ids = {b["footprintSourceObjectUUID"] for b in report["buildings"]}
        facade_ids = [(a["sourceObjectUUID"], a["brepFaceIndex"])
                      for a in report["facadeAssignments"]]
        roof_ids = [(a["sourceObjectUUID"], a["brepFaceIndex"])
                    for a in report["roofAssignments"]]
        self.assertEqual(len(facade_ids), len(set(facade_ids)))
        self.assertEqual(len(roof_ids), len(set(roof_ids)))
        for assignment in report["facadeAssignments"]:
            self.assertIn(assignment["footprintSourceObjectUUID"], footprint_ids)
            self.assertGreaterEqual(
                assignment["boundaryCoverageScore"], MODULE.FACADE_MIN_SCORE)
        for assignment in report["roofAssignments"]:
            self.assertIn(assignment["footprintSourceObjectUUID"], footprint_ids)
            self.assertGreaterEqual(
                assignment["roofOverlapScore"], MODULE.ROOF_MIN_OVERLAP)


if __name__ == "__main__":
    unittest.main(verbosity=2)
