import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "nyc"))
from audit_roadbed_centerline_conflicts import (
    analyze, focus_svg, geo_source, valid_polygon,
    FOCUS_BUILDING_FID, FOCUS_DCM_OBJECTID
)

ORIGIN = [-73.9864883, 40.756421]


def source_city(poly=None):
    return {
        "assetRole": "GEOREFERENCED_SOURCE_QA_ONLY_NOT_IN_GAME",
        "projection": {"originLonLat": ORIGIN, "scaleMetresPerGameUnit": None},
        "source": {"buildings": "official NYC building", "streets": "official DCM"},
        "buildings": [{
            "fid": FOCUS_BUILDING_FID, "outline": poly or
            [[0, 0], [10, 0], [10, 10], [0, 10]]
        }],
        "roads": [{
            "objectId": FOCUS_DCM_OBJECTID, "streetName": "Broadway",
            "lines": [[[-5, 5], [15, 5]]]
        }],
        "sourceRoadBuildingOverlapAudit": {"issues": [{
            "buildingFid": FOCUS_BUILDING_FID, "roadObjectId": FOCUS_DCM_OBJECTID,
            "overlapMetres": 10
        }]}
    }


def source_roadbeds(poly=None):
    ring = poly or [[20, -2], [30, -2], [30, 12], [20, 12], [20, -2]]
    return {
        "schema": "patrol-nyc-oti-roadbed-planimetric-2022-v1",
        "referenceImageryYear": 2022,
        "projection": {"originLonLat": ORIGIN},
        "roadbeds": [{
            "objectId": 421, "subtype": 350000,
            "polygons": [[ring]]
        }]
    }


class OfficialGeospatialAuditTests(unittest.TestCase):
    def test_centerline_crosses_building_but_real_roadbed_does_not(self):
        city, road = source_city(), source_roadbeds()
        report = analyze(city, road)
        self.assertEqual(report["counts"]["roadbedBuildingAreaOverlaps"], 0)
        self.assertEqual(report["focus"]["centerlineInsideBuildingMetres"], 10)
        self.assertEqual(report["focus"]["officialRoadbedInsideBuildingSquareMetres"], 0)
        self.assertEqual(report["focus"]["nearestOfficialRoadbedEdgeMetres"], 10)
        self.assertEqual(report["focus"]["classification"],
                         "centerline_only_no_roadbed_overlap")
        svg = focus_svg(city, road, report)
        self.assertIn('FID 981369', svg)
        self.assertIn('fill="#b34956"', svg)

    def test_real_roadbed_overlap_is_not_silently_ignored(self):
        report = analyze(source_city(), source_roadbeds([
            [8, 4], [12, 4], [12, 6], [8, 6], [8, 4]
        ]))
        self.assertEqual(report["counts"]["roadbedBuildingAreaOverlaps"], 1)
        self.assertEqual(report["focus"]["officialRoadbedInsideBuildingSquareMetres"], 4)
        self.assertEqual(report["focus"]["classification"], "REVIEW_REQUIRED")

    def test_polygon_hole_excludes_inner_building(self):
        road = source_roadbeds()
        # A roadbed outer ring surrounds the small test building, but its
        # existing interior hole reserves the entire building.
        road["roadbeds"][0]["polygons"] = [[
            [[-10, -10], [20, -10], [20, 20], [-10, 20], [-10, -10]],
            [[-1, -1], [-1, 11], [11, 11], [11, -1], [-1, -1]]
        ]]
        report = analyze(source_city(), road)
        self.assertEqual(report["counts"]["roadbedBuildingAreaOverlaps"], 0)

    def test_incompatible_coordinate_source_is_hard_failure(self):
        c, r = source_city(), source_roadbeds()
        r["projection"]["originLonLat"] = [-73.9, 40.7]
        with self.assertRaisesRegex(ValueError, "CRS/origin mismatch"):
            analyze(c, r)
        c["projection"]["scaleMetresPerGameUnit"] = .319
        r["projection"]["originLonLat"] = ORIGIN
        with self.assertRaisesRegex(ValueError, "Compressed PATROL"):
            analyze(c, r)

    def test_invalid_topology_is_never_repaired_without_review(self):
        with self.assertRaisesRegex(ValueError, "Invalid source"):
            valid_polygon([[0, 0], [10, 10], [0, 10], [10, 0]],
                          label="bowtie")


if __name__ == "__main__":
    unittest.main(verbosity=2)
