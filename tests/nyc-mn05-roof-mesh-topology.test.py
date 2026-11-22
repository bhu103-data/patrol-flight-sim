#!/usr/bin/env python3
"""Independent topology and source-loop cross-check for the pinned MN05 roof artifact."""
from __future__ import annotations
import collections
import json
import pathlib
import unittest

from mn05_mesh_topology import analyze_mesh

ROOT = pathlib.Path("artifacts/nyc-official-mn05")
MESH_PATH = ROOT / "times-square-original-roof-mesh.json"
ROI_PATH = ROOT / "times-square-roof-source-roi.json"
OUT_PATH = ROOT / "times-square-roof-mesh-topology.json"
EXPECTED_SHA = "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
EXPECTED_LOOP_DISTRIBUTION = {1: 1341, 2: 55, 3: 5, 4: 1, 5: 1}
BREP_BOUNDS_TOLERANCE_FT = 0.05


def _vertices(patch):
    flat = patch["vertices"]
    if len(flat) % 3:
        raise ValueError("mesh vertex array is not XYZ aligned")
    return [flat[i:i + 3] for i in range(0, len(flat), 3)]


def _faces(patch):
    flat = patch["sourceTriangles"]
    if len(flat) % 3:
        raise ValueError("source triangle index array is not triplet aligned")
    return [flat[i:i + 3] for i in range(0, len(flat), 3)]


def _build_report(mesh, roi):
    patches = mesh["sourceRooftop3dMeshPatches"]
    results = {}
    loop_distribution = collections.Counter()
    invalid = []
    totals = collections.Counter()
    for patch in patches:
        key = (patch["sourceObjectUUID"], patch["brepFaceIndex"])
        result = analyze_mesh(_vertices(patch), _faces(patch))
        results[key] = result
        totals["vertices"] += result.get("vertexCount", 0)
        totals["triangles"] += result.get("triangleCount", 0)
        totals["nonManifoldEdges"] += result.get("nonManifoldEdgeCount", 0)
        totals["badBoundaryVertices"] += result.get("badBoundaryVertexCount", 0)
        totals["degenerateTriangles"] += result.get("degenerateTriangleCount", 0)
        if not result["valid"]:
            invalid.append({
                "sourceObjectUUID": key[0],
                "brepFaceIndex": key[1],
                "errors": result["errors"][:8],
            })
        loop_distribution[result.get("boundaryLoopCount", 0)] += 1

    source_brep_loops = {}
    source_brep_bounds = {}
    exact_trim_polyline_count = 0
    total_trim_records = 0
    for obj in roi.get("roofSamples", []):
        source_id = obj["sourceObjectId"]
        source_brep_bounds[source_id] = obj["rawFootBBox"]
        for face in obj.get("faces", []):
            source_brep_loops[(source_id, face["faceIndex"])] = face.get("loopCount")
            for boundary in face.get("boundaries", []):
                total_trim_records += 1
                if boundary.get("isExactSourcePolyline"):
                    exact_trim_polyline_count += 1

    matched = 0
    loop_mismatches = []
    for key, expected in source_brep_loops.items():
        result = results.get(key)
        if result is None:
            loop_mismatches.append({
                "sourceObjectUUID": key[0],
                "brepFaceIndex": key[1],
                "expectedBrepLoopCount": expected,
                "actualMeshLoopCount": None,
            })
            continue
        matched += 1
        actual = result.get("boundaryLoopCount")
        if expected != actual:
            loop_mismatches.append({
                "sourceObjectUUID": key[0],
                "brepFaceIndex": key[1],
                "expectedBrepLoopCount": expected,
                "actualMeshLoopCount": actual,
            })

    max_outside_ft = 0.0
    bbox_comparisons = 0
    bbox_mismatches = []
    for patch in patches:
        source_bbox = source_brep_bounds.get(patch["sourceObjectUUID"])
        if source_bbox is None:
            continue
        mesh_bbox = patch["sourceFootBounds"]
        outside = 0.0
        for axis in range(3):
            outside = max(
                outside,
                source_bbox[axis] - mesh_bbox[axis],
                mesh_bbox[axis + 3] - source_bbox[axis + 3],
                0.0,
            )
        bbox_comparisons += 1
        max_outside_ft = max(max_outside_ft, outside)
        if outside > BREP_BOUNDS_TOLERANCE_FT:
            bbox_mismatches.append({
                "sourceObjectUUID": patch["sourceObjectUUID"],
                "outsideFt": round(outside, 8),
            })

    distribution = {int(k): int(v) for k, v in sorted(loop_distribution.items())}
    return {
        "schema": "patrol-mn05-roof-mesh-topology-qa-v1",
        "role": "INDEPENDENT_SOURCE_TOPOLOGY_QA_ONLY_NOT_A_RUNTIME_IMPORT",
        "source3dmSHA256": mesh["source3dmSHA256"],
        "sourceCRS": mesh["sourceCRS"],
        "vertexInterpretation": "local east/north metres; raw 2014 Rhino Z feet",
        "sourceCapture": "2014 aerial survey",
        "sourceVerticalDatumVerified": False,
        "sourceFidMatched": False,
        "sourceTemporalCurrent": False,
        "runtimeImportAccepted": False,
        "sourceRooftopMeshPatches": len(patches),
        "sourceTriangles": totals["triangles"],
        "sourceVertices": totals["vertices"],
        "invalidTopologyPatches": len(invalid),
        "nonManifoldEdgeCount": totals["nonManifoldEdges"],
        "badBoundaryVertexCount": totals["badBoundaryVertices"],
        "degenerateTriangleCount": totals["degenerateTriangles"],
        "selfIntersectingBoundaryLoopCount": sum(
            1 for patch_result in results.values()
            for error in patch_result["errors"] if "self-intersects" in error
        ),
        "boundaryLoopDistribution": distribution,
        "multiLoopPatchCount": sum(count for loops, count in distribution.items() if loops > 1),
        "sampledBrepLoopCountComparisons": matched,
        "sampledBrepLoopCountMismatches": len(loop_mismatches),
        "exactTrimBoundaryRecords": total_trim_records,
        "exactTrimPolylineRecords": exact_trim_polyline_count,
        "exactTrimAreaComparisonAvailable": exact_trim_polyline_count > 0,
        "sampledBrepBoundsComparisons": bbox_comparisons,
        "maxMeshOutsideSourceBrepBoundsFt": round(max_outside_ft, 8),
        "sourceBrepBoundsToleranceFt": BREP_BOUNDS_TOLERANCE_FT,
        "bboxMismatchCount": len(bbox_mismatches),
        "invalidExamples": invalid[:12],
        "loopMismatchExamples": loop_mismatches[:12],
        "bboxMismatchExamples": bbox_mismatches[:12],
        "passed": (
            mesh["source3dmSHA256"] == EXPECTED_SHA
            and len(patches) == 1403
            and totals["triangles"] == 10669
            and totals["vertices"] == 13330
            and not invalid
            and distribution == EXPECTED_LOOP_DISTRIBUTION
            and matched == 80
            and not loop_mismatches
            and bbox_comparisons == 80
            and max_outside_ft <= BREP_BOUNDS_TOLERANCE_FT
            and not bbox_mismatches
        ),
        "limitations": [
            "Cached Rhino mesh topology is not an exact NURBS trim reconstruction.",
            "The 80 sampled Brep loop counts match, but no exact trim polyline was available for perimeter or area deviation comparison.",
            "The original 2014 vertical datum is still unverified; source Z is not aligned to 2022 roadbed or 2026 terrain.",
            "No 2014-to-2026 building change reconciliation or per-building OTI FID match is claimed.",
            "This is not the production PATROL map and does not authorize runtime import.",
        ],
        "nextGates": [
            "extract a small, source-ID-matched facade subset and compare to 2022 OTI footprints",
            "independently verify vertical units/datum and source height controls",
            "compare source mesh surfaces against exact Brep trim curves where the API exposes them",
            "review 2014-to-2026 changes and current official building/road data",
            "only then prepare a separate opt-in PATROL WebGL preview with fixed-camera and frame-budget evidence",
        ],
    }


class ActualMN05RoofTopologyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mesh = json.loads(MESH_PATH.read_text())
        roi = json.loads(ROI_PATH.read_text())
        cls.report = _build_report(mesh, roi)
        OUT_PATH.write_text(json.dumps(cls.report, ensure_ascii=False, indent=2))

    def test_exact_source_and_mesh_budget(self):
        self.assertEqual(self.report["source3dmSHA256"], EXPECTED_SHA)
        self.assertEqual(self.report["sourceRooftopMeshPatches"], 1403)
        self.assertEqual(self.report["sourceTriangles"], 10669)
        self.assertEqual(self.report["sourceVertices"], 13330)

    def test_every_cached_roof_mesh_has_valid_topology(self):
        self.assertEqual(self.report["invalidTopologyPatches"], 0)
        self.assertEqual(self.report["nonManifoldEdgeCount"], 0)
        self.assertEqual(self.report["badBoundaryVertexCount"], 0)
        self.assertEqual(self.report["degenerateTriangleCount"], 0)
        self.assertEqual(self.report["selfIntersectingBoundaryLoopCount"], 0)

    def test_boundary_loops_preserve_multiple_loops_and_holes(self):
        self.assertEqual(self.report["boundaryLoopDistribution"], EXPECTED_LOOP_DISTRIBUTION)
        self.assertEqual(self.report["multiLoopPatchCount"], 62)

    def test_sampled_mesh_loop_counts_match_original_brep(self):
        self.assertEqual(self.report["sampledBrepLoopCountComparisons"], 80)
        self.assertEqual(self.report["sampledBrepLoopCountMismatches"], 0)

    def test_mesh_bounds_match_sampled_original_brep_with_explicit_tolerance(self):
        self.assertEqual(self.report["sampledBrepBoundsComparisons"], 80)
        self.assertLessEqual(self.report["maxMeshOutsideSourceBrepBoundsFt"], BREP_BOUNDS_TOLERANCE_FT)
        self.assertEqual(self.report["bboxMismatchCount"], 0)

    def test_exact_trim_and_vertical_datum_unknowns_remain_explicit(self):
        self.assertEqual(self.report["exactTrimPolylineRecords"], 0)
        self.assertFalse(self.report["exactTrimAreaComparisonAvailable"])
        self.assertFalse(self.report["sourceVerticalDatumVerified"])
        self.assertFalse(self.report["sourceFidMatched"])
        self.assertFalse(self.report["sourceTemporalCurrent"])
        self.assertFalse(self.report["runtimeImportAccepted"])

    def test_complete_topology_report_passes(self):
        self.assertTrue(self.report["passed"], json.dumps(self.report, indent=2))


if __name__ == "__main__":
    unittest.main()
