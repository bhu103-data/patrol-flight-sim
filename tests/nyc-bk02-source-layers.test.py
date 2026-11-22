import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"nyc"))
from bk02_source_layers import classify_surface_layer

class BK02OfficialSurfaceLayerTests(unittest.TestCase):
    def test_mn05_and_bk02_official_surface_layer_aliases(self):
        cases={
          "Buildings::RoofTop Surface":"roof",
          "Buildings::Facade Surface":"facade",
          "Buildings::FootPrint Surface":"footprint",
          "Buildings::Surface_RoofTop":"roof",
          "Buildings::Surface_Facade":"facade",
          "Buildings::Surface_FootPrint":"footprint",
        }
        for name,expected in cases.items():
            with self.subTest(name=name):
                self.assertEqual(classify_surface_layer(name),expected)

    def test_duplicate_building_inventory_layers_are_not_double_rendered(self):
        for name in ("Buildings::Building_RoofTop",
                     "Buildings::Building_Facade",
                     "Buildings::Building_FootPrint",
                     "Buildings::RoofTop",
                     "Buildings::Facade"):
            with self.subTest(name=name):
                self.assertIsNone(classify_surface_layer(name))

if __name__=="__main__":
    unittest.main(verbosity=2)
