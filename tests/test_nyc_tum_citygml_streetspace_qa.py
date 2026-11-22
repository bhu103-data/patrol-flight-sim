import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.nyc.tum_citygml_streetspace_qa import (
    geometry_positions,
    normalize_direction_code,
    normalize_name,
    safe_extract_zip,
    summarize_geojson,
)


class TumCityGmlStreetspaceQaTests(unittest.TestCase):
    def test_recursive_coordinate_count_for_multipolygon(self):
        coordinates = [
            [
                [[-73.99, 40.75, 0], [-73.98, 40.75, 0], [-73.98, 40.76, 0]],
                [[-73.985, 40.752, 0], [-73.984, 40.752, 0], [-73.984, 40.753, 0]],
            ],
            [
                [[-73.97, 40.75, 0], [-73.96, 40.75, 0], [-73.96, 40.76, 0]],
            ],
        ]
        self.assertEqual(len(list(geometry_positions(coordinates))), 9)

    def test_summarize_geojson_reports_validity_vertices_and_bounds(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.geojson"
            path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {"area_m2": 1.0}, "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[-73.99, 40.75, 0], [-73.98, 40.75, 0], [-73.98, 40.76, 0], [-73.99, 40.75, 0]]],
                    }},
                    {"type": "Feature", "properties": {"area_m2": 1.0}, "geometry": {
                        "type": "Point", "coordinates": [-73.97, 40.77, 0],
                    }},
                ],
            }), encoding="utf-8")
            summary = summarize_geojson(path, "area_m2")
        self.assertEqual(summary["featureCount"], 2)
        self.assertEqual(summary["vertexCount"], 5)
        self.assertEqual(summary["geometryValidCount"], 2)
        self.assertEqual(summary["geometryInvalidCount"], 0)
        self.assertEqual(summary["geometryTypes"], {"Polygon": 1, "Point": 1})
        self.assertEqual(summary["boundsWgs84"], [-73.99, 40.75, -73.97, 40.77])
        self.assertIsNotNone(summary["areaAttributeComparison"])

    def test_safe_extract_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive_path = root / "bad.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "unsafe")
            with self.assertRaises(ValueError):
                safe_extract_zip(archive_path, root / "extract")

    def test_direction_codes_translate_from_lion_to_cscl(self):
        self.assertEqual(normalize_direction_code("W"), "FT")
        self.assertEqual(normalize_direction_code("A"), "TF")
        self.assertEqual(normalize_direction_code("T"), "TW")
        self.assertEqual(normalize_direction_code("P"), "NV")
        self.assertIsNone(normalize_direction_code("unknown"))

    def test_street_name_normalization_is_case_and_space_insensitive(self):
        self.assertEqual(normalize_name("  7   Avenue "), "7 AVENUE")
        self.assertEqual(normalize_name("West 41 Street"), "WEST 41 STREET")


if __name__ == "__main__":
    unittest.main()
