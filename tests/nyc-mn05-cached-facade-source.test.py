import sys
import unittest
from pathlib import Path
from shapely.geometry import Polygon

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"nyc"))
from inspect_mn05_facade_support import (
    face_from_cached_facade_mesh,facade_xy_projection,match_facade_to_building,
    wgs84_to_local_metres,require_feet_model_unit,anchored_source_height_metres)
from official_mn05_projection import ORIGIN_WGS84

class Point:
    def __init__(self,x,y,z):
        self.X=x;self.Y=y;self.Z=z

class Face:
    def __init__(self,quad):
        self.IsQuad=quad

class Faces:
    def __init__(self,rows):
        self.rows=rows
    def __len__(self):
        return len(self.rows)
    def __getitem__(self,i):
        return Face(self.rows[i][0])
    def GetFaceVertices(self,i):
        return (True,*(Point(*p) for p in self.rows[i][1]))

class Mesh:
    def __init__(self,rows):
        self.Faces=Faces(rows)

def building(fid,ring):
    return {"fid":fid,"geometry":Polygon(ring)}

class CachedFacadeTests(unittest.TestCase):
    def test_2022_wgs84_footprints_use_wgs84_transform_not_rhino_stateplane(self):
        self.assertEqual(wgs84_to_local_metres(*ORIGIN_WGS84),(0.0,0.0))
        with self.assertRaisesRegex(ValueError,"outside NYC"):
            wgs84_to_local_metres(-100.0,40.75)

    def test_original_rhino_unit_system_must_be_verified_as_feet(self):
        class Settings:
            ModelUnitSystem=type("Unit",(),{"name":"Feet"})()
        self.assertEqual(require_feet_model_unit(Settings()),"Feet")
        Settings.ModelUnitSystem=type("Unit",(),{"name":"Meters"})()
        with self.assertRaisesRegex(ValueError,"must be Feet"):
            require_feet_model_unit(Settings())

    def test_relative_source_z_is_anchored_to_2022_height_without_absolute_datum_claim(self):
        self.assertAlmostEqual(anchored_source_height_metres(1000,1000,50,
            source_vertical_unit_verified=True),50.35,5)
        self.assertAlmostEqual(anchored_source_height_metres(900,1000,50,
            source_vertical_unit_verified=True),19.87,2)
        with self.assertRaisesRegex(ValueError,"not verified"):
            anchored_source_height_metres(900,1000,50)
        with self.assertRaisesRegex(ValueError,"outside current building height"):
            anchored_source_height_metres(1006,1000,50,
                source_vertical_unit_verified=True)

    def test_2022_wgs84_footprints_use_wgs84_transform_not_rhino_stateplane(self):
        self.assertEqual(wgs84_to_local_metres(*ORIGIN_WGS84),(0.0,0.0))
        with self.assertRaisesRegex(ValueError,"outside NYC"):
            wgs84_to_local_metres(-100.0,40.75)

    def test_vertical_saved_triangle_is_not_dropped_as_zero_xy_area(self):
        vertical=[[0,0,0],[10,0,0],[10,0,20]]
        result=face_from_cached_facade_mesh(
            Mesh([(False,vertical+[vertical[-1]])]),lambda x,y:(x,y))
        self.assertEqual(len(result),1)
        self.assertEqual(result[0],vertical)
        projected=facade_xy_projection(result)
        self.assertAlmostEqual(projected.length,10)
        self.assertEqual(projected.geom_type,"LineString")

    def test_saved_quad_is_split_on_original_diagonal_without_reconstruction(self):
        quad=[[0,0,0],[10,0,0],[10,0,20],[0,0,20]]
        result=face_from_cached_facade_mesh(
            Mesh([(True,quad)]),lambda x,y:(x,y))
        self.assertEqual(len(result),2)
        self.assertEqual(result[0],[quad[0],quad[1],quad[2]])
        self.assertEqual(result[1],[quad[0],quad[2],quad[3]])

    def test_facade_matches_one_real_footprint_boundary(self):
        wall=[[0,0,0],[10,0,0],[10,0,20]]
        target=building(11,[(0,0),(10,0),(10,10),(0,10)])
        other=building(12,[(20,0),(30,0),(30,10),(20,10)])
        match=match_facade_to_building([wall],[target,other])
        self.assertIsNotNone(match)
        self.assertEqual(match["matchedFid"],11)
        self.assertGreaterEqual(match["matchCoverage"],.99)
        self.assertAlmostEqual(match["boundaryDistanceMetres"],0)

    def test_shared_party_wall_is_ambiguous_and_not_assigned(self):
        wall=[[10,0,0],[10,10,0],[10,10,20]]
        a=building(11,[(0,0),(10,0),(10,10),(0,10)])
        b=building(12,[(10,0),(20,0),(20,10),(10,10)])
        self.assertIsNone(match_facade_to_building([wall],[a,b]))

    def test_invalid_or_degenerate_faces_fail_closed(self):
        broken=Mesh([(False,[[0,0,0],[float("nan"),0,0],[0,0,20],[0,0,20]])])
        with self.assertRaisesRegex(ValueError,"invalid XYZ"):
            face_from_cached_facade_mesh(broken,lambda x,y:(x,y))
        flat=Mesh([(False,[[0,0,0],[1,0,0],[2,0,0],[2,0,0]])])
        self.assertEqual(face_from_cached_facade_mesh(flat,lambda x,y:(x,y)),[])
        self.assertIsNone(match_facade_to_building([],[
            building(1,[(0,0),(10,0),(10,10),(0,10)])]))

if __name__=="__main__":
    unittest.main(verbosity=2)
