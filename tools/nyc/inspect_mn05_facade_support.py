"""Source-preserving geometry helpers for NYC DCP MN05 vertical facade faces."""
import math
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union


def _xyz(p):
    return (float(p.X), float(p.Y), float(p.Z))


def _area3d(tri):
    a,b,c=tri
    u=[b[i]-a[i] for i in range(3)]
    v=[c[i]-a[i] for i in range(3)]
    cross=(u[1]*v[2]-u[2]*v[1],
           u[2]*v[0]-u[0]*v[2],
           u[0]*v[1]-u[1]*v[0])
    return .5*math.sqrt(sum(x*x for x in cross))


def face_from_cached_facade_mesh(mesh, transform):
    """Keep real vertical triangles even when their XY projection is a line."""
    if mesh is None or not hasattr(mesh,"Faces") or len(mesh.Faces)>10000:
        raise ValueError("missing or oversized original Rhino facade mesh")
    out=[]
    for i in range(len(mesh.Faces)):
        result=mesh.Faces.GetFaceVertices(i)
        if not result or not result[0]:
            raise ValueError("Rhino facade mesh face lookup failed")
        raw=[_xyz(p) for p in result[1:]]
        if len(raw)!=4 or any(not all(math.isfinite(v) for v in p) for p in raw):
            raise ValueError("facade triangle/quad has invalid XYZ")
        face=mesh.Faces[i]
        is_quad=getattr(face,"IsQuad",None)
        if callable(is_quad):
            is_quad=is_quad()
        if is_quad is None:
            is_quad=math.dist(raw[2],raw[3])>1e-8
        source_tris=[[raw[0],raw[1],raw[2]]]
        if is_quad:
            source_tris.append([raw[0],raw[2],raw[3]])
        for tri in source_tris:
            mapped=[]
            for x,y,z in tri:
                e,n=transform(x,y)
                mapped.append([float(e),float(n),float(z)])
            if not all(math.isfinite(v) for p in mapped for v in p):
                raise ValueError("nonfinite projected facade vertex")
            if _area3d(mapped)<.005:
                continue
            out.append(mapped)
    if len(out)>20000:
        raise ValueError("facade mesh triangle budget exceeded")
    return out


def facade_xy_projection(triangles):
    """Project real wall triangles to XY linework for source-footprint matching."""
    parts=[]
    for tri in triangles:
        pts=[]
        for p in tri:
            xy=(round(float(p[0]),5),round(float(p[1]),5))
            if xy not in pts:
                pts.append(xy)
        if len(pts)<2:
            continue
        if len(pts)>=3:
            poly=Polygon(pts)
            if poly.is_valid and poly.area>.05:
                parts.append(poly)
                continue
        line=LineString(pts)
        if line.is_valid and line.length>.05:
            parts.append(line)
    if not parts:
        return None
    return unary_union(parts)


def match_facade_to_building(triangles, buildings, tolerance_metres=1.5,
                             minimum_coverage=.65, ambiguity_delta=.08):
    """Match a facade to one footprint boundary; ambiguous party walls fail closed."""
    projected=facade_xy_projection(triangles)
    if projected is None or projected.is_empty or projected.length<1.0:
        return None
    candidates=[]
    for building in buildings:
        footprint=building["geometry"]
        boundary=footprint.boundary
        if projected.geom_type in ("LineString","MultiLineString"):
            denominator=projected.length
            covered=projected.intersection(boundary.buffer(tolerance_metres)).length
            coverage=min(1.0,covered/denominator) if denominator else 0.0
            distance=projected.distance(boundary)
        else:
            denominator=projected.area
            covered=projected.intersection(footprint.buffer(tolerance_metres)).area
            coverage=min(1.0,covered/denominator) if denominator else 0.0
            distance=projected.distance(footprint)
        if coverage>=minimum_coverage and distance<=tolerance_metres:
            candidates.append((coverage,distance,building))
    candidates.sort(key=lambda row:(-row[0],row[1],row[2]["fid"]))
    if not candidates:
        return None
    if len(candidates)>1:
        first,second=candidates[0],candidates[1]
        if first[0]-second[0]<ambiguity_delta and abs(first[1]-second[1])<.5:
            return None
    coverage,distance,building=candidates[0]
    return {"matchedFid":building["fid"],
            "matchCoverage":coverage,
            "boundaryDistanceMetres":distance,
            "projectedLengthMetres":projected.length,
            "projectedAreaSquareMetres":projected.area}
