"""Validation helpers for authentic NYC DCP MN05 cached Brep roof meshes."""
import math
from shapely.geometry import Polygon
from shapely.ops import unary_union

MODEL_FOOT_IN_METRES = 0.3048  # Rhino UnitSystem.Feet, verified from the 3DM


def require_feet_model_unit(settings):
    """Never infer source Z units from horizontal EPSG:2263 alone."""
    unit = settings.ModelUnitSystem
    name = getattr(unit, "name", str(unit).rsplit(".", 1)[-1])
    if name != "Feet":
        raise ValueError("Original Rhino model units must be Feet, got " + str(name))
    return name


def _as_xyz(point):
    return (float(point.X), float(point.Y), float(point.Z))


def _triangle_area2d(points):
    a, b, c = points
    return abs((b[0]-a[0])*(c[1]-a[1]) -
               (b[1]-a[1])*(c[0]-a[0])) * .5


def face_from_cached_mesh(mesh, transform):
    """Only actual saved Rhino roof triangles/quads; no reconstructed surfaces."""
    if mesh is None or not hasattr(mesh, "Faces") or len(mesh.Faces) > 10000:
        raise ValueError("missing or oversized original Rhino source mesh")
    out = []
    for face_i in range(len(mesh.Faces)):
        result = mesh.Faces.GetFaceVertices(face_i)
        if not result or not result[0]:
            raise ValueError("Rhino source face vertex lookup failed")
        raw = [_as_xyz(p) for p in result[1:]]
        if len(raw) != 4 or any(not all(math.isfinite(v) for v in p) for p in raw):
            raise ValueError("source triangle/quad has invalid XYZ")
        face = mesh.Faces[face_i]
        is_quad = getattr(face, "IsQuad", None)
        if callable(is_quad):
            is_quad = is_quad()
        if is_quad is None:
            is_quad = math.dist(raw[2], raw[3]) > 1e-8
        polygons = [[raw[0], raw[1], raw[2]]]
        if is_quad:
            polygons.append([raw[0], raw[2], raw[3]])
        for tri in polygons:
            pts = []
            for x, y, z in tri:
                e, n = transform(x, y)
                pts.append([float(e), float(n), float(z)])
            if not all(math.isfinite(v) for p in pts for v in p):
                raise ValueError("nonfinite mapped source roof triangle")
            if _triangle_area2d(pts) < .005:
                continue
            out.append(pts)
    if len(out) > 10000:
        raise ValueError("source triangle budget exceeded")
    return out


def choose_matched_roof(source, official_buildings, min_coverage=.60):
    """Keep a historic roof only when its saved mesh overlaps one true 2022 FID."""
    pieces = []
    total = 0
    for tri in source["triangles"]:
        if len(tri) != 3 or any(len(p) != 3 for p in tri):
            raise ValueError("source triangle coordinate count inconsistent")
        polygon = Polygon([(p[0], p[1]) for p in tri])
        if not polygon.is_valid or polygon.area < .005:
            raise ValueError("invalid saved source mesh triangle")
        pieces.append(polygon)
        total += polygon.area
    if not pieces:
        return None
    footprint = unary_union(pieces)
    if footprint.area < 1 or total > footprint.area * 1.03:
        return None
    best = None
    for building in official_buildings:
        target = building["geometry"]
        if not footprint.intersects(target):
            continue
        area = footprint.intersection(target).area
        if best is None or area > best[0]:
            best = (area, building)
    if not best or best[0] / footprint.area < min_coverage:
        return None
    b = best[1]
    return {**source, "matchedFid": b["fid"],
            "matchAreaRatio": best[0] / footprint.area,
            "visualRoofHeightMetres": b["heightMetres"]}


def source_roof_reference_by_fid(selected, tolerance_metres=2.0):
    """Return per-FID source top Z, rejecting historic relief taller than 2022 roof.

    The 2014 absolute vertical datum is not claimed. Only within-building
    relative Z is retained, then the highest saved roof point is anchored to
    the newer 2022 HEIGHTROOF attribute. Implausible cross-object matches fail
    closed rather than creating a tower taller than the current building.
    """
    grouped = {}
    for row in selected:
        fid = row["matchedFid"]
        group = grouped.setdefault(fid, {
            "heightMetres": float(row["visualRoofHeightMetres"]), "z": []})
        if abs(group["heightMetres"] - float(row["visualRoofHeightMetres"])) > 1e-6:
            raise ValueError("inconsistent current roof height for source FID")
        for tri in row["triangles"]:
            group["z"].extend(float(p[2]) for p in tri)
    references, metrics, rejected = {}, {}, {}
    for fid, group in grouped.items():
        values = group["z"]
        if not values or not all(math.isfinite(v) for v in values):
            rejected[fid] = "missing-or-nonfinite-source-z"
            continue
        top, bottom = max(values), min(values)
        relief = (top - bottom) * MODEL_FOOT_IN_METRES
        height = group["heightMetres"]
        metrics[fid] = {"sourceTopZFeet": top, "sourceBottomZFeet": bottom,
                        "relativeReliefMetres": relief,
                        "current2022RoofHeightMetres": height}
        if relief > height + tolerance_metres:
            rejected[fid] = "2014-roof-relief-exceeds-2022-building-height"
            continue
        references[fid] = top
    return references, metrics, rejected


def anchored_source_height_metres(source_z_feet, source_roof_top_z_feet,
                                  current_roof_height_metres, *,
                                  source_vertical_unit_verified=False):
    """Preserve relative 2014 source Z, anchored at 2022 HEIGHTROOF.

    The absolute 2014 vertical datum remains unknown; subtraction cancels any
    constant datum shift. Rhino's original 3DM unit system must be verified
    as Feet before converting the relative offset to metres.
    """
    if not source_vertical_unit_verified:
        raise ValueError("Rhino source vertical unit is not verified")
    if not all(math.isfinite(v) for v in (
        source_z_feet, source_roof_top_z_feet, current_roof_height_metres
    )):
        raise ValueError("nonfinite source roof anchor")
    delta = float(source_z_feet) - float(source_roof_top_z_feet)
    if delta > 5 or delta < -(current_roof_height_metres / MODEL_FOOT_IN_METRES + 5):
        raise ValueError("source facade/roof Z lies outside current building height")
    return float(current_roof_height_metres) + .35 + delta * MODEL_FOOT_IN_METRES
