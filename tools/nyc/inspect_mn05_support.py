"""Pure validation helpers for original 2014 NYC DCP cached Brep face meshes.

Uses original per-face mesh triangles stored IN the authenticated Rhino .3dm
file. This is not a replacement for the still-unresolved Brep trim loop API.
"""
import math
from shapely.geometry import Polygon
from shapely.ops import unary_union


def _as_xyz(point):
    return (float(point.X),float(point.Y),float(point.Z))


def _triangle_area2d(points):
    a,b,c=points
    return abs((b[0]-a[0])*(c[1]-a[1])-
               (b[1]-a[1])*(c[0]-a[0]))*.5


def face_from_cached_mesh(mesh,transform):
    """Each projected roof triangle must be an actual cached Rhino mesh face.

    We split actual source quads on their original diagonal, but never invent
    NURBS surface triangulation or a polygon fan from bbox/edge vertices.
    """
    if mesh is None or not hasattr(mesh,"Faces") or len(mesh.Faces)>10000:
        raise ValueError("missing or oversized original Rhino source mesh")
    out=[]
    for face_i in range(len(mesh.Faces)):
        result=mesh.Faces.GetFaceVertices(face_i)
        if not result or not result[0]:
            raise ValueError("Rhino source face vertex lookup failed")
        raw=[_as_xyz(p) for p in result[1:]]
        if len(raw)!=4 or any(not all(math.isfinite(v) for v in p)
                             for p in raw):
            raise ValueError("source triangle/quad has invalid XYZ")
        face=mesh.Faces[face_i]
        is_quad=getattr(face,"IsQuad",None)
        if callable(is_quad):
            is_quad=is_quad()
        if is_quad is None:
            is_quad=math.dist(raw[2],raw[3])>1e-8
        polygons=[[raw[0],raw[1],raw[2]]]
        if is_quad:
            polygons.append([raw[0],raw[2],raw[3]])
        for tri in polygons:
            pts=[]
            for x,y,z in tri:
                e,n=transform(x,y)
                pts.append([float(e),float(n),float(z)])
            if not all(math.isfinite(v) for p in pts for v in p):
                raise ValueError("nonfinite mapped source roof triangle")
            if _triangle_area2d(pts)<.005:
                continue
            out.append(pts)
    if len(out)>10000:
        raise ValueError("source triangle budget exceeded")
    return out


def choose_matched_roof(source,official_buildings,min_coverage=.60):
    """Keep source 2014 mesh only when 2022 footprint matches in true metres.

    Return no match if the historical building is moved/changed; do NOT place
    orphan roof pieces on the nearest unrelated modern building.
    """
    pieces=[]
    total=0
    for tri in source["triangles"]:
        if len(tri)!=3 or any(len(p)!=3 for p in tri):
            raise ValueError("source triangle coordinate count inconsistent")
        polygon=Polygon([(p[0],p[1]) for p in tri])
        if not polygon.is_valid or polygon.area<.005:
            raise ValueError("invalid saved source mesh triangle")
        pieces.append(polygon);total+=polygon.area
    if not pieces:
        return None
    footprint=unary_union(pieces)
    if footprint.area<1 or total>footprint.area*1.03:
        # Saved mesh self-overlap or too little area to have a valid match.
        return None
    best=None
    for building in official_buildings:
        target=building["geometry"]
        if not footprint.intersects(target):
            continue
        area=footprint.intersection(target).area
        if best is None or area>best[0]:
            best=(area,building)
    if not best or best[0]/footprint.area<min_coverage:
        return None
    b=best[1]
    return {**source,"matchedFid":b["fid"],
            "matchAreaRatio":best[0]/footprint.area,
            "visualRoofHeightMetres":b["heightMetres"]}
