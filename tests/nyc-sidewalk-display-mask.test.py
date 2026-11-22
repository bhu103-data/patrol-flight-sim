import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"nyc"))
from derive_sidewalk_display_mask import derive_sidewalk_display,strict_polygon

FRAME = {
    "originLonLat": [-73.9864883, 40.756421],
    "bboxLonLat": [-73.987,40.756,-73.986,40.757],
    "scaleMetresPerGameUnit": None
}


def city(buildings=None):
    return {
        "assetRole": "GEOREFERENCED_SOURCE_QA_ONLY_NOT_IN_GAME",
        "projection": copy.deepcopy(FRAME),
        "buildings": buildings if buildings is not None else [
            {"fid":300973,"outline":[[4,4],[6,4],[6,6],[4,6]]}
        ]
    }


def sidewalk(poly=None, extra=None):
    polys=[poly or [[[0,0],[12,0],[12,12],[0,12],[0,0]]]]
    if extra:
        polys.append(extra)
    return {
      "schema":"patrol-nyc-oti-sidewalk-curb-metre-source-v1",
      "projection":copy.deepcopy(FRAME),
      "sources":{"sidewalk":"official NYC OTI sidewalk dataset 2022"},
      "sidewalks":[{"objectId":9867,"sourceId":200,
        "subtype":380000,"status":"2022 mapped","polygons":polys}]
    }


class DisplayMaskTests(unittest.TestCase):
    def test_overlap_removed_from_display_but_original_source_is_byte_intact(self):
        c=city()
        original=sidewalk()
        original_serialized=json.dumps(original,sort_keys=True)
        display,report=derive_sidewalk_display(c,original)
        self.assertEqual(json.dumps(original,sort_keys=True),original_serialized)
        self.assertEqual(display["assetRole"],
                         "VISUAL_ONLY_SOURCE_PRESERVING_DERIVATION")
        self.assertAlmostEqual(report["areas"]["sourceClippedPartSumSquareMetres"],144)
        self.assertAlmostEqual(report["areas"]["maskedPartSumSquareMetres"],4)
        self.assertAlmostEqual(report["areas"]["displayPartSumSquareMetres"],140)
        self.assertEqual(report["areas"]["displayUnionBuildingOverlapSquareMetres"],0)
        self.assertEqual(report["affectedOfficialObjects"][0]["buildingFid"],300973)
        self.assertEqual(report["affectedOfficialObjects"][0]["sidewalkObjectId"],9867)
        polys=display["sidewalks"][0]["polygons"]
        self.assertTrue(any(len(x)>1 for x in polys),"Building subtraction is a polygon hole")

    def test_source_hole_not_falsely_filled(self):
        original=sidewalk(poly=[
            [[0,0],[12,0],[12,12],[0,12],[0,0]],
            [[3,3],[3,7],[7,7],[7,3],[3,3]]
        ])
        display,report=derive_sidewalk_display(city(),original)
        self.assertEqual(report["areas"]["maskedPartSumSquareMetres"],0)
        self.assertAlmostEqual(report["areas"]["sourceClippedPartSumSquareMetres"],128)
        self.assertAlmostEqual(report["areas"]["displayPartSumSquareMetres"],128)
        self.assertTrue(display["sidewalks"][0]["polygons"][0][1])

    def test_disjoint_objects_are_not_modified(self):
        c=city(buildings=[{"fid":500,"outline":[[20,20],[25,20],[25,25],[20,25]]}])
        display,report=derive_sidewalk_display(c,sidewalk())
        self.assertEqual(report["areas"]["maskedPartSumSquareMetres"],0)
        self.assertEqual(report["counts"]["conflictRecords"],0)
        self.assertAlmostEqual(report["areas"]["displayPartSumSquareMetres"],144)

    def test_crs_and_source_integrity_fail_closed(self):
        c,edge=city(),sidewalk()
        edge["projection"]["originLonLat"]=[-73.9,40.8]
        with self.assertRaisesRegex(ValueError,"Mixed source geographic"):
            derive_sidewalk_display(c,edge)
        edge=sidewalk()
        c["projection"]["scaleMetresPerGameUnit"]=.11
        with self.assertRaisesRegex(ValueError,"Compressed PATROL"):
            derive_sidewalk_display(c,edge)
        edge=sidewalk()
        edge["schema"]="fake-user-authored-pavement"
        with self.assertRaisesRegex(ValueError,"Not authentic"):
            derive_sidewalk_display(city(),edge)

    def test_invalid_topology_refuses_automatic_geometry_fixes(self):
        with self.assertRaisesRegex(ValueError,"Invalid source polygon"):
            strict_polygon([[[0,0],[10,10],[10,0],[0,10],[0,0]]],"bowtie")

if __name__=="__main__":
    unittest.main(verbosity=2)
