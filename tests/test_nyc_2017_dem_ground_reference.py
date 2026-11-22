import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from shapely.geometry import Polygon, mapping, box

from tools.nyc.nyc_2017_dem_ground_reference import (
    aggregate_feature_samples,
    fetch_dem_tile_index,
    sample_polygon_features,
    select_single_covering_tile,
    summarize_values_us_survey_feet,
    validate_range_probe,
)


class Nyc2017DemGroundReferenceTests(unittest.TestCase):
    def test_fetch_dem_tile_index_deduplicates_tile_ids(self):
        feature = {
            "type": "Feature",
            "properties": {
                "OBJECTID": 21,
                "FILENAME": "be_NYC_025.tif",
                "SIZE_": 673930486,
                "DIRECT_DL": "https://gisdata.ny.gov/elevation/DEM/NYC_TopoBathymetric2017/be_NYC_025.tif",
                "PARTIAL": "Yes",
            },
            "geometry": mapping(box(-74.01, 40.74, -73.94, 40.79)),
        }
        urls = []

        def fake_fetch(url):
            urls.append(url)
            return {"type": "FeatureCollection", "features": [feature, feature]}

        result = fetch_dem_tile_index(
            (-73.99104, 40.753539, -73.981483, 40.761460),
            fetcher=fake_fetch,
        )

        self.assertEqual(len(urls), 1)
        self.assertIn("Dem_Indexes/FeatureServer/0/query?", urls[0])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["properties"]["FILENAME"], "be_NYC_025.tif")

    def test_single_tile_must_cover_entire_roi(self):
        roi = (-73.99104, 40.753539, -73.981483, 40.761460)
        tile = {
            "properties": {"OBJECTID": 21, "FILENAME": "be_NYC_025.tif"},
            "geometry": mapping(box(-74.02, 40.72, -73.93, 40.80)),
        }
        selected = select_single_covering_tile([tile], roi)
        self.assertEqual(selected["properties"]["OBJECTID"], 21)

        incomplete = {
            "properties": {"OBJECTID": 22, "FILENAME": "partial.tif"},
            "geometry": mapping(box(-73.99, 40.755, -73.98, 40.76)),
        }
        with self.assertRaises(RuntimeError):
            select_single_covering_tile([incomplete], roi)

    def test_range_probe_requires_http_206_and_expected_file_size(self):
        result = validate_range_probe(206, "bytes 0-0/673930486", 673930486)
        self.assertTrue(result["rangeSupported"])
        with self.assertRaises(RuntimeError):
            validate_range_probe(200, None, 673930486)
        with self.assertRaises(RuntimeError):
            validate_range_probe(206, "bytes 0-0/10", 673930486)

    def test_us_survey_foot_conversion_and_value_summary(self):
        result = summarize_values_us_survey_feet(np.asarray([10.0, 10.0, 10.0]))
        self.assertEqual(result["pixelCount"], 3)
        self.assertAlmostEqual(result["p50MetersNavd88"], 3.048006, places=5)
        self.assertAlmostEqual(result["maxMetersNavd88"], 3.048006, places=5)

    def test_sample_polygon_features_from_one_foot_dem(self):
        with MemoryFile() as memory_file:
            with memory_file.open(
                driver="GTiff",
                height=100,
                width=100,
                count=1,
                dtype="float32",
                crs="EPSG:2263",
                transform=from_origin(1000000, 200000, 1, 1),
                nodata=-9999,
            ) as writer:
                writer.write(np.full((100, 100), 10.0, dtype="float32"), 1)
            with memory_file.open() as dataset:
                to_wgs84 = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)
                projected = Polygon([
                    (1000010, 199990),
                    (1000020, 199990),
                    (1000020, 199980),
                    (1000010, 199980),
                    (1000010, 199990),
                ])
                geographic = Polygon([
                    to_wgs84.transform(x, y) for x, y in projected.exterior.coords
                ])
                feature = {
                    "type": "Feature",
                    "properties": {"OBJECTID": 99, "SOURCE_ID": 199, "SUB_FEATURE_CODE": 350000},
                    "geometry": mapping(geographic),
                }
                records = sample_polygon_features(dataset, [feature], 350000)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["objectId"], 99)
        self.assertGreater(records[0]["elevation"]["pixelCount"], 0)
        self.assertAlmostEqual(records[0]["elevation"]["p50MetersNavd88"], 3.048006, places=4)

    def test_aggregate_feature_samples_counts_missing_polygons(self):
        records = [
            {"elevation": {"pixelCount": 5, "p50MetersNavd88": 3.0, "minMetersNavd88": 2.0, "maxMetersNavd88": 4.0}},
            {"elevation": {"pixelCount": 0}},
        ]
        summary = aggregate_feature_samples(records)
        self.assertEqual(summary["featureCount"], 2)
        self.assertEqual(summary["sampledFeatureCount"], 1)
        self.assertEqual(summary["noDataFeatureCount"], 1)
        self.assertEqual(summary["validPixelSamples"], 5)


if __name__ == "__main__":
    unittest.main()
