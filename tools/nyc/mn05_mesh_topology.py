"""Conservative topology checks for cached Rhino Brep-face meshes.

This module does not claim a cached render mesh is an exact NURBS trim
boundary. It validates finite triangles, edge incidence and closed loops.
"""
from __future__ import annotations
import collections
import math

def _distance(a, b):
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))

def _orient2(a, b, c):
    return ((b[0] - a[0]) * (c[1] - a[1])
            - (b[1] - a[1]) * (c[0] - a[0]))

def _on_segment(a, b, p, eps):
    return (min(a[0], b[0]) - eps <= p[0] <= max(a[0], b[0]) + eps
            and min(a[1], b[1]) - eps <= p[1] <= max(a[1], b[1]) + eps)

def _segments_intersect(a, b, c, d, eps=1e-10):
    o1, o2 = _orient2(a, b, c), _orient2(a, b, d)
    o3, o4 = _orient2(c, d, a), _orient2(c, d, b)
    if (((o1 > eps and o2 < -eps) or (o1 < -eps and o2 > eps))
            and ((o3 > eps and o4 < -eps) or (o3 < -eps and o4 > eps))):
        return True
    if abs(o1) <= eps and _on_segment(a, b, c, eps):
        return True
    if abs(o2) <= eps and _on_segment(a, b, d, eps):
        return True
    if abs(o3) <= eps and _on_segment(c, d, a, eps):
        return True
    if abs(o4) <= eps and _on_segment(c, d, b, eps):
        return True
    return False

def _loop_signed_area(loop, vertices):
    pts = [vertices[i] for i in loop]
    return 0.5 * sum(
        pts[i][0] * pts[(i + 1) % len(pts)][1]
        - pts[(i + 1) % len(pts)][0] * pts[i][1]
        for i in range(len(pts))
    )

def _loop_self_intersects(loop, vertices):
    pts = [vertices[i] for i in loop]
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        for j in range(i + 1, n):
            if j == i or j == (i + 1) % n or (j + 1) % n == i:
                continue
            c, d = pts[j], pts[(j + 1) % n]
            if _segments_intersect(a, b, c, d):
                return True
    return False

def analyze_mesh(vertices, faces, area_epsilon=1e-10):
    """Validate one cached Brep-face mesh; preserve holes as separate loops.

    faces accepts 3-index triangles or 4-index quads. Quad perimeter edges
    are counted without the internal triangulation diagonal. Boundary loops
    are topological mesh loops, not exact source Brep trim curves.
    """
    errors = []
    verts = []
    for index, point in enumerate(vertices):
        if len(point) != 3:
            return {"valid": False, "errors": [f"vertex {index} is not xyz"]}
        values = tuple(float(v) for v in point)
        if not all(math.isfinite(v) for v in values):
            return {"valid": False, "errors": [f"vertex {index} is non-finite"]}
        verts.append(values)
    if not verts:
        return {"valid": False, "errors": ["mesh has no vertices"]}

    edge_counts = collections.Counter()
    triangles = []
    valid_source_faces = 0
    for face_index, raw_face in enumerate(faces):
        face = tuple(int(value) for value in raw_face)
        if len(face) not in (3, 4):
            errors.append(f"face {face_index} is not triangle or quad")
            continue
        if len(set(face)) != len(face):
            errors.append(f"face {face_index} repeats a vertex")
            continue
        if any(value < 0 or value >= len(verts) for value in face):
            errors.append(f"face {face_index} has an out-of-range vertex")
            continue
        valid_source_faces += 1
        for a, b in zip(face, face[1:] + face[:1]):
            if a == b:
                errors.append(f"face {face_index} has a zero-length edge")
                continue
            edge_counts[tuple(sorted((a, b)))] += 1
        if len(face) == 3:
            triangles.append(face)
        else:
            a, b, c, d = face
            if _distance(verts[a], verts[c]) <= _distance(verts[b], verts[d]):
                triangles.extend(((a, b, c), (a, c, d)))
            else:
                triangles.extend(((a, b, d), (b, c, d)))

    nonmanifold_edges = [edge for edge, count in edge_counts.items() if count > 2]
    if nonmanifold_edges:
        errors.append(f"{len(nonmanifold_edges)} edges are used by more than two faces")
    boundary_edges = [edge for edge, count in edge_counts.items() if count == 1]
    adjacency = collections.defaultdict(list)
    for a, b in boundary_edges:
        adjacency[a].append(b)
        adjacency[b].append(a)
    bad_boundary_vertices = {
        vertex: len(neighbors) for vertex, neighbors in adjacency.items()
        if len(neighbors) != 2
    }
    if bad_boundary_vertices:
        errors.append(f"{len(bad_boundary_vertices)} boundary vertices do not have degree 2")

    loops = []
    if not boundary_edges:
        errors.append("Brep-face mesh has no open boundary edges")
    elif not bad_boundary_vertices:
        remaining = set(boundary_edges)
        while remaining:
            first_a, first_b = next(iter(remaining))
            start, previous, current = first_a, first_a, first_b
            loop = [first_a, first_b]
            remaining.remove(tuple(sorted((first_a, first_b))))
            guard = 0
            while current != start:
                guard += 1
                if guard > len(boundary_edges) + 1:
                    errors.append("boundary traversal exceeded edge count")
                    break
                choices = [
                    neighbor for neighbor in adjacency[current]
                    if neighbor != previous
                    and tuple(sorted((current, neighbor))) in remaining
                ]
                if not choices:
                    errors.append("boundary edge chain did not close")
                    break
                next_vertex = choices[0]
                remaining.remove(tuple(sorted((current, next_vertex))))
                previous, current = current, next_vertex
                if current != start:
                    loop.append(current)
            else:
                loops.append(loop)

    loop_areas = []
    for loop_index, loop in enumerate(loops):
        area = _loop_signed_area(loop, verts)
        loop_areas.append(area)
        if abs(area) <= area_epsilon:
            errors.append(f"boundary loop {loop_index} has zero projected XY area")
        if _loop_self_intersects(loop, verts):
            errors.append(f"boundary loop {loop_index} self-intersects in XY")

    surface_area_3d = 0.0
    projected_triangle_area = 0.0
    degenerate_triangles = 0
    for triangle_index, (a, b, c) in enumerate(triangles):
        p, q, r = verts[a], verts[b], verts[c]
        u = tuple(q[i] - p[i] for i in range(3))
        v = tuple(r[i] - p[i] for i in range(3))
        cross = (
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        )
        area_3d = 0.5 * math.sqrt(sum(component * component for component in cross))
        area_xy = 0.5 * abs(_orient2(p, q, r))
        if area_3d <= area_epsilon:
            degenerate_triangles += 1
            errors.append(f"triangle {triangle_index} has zero 3D area")
        surface_area_3d += area_3d
        projected_triangle_area += area_xy

    return {
        "valid": not errors and valid_source_faces > 0,
        "errors": errors,
        "vertexCount": len(verts),
        "sourceFaceCount": valid_source_faces,
        "triangleCount": len(triangles),
        "boundaryEdgeCount": len(boundary_edges),
        "boundaryLoopCount": len(loops),
        "boundaryLoopVertexCounts": [len(loop) for loop in loops],
        "boundaryLoops": loops,
        "boundaryLoopSignedAreaXY": loop_areas,
        "surfaceArea3D": surface_area_3d,
        "projectedTriangleAreaXY": projected_triangle_area,
        "nonManifoldEdgeCount": len(nonmanifold_edges),
        "badBoundaryVertexCount": len(bad_boundary_vertices),
        "degenerateTriangleCount": degenerate_triangles,
    }
