import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.nyc.tum_citygml_streetspace_qa import (
    current_cscl_comparison,
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
        self.assertEqual(normalize_name("W 44 ST"), "WEST 44 STREET")
        self.assertEqual(normalize_name("7 AVE"), "7 AVENUE")
        self.assertEqual(normalize_name("AVE OF THE AMERICAS"), "AVENUE OF THE AMERICAS")


    def test_current_cscl_comparison_exposes_exact_roi_feature_count(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            roadbed_path = root / "roadbed.geojson"
            cscl_path = root / "current-cscl.geojson"
            output_dir = root / "out"

            roadbed_path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "name": "BROADWAY",
                        "physical_id": "4216",
                        "traffic_direction": "A",
                        "number_total_lanes": 2,
                        "street_width_meter": 10.0,
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-73.9885, 40.7540],
                            [-73.9875, 40.7540],
                            [-73.9875, 40.7550],
                            [-73.9885, 40.7550],
                            [-73.9885, 40.7540],
                        ]],
                    },
                }],
            }), encoding="utf-8")
            cscl_path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "stname_label": "BROADWAY",
                            "trafdir": "TF",
                            "physicalid": "4216",
                            "number_total_lanes": "2",
                            "streetwidth": "32.8084",
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-73.9890, 40.7545],
                                [-73.9870, 40.7545],
                            ],
                        },
                    },
                    {
                        "type": "Feature",
                        "properties": {"stname_label": "WEST 44 ST"},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-73.9910, 40.7545],
                                [-73.9905, 40.7545],
                            ],
                        },
                    },
                ],
            }), encoding="utf-8")

            result = current_cscl_comparison(
                roadbed_path,
                cscl_path,
                output_dir,
                (-73.9900, 40.7530, -73.9800, 40.7600),
                0.005,
            )

        self.assertEqual(result["featureCountInMatchBuffer"], 2)
        self.assertEqual(result["featureCountIntersectingExactRoi"], 1)
        self.assertNotIn("featureCount", result)


if __name__ == "__main__":
    unittest.main()
