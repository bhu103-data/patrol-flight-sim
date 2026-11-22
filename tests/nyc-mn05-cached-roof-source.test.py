import sys
import unittest
from pathlib import Path
from shapely.geometry import Polygon

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"nyc"))
from inspect_mn05_support import face_from_cached_mesh,choose_matched_roof

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

def original_tri():
    return [[0,0,210],[10,0,210],[0,10,210]]

class CachedMunicipalRoofTests(unittest.TestCase):
    def test_only_original_saved_mesh_faces_are_used(self):
        tri=original_tri()
        quad=[[0,0,210],[10,0,210],[10,10,210],[0,10,210]]
        result=face_from_cached_mesh(Mesh([
            (False,tri+[tri[-1]]),(True,quad)]),lambda x,y:(x,y))
        self.assertEqual(len(result),3)
        self.assertEqual(result[0],tri)
        self.assertEqual(result[1],[quad[0],quad[1],quad[2]])
        self.assertEqual(result[2],[quad[0],quad[2],quad[3]])

    def test_2014_source_matches_only_a_true_2022_footprint(self):
        source={"sourceUuid":"real-2014-uuid","triangles":[original_tri()]}
        buildings=[{"fid":123,"heightMetres":31.5,
                    "geometry":Polygon([(0,0),(12,0),(12,12),(0,12)])},
                   {"fid":456,"heightMetres":50,
                    "geometry":Polygon([(100,100),(130,100),(130,130),(100,130)])}]
        matched=choose_matched_roof(source,buildings)
        self.assertEqual(matched["matchedFid"],123)
        self.assertEqual(matched["visualRoofHeightMetres"],31.5)
        self.assertEqual(matched["matchAreaRatio"],1)
        # No invented assignment to an adjacent unrelated building.
        self.assertIsNone(choose_matched_roof(source,buildings[1:]))
        self.assertIsNone(choose_matched_roof(source,[{"fid":111,"heightMetres":33,
            "geometry":Polygon([(9,9),(20,9),(20,20),(9,20)])}]))

    def test_bad_source_faces_fail_closed(self):
        broken=Mesh([(False,[[0,0,0],[float("nan"),0,0],[0,10,0],[0,10,0]])])
        with self.assertRaisesRegex(ValueError,"invalid XYZ"):
            face_from_cached_mesh(broken,lambda x,y:(x,y))
        self.assertEqual(face_from_cached_mesh(
            Mesh([(False,[[0,0,0],[1,0,0],[2,0,0],[2,0,0]])]),
            lambda x,y:(x,y)),[])

    def test_overlapping_fake_saved_triangles_are_not_accepted(self):
        source={"sourceUuid":"untrusted","triangles":[original_tri(),original_tri()]}
        footprint=[{"fid":123,"heightMetres":31,
            "geometry":Polygon([(0,0),(12,0),(12,12),(0,12)])}]
        self.assertIsNone(choose_matched_roof(source,footprint))

if __name__=="__main__":
    unittest.main(verbosity=2)
