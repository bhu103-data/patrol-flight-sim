#!/usr/bin/env python3
"""Inspect the official 2014 NYC DCP Manhattan CD5 3D model.

This is a source audit only. It does not modify PATROL assets or infer current
facade appearance, elevations, traffic access or collision from the 2014 model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from collections import Counter, defaultdict
from pathlib import Path

import rhino3dm
from pyproj import Transformer

BBOX_WGS84 = (-73.9900, 40.7552, -73.9822, 40.7610)
CRS = "EPSG:2263"  # NAD83 / New York Long Island (US survey feet)
TARGET_LAYERS = {
    "Building_FootPrint",
    "Building_RoofTop",
    "Building_Facade",
    "Surface_Foot Print",
    "Surface_Roof Top",
    "Surface_Facade",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def projected_bounds(bbox):
    west, south, east, north = bbox
    transform = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
    corners = [
        transform.transform(west, south),
        transform.transform(west, north),
        transform.transform(east, south),
        transform.transform(east, north),
    ]
    xs = [p[0] for p in corners]
    ys = [p[1] for p in corners]
    return [min(xs), min(ys), max(xs), max(ys)]


def intersects(a, b):
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def layer_name(model, index):
    try:
        layer = model.Layers[index]
        return getattr(layer, "FullPath", None) or layer.Name
    except Exception:
        return "layer-index-" + str(index)


def user_value(attributes, key):
    try:
        value = attributes.GetUserString(key)
        return str(value) if value is not None else None
    except Exception:
        return None


def geom_bbox(geometry):
    box = geometry.GetBoundingBox()
    lo, hi = box.Min, box.Max
    values = [float(lo.X), float(lo.Y), float(lo.Z),
              float(hi.X), float(hi.Y), float(hi.Z)]
    if not all(math.isfinite(v) for v in values):
        raise ValueError("non-finite Rhino bounding box")
    return values


def inspect(model_path: Path, report_path: Path):
    model = rhino3dm.File3dm.Read(str(model_path))
    if model is None:
        raise RuntimeError("rhino3dm could not read the official MN05 model")

    query_bounds = projected_bounds(BBOX_WGS84)
    layer_counts = Counter()
    layer_inside_counts = Counter()
    geometry_counts = Counter()
    geometry_inside_counts = Counter()
    layer_geometry = defaultdict(Counter)
    user_string_counts = Counter()
    bin_values = set()
    doitt_values = set()
    source_values = set()
    inside_objects = []
    total_mesh_vertices = 0
    total_mesh_faces = 0
    total_brep_faces = 0
    total_curve_objects = 0
    total_objects = 0
    bbox_failures = 0
    max_objects = 2_000_000

    for obj in model.Objects:
        total_objects += 1
        if total_objects > max_objects:
            raise RuntimeError("MN05 model exceeded the 2,000,000 object safety guard")
        geometry = obj.Geometry
        attributes = obj.Attributes
        layer = layer_name(model, attributes.LayerIndex)
        geometry_type = type(geometry).__name__
        layer_counts[layer] += 1
        geometry_counts[geometry_type] += 1
        layer_geometry[layer][geometry_type] += 1

        if geometry_type == "Mesh":
            total_mesh_vertices += geometry.Vertices.Count
            total_mesh_faces += geometry.Faces.Count
        elif geometry_type == "Brep":
            total_brep_faces += geometry.Faces.Count
        elif geometry_type in ("Curve", "PolylineCurve", "NurbsCurve"):
            total_curve_objects += 1

        try:
            bounds = geom_bbox(geometry)
        except Exception:
            bbox_failures += 1
            continue
        xy_bounds = [bounds[0], bounds[1], bounds[3], bounds[4]]
        if not intersects(xy_bounds, query_bounds):
            continue

        layer_inside_counts[layer] += 1
        geometry_inside_counts[geometry_type] += 1
        keys = {
            "BIN": user_value(attributes, "BIN"),
            "DOITT_ID": user_value(attributes, "DOITT_ID"),
            "SOURCE_ID": user_value(attributes, "SOURCE_ID"),
        }
        for key, value in keys.items():
            if value:
                user_string_counts[key] += 1
                if key == "BIN":
                    bin_values.add(value)
                elif key == "DOITT_ID":
                    doitt_values.add(value)
                else:
                    source_values.add(value)

        if len(inside_objects) < 80:
            inside_objects.append({
                "layer": layer,
                "geometryType": geometry_type,
                "name": getattr(attributes, "Name", None),
                "bboxStatePlaneFtUS": [round(v, 3) for v in bounds],
                "userStrings": keys,
                "meshVertices": geometry.Vertices.Count if geometry_type == "Mesh" else None,
                "meshFaces": geometry.Faces.Count if geometry_type == "Mesh" else None,
                "brepFaces": geometry.Faces.Count if geometry_type == "Brep" else None,
            })

    layers = []
    for layer in model.Layers:
        layers.append({
            "index": layer.Index,
            "name": getattr(layer, "FullPath", None) or layer.Name,
            "visible": layer.IsVisible,
            "locked": layer.IsLocked,
        })

    target_layer_report = {}
    for name in sorted(TARGET_LAYERS):
        target_layer_report[name] = {
            "allObjects": layer_counts.get(name, 0),
            "insideTimesSquareBbox": layer_inside_counts.get(name, 0),
            "geometryTypes": dict(layer_geometry.get(name, {})),
        }

    report = {
        "schema": "patrol-nyc-dcp-mn05-3dmodel-audit-v1",
        "purpose": "source inspection only; no runtime asset is produced",
        "source": {
            "publisher": "NYC Department of City Planning / NYC Open Data",
            "dataset": "NYC 3D Model by Community District",
            "file": "nyc_3dmodel_mn05.zip (Manhattan Community District 5)",
            "sourceYear": 2014,
            "url": "https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip",
            "metadata": "https://github.com/CityOfNewYork/nyc-geo-metadata/blob/master/Metadata/Metadata_3DBuildingModel.md",
            "terms": "https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje",
            "attribution": "NYC Department of City Planning, NYC 3D Model (2014); modifications/extraction must be identified.",
        },
        "files": {
            "modelPath": str(model_path),
            "modelBytes": model_path.stat().st_size,
            "modelSha256": sha256(model_path),
        },
        "coordinateSystem": {
            "crs": CRS,
            "modelUnitSystem": str(model.Settings.ModelUnitSystem),
            "queryBboxWgs84": list(BBOX_WGS84),
            "queryBboxStatePlaneFtUS": [round(v, 3) for v in query_bounds],
            "note": "BBOX is transformed from the same bounded Times Square tile used by the 2022 OTI surface pilot. Confirm Rhino model units/CRS before any mesh transform.",
        },
        "inventory": {
            "totalObjects": total_objects,
            "bboxFailures": bbox_failures,
            "objectsIntersectingTimesSquareBbox": sum(layer_inside_counts.values()),
            "geometryTypes": dict(geometry_counts),
            "geometryTypesInsideTimesSquareBbox": dict(geometry_inside_counts),
            "meshVerticesAllModel": total_mesh_vertices,
            "meshFacesAllModel": total_mesh_faces,
            "brepFacesAllModel": total_brep_faces,
            "curveObjectsAllModel": total_curve_objects,
            "userStringPresenceInsideBbox": dict(user_string_counts),
            "distinctBINInsideBbox": len(bin_values),
            "distinctDOITTIDInsideBbox": len(doitt_values),
            "distinctSOURCEIDInsideBbox": len(source_values),
        },
        "targetBuildingLayers": target_layer_report,
        "layers": layers,
        "sampleObjectsInsideTimesSquareBbox": inside_objects,
        "recommendation": (
            "candidate-for-roof-and-facade-geometry-review"
            if layer_inside_counts.get("Surface_Facade", 0) > 0
            and layer_inside_counts.get("Surface_Roof Top", 0) > 0
            else "do-not-integrate-until-source-layer-coverage-is-proven"
        ),
        "limitations": [
            "2014 one-time capture, not a current 2026 survey.",
            "The source is a hybrid LOD1/LOD2 city model; only a limited set of iconic buildings receive LOD2 detail.",
            "A facade layer is not proof of photographic textures, windows or storefront detail.",
            "Do not infer traffic access, collision, curb height or surveyed vertical datum from this model.",
            "No source geometry is merged into PATROL by this audit.",
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "report": str(report_path),
        "modelBytes": report["files"]["modelBytes"],
        "totalObjects": total_objects,
        "insideTimesSquare": report["inventory"]["objectsIntersectingTimesSquareBbox"],
        "geometryTypesInside": report["inventory"]["geometryTypesInsideTimesSquareBbox"],
        "targetBuildingLayers": target_layer_report,
        "recommendation": report["recommendation"],
    }, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    inspect(args.model, args.report)


if __name__ == "__main__":
    main()
