#!/usr/bin/env python3
"""Pure-Python regression tests for cached Rhino mesh topology checks."""
from __future__ import annotations
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools" / "nyc"))
from mn05_mesh_topology import analyze_mesh

class CachedMeshTopologyTests(unittest.TestCase):
    def test_single_quad_has_one_closed_boundary(self):
        vertices = [(0, 0, 0), (2, 0, 0), (2, 1, 0), (0, 1, 0)]
        result = analyze_mesh(vertices, [(0, 1, 2, 3)])
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["triangleCount"], 2)
        self.assertEqual(result["boundaryLoopCount"], 1)
        self.assertEqual(result["boundaryLoopVertexCounts"], [4])
        self.assertAlmostEqual(abs(result["boundaryLoopSignedAreaXY"][0]), 2.0)

    def test_two_triangles_share_internal_diagonal(self):
        vertices = [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)]
        result = analyze_mesh(vertices, [(0, 1, 2), (0, 2, 3)])
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["boundaryEdgeCount"], 4)
        self.assertEqual(result["boundaryLoopCount"], 1)

    def test_hole_is_preserved_as_a_second_loop(self):
        vertices = [
            (0, 0, 0), (2, 0, 0), (2, 2, 0), (0, 2, 0),
            (0.5, 0.5, 0), (1.5, 0.5, 0), (1.5, 1.5, 0), (0.5, 1.5, 0),
        ]
        faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        result = analyze_mesh(vertices, faces)
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["boundaryLoopCount"], 2)
        self.assertCountEqual(result["boundaryLoopVertexCounts"], [4, 4])

    def test_nonmanifold_edge_is_rejected(self):
        vertices = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1)]
        result = analyze_mesh(vertices, [(0, 1, 2), (1, 0, 3), (0, 1, 4)])
        self.assertFalse(result["valid"])
        self.assertGreater(result["nonManifoldEdgeCount"], 0)

    def test_degenerate_triangle_is_rejected(self):
        vertices = [(0, 0, 0), (1, 0, 0), (2, 0, 0)]
        result = analyze_mesh(vertices, [(0, 1, 2)])
        self.assertFalse(result["valid"])
        self.assertGreater(result["degenerateTriangleCount"], 0)

    def test_bow_tie_boundary_is_rejected(self):
        vertices = [(0, 0, 0), (1, 1, 0), (0, 1, 0), (1, 0, 0)]
        result = analyze_mesh(vertices, [(0, 1, 2, 3)])
        self.assertFalse(result["valid"])
        self.assertTrue(any("self-intersects" in error for error in result["errors"]))

    def test_invalid_index_is_rejected(self):
        vertices = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
        result = analyze_mesh(vertices, [(0, 1, 9)])
        self.assertFalse(result["valid"])
        self.assertTrue(any("out-of-range" in error for error in result["errors"]))

if __name__ == "__main__":
    unittest.main()
