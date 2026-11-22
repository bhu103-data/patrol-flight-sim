#!/usr/bin/env python3
"""Audit cached mesh topology on authentic NYC DCP MN05 roof Breps.

This is source-QA only. Cached Rhino face meshes are tessellations, not exact
NURBS trims; this script never labels them surveyed 2026 geometry or imports
them into the PATROL runtime.
"""
from __future__ import annotations
import hashlib
import json
import math
import pathlib
import sys

import rhino3dm

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from official_mn05_projection import mn05_stateplane_to_metric
from mn05_mesh_topology import analyze_mesh

FOLDER = pathlib.Path("artifacts/nyc-official-mn05")
SOURCE = FOLDER / "mn05-source.3dm"
STATS = FOLDER / "mn05-probe.json"
OUT = FOLDER / "times-square-cached-roof-mesh.json"
EXPECTED_ZIP_SHA = "71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"
EXPECTED_3DM_SHA = "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
BOUNDS_METRES = (-315.0, -175.0, 380.0, 530.0)
MAX_ROOF_SAMPLE_OBJECTS = 48
MAX_FACE_SAMPLES = 96
MAX_EXPORTED_MESHES = 12
MAX_EXPORT_VERTICES = 512
MAX_EXPORT_FACES = 512
BREP_BOUNDS_TOLERANCE_FT = 0.5


def bbox_values(box):
    return [
        float(box.Min.X), float(box.Min.Y), float(box.Min.Z),
        float(box.Max.X), float(box.Max.Y), float(box.Max.Z),
    ]


def bbox_intersects_xy(box, bounds):
    minx, miny, maxx, maxy = bounds
    return not (
        box.Max.X < minx or box.Min.X > maxx
        or box.Max.Y < miny or box.Min.Y > maxy
    )


def mesh_arrays(mesh):
    vertices = []
    for index in range(len(mesh.Vertices)):
        point = mesh.Vertices[index]
        vertices.append([float(point.X), float(point.Y), float(point.Z)])
    faces = []
    for index in range(len(mesh.Faces)):
        face = mesh.Faces[index]
        a, b, c, d = int(face.A), int(face.B), int(face.C), int(face.D)
        faces.append([a, b, c] if d == c else [a, b, c, d])
    return vertices, faces


def bbox_contains_vertices(bbox, vertices, tolerance):
    worst = 0.0
    for x, y, z in vertices:
        outside = max(
            bbox.Min.X - x, x - bbox.Max.X,
            bbox.Min.Y - y, y - bbox.Max.Y,
            bbox.Min.Z - z, z - bbox.Max.Z,
            0.0,
        )
        worst = max(worst, outside)
    return worst <= tolerance, worst


def inspect():
    report = {
        "source": "NYC DCP official 2014 Manhattan MN05 Rhino 3DM",
        "sourceDataset": "NYC 3D Model by Community District (u5j4-zxpn)",
        "sourceDocumentation": "https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf",
        "sourceEPSG": "EPSG:2263 NAD83 New York Long Island East, US survey feet",
        "sourceVintage": "2014 aerial survey; municipal metadata last updated 2018",
        "role": "CACHED_ROOF_MESH_TOPOLOGY_QA_ONLY",
        "rootMetreBounds": BOUNDS_METRES,
        "sourceVerticalDatumVerified": False,
        "sourceVerticalUnitVerified": False,
        "sourceFidMatched": False,
        "sourceTemporalCurrent": False,
        "readyForWebGLPreview": False,
        "runtimeImportAccepted": False,
        "meshAccepted": False,
        "errors": [],
        "warnings": [],
        "faceSamples": [],
    }
    try:
        previous = json.loads(STATS.read_text())
        if previous.get("imported") is not True:
            raise ValueError("Official MN05 source probe did not pass")
        if previous.get("sha256") != EXPECTED_ZIP_SHA:
            raise ValueError("Official NYC MN05 ZIP provenance SHA changed")
        if previous.get("source3dmSha256") != EXPECTED_3DM_SHA:
            raise ValueError("Official NYC MN05 Rhino model provenance SHA changed")
        actual_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
        if actual_sha != EXPECTED_3DM_SHA:
            raise ValueError("Temporary Rhino 3DM bytes do not match pinned source SHA")

        model = rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:
            raise ValueError("Official MN05 Rhino 3DM could not be parsed")
        settings = model.Settings
        try:
            model_unit = str(settings.ModelUnitSystem)
        except Exception:
            model_unit = "unavailable"
        report["modelSettings"] = {
            "modelUnitSystem": model_unit,
            "modelAbsoluteTolerance": float(settings.ModelAbsoluteTolerance),
            "modelAngleToleranceRadians": float(settings.ModelAngleToleranceRadians),
            "note": "Rhino model units do not independently establish the source vertical datum",
        }
        layer_names = {
            index: str(layer.FullPath or layer.Name)
            for index, layer in enumerate(model.Layers)
        }
        roof_indices = {
            index for index, name in layer_names.items()
            if "RoofTop Surface" in name
        }
        if not roof_indices:
            raise ValueError("Official Buildings::RoofTop Surface layer is absent")
        report["roofLayers"] = [layer_names[index] for index in sorted(roof_indices)]

        # Resolve the metric Times Square envelope back into the official
        # source CRS, using the same tested projection as the parent pilot.
        from official_mn05_projection import metric_to_mn05_stateplane
        corners = [
            metric_to_mn05_stateplane(x, y)
            for x in (BOUNDS_METRES[0], BOUNDS_METRES[2])
            for y in (BOUNDS_METRES[1], BOUNDS_METRES[3])
        ]
        source_bounds = (
            min(point[0] for point in corners),
            min(point[1] for point in corners),
            max(point[0] for point in corners),
            max(point[1] for point in corners),
        )
        report["sourceFootBounds"] = list(source_bounds)

        candidates = []
        roof_total = 0
        roof_inside = 0
        scanned = 0
        for object_index, obj in enumerate(model.Objects):
            scanned += 1
            layer_index = obj.Attributes.LayerIndex
            if layer_index not in roof_indices:
                continue
            roof_total += 1
            geometry = obj.Geometry
            if not hasattr(geometry, "GetBoundingBox"):
                continue
            bbox = geometry.GetBoundingBox()
            if bbox is None or not bbox_intersects_xy(bbox, source_bounds):
                continue
            roof_inside += 1
            values = bbox_values(bbox)
            center_x = (values[0] + values[3]) * 0.5
            center_y = (values[1] + values[4]) * 0.5
            local_x, local_y = mn05_stateplane_to_metric(center_x, center_y)
            distance = math.hypot(local_x, local_y)
            candidates.append((distance, object_index, obj, bbox, local_x, local_y))

        candidates.sort(key=lambda item: (item[0], item[1]))
        selected = candidates[:MAX_ROOF_SAMPLE_OBJECTS]
        valid_mesh_count = 0
        invalid_mesh_count = 0
        exported_mesh_count = 0
        total_vertices = 0
        total_triangles = 0
        for distance, object_index, obj, bbox, local_x, local_y in selected:
            geometry = obj.Geometry
            object_id = str(obj.Attributes.Id)
            layer_name = layer_names.get(obj.Attributes.LayerIndex, "unknown")
            for face_index in range(len(geometry.Faces)):
                if len(report["faceSamples"]) >= MAX_FACE_SAMPLES:
                    break
                brep_face = geometry.Faces[face_index]
                mesh = brep_face.GetMesh(rhino3dm.MeshType.Any)
                sample = {
                    "sourceObjectIndex": object_index,
                    "sourceObjectId": object_id,
                    "sourceLayer": layer_name,
                    "brepFaceIndex": face_index,
                    "sourceObjectBoundsFt": bbox_values(bbox),
                    "localCenterMetres": [round(local_x, 4), round(local_y, 4)],
                    "distanceFromTimesSquareOriginMetres": round(distance, 4),
                    "meshTypeRequested": "MeshType.Any",
                    "faceOrientationIsReversed": bool(brep_face.OrientationIsReversed),
                }
                if mesh is None:
                    invalid_mesh_count += 1
                    sample["meshMetrics"] = {"valid": False, "errors": ["BrepFace.GetMesh returned null"]}
                    report["faceSamples"].append(sample)
                    continue
                vertices, faces = mesh_arrays(mesh)
                metrics = analyze_mesh(vertices, faces)
                try:
                    manifold = bool(mesh.IsManifold(True))
                except Exception as error:
                    manifold = None
                    metrics["errors"].append(f"Rhino mesh manifold check unavailable: {type(error).__name__}")
                    metrics["valid"] = False
                try:
                    mesh_closed = bool(mesh.IsClosed)
                except Exception:
                    mesh_closed = None
                bbox_ok, bbox_delta = bbox_contains_vertices(bbox, vertices, BREP_BOUNDS_TOLERANCE_FT)
                if not bbox_ok:
                    metrics["errors"].append(
                        f"cached mesh vertex exceeds source Brep bounds by {bbox_delta:.6f} ft"
                    )
                    metrics["valid"] = False
                if manifold is False:
                    metrics["errors"].append("Rhino reports cached mesh is non-manifold")
                    metrics["valid"] = False
                metrics["rhinoMeshIsManifold"] = manifold
                metrics["rhinoMeshIsClosed"] = mesh_closed
                metrics["maxVertexOutsideBrepBoundsFt"] = round(bbox_delta, 8)
                metrics["brepBoundsContainMesh"] = bbox_ok
                sample["meshMetrics"] = metrics
                sample["meshVertexCount"] = len(vertices)
                sample["meshSourceFaceCount"] = len(faces)
                if metrics["valid"]:
                    valid_mesh_count += 1
                else:
                    invalid_mesh_count += 1

                if (
                    metrics["valid"]
                    and exported_mesh_count < MAX_EXPORTED_MESHES
                    and len(vertices) <= MAX_EXPORT_VERTICES
                    and len(faces) <= MAX_EXPORT_FACES
                ):
                    local_vertices = []
                    for x, y, z in vertices:
                        east, north = mn05_stateplane_to_metric(x, y)
                        local_vertices.append([round(east, 5), round(north, 5), round(z, 5)])
                    sample["boundedPreviewMesh"] = {
                        "sourceVerticesXYZ": vertices,
                        "localXYMetresRawZ": local_vertices,
                        "sourceFaces": faces,
                        "boundaryLoopsVertexIndices": metrics["boundaryLoops"],
                        "zUnit": "unverified raw Rhino model units; do not convert or place in runtime",
                    }
                    exported_mesh_count += 1
                    total_vertices += len(vertices)
                    total_triangles += metrics["triangleCount"]
                else:
                    sample["boundedPreviewMesh"] = None
                report["faceSamples"].append(sample)
            if len(report["faceSamples"]) >= MAX_FACE_SAMPLES:
                break

        report["sourceObjectCount"] = len(model.Objects)
        report["scannedSourceObjects"] = scanned
        report["layerStats"] = {
            "roofTotal": roof_total,
            "roofInsideROI": roof_inside,
            "sampledRoofObjects": len(selected),
        }
        report["meshStats"] = {
            "faceMeshSamples": len(report["faceSamples"]),
            "validFaceMeshes": valid_mesh_count,
            "invalidFaceMeshes": invalid_mesh_count,
            "boundedPreviewMeshesExported": exported_mesh_count,
            "previewVertexCount": total_vertices,
            "previewTriangleCount": total_triangles,
            "minimumValidFaceMeshes": 12,
        }
        report["meshCandidateReady"] = (
            valid_mesh_count >= 12
            and invalid_mesh_count == 0
            and exported_mesh_count >= 12
        )
        if not report["meshCandidateReady"]:
            report["errors"].append(
                "Cached roof mesh topology did not satisfy the bounded source-preview gate"
            )
        report["nextGates"] = [
            "verify source model vertical unit and vertical datum independently",
            "match selected 2014 roof objects to 2022 OTI building FIDs and review 2014-to-2026 changes",
            "measure cached mesh chord deviation against the original Brep surfaces",
            "produce a separate opt-in WebGL preview with source attribution and matched fixed camera",
            "run collision, map-switch, first-load and native GPU p50/p95 regression before any runtime import",
        ]
    except Exception as error:
        report["errors"].append(f"{type(error).__name__}: {error}")
    finally:
        SOURCE.unlink(missing_ok=True)
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps({
            key: value for key, value in report.items() if key != "faceSamples"
        }, ensure_ascii=False, indent=2))
    if report.get("errors") or not report.get("meshCandidateReady"):
        raise SystemExit(2)


if __name__ == "__main__":
    inspect()
