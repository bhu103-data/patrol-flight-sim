#!/usr/bin/env python3
"""Unit tests for the read-only NYC MN05 roof vertical-reference audit."""
from __future__ import annotations

import datetime as dt
import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path("tools/nyc/audit-mn05-roof-vertical-reference.py")
SPEC = importlib.util.spec_from_file_location("mn05_vertical_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(audit)


class RoofVerticalReferenceAuditTests(unittest.TestCase):
    def test_local_projection_origin_is_zero(self):
        self.assertEqual(audit.wgs84_to_local_meters(-73.9864883, 40.756421), (0.0, 0.0))

    def test_local_projection_uses_metres_not_degrees_scaled_twice(self):
        east, north = audit.wgs84_to_local_meters(-73.9854883, 40.756421)
        self.assertAlmostEqual(east, 84.444, delta=0.15)
        self.assertAlmostEqual(north, 0.0, delta=0.001)

    def test_boundary_inclusive_point_in_ring(self):
        ring = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]
        self.assertTrue(audit.point_in_ring(5.0, 5.0, ring))
        self.assertTrue(audit.point_in_ring(0.0, 5.0, ring))
        self.assertFalse(audit.point_in_ring(12.0, 5.0, ring))

    def test_unique_roof_object_match_uses_source_footprint(self):
        footprints = [{
            "fid": 1001,
            "ring": [(0.0, 0.0), (20.0, 0.0), (20.0, 20.0), (0.0, 20.0)],
        }]
        groups = {"source-object-1": [
            (2.0, 2.0, 100.0), (18.0, 2.0, 101.0),
            (18.0, 18.0, 102.0), (2.0, 18.0, 101.0),
        ]}
        matched, stats = audit.match_roof_objects(groups, footprints)
        self.assertIn(1001, matched)
        self.assertEqual(matched[1001]["roofObjectCount"], 1)
        self.assertEqual(stats["uniquelyMatchedObjectCount"], 1)

    def test_overlapping_footprints_are_not_forced_into_one_fid(self):
        ring = [(0.0, 0.0), (20.0, 0.0), (20.0, 20.0), (0.0, 20.0)]
        footprints = [{"fid": 1001, "ring": ring}, {"fid": 1002, "ring": ring}]
        groups = {"source-object-1": [
            (2.0, 2.0, 100.0), (18.0, 2.0, 101.0),
            (18.0, 18.0, 102.0), (2.0, 18.0, 101.0),
        ]}
        matched, stats = audit.match_roof_objects(groups, footprints)
        self.assertEqual(matched, {})
        self.assertEqual(stats["ambiguousObjectCount"], 1)

    def test_z_unit_conversion_requires_recognised_model_unit(self):
        self.assertEqual(audit._z_unit_to_feet("Feet"), (1.0, "FEET"))
        self.assertAlmostEqual(
            audit._z_unit_to_feet("Meters")[0], 1.0 / 0.3048
        )
        self.assertEqual(audit._z_unit_to_feet("Unknown Unit"), (None, "UNKNOWN"))

    def test_dcp_accuracy_summary_is_descriptive_not_a_datum_claim(self):
        summary = audit._summarise_deltas([
            {"fid": 1, "deltaFt": 0.5},
            {"fid": 2, "deltaFt": -2.0},
        ])
        self.assertEqual(summary["sampleCount"], 2)
        self.assertEqual(summary["withinDcp95AccuracyBandCount"], 1)
        self.assertEqual(summary["medianAbsoluteDeltaFt"], 1.25)

    def test_build_audit_never_certifies_vertical_datum_or_runtime_import(self):
        mesh = {
            "source3dmSHA256": "pinned",
            "sourceRooftop3dMeshPatches": [{
                "sourceObjectUUID": "source-object-1",
                "vertexCount": 4,
                "vertices": [2, 2, 100, 18, 2, 100, 18, 18, 100, 2, 18, 100],
            }],
        }
        probe = {"modelUnitSystem": "Feet"}
        footprints = [{
            "fid": 1001,
            "ring": [(0, 0), (20, 0), (20, 20), (0, 20)],
            "snapshotHeightFt": 80.0,
        }]
        modified = int(dt.datetime(2014, 1, 1, tzinfo=dt.timezone.utc).timestamp() * 1000)
        current = {1001: {
            "FID": 1001, "BIN": 123, "DOITT_ID": 456,
            "GROUNDELEV": 20, "HEIGHTROOF": 80,
            "GEOMSOURCE": "Photogrammetric", "CNSTRCT_YR": 2000,
            "LSTMODDATE": modified, "LSTSTATTYPE": "Initialization", "FEAT_CODE": 2100,
        }}
        report = audit.build_audit(mesh, probe, footprints, {}, current)
        self.assertEqual(report["verticalDatumStatus"], "NOT_CERTIFIED")
        self.assertFalse(report["runtimeImportAllowed"])
        self.assertFalse(report["sourceModel"]["verticalDatumDeclaredIn3dModelMetadata"])
        self.assertEqual(
            report["verticalComparison"]["photogrammetricMatches"]["sampleCount"], 1
        )
        self.assertEqual(
            report["verticalComparison"]["stableSince2014Candidates"]["sampleCount"], 1
        )
        self.assertEqual(report["perBuilding"][0]["lastStatusType"], "Initialization")

    def test_historic_footprint_crosscheck_preserves_status_and_datum_uncertainty(self):
        mesh = {
            "sourceRooftop3dMeshPatches": [{
                "sourceObjectUUID": "historic-source-object",
                "vertexCount": 4,
                "vertices": [2, 2, 100, 18, 2, 100, 18, 18, 100, 2, 18, 100],
            }],
        }
        probe = {"modelUnitSystem": "UnitSystem.Feet"}
        historic_footprints = [{
            "fid": 77,
            "ring": [(0, 0), (20, 0), (20, 20), (0, 20)],
        }]
        historic_attributes = {77: {
            "OBJECTID": 77, "BIN": 123, "DOITT_ID": 456,
            "GROUND_ELEVATION": 20, "HEIGHT_ROOF": 80,
            "GEOM_SOURCE": "Photogrammetric", "CONSTRUCTION_YEAR": 1970,
            "DEMOLITION_YEAR": 2020, "LAST_STATUS_TYPE": "Alteration",
            "LAST_EDITED_DATE": int(
                dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc).timestamp() * 1000
            ),
            "FEATURE_CODE": 2100,
        }}
        report = audit.build_historic_comparison(
            mesh, probe, historic_footprints, historic_attributes
        )
        self.assertEqual(report["matching"]["uniqueMatchedBuildingCount"], 1)
        self.assertEqual(report["photogrammetricMatches"]["sampleCount"], 1)
        self.assertEqual(report["perHistoricBuilding"][0]["deltaSourceMinusHistoricFt"], 0.0)
        self.assertEqual(report["perHistoricBuilding"][0]["lastStatusType"], "Alteration")


if __name__ == "__main__":
    unittest.main()
