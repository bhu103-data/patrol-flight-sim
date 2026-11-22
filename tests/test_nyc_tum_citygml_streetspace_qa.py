import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.nyc.tum_citygml_streetspace_qa import (
    geometry_positions,
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

    def test_summarize_geojson_reports_features_vertices_and_bounds(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.geojson"
            path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {}, "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[-73.99, 40.75, 0], [-73.98, 40.75, 0], [-73.98, 40.76, 0]]],
                    }},
                    {"type": "Feature", "properties": {}, "geometry": {
                        "type": "Point", "coordinates": [-73.97, 40.77, 0],
                    }},
                ],
            }), encoding="utf-8")
            summary = summarize_geojson(path)
        self.assertEqual(summary["featureCount"], 2)
        self.assertEqual(summary["vertexCount"], 4)
        self.assertEqual(summary["geometryTypes"], {"Polygon": 1, "Point": 1})
        self.assertEqual(summary["boundsWgs84"], [-73.99, 40.75, -73.97, 40.77])

    def test_safe_extract_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive_path = root / "bad.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "unsafe")
            with self.assertRaises(ValueError):
                safe_extract_zip(archive_path, root / "extract")


if (import_name := __name__) == "__main__":
    unittest.main()
