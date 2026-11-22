"""Fail-closed geometry helpers for official 2014 MN05 roof/facade cached meshes."""
from __future__ import annotations
import math
from shapely.geometry import MultiPoint, Polygon
from shapely.ops import unary_union


def _xyz(point):
    return (float(point.X), float(point.Y), float(point.Z))


def cached_mesh_triangles(mesh, transform):
    """Read only faces already cached in the official Rhino Brep face.

    Returns source-derived triangles in local east/north metres plus raw Rhino
    Z units. No NURBS tessellation, bounding-box roofs or fabricated quads.
    """
    if mesh is None or not hasattr(mesh, "Faces"):
        raise ValueError("missing original cached Rhino face mesh")
    faces = mesh.Faces
    if len(faces) < 1 or len(faces) > 20000:
        raise ValueError("cached Rhino face count outside bounded limit")
    triangles = []
    xy_points = []
    for face_index in range(len(faces)):
        result = faces.GetFaceVertices(face_index)
        if not result or not result[0]:
            raise ValueError("Rhino cached face vertex lookup failed")
        raw = [_xyz(point) for point in result[1:]]
        if len(raw) != 4 or any(not all(math.isfinite(v) for v in p) for p in raw):
            raise ValueError("cached facade face has invalid XYZ")
        mapped = []
        for x, y, z in raw:
            east, north = transform(x, y)
            point = [float(east), float(north), float(z)]
            if not all(math.isfinite(v) for v in point):
                raise ValueError("non-finite mapped source facade vertex")
            mapped.append(point)
            xy_points.append((point[0], point[1]))
        is_quad = math.dist(raw[2], raw[3]) > 1e-8
        source_faces = [[mapped[0], mapped[1], mapped[2]]]
        if is_quad:
            source_faces.append([mapped[0], mapped[2], mapped[3]])
        for tri in source_faces:
            a, b, c = tri
            u = [b[i] - a[i] for i in range(3)]
            v = [c[i] - a[i] for i in range(3)]
            cross = (u[1]*v[2]-u[2]*v[1],
                     u[2]*v[0]-u[0]*v[2],
                     u[0]*v[1]-u[1]*v[0])
            if math.sqrt(sum(t*t for t in cross)) < 1e-5:
                continue
            triangles.append(tri)
    if len(triangles) > 40000:
        raise ValueError("cached facade triangle count exceeds bounded ROI budget")
    return triangles, xy_points


def match_roof_triangles(triangles, buildings, min_coverage=0.60):
    """Match a source roof patch only to a newer footprint it actually covers."""
    pieces = []
    total_area = 0.0
    for tri in triangles:
        if len(tri) != 3 or any(len(p) != 3 for p in tri):
            raise ValueError("source roof triangle coordinate count inconsistent")
        polygon = Polygon([(p[0], p[1]) for p in tri])
        if not polygon.is_valid or polygon.area < 0.005:
            continue
        pieces.append(polygon)
        total_area += polygon.area
    if not pieces:
        return None
    footprint = unary_union(pieces)
    if footprint.area < 1.0 or total_area > footprint.area * 1.05:
        return None
    best = None
    for building in buildings:
        area = footprint.intersection(building["geometry"]).area
        if best is None or area > best[0]:
            best = (area, building)
    if not best or best[0] / footprint.area < min_coverage:
        return None
    return {"building": best[1], "coverage": best[0] / footprint.area}


def match_facade_patch(xy_points, buildings, max_boundary_distance=2.0,
                       min_boundary_coverage=0.78):
    """Match a vertical facade mesh to a unique footprint boundary in metres.

    Facade faces project to a line or narrow polygon in XY. Require most of
    that projected geometry to lie within a small boundary corridor. Shared
    party walls that match two buildings equally are rejected as ambiguous.
    """
    clean = [(float(x), float(y)) for x, y in xy_points
             if math.isfinite(float(x)) and math.isfinite(float(y))]
    if len(clean) < 3:
        return None
    hull = MultiPoint(clean).convex_hull
    if hull.is_empty or hull.geom_type in ("Point", "MultiPoint"):
        return None
    ranked = []
    for building in buildings:
        boundary = building["geometry"].boundary
        distance = float(boundary.distance(hull))
        if distance > max_boundary_distance:
            continue
        corridor = boundary.buffer(max_boundary_distance)
        if hull.geom_type in ("LineString", "MultiLineString"):
            measure = float(hull.length)
            covered = float(hull.intersection(corridor).length)
        else:
            measure = float(hull.area)
            covered = float(hull.intersection(corridor).area)
        if measure < 0.25:
            continue
        coverage = min(1.0, covered / measure)
        if coverage >= min_boundary_coverage:
            ranked.append((coverage, distance, building))
    ranked.sort(key=lambda row: (row[0], -row[1]), reverse=True)
    if not ranked:
        return None
    if len(ranked) > 1:
        first, second = ranked[0], ranked[1]
        if (first[0] - second[0] < 0.08 and
                abs(first[1] - second[1]) < 0.25):
            return None
    coverage, distance, building = ranked[0]
    return {"building": building, "coverage": coverage,
            "boundaryDistanceMetres": distance}


def relative_height_metres(source_z, source_min_z, source_max_z, modern_height_metres):
    """Normalize relative 2014 source Z to a newer HEIGHTROOF display anchor.

    Absolute historical Z and its vertical datum are deliberately not used.
    """
    values = (source_z, source_min_z, source_max_z, modern_height_metres)
    if not all(math.isfinite(float(v)) for v in values):
        raise ValueError("non-finite source/anchor height")
    span = float(source_max_z) - float(source_min_z)
    if span <= 1e-6 or not 0 < float(modern_height_metres) < 1000:
        raise ValueError("invalid relative source height span or modern roof anchor")
    fraction = (float(source_z) - float(source_min_z)) / span
    if fraction < -1e-5 or fraction > 1.00001:
        raise ValueError("source Z lies outside the building-relative range")
    return max(0.0, min(1.0, fraction)) * float(modern_height_metres)


def plausible_height_ratio(source_z_span, modern_height_ft, min_ratio=0.50,
                           max_ratio=1.75):
    """Conservative shape-consistency gate, not proof of vertical datum.

    The source Z unit remains unverified; this ratio is used only to reject
    obvious cross-building/partial-wall mismatches before display anchoring.
    """
    values = (source_z_span, modern_height_ft, min_ratio, max_ratio)
    if not all(math.isfinite(float(v)) for v in values):
        return False
    if float(source_z_span) <= 0 or float(modern_height_ft) <= 0:
        return False
    ratio = float(source_z_span) / float(modern_height_ft)
    return float(min_ratio) <= ratio <= float(max_ratio)
