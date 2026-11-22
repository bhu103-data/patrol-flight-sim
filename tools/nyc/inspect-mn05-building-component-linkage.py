#!/usr/bin/env python3
"""Audit whether official 2014 MN05 building surfaces retain Rhino object links.

Read-only source inspection of FootPrint Surface, RoofTop Surface and Facade
Surface. Report object groups, names and user strings before attempting any
spatial join. No raw 3DM or geometry is committed or uploaded.
"""
from __future__ import annotations

import collections
import hashlib
import importlib.util
import json
import math
import pathlib
import sys

import rhino3dm

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from official_mn05_projection import mn05_stateplane_to_metric

MESH_HELPER_PATH = HERE / "inspect-mn05-roof-source-roi.py"
MESH_HELPER_SPEC = importlib.util.spec_from_file_location("mn05_roof_source_mesh_helper", MESH_HELPER_PATH)
MESH_HELPER = importlib.util.module_from_spec(MESH_HELPER_SPEC)
MESH_HELPER_SPEC.loader.exec_module(MESH_HELPER)
original_cached_face_mesh = MESH_HELPER.original_cached_face_mesh

ROOT = pathlib.Path("artifacts/nyc-official-mn05")
SOURCE = ROOT / "mn05-source.3dm"
PROBE = ROOT / "mn05-probe.json"
OUTPUT = ROOT / "mn05-building-component-linkage.json"
FOOTPRINT_MESH_OUTPUT = ROOT / "times-square-original-footprint-mesh.json"
EXPECTED_ZIP_SHA = "71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"
EXPECTED_MODEL_SHA = "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
ROI_METRES = (-315.0, -175.0, 380.0, 530.0)
SAMPLE_PER_ROLE = 12
MAX_USER_STRING_PAIRS = 8


def classify_layer(full_path: str) -> str | None:
    name = str(full_path or "").lower()
    if "footprint surface" in name:
        return "footprint"
    if "rooftop surface" in name:
        return "roof"
    if "facade surface" in name:
        return "facade"
    return None


def safe_group_ids(attributes) -> list[int]:
    getter = getattr(attributes, "GetGroupList", None)
    if not callable(getter):
        return []
    try:
        values = getter() or []
        return sorted({int(value) for value in values})
    except Exception:
        return []


def safe_user_strings(attributes) -> list[list[str]]:
    getter = getattr(attributes, "GetUserStrings", None)
    if not callable(getter):
        return []
    try:
        values = getter()
    except Exception:
        return []
    if values is None:
        return []
    if isinstance(values, dict):
        pairs = [[str(k), str(v)] for k, v in values.items()]
    elif isinstance(values, (list, tuple)):
        if values and all(isinstance(item, (list, tuple)) and len(item) == 2
                          for item in values):
            pairs = [[str(item[0]), str(item[1])] for item in values]
        elif len(values) % 2 == 0:
            pairs = [[str(values[i]), str(values[i + 1])]
                     for i in range(0, len(values), 2)]
        else:
            pairs = [[str(i), str(value)] for i, value in enumerate(values)]
    else:
        pairs = [["raw", str(values)]]
    return [[key[:100], value[:180]]
            for key, value in pairs[:MAX_USER_STRING_PAIRS]]


def summarize_group_roles(rows: list[dict]) -> dict:
    group_roles: dict[int, set[str]] = collections.defaultdict(set)
    group_counts: dict[int, collections.Counter] = collections.defaultdict(collections.Counter)
    for row in rows:
        for group_id in row["groupIds"]:
            group_roles[group_id].add(row["role"])
            group_counts[group_id][row["role"]] += 1
    all_three = {"footprint", "roof", "facade"}
    return {
        "groupsWithAnyTargetLayer": len(group_roles),
        "groupsWithFootprintAndFacade": sum(
            {"footprint", "facade"}.issubset(roles)
            for roles in group_roles.values()),
        "groupsWithFootprintAndRoof": sum(
            {"footprint", "roof"}.issubset(roles)
            for roles in group_roles.values()),
        "groupsWithRoofAndFacade": sum(
            {"roof", "facade"}.issubset(roles)
            for roles in group_roles.values()),
        "groupsWithAllThreeComponents": sum(
            all_three.issubset(roles) for roles in group_roles.values()),
        "groupSamples": [
            {"groupId": group_id,
             "roles": sorted(group_roles[group_id]),
             "objectCounts": dict(group_counts[group_id])}
            for group_id in sorted(group_roles)[:40]
        ],
    }


def _bbox_intersects_roi(bbox) -> tuple[bool, list[float]]:
    a, b = bbox.Min, bbox.Max
    corners = [
        mn05_stateplane_to_metric(x, y)
        for x in (a.X, b.X) for y in (a.Y, b.Y)
    ]
    min_e = min(p[0] for p in corners)
    max_e = max(p[0] for p in corners)
    min_n = min(p[1] for p in corners)
    max_n = max(p[1] for p in corners)
    west, south, east, north = ROI_METRES
    intersects = not (max_e < west or min_e > east or
                      max_n < south or min_n > north)
    return intersects, [round(min_e, 3), round(min_n, 3),
                        round(max_e, 3), round(max_n, 3)]


def inspect() -> None:
    report = {
        "schema": "nyc-mn05-2014-building-component-linkage-v1",
        "role": "READ_ONLY_SOURCE_LINKAGE_AUDIT_NOT_GAME_GEOMETRY",
        "source": "NYC DCP 2014 Manhattan Community District 05 Rhino 3DM",
        "sourceZipSha256": EXPECTED_ZIP_SHA,
        "source3dmSha256": EXPECTED_MODEL_SHA,
        "sourceVintage": "2014 aerial survey / 2018 dataset; not 2026 facade reality",
        "sourceCrs": "EPSG:2263 NY Long Island NAD83 US survey feet",
        "viewerCrs": "WGS84 local east/north metres",
        "roiMetres": ROI_METRES,
        "verticalDatumEvidence": (
            "2014 NYC planimetric capture rules document NAVD88; direct numeric "
            "mapping of this Rhino 3DM Z to NAVD88 still requires cross-check"),
        "raw3dmZMappingVerified": False,
        "source3dmShaVerified": False,
        "layers": {},
        "attributeSamples": {"footprint": [], "roof": [], "facade": []},
        "groupLinkage": {},
        "sourceLinkageAccepted": False,
        "errors": [],
    }
    footprint_mesh_patches = []
    footprint_mesh_triangles = 0
    footprint_mesh_vertices = 0
    footprint_mesh_degenerate = 0
    try:
        previous = json.loads(PROBE.read_text())
        if previous.get("imported") is not True:
            raise ValueError("Official MN05 source probe did not pass")
        if previous.get("sha256") != EXPECTED_ZIP_SHA:
            raise ValueError("Official MN05 ZIP provenance SHA mismatch")
        if previous.get("source3dmSha256") != EXPECTED_MODEL_SHA:
            raise ValueError("Official MN05 Rhino model provenance SHA mismatch")
        actual_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
        if actual_sha != EXPECTED_MODEL_SHA:
            raise ValueError("Original 2014 Rhino model SHA changed")
        report["source3dmShaVerified"] = True

        model = rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:
            raise ValueError("Official MN05 Rhino model could not be opened")
        report["rhino3dmVersion"] = str(getattr(rhino3dm, "__version__", "unknown"))
        layer_names = {
            i: str(layer.FullPath or layer.Name)
            for i, layer in enumerate(model.Layers)
        }
        target_layers = {
            i: role for i, name in layer_names.items()
            if (role := classify_layer(name)) is not None
        }
        if set(target_layers.values()) != {"footprint", "roof", "facade"}:
            raise ValueError("One or more official building surface layers are absent")
        report["layerNames"] = {
            role: sorted(layer_names[i] for i, found in target_layers.items()
                         if found == role)
            for role in ("footprint", "roof", "facade")
        }

        counters = {
            role: collections.Counter()
            for role in ("footprint", "roof", "facade")
        }
        rows = []
        for object_index, obj in enumerate(model.Objects):
            role = target_layers.get(obj.Attributes.LayerIndex)
            if role is None:
                continue
            counters[role]["totalObjects"] += 1
            geom = obj.Geometry
            if not hasattr(geom, "GetBoundingBox"):
                counters[role]["missingBoundingBox"] += 1
                continue
            bbox = geom.GetBoundingBox()
            if bbox is None:
                counters[role]["missingBoundingBox"] += 1
                continue
            inside, bbox_metres = _bbox_intersects_roi(bbox)
            if not inside:
                continue
            counters[role]["roiObjects"] += 1
            attrs = obj.Attributes
            groups = safe_group_ids(attrs)
            user_strings = safe_user_strings(attrs)
            name = str(getattr(attrs, "Name", "") or "")
            url = str(getattr(attrs, "Url", "") or "")
            if groups:
                counters[role]["roiObjectsWithGroups"] += 1
            if name:
                counters[role]["roiObjectsWithNames"] += 1
            if user_strings:
                counters[role]["roiObjectsWithUserStrings"] += 1
            if hasattr(geom, "Faces"):
                counters[role]["roiBreps"] += 1
                if role == "footprint":
                    for face_index, face in enumerate(geom.Faces):
                        cached = face.GetMesh(rhino3dm.MeshType.Any)
                        patch = original_cached_face_mesh(
                            cached, bbox, str(attrs.Id), face_index)
                        if patch is None:
                            counters[role]["footprintCachedMeshMissing"] += 1
                            continue
                        patch["sourceObjectIndex"] = object_index
                        footprint_mesh_patches.append(patch)
                        footprint_mesh_triangles += patch["triangleCount"]
                        footprint_mesh_vertices += patch["vertexCount"]
                        footprint_mesh_degenerate += patch["degenerateSourceTrianglesRejected"]
            rows.append({"role": role, "groupIds": groups})
            if len(report["attributeSamples"][role]) < SAMPLE_PER_ROLE:
                report["attributeSamples"][role].append({
                    "sourceObjectIndex": object_index,
                    "sourceObjectUUID": str(attrs.Id),
                    "name": name[:160],
                    "url": url[:200],
                    "groupIds": groups,
                    "userStrings": user_strings,
                    "bboxLocalMetres": bbox_metres,
                    "rawZFeet": [round(float(bbox.Min.Z), 3),
                                 round(float(bbox.Max.Z), 3)],
                    "faceCount": len(geom.Faces) if hasattr(geom, "Faces") else None,
                })

        for role in ("footprint", "roof", "facade"):
            for field in (
                "totalObjects", "roiObjects", "roiBreps",
                "roiObjectsWithGroups", "roiObjectsWithNames",
                "roiObjectsWithUserStrings", "missingBoundingBox",
            ):
                counters[role].setdefault(field, 0)
        report["layers"] = {
            role: dict(counters[role])
            for role in ("footprint", "roof", "facade")
        }
        report["footprintMeshPatches"] = len(footprint_mesh_patches)
        report["footprintMeshTriangles"] = footprint_mesh_triangles
        report["footprintMeshVertices"] = footprint_mesh_vertices
        report["footprintMeshDegenerateTrianglesRejected"] = footprint_mesh_degenerate
        report["footprintMeshAccepted"] = len(footprint_mesh_patches) > 100 and footprint_mesh_triangles > 100
        report["groupLinkage"] = summarize_group_roles(rows)
        report["sourceLinkageAccepted"] = all(
            counters[role]["roiObjects"] > 100
            for role in ("footprint", "roof", "facade")
        )
        report["roiObjectsScanned"] = len(rows)
        report["interpretation"] = (
            "If groups or stable object attributes link the three component layers, "
            "use only those source-native links. If not, use a separate conservative "
            "spatial join through original 2014 FootPrint Surface polygons; do not "
            "assign facades to nearby 2022 FIDs by guess."
        )
    except Exception as exc:
        report["errors"].append(f"{type(exc).__name__}: {exc}")
    finally:
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        FOOTPRINT_MESH_OUTPUT.write_text(json.dumps({
            "schema": "nyc-mn05-2014-footprint-surface-mesh-v1",
            "source3dmSha256": EXPECTED_MODEL_SHA,
            "sourceVintage": "2014",
            "roiMetres": ROI_METRES,
            "counts": {
                "sourceFootprintMeshPatches": len(footprint_mesh_patches),
                "sourceFootprintTriangles": footprint_mesh_triangles,
                "sourceFootprintVertices": footprint_mesh_vertices,
                "degenerateSourceTrianglesRejected": footprint_mesh_degenerate,
            },
            "sourceFootprintMeshPatches": footprint_mesh_patches,
        }, ensure_ascii=False, separators=(",", ":")))
        print(json.dumps({k: v for k, v in report.items()
                          if k != "attributeSamples"}, ensure_ascii=False, indent=2))
    if report["errors"] or not report["sourceLinkageAccepted"] or not report.get("footprintMeshAccepted"):
        raise SystemExit(1)


if __name__ == "__main__":
    inspect()
