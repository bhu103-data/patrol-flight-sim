#!/usr/bin/env python3
import math
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"tools"/"nyc"))
from official_bk02_projection import (
    DUMBO_ORIGIN,M_PER_DEG_LON,M_PER_DEG_LAT,US_SURVEY_FOOT_IN_METRES,
    stateplane_to_dumbo_metres,dumbo_metres_to_stateplane,source_bounds_from_oti)

class BK02ProjectionTest(unittest.TestCase):
    def test_local_origin_roundtrip(self):
        x,y=dumbo_metres_to_stateplane(0,0)
        east,south=stateplane_to_dumbo_metres(x,y)
        self.assertLess(math.hypot(east,south),.0001)
        self.assertAlmostEqual(US_SURVEY_FOOT_IN_METRES,1200/3937,places=12)

    def test_stateplane_100_us_survey_foot_axis_steps(self):
        x,y=dumbo_metres_to_stateplane(0,0)
        east=stateplane_to_dumbo_metres(x+100,y)
        north=stateplane_to_dumbo_metres(x,y+100)
        self.assertTrue(30.47<math.hypot(*east)<30.49)
        self.assertTrue(30.47<math.hypot(*north)<30.49)
        self.assertGreater(east[0],0)
        self.assertLess(north[1],0)

    def test_metre_roundtrip_over_complete_48_building_aoi(self):
        for e,s in [(-250,-260),(0,0),(240,260),(180,-210),(-120,180)]:
            x,y=dumbo_metres_to_stateplane(e,s)
            a,b=stateplane_to_dumbo_metres(x,y)
            self.assertLess(math.hypot(e-a,s-b),.001)

    def test_48_oti_source_footprints_define_bounded_roi(self):
        root=pathlib.Path(__file__).resolve().parents[1]
        bounds=source_bounds_from_oti(root/"assets/nyc/dumbo-oti-metric-48.json")
        self.assertEqual(len(bounds),4)
        self.assertTrue(360<bounds[2]-bounds[0]<420)
        self.assertTrue(480<bounds[3]-bounds[1]<580)

    def test_invalid_source_coordinates_fail_closed(self):
        for p in [(math.nan,0),(0,math.inf),(1e9,1e9)]:
            with self.assertRaises(ValueError):stateplane_to_dumbo_metres(*p)

if __name__=="__main__":unittest.main()
