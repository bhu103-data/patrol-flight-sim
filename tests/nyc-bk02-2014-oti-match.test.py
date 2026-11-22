#!/usr/bin/env python3
"""Acceptance tests for spatial 2014 BK02 -> 2022 OTI candidate matches."""
import json,math,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPORT=pathlib.Path("artifacts/nyc-official-bk02/dumbo-2014-oti-2022-match.json")
class BK02OtiMatchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.data=json.loads(REPORT.read_text())
    def test_exact_source_versions_and_historical_caveat(self):
        d=self.data
        self.assertEqual(d["schema"],"patrol-nyc-dumbo-bk02-2014-to-oti-2022-footprint-match-v1")
        self.assertEqual(d["sourceVintage"],2014)
        self.assertEqual(d["currentFootprintVintage"],2022)
        self.assertEqual(d["source3dmSha256"],
          "c22a7e7225425e01b5f50e5d68f6dc75b93a9d05c8a4ae566f1c1d40ec981493")
        self.assertIn("absolute vertical datum unverified",d["sourceZUnits"])
        self.assertIn("not absolute elevation",d["heightComparison"])
        self.assertIn("No automatic import",d["releaseRule"])
    def test_all_48_current_oti_buildings_have_auditable_match_rows(self):
        d=self.data;rows=d["matches"]
        self.assertEqual(d["otiBuildings"],48)
        self.assertEqual(len(rows),48)
        self.assertGreater(d["sourceFootprintObjects"],20)
        self.assertGreater(d["candidatePairs"],0)
        self.assertGreater(d["uniqueOneToOneAssignments"],0)
        self.assertEqual(sum(d["matchCounts"].values()),48)
    def test_one_to_one_assignments_are_unique_and_scores_bounded(self):
        rows=self.data["matches"]
        assigned=[r["source2014ObjectUUID"] for r in rows if r["assignedOneToOne"]]
        self.assertEqual(len(assigned),len(set(assigned)))
        for row in rows:
            if row["footprintIoU"] is not None:
                self.assertTrue(0<=row["footprintIoU"]<=1)
                self.assertTrue(math.isfinite(row["centroidDistanceM"]))
                self.assertGreater(row["sourceToOtiAreaRatio"],0)
            if row["matchStatus"]=="high-confidence-footprint-match":
                self.assertTrue(row["assignedOneToOne"],
                  "High-confidence candidates must have an exclusive source-object assignment")
                self.assertGreaterEqual(row["footprintIoU"],.85)
                self.assertLessEqual(row["centroidDistanceM"],1.0)
            if not row["assignedOneToOne"]:
                self.assertNotEqual(row["matchStatus"],"high-confidence-footprint-match")
    def test_relative_height_comparison_is_not_promoted_to_absolute_elevation(self):
        for row in self.data["matches"]:
            evidence=row["sourceHeightEvidence"]
            if evidence is None:
                self.assertEqual(row["heightComparisonStatus"],"not-comparable")
                self.assertIsNone(row["heightDeltaFeet"])
                continue
            if evidence["sourceRelativeHeightRhinoFeet"] is not None:
                self.assertTrue(math.isfinite(evidence["sourceRelativeHeightRhinoFeet"]))
                self.assertIn(row["heightComparisonStatus"],
                  ("within-2m","within-5m","height-difference-over-5m"))
            else:
                self.assertEqual(row["heightComparisonStatus"],"not-comparable")
if __name__=="__main__":unittest.main()
