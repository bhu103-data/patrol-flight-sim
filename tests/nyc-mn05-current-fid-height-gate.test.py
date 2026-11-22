#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import pathlib
import unittest

from shapely.geometry import Polygon
from shapely.strtree import STRtree

SCRIPT_PATH = pathlib.Path("tools/nyc/match-mn05-components-to-current-fids.py")
SPEC = importlib.util.spec_from_file_location("mn05_current_fid_gate", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class MN05CurrentFidGateTests(unittest.TestCase):
    def test_height_gate_uses_absolute_or_relative_relief_tolerance(self):
        status, delta, relative = MODULE.classify_height_delta(30.0, 29.0)
        self.assertEqual(status, "close")
        self.assertAlmostEqual(delta, 1.0)
        self.assertAlmostEqual(relative, 1.0 / 29.0)

    def test_height_change_is_flagged_not_silently_accepted(self):
        status, delta, relative = MODULE.classify_height_delta(80.0, 50.0)
        self.assertEqual(status, "changed")
        self.assertAlmostEqual(delta, 30.0)

    def test_footprint_candidate_requires_overlap_and_margin(self):
        source = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        current = [
            {"fid": 101, "polygon": Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])},
            {"fid": 102, "polygon": Polygon([(20, 0), (30, 0), (30, 10), (20, 10)])},
        ]
        tree = STRtree([item["polygon"] for item in current])
        best, reason, ratio, margin = MODULE.build_candidate(source, tree, current)
        self.assertEqual(reason, "matched")
        self.assertEqual(best["fid"], 101)
        self.assertAlmostEqual(ratio, 1.0)
        self.assertGreaterEqual(margin, MODULE.MIN_FOOTPRINT_MARGIN)

    def test_identical_candidate_footprints_are_rejected_as_ambiguous(self):
        source = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        duplicate = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        current = [
            {"fid": 101, "polygon": duplicate},
            {"fid": 102, "polygon": duplicate},
        ]
        tree = STRtree([item["polygon"] for item in current])
        best, reason, ratio, margin = MODULE.build_candidate(source, tree, current)
        self.assertIsNone(best)
        self.assertEqual(reason, "ambiguous_current_fid")

    def test_current_fid_height_and_facade_gate_artifact(self):
        path = pathlib.Path("artifacts/nyc-official-mn05/mn05-2014-to-current-fid-height-gate.json")
        self.assertTrue(path.is_file(), "current FID height-gate report was not generated")
        report = json.loads(path.read_text())
        counts = report["counts"]
        self.assertEqual(counts["currentFootprintFeatures"], 120)
        self.assertGreater(counts["matched2014FootprintsToCurrentFids"], 0)
        self.assertGreater(counts["eligibleForFacadePreview"], 0)
        self.assertFalse(report["rawZMappingVerified"])
        self.assertEqual(report["currentFootprintRetrieved"], "2026-11-20")
        eligible = report["eligibleForFacadePreview"]
        eligible_fids = [item["currentFid"] for item in eligible]
        self.assertEqual(len(eligible_fids), len(set(eligible_fids)))
        for item in eligible:
            self.assertEqual(item["heightStatus"], "close")
            self.assertFalse(item["currentFidConflict"])
            self.assertGreaterEqual(item["footprintOverlapRatio"], MODULE.MIN_FOOTPRINT_OVERLAP)
            self.assertGreaterEqual(item["footprintMatchMargin"], MODULE.MIN_FOOTPRINT_MARGIN)
            self.assertGreaterEqual(item["facadeBoundaryCoverageRatio"], MODULE.MIN_FACADE_COVERAGE)
            self.assertGreaterEqual(item["roofCoverageRatio"], MODULE.MIN_ROOF_COVERAGE)
            self.assertGreaterEqual(item["facadeSourceObjectCount"], MODULE.MIN_FACADE_OBJECTS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
