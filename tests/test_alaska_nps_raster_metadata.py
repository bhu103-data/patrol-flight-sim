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

    def test_true_pixel_mask_inside_wgs84_study_bounds(self):
        import numpy as np
        from rasterio.io import MemoryFile
        from rasterio.transform import from_bounds

        profile = {
            "driver": "GTiff", "height": 32, "width": 32,
            "count": 1, "dtype": "float32", "crs": "EPSG:4326",
            "transform": from_bounds(-133.4, 57.7, -132.9, 58.1, 32, 32),
            "nodata": -9999.0,
        }
        grid = np.full((32, 32), -9999.0, dtype="float32")
        grid[10, 10] = 245.5  # Actual pixel centre is inside NOAA study AOI.
        grid[0, 0] = 200.0   # This point is outside and must be excluded.
        with MemoryFile() as mem:
            with mem.open(**profile) as writer:
                writer.write(grid, 1)
            with mem.open() as raster:
                result = audit.sample_valid_study_pixels(
                    raster, audit.AOI_NOAA, max_axis=32)
                self.assertEqual(result["valid_inside_bbox"], 1)
                self.assertEqual(result["status"],
                                 "POSITIVE_VALID_PIXEL_SAMPLES_IN_NOAA_BBOX")

        grid.fill(-9999.0)
        with MemoryFile() as mem:
            with mem.open(**profile) as writer:
                writer.write(grid, 1)
            with mem.open() as raster:
                result = audit.sample_valid_study_pixels(
                    raster, audit.AOI_NOAA, max_axis=32)
                self.assertEqual(result["valid_inside_bbox"], 0)
                self.assertEqual(result["status"],
                                 "NO_VALID_PIXELS_IN_SAMPLED_GRID")

    def test_only_expected_nps_endpoints_are_imported(self):
        self.assertEqual(audit.SOURCES, (
            ("Sawyer", "744015"), ("SouthSawyer", "744024")
        ))


if __name__ == "__main__":
    unittest.main()
