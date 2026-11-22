import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.nyc.tum_citygml_streetspace_qa import (
    compare_tum_to_oti_2022,
    current_cscl_comparison,
    fetch_oti_roadbed_features,
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


    def test_stale_physical_id_uses_nearer_same_name_current_segment(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            roadbed_path = root / "roadbed.geojson"
            cscl_path = root / "current-cscl.geojson"

            roadbed_path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "name": "WEST 46 STREET",
                        "physical_id": "1849",
                        "traffic_direction": "W",
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-73.9861, 40.7550],
                            [-73.9859, 40.7550],
                            [-73.9859, 40.7552],
                            [-73.9861, 40.7552],
                            [-73.9861, 40.7550],
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
                            "stname_label": "W 46 ST",
                            "trafdir": "FT",
                            "physicalid": "1849",
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-73.9845, 40.7551],
                                [-73.9843, 40.7551],
                            ],
                        },
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "stname_label": "W 46 ST",
                            "trafdir": "FT",
                            "physicalid": "1848",
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-73.9862, 40.7551],
                                [-73.9858, 40.7551],
                            ],
                        },
                    },
                ],
            }), encoding="utf-8")

            result = current_cscl_comparison(
                roadbed_path,
                cscl_path,
                root / "out",
                (-73.9900, 40.7530, -73.9800, 40.7600),
                0.005,
            )

        match = result["tumRoadbedToCurrentCscl"]["matches"][0]
        self.assertEqual(match["matchMethod"], "normalized_street_name_after_physical_id_spatial_mismatch")
        self.assertTrue(match["physicalIdExistsInCurrentCscl"])
        self.assertGreater(match["physicalIdCandidateDistanceM"], 10.0)
        self.assertTrue(match["physicalIdCandidateSpatialMismatch"])
        self.assertLess(match["centroidToCurrentCsclDistanceM"], 10.0)
        self.assertEqual(result["tumRoadbedToCurrentCscl"]["physicalIdSpatialMismatchCount"], 1)



    def test_fetch_oti_roadbed_features_deduplicates_source_object_ids(self):
        feature = {
            "type": "Feature",
            "properties": {"OBJECTID": 123, "SUB_FEATURE_CODE": 350000},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-73.99, 40.75],
                    [-73.98, 40.75],
                    [-73.98, 40.76],
                    [-73.99, 40.76],
                    [-73.99, 40.75],
                ]],
            },
        }
        urls = []

        def fake_fetch(url):
            urls.append(url)
            return {
                "type": "FeatureCollection",
                "features": [feature, feature],
            }

        result = fetch_oti_roadbed_features(
            (-73.991, 40.749, -73.979, 40.761),
            fetcher=fake_fetch,
        )

        self.assertEqual(len(urls), 1)
        self.assertIn("Roadbed_2022/FeatureServer/20/query?", urls[0])
        self.assertEqual([item["properties"]["OBJECTID"] for item in result], [123])

    def test_tum_oti_crosswalk_compares_roadbeds_and_intersections_in_metres(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            roadbed_path = root / "tum-roadbed.geojson"
            intersection_path = root / "tum-intersection.geojson"
            roadbed_polygon = [[
                [-73.990, 40.750],
                [-73.988, 40.750],
                [-73.988, 40.752],
                [-73.990, 40.752],
                [-73.990, 40.750],
            ]]
            intersection_polygon = [[
                [-73.987, 40.750],
                [-73.985, 40.750],
                [-73.985, 40.752],
                [-73.987, 40.752],
                [-73.987, 40.750],
            ]]

            roadbed_path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {"gml_id": "tum-road-1"},
                    "geometry": {"type": "Polygon", "coordinates": roadbed_polygon},
                }],
            }), encoding="utf-8")
            intersection_path.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {"gml_id": "tum-intersection-1"},
                    "geometry": {"type": "Polygon", "coordinates": intersection_polygon},
                }],
            }), encoding="utf-8")

            oti_features = [
                {
                    "type": "Feature",
                    "properties": {"OBJECTID": 501, "SUB_FEATURE_CODE": 350000},
                    "geometry": {"type": "Polygon", "coordinates": roadbed_polygon},
                },
                {
                    "type": "Feature",
                    "properties": {"OBJECTID": 601, "SUB_FEATURE_CODE": 350010},
                    "geometry": {"type": "Polygon", "coordinates": intersection_polygon},
                },
                {
                    "type": "Feature",
                    "properties": {"OBJECTID": 701, "SUB_FEATURE_CODE": 350020},
                    "geometry": {"type": "Polygon", "coordinates": roadbed_polygon},
                },
            ]

            result = compare_tum_to_oti_2022(
                roadbed_path,
                intersection_path,
                oti_features,
                (-73.995, 40.745, -73.980, 40.755),
            )

        self.assertEqual(result["otiSubtypeCounts"]["roadbed350000"], 1)
        self.assertEqual(result["otiSubtypeCounts"]["intersection350010"], 1)
        self.assertAlmostEqual(result["roadbed"]["intersectionOverUnionPercent"], 100.0, places=3)
        self.assertAlmostEqual(result["intersection"]["intersectionOverUnionPercent"], 100.0, places=3)
        self.assertEqual(result["roadbed"]["worstCentroidMatches"][0]["tumGmlId"], "tum-road-1")
        self.assertFalse(result["runtimeImportAllowed"])



if __name__ == "__main__":
    unittest.main()
