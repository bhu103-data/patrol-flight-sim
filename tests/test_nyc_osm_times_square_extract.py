import unittest
from shapely.geometry import Polygon, box
from shapely import to_wkb
from pyproj import Transformer
from scripts.nyc_osm_times_square_extract import normalize_tags,row_to_element

class OSMExtractTests(unittest.TestCase):
    def test_normalize_tags_accepts_dict_and_pairs(self):
        self.assertEqual(normalize_tags({"building":"yes","height":20}),{"building":"yes","height":"20"})
        self.assertEqual(normalize_tags([("roof:shape","flat")]),{"roof:shape":"flat"})
    def test_way_inside_bbox_keeps_tags_and_ring(self):
        t=Transformer.from_crs("EPSG:2263","EPSG:4326",always_xy=True)
        row={"osm_type":"way","osm_id":77,"tags":{"building":"commercial","building:levels":"12"},
             "geometry":to_wkb(Polygon([(1,1),(9,1),(9,9),(1,9),(1,1)]))}
        item=row_to_element(row,box(0,0,10,10),t)
        self.assertEqual(item["id"],77);self.assertEqual(item["tags"]["building:levels"],"12")
        self.assertEqual(len(item["geometry"]),5)
    def test_outside_and_nonbuilding_are_rejected(self):
        t=Transformer.from_crs("EPSG:2263","EPSG:4326",always_xy=True)
        row={"osm_type":"way","osm_id":78,"tags":{"building":"yes"},
             "geometry":to_wkb(Polygon([(20,20),(30,20),(30,30),(20,30),(20,20)]))}
        self.assertIsNone(row_to_element(row,box(0,0,10,10),t))
        row["tags"]={"highway":"residential"}
        self.assertIsNone(row_to_element(row,box(0,0,50,50),t))
    def test_building_part_only_is_preserved(self):
        t=Transformer.from_crs("EPSG:2263","EPSG:4326",always_xy=True)
        row={"osm_type":"way","osm_id":79,"tags":{"building:part":"yes"},
             "geometry":to_wkb(Polygon([(1,1),(9,1),(9,9),(1,9),(1,1)]))}
        self.assertEqual(row_to_element(row,box(0,0,10,10),t)["tags"]["building:part"],"yes")
if __name__=="__main__": unittest.main()
