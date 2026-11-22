#!/usr/bin/env python3
"""Extract only source-verified historic NYC marked median polygons in the
measured Times Square neighborhood, never synthetic outlines/traffic lanes.

Input: verified TUM derived NYC CityGML LoD2 road-space sample, EPSG:32118.
Output: georeferenced *QA-only* polygons clipped to local east/north metres.
2015–2017 vintage, terrain baseline 0; NOT 2026 surveyed lane markings.
"""
from __future__ import annotations
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon, box, MultiPolygon

FOLDER = Path("artifacts/nyc-tum-lod2-markings")
BBOX = (-315.0, -185.0, 400.0, 535.0)  # source QA frame, metres
LON0, LAT0 = -73.9864883, 40.756421
RAD = math.pi / 180
lat0 = LAT0 * RAD
EAST_PER_DEGREE = (111412.84 * math.cos(lat0) -
                  93.5 * math.cos(3 * lat0) + .118 * math.cos(5 * lat0))
NORTH_PER_DEGREE = (111132.92 - 559.82 * math.cos(2 * lat0) +
                    1.175 * math.cos(4 * lat0))
CRS = "EPSG:32118"
MAX_RINGS = 20_000
MAX_VERTICES_PER_RING = 50_000


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def source_ring(linear_ring):
    pos_lists = [el for el in linear_ring.iter()
                 if local_name(el.tag) == "posList" and el.text]
    if pos_lists:
        el = pos_lists[0]
        values = [float(x) for x in el.text.split()]
        requested = el.get("srsDimension") or linear_ring.get("srsDimension")
        # LoD2 CityGML polygons are 3D in source StatePlane CRS.
        dimension = int(requested) if requested else 3
        if dimension not in (2, 3) or len(values) % dimension:
            raise ValueError("Unexpected CityGML posList component count")
        return [(values[i], values[i+1]) for i in range(0, len(values), dimension)]
    pos = [el for el in linear_ring.iter() if local_name(el.tag) == "pos" and el.text]
    return [tuple(float(x) for x in el.text.split()[:2]) for el in pos]


def extract_polygon_rings(element):
    rings = []
    for part in element:
        if local_name(part.tag) not in ("exterior", "interior"):
            continue
        linear_rings = [el for el in part.iter()
                        if local_name(el.tag) == "LinearRing"]
        for linear in linear_rings:
            coords = source_ring(linear)
            if len(coords) > MAX_VERTICES_PER_RING:
                raise ValueError("GML source ring exceeds vertex budget")
            if len(coords) >= 3:
                rings.append((local_name(part.tag), coords))
    return rings


def extract():
    FOLDER.mkdir(parents=True, exist_ok=True)
    probe = json.loads((FOLDER / "probe.json").read_text())
    if not probe.get("acquired") or "EPSG:32118" not in probe.get("detectedSrsNames", []):
        raise ValueError("Source ZIP / metre EPSG:32118 not independently verified")
    zip_path = FOLDER / "source.zip"
    if hashlib.sha256(zip_path.read_bytes()).hexdigest() != probe["sha256"]:
        raise ValueError("Source archive SHA256 changed before extraction")
    transformer = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    tile = box(*BBOX)
    results, examples = [], []
    polygons_seen = 0
    invalid = 0
    vertex_budget = 0
    with zipfile.ZipFile(zip_path) as archive:
        selected = probe["xmlMember"]
        if selected not in archive.namelist():
            raise ValueError("Verified source XML member missing")
        with archive.open(selected) as source:
            # Incremental parse keeps a 20 MB historic GML file within memory.
            for _event,el in ET.iterparse(source, events=("end",)):
                if local_name(el.tag) != "Polygon":
                    continue
                polygons_seen += 1
                try:
                    rings = extract_polygon_rings(el)
                    outer = next(r for role,r in rings if role == "exterior")
                    holes = [r for role,r in rings if role == "interior"]
                    def project(vertices):
                        projected = []
                        for px,py in vertices:
                            lon,lat = transformer.transform(px,py)
                            if not (-75 < lon < -72 and 39 < lat < 42):
                                raise ValueError("EPSG:32118 geometry unexpectedly outside NYC")
                            projected.append([(lon-LON0)*EAST_PER_DEGREE,
                                              (lat-LAT0)*NORTH_PER_DEGREE])
                        return projected
                    shape = Polygon(project(outer),[project(r) for r in holes])
                    if not shape.is_valid or shape.area <= .01:
                        invalid += 1;continue
                    if not shape.intersects(tile):
                        continue
                    clipped = shape.intersection(tile)
                    parts = list(clipped.geoms) if isinstance(clipped,MultiPolygon) else [clipped]
                    for part in parts:
                        if part.geom_type != "Polygon" or part.area < .04:
                            continue
                        rings_local = [
                            [[round(x,3),round(y,3)] for x,y in part.exterior.coords]
                        ] + [
                            [[round(x,3),round(y,3)] for x,y in inner.coords]
                            for inner in part.interiors
                        ]
                        vertex_budget += sum(len(v) for v in rings_local)
                        if vertex_budget > 50_000:
                            raise ValueError("Historic mark polygon local vertex budget exceeded")
                        results.append({"sourcePolygonNumber":polygons_seen,
                                        "rings":rings_local,
                                        "areaSquareMeters":round(part.area,3)})
                except (ValueError, StopIteration, OverflowError) as exc:
                    invalid += 1
                    if len(examples) < 5:
                        examples.append(str(exc))
                # Clear after each complete geometry element to avoid retaining
                # tens of thousands of unrelated NYC CityGML objects.
                el.clear()
                if polygons_seen > MAX_RINGS:
                    raise ValueError("Unexpectedly many CityGML source polygons")
    manifest = {
        "schema":"patrol-nyc-historic-painted-median-qa-v1",
        "source":probe["source"],"sha256":probe["sha256"],
        "sourceCrs":CRS,"sourceVintage":"2015-2017, not 2026",
        "role":"QA_ONLY_HISTORIC_CITYGML_NOT_IN_GAME",
        "projection":{"origin":[LON0,LAT0],"axes":"X east, Z north (metres)"},
        "bboxMeters":BBOX,
        "candidateCityPolygons":polygons_seen,
        "clippedTimesSquarePolygons":len(results),
        "invalidSourcePolygons":invalid,
        "exceptionSamples":examples,
        "localVertices":vertex_budget,
        "readyToRender":False,
        "limitations":["Painted medians are not all pavement/road marking types",
                       "Historical NYC city model predates 2026 signage",
                       "TUM source street objects are flat at 0m; terrain datum unknown",
                       "No roof/facade/collision replacement has been performed"],
        "polygons":results,
    }
    (FOLDER / "times-square-markings-source.json").write_text(
        json.dumps(manifest,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in manifest.items() if k != "polygons"},
                     ensure_ascii=False,indent=2))
    # Empty local coverage is a legitimate outcome; must never fabricate it.
    return manifest


if __name__ == "__main__":
    try:
        extract()
    finally:
        (FOLDER / "source.zip").unlink(missing_ok=True)
