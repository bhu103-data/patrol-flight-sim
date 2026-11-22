"""Offline geometry/source scope contract for NPS full ZIP metadata audit."""
import importlib.util
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "alaska"))
spec = importlib.util.spec_from_file_location(
    "alaska_nps_raster_metadata", ROOT / "tools/alaska/audit_nps_sawyer_raster_metadata.py"
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class NpsSurveyMetadataSafetyTests(unittest.TestCase):
    def test_download_guard_budget(self):
        self.assertLessEqual(audit.MAX_SOURCE_BYTES, 350 * 1024 * 1024)
        self.assertLessEqual(audit.MAX_ENTRIES, 500)
        self.assertEqual(audit.AOI_GAME, (-133.265, 57.851, -133.135, 57.923))

    def test_wgs84_bbox_overlap(self):
        self.assertTrue(audit.overlap(audit.AOI_GAME, audit.AOI_NOAA))
        self.assertTrue(audit.overlap(
            (-133.2, 57.9, -133.19, 57.91), audit.AOI_GAME
        ))
        self.assertFalse(audit.overlap(
            (-132.9, 57.9, -132.8, 57.91), audit.AOI_GAME
        ))

    def test_never_accept_identical_glacier_name_without_geographic_match(self):
        self.assertFalse(audit.has_study_bbox_candidate([]))
        self.assertFalse(audit.has_study_bbox_candidate([
            {"name": "Sawyer.2015.170.2p5m.tif",
             "intersects_noaa_study_bbox": False}
        ]))
        self.assertFalse(audit.has_study_bbox_candidate([
            {"name": "SouthSawyer.2015.170.2p5m.tif",
             "intersects_noaa_study_bbox": None}
        ]))
        self.assertTrue(audit.has_study_bbox_candidate([
            {"name": "Sawyer.2003.120.2p5m.tif",
             "intersects_noaa_study_bbox": False},
            {"name": "Sawyer.2020.215.2p5m.tif",
             "intersects_noaa_study_bbox": True},
        ]))
        self.assertFalse(audit.overlap(
            (-158.342865, 56.6082, -135.094727, 68.43901),
            audit.AOI_NOAA
        ))

    def test_only_expected_nps_endpoints_are_imported(self):
        self.assertEqual(audit.SOURCES, (
            ("Sawyer", "744015"), ("SouthSawyer", "744024")
        ))


if __name__ == "__main__":
    unittest.main()
