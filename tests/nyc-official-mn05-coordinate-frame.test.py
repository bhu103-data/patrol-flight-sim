#!/usr/bin/env python3
"""Regress real Times Square horizontal geographic transform in metres."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools" / "nyc"))
from official_mn05_projection import (
    mn05_stateplane_to_metric, metric_to_mn05_stateplane,
    relative_roof_metres, US_SURVEY_FOOT_IN_METRES,
)

class MunicipalMN05MetreFrameTest(unittest.TestCase):
    def test_real_one_times_origin_2263_in_survey_feet(self):
        # Independent EPSG:2263 projected WGS84 origin from PROJ.
        x, y = 987993.364636053, 214861.55356842946
        east, north = mn05_stateplane_to_metric(x, y)
        self.assertLess(abs(east), 0.00001)
        self.assertLess(abs(north), 0.00001)
        rx, ry = metric_to_mn05_stateplane(east, north)
        self.assertLess(math.hypot(rx-x, ry-y), 0.0001)

    def test_real_city_source_100_us_feet_not_100_metres(self):
        x, y = 987993.364636053, 214861.55356842946
        start = mn05_stateplane_to_metric(x, y)
        east = mn05_stateplane_to_metric(x+100, y)
        north = mn05_stateplane_to_metric(x, y+100)
        self.assertTrue(30.3 < math.hypot(east[0]-start[0],east[1]-start[1]) < 30.7)
        self.assertTrue(30.3 < math.hypot(north[0]-start[0],north[1]-start[1]) < 30.7)
        self.assertAlmostEqual(US_SURVEY_FOOT_IN_METRES, 1200/3937, places=12)

    def test_nyc_mn05_xy_roundtrip_in_actual_times_square_area(self):
        for x,z in [(-250,-150),(0,0),(360,480),(10,200)]:
            east,north = metric_to_mn05_stateplane(x,z)
            a,b = mn05_stateplane_to_metric(east,north)
            self.assertLess(math.hypot(x-a,z-b),0.0001)

    def test_vertical_height_rejected_until_real_unit_and_base_are_verified(self):
        with self.assertRaisesRegex(ValueError, "vertical unit/datum"):
            relative_roof_metres(340,10)
        self.assertAlmostEqual(relative_roof_metres(340,10,
            source_vertical_unit_verified=True),330*(1200/3937),places=9)
        with self.assertRaises(ValueError):
            relative_roof_metres(10,340,source_vertical_unit_verified=True)
        with self.assertRaises(ValueError):
            relative_roof_metres(math.nan,10,source_vertical_unit_verified=True)

    def test_infinite_and_outside_nyc_raw_3dm_footprint_points_fail(self):
        for x,y in [(float('nan'),0),(0,0),(1e9,1e9)]:
            with self.assertRaises(ValueError):
                mn05_stateplane_to_metric(x,y)

if __name__ == "__main__":
    unittest.main()
