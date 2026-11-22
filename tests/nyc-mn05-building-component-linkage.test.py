#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import pathlib
import unittest

SCRIPT_PATH = pathlib.Path("tools/nyc/inspect-mn05-building-component-linkage.py")
SPEC = importlib.util.spec_from_file_location("mn05_component_linkage", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
classify_layer = MODULE.classify_layer
safe_group_ids = MODULE.safe_group_ids
safe_user_strings = MODULE.safe_user_strings
summarize_group_roles = MODULE.summarize_group_roles


class FakeAttributes:
    def __init__(self, groups=None, user_strings=None):
        self._groups = groups
        self._user_strings = user_strings

    def GetGroupList(self):
        if self._groups is None:
            raise RuntimeError("no group API")
        return self._groups

    def GetUserStrings(self):
        if self._user_strings is None:
            return []
        return self._user_strings


class BuildingComponentLinkageUnitTests(unittest.TestCase):
    def test_classifies_only_official_surface_layers(self):
        self.assertEqual(classify_layer("Buildings::FootPrint Surface"), "footprint")
        self.assertEqual(classify_layer("Buildings::RoofTop Surface"), "roof")
        self.assertEqual(classify_layer("Buildings::Facade Surface"), "facade")
        self.assertIsNone(classify_layer("Linework::Roadbed"))

    def test_group_ids_are_sorted_unique_and_fail_closed(self):
        self.assertEqual(safe_group_ids(FakeAttributes([4, 2, 4])), [2, 4])
        self.assertEqual(safe_group_ids(FakeAttributes(None)), [])

    def test_user_strings_are_bounded_and_normalized(self):
        self.assertEqual(
            safe_user_strings(FakeAttributes(user_strings={"BIN": "123", "source": "DCP"})),
            [["BIN", "123"], ["source", "DCP"]],
        )
        self.assertEqual(
            safe_user_strings(FakeAttributes(user_strings=["BIN", "123", "FID", "456"])),
            [["BIN", "123"], ["FID", "456"]],
        )

    def test_group_summary_identifies_native_three_layer_links(self):
        rows = [
            {"role": "footprint", "groupIds": [1, 2]},
            {"role": "roof", "groupIds": [1, 3]},
            {"role": "facade", "groupIds": [1, 2, 3]},
        ]
        summary = summarize_group_roles(rows)
        self.assertEqual(summary["groupsWithAllThreeComponents"], 1)
        self.assertEqual(summary["groupsWithFootprintAndFacade"], 2)
        self.assertEqual(summary["groupsWithFootprintAndRoof"], 1)
        self.assertEqual(summary["groupsWithRoofAndFacade"], 2)

    def test_source_linkage_artifact_is_provenance_pinned(self):
        path = pathlib.Path("artifacts/nyc-official-mn05/mn05-building-component-linkage.json")
        self.assertTrue(path.is_file(), "source linkage report was not generated")
        import json
        report = json.loads(path.read_text())
        self.assertTrue(report["source3dmShaVerified"])
        self.assertTrue(report["sourceLinkageAccepted"])
        self.assertEqual(
            report["source3dmSha256"],
            "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57",
        )
        self.assertEqual(
            set(report["layers"]),
            {"footprint", "roof", "facade"},
        )
        for layer in report["layers"].values():
            self.assertGreater(layer["roiObjects"], 100)
        self.assertIn("groupsWithAllThreeComponents", report["groupLinkage"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
