#!/usr/bin/env python3
"""Offline NYC MSFS addon inventory and *non-public* import preflight.

Never logs in, downloads, extracts executable content, or enables PATROL assets.
A local legal-rights review is required before any cross-game reuse.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import struct
import zipfile

MAX_ARCHIVE_BYTES = 2 * 1024**3
MAX_MEMBERS = 5000
MAX_EXPANDED_BYTES = 4 * 1024**3
MAX_GLB_BYTES = 8 * 1024**2
MAX_TRIANGLES = 25000


def within(root: Path, name: str) -> Path:
    if not name or '\\' in name or Path(name).is_absolute():
        raise ValueError('invalid relative filename')
    root = root.resolve()
    result = (root / name).resolve()
    if not result.is_relative_to(root) or result == root:
        raise ValueError('path escapes input directory')
    if result.name.lower() == 'creds.txt':
        raise ValueError('credential file is not an addon archive')
    return result


def zip_inventory(path: Path) -> tuple[list[dict], list[tuple[str, bytes]]]:
    files = []
    glbs = []
    total = 0
    glb_bytes = 0
    seen_names = set()
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > MAX_MEMBERS:
            raise ValueError('archive has too many entries')
        for m in members:
            name = m.filename.replace('\\', '/')
            item = PurePosixPath(name)
            if (not name or name.startswith('/') or '..' in item.parts or ':' in item.parts[0]
                    or (m.external_attr >> 16) & 0o170000 == stat.S_IFLNK):
                raise ValueError('unsafe archive member path or symbolic link')
            total += m.file_size
            if total > MAX_EXPANDED_BYTES:
                raise ValueError('expanded archive is too large')
            if m.compress_size and m.file_size > max(10 * 1024**2, m.compress_size * 200):
                raise ValueError('suspicious compression ratio')
            normalized = str(item)
            if normalized in seen_names:
                raise ValueError('duplicate canonical archive member path')
            seen_names.add(normalized)
            if m.is_dir():
                continue
            files.append({'name': name, 'bytes': m.file_size})
            if name.lower().endswith('.glb') and m.file_size <= MAX_GLB_BYTES:
                glb_bytes += m.file_size
                if len(glbs) >= 128 or glb_bytes > 256 * 1024**2:
                    raise ValueError('GLB candidate count or memory budget exceeded')
                with archive.open(m) as handle:
                    glbs.append((name, handle.read(MAX_GLB_BYTES + 1)))
    return files, glbs


def check_glb(raw: bytes) -> int:
    """Check a real, scene-reachable GLB against PATROL's native decoder limits.

    This is an offline *structural* preflight, not browser/GPU/visual approval.
    """
    if len(raw) < 32 or len(raw) > MAX_GLB_BYTES:
        raise ValueError('GLB size outside PATROL budget')
    magic, version, length = struct.unpack_from('<III', raw, 0)
    if magic != 0x46546c67 or version != 2 or length != len(raw):
        raise ValueError('invalid GLB2 header')
    json_size, json_type = struct.unpack_from('<II', raw, 12)
    if (json_type != 0x4e4f534a or json_size < 2 or json_size % 4 or
            20 + json_size + 8 > len(raw)):
        raise ValueError('invalid GLB JSON chunk')
    doc = json.loads(raw[20:20 + json_size].decode('utf-8').rstrip(' \x00'))
    if not isinstance(doc, dict) or doc.get('asset', {}).get('version') != '2.0':
        raise ValueError('GLB must contain glTF 2.0 metadata')
    if doc.get('extensionsRequired'):
        raise ValueError('GLB has required extensions unsupported by PATROL')
    bin_header = 20 + json_size
    bin_size, bin_type = struct.unpack_from('<II', raw, bin_header)
    bin_start = bin_header + 8
    if (bin_type != 0x004e4942 or bin_size % 4 or
            bin_start + bin_size != len(raw)):
        raise ValueError('missing or invalid GLB BIN chunk')
    buffers = doc.get('buffers', [])
    if (len(buffers) != 1 or 'uri' in buffers[0] or
            type(buffers[0].get('byteLength')) is not int or
            not 0 < buffers[0]['byteLength'] <= bin_size or
            bin_size - buffers[0]['byteLength'] > 3):
        raise ValueError('external or invalid GLB buffer')
    views = doc.get('bufferViews', [])
    accessors = doc.get('accessors', [])
    meshes = doc.get('meshes', [])
    nodes = doc.get('nodes', [])
    scenes = doc.get('scenes', [])
    formats = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def view_at(ident: int) -> tuple[int, int, dict]:
        if type(ident) is not int or not 0 <= ident < len(views):
            raise ValueError('invalid GLB bufferView index')
        view = views[ident]
        offset, size = view.get('byteOffset', 0), view.get('byteLength')
        if (view.get('buffer') != 0 or type(offset) is not int or
                type(size) is not int or offset < 0 or size <= 0 or
                offset + size > buffers[0]['byteLength']):
            raise ValueError('bufferView outside embedded BIN')
        return bin_start + offset, size, view

    def accessor_at(ident: int, kind: str | None = None) -> dict:
        if type(ident) is not int or not 0 <= ident < len(accessors):
            raise ValueError('invalid GLB accessor index')
        a = accessors[ident]
        if a.get('sparse'):
            raise ValueError('sparse GLB accessor unsupported')
        c_type, a_type, count = a.get('componentType'), a.get('type'), a.get('count')
        if (c_type not in formats or a_type not in components or
                type(count) is not int or count <= 0 or count > 75000):
            raise ValueError('unsupported GLB accessor layout')
        if kind and a_type != kind:
            raise ValueError('GLB accessor type does not match semantic')
        absolute, length, view = view_at(a.get('bufferView'))
        width = formats[c_type][1] * components[a_type]
        stride = view.get('byteStride', width)
        offset = a.get('byteOffset', 0)
        if (type(stride) is not int or type(offset) is not int or
                stride < width or stride > 252 or offset < 0 or
                offset + (count - 1) * stride + width > length):
            raise ValueError('GLB accessor exceeds embedded bufferView')
        return {'count': count, 'type': a_type, 'componentType': c_type,
                'start': absolute + offset, 'stride': stride}

    def check_texture(texture_index: int) -> None:
        textures, images = doc.get('textures', []), doc.get('images', [])
        if type(texture_index) is not int or not 0 <= texture_index < len(textures):
            raise ValueError('invalid base color texture index')
        image_id = textures[texture_index].get('source')
        if type(image_id) is not int or not 0 <= image_id < len(images):
            raise ValueError('missing base color image')
        img = images[image_id]
        if ('uri' in img or img.get('mimeType') not in ('image/png', 'image/jpeg')):
            raise ValueError('external or unsupported base color image')
        _, length, _ = view_at(img.get('bufferView'))
        if not 64 <= length <= 4 * 1024**2:
            raise ValueError('base color image exceeds PATROL budget')

    chosen_scene = doc.get('scene', 0)
    if type(chosen_scene) is not int or not 0 <= chosen_scene < len(scenes):
        raise ValueError('GLB has no valid default scene')
    triangles = 0
    used_textures = set()
    min_y, max_y = float('inf'), float('-inf')

    def walk(node_id: int, lineage: frozenset, depth: int) -> None:
        nonlocal triangles, min_y, max_y
        if (type(node_id) is not int or not 0 <= node_id < len(nodes) or
                node_id in lineage or depth > 32):
            raise ValueError('invalid/cyclic GLB node hierarchy')
        node = nodes[node_id]
        if 'mesh' in node:
            mesh_id = node['mesh']
            if type(mesh_id) is not int or not 0 <= mesh_id < len(meshes):
                raise ValueError('invalid node mesh reference')
            for prim in meshes[mesh_id].get('primitives', []):
                if prim.get('mode', 4) != 4 or prim.get('extensions'):
                    raise ValueError('PATROL requires uncompressed triangle primitives')
                attrs = prim.get('attributes', {})
                position = accessor_at(attrs.get('POSITION'), 'VEC3')
                if position['componentType'] != 5126:
                    raise ValueError('PATROL positions require Float32 VEC3')
                for semantic, kind in (('NORMAL', 'VEC3'), ('COLOR_0', None),
                                       ('TEXCOORD_0', 'VEC2')):
                    if semantic not in attrs:
                        continue
                    extra = accessor_at(attrs[semantic], kind)
                    if semantic == 'COLOR_0' and extra['type'] not in ('VEC3', 'VEC4'):
                        raise ValueError('invalid vertex color layout')
                    if extra['count'] != position['count']:
                        raise ValueError('GLB vertex attribute count mismatch')
                if 'indices' in prim:
                    indices = accessor_at(prim['indices'], 'SCALAR')
                    if indices['componentType'] not in (5121, 5123, 5125):
                        raise ValueError('unsupported GLB index component type')
                    index_count = indices['count']
                    fmt = '<' + formats[indices['componentType']][0]
                    for j in range(index_count):
                        index = struct.unpack_from(fmt, raw,
                            indices['start'] + j * indices['stride'])[0]
                        if index >= position['count']:
                            raise ValueError('GLB index outside position accessor')
                else:
                    index_count = position['count']
                if index_count % 3:
                    raise ValueError('GLB triangle primitive count not divisible by 3')
                triangles += index_count // 3
                if triangles > MAX_TRIANGLES:
                    raise ValueError('triangle budget exceeded')
                if 'material' in prim:
                    materials = doc.get('materials', [])
                    mat_id = prim['material']
                    if type(mat_id) is not int or not 0 <= mat_id < len(materials):
                        raise ValueError('invalid GLB material reference')
                    diffuse = materials[mat_id].get('pbrMetallicRoughness', {}).get('baseColorTexture')
                    if diffuse is not None:
                        if (diffuse.get('texCoord', 0) != 0 or
                                diffuse.get('extensions', {}).get('KHR_texture_transform') or
                                'TEXCOORD_0' not in attrs):
                            raise ValueError('PATROL needs untransformed TEXCOORD_0')
                        tex_id = diffuse.get('index')
                        used_textures.add(tex_id)
                        if len(used_textures) > 1:
                            raise ValueError('PATROL supports only one diffuse texture atlas')
                        check_texture(tex_id)
                for j in range(position['count']):
                    y = struct.unpack_from('<f', raw, position['start'] +
                        j * position['stride'] + 4)[0]
                    if not (-1e9 < y < 1e9):
                        raise ValueError('non-finite or unbounded GLB positions')
                    min_y, max_y = min(min_y, y), max(max_y, y)
        for child in node.get('children', []):
            walk(child, lineage | {node_id}, depth + 1)

    for root_node in scenes[chosen_scene].get('nodes', []):
        walk(root_node, frozenset(), 0)
    if not 0 < triangles <= MAX_TRIANGLES or not max_y > min_y:
        raise ValueError('empty, over-budget, or vertically flat GLB scene')
    return triangles


def approved(item: dict, evidence_root: Path) -> bool:
    rights = item.get('rights') or {}
    required = ('modify', 'cross_game', 'redistribute', 'dependencies_clear')
    if not all(rights.get(k) is True for k in required):
        return False
    try:
        proof = within(evidence_root, item.get('rights_evidence', ''))
        return proof.is_file() and 20 <= proof.stat().st_size <= 1048576
    except ValueError:
        return False


def analyze(item: dict, archives: Path, evidence: Path, staging: Path | None) -> dict:
    addon_id = item.get('id')
    if type(addon_id) is not int or not (1 <= addon_id <= 1000000000):
        raise ValueError('addon id must be a positive integer')
    result = {'id': addon_id, 'title': item.get('title', ''),
              'page': f'https://flightsim.to/addon/{addon_id}', 'status': 'missing_archive',
              'rights_reviewed': False, 'files': [], 'glb_candidates': []}
    name = item.get('archive')
    if not name:
        return result
    path = within(archives, name)
    if not path.is_file():
        return result
    result['archive_bytes'] = path.stat().st_size
    if path.stat().st_size > MAX_ARCHIVE_BYTES:
        result['status'] = 'oversized_archive'
        return result
    with path.open('rb') as source:
        result['sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
    try:
        if zipfile.is_zipfile(path):
            files, glbs = zip_inventory(path)
        elif path.suffix.lower() == '.glb':
            if path.stat().st_size > MAX_GLB_BYTES:
                result['status'] = 'oversized_glb'
                return result
            with path.open('rb') as source:
                content = source.read(MAX_GLB_BYTES + 1)
            files, glbs = ([{'name': path.name, 'bytes': len(content)}], [(path.name, content)])
        else:
            result['status'] = 'unsupported_archive_format'
            return result
    except (ValueError, OSError, zipfile.BadZipFile, RuntimeError) as exc:
        result['status'] = 'unsafe_or_invalid_archive'
        result['error'] = str(exc)
        return result
    result['files'] = files
    result['rights_reviewed'] = approved(item, evidence)
    for filename, binary in glbs:
        try:
            tris = check_glb(binary)
            result['glb_candidates'].append({'name': filename, 'bytes': len(binary), 'triangles': tris})
            if result['rights_reviewed'] and staging is not None:
                destination = staging / str(addon_id) / f'{len(result["glb_candidates"]):03d}.glb'
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(binary)
                result['glb_candidates'][-1]['local_review_copy'] = str(destination)
        except (ValueError, UnicodeError, KeyError, TypeError, IndexError, AttributeError, struct.error) as exc:
            result['glb_candidates'].append({'name': filename, 'rejected': str(exc)})
    if not result['rights_reviewed']:
        result['status'] = 'rights_pending'
    elif not any('triangles' in v for v in result['glb_candidates']):
        result['status'] = 'conversion_or_manual_review_required'
    else:
        result['status'] = 'local_review_only' if staging else 'glb_review_candidates'
    return result


def run(manifest: Path, archives: Path, evidence: Path, output: Path, staging: Path | None) -> dict:
    source = json.loads(manifest.read_text(encoding='utf-8'))
    entries = source.get('addons')
    if not isinstance(entries, list):
        raise ValueError('manifest must contain addons array')
    ids = [i.get('id') for i in entries if isinstance(i, dict) and type(i.get('id')) is int]
    if len(set(ids)) != len(ids):
        raise ValueError('duplicate addon IDs')
    rows = []
    for index, item in enumerate(entries):
        try:
            if not isinstance(item, dict):
                raise ValueError('manifest row must be an object')
            rows.append(analyze(item, archives, evidence, staging))
        except (ValueError, OSError, TypeError, KeyError, IndexError, AttributeError, struct.error) as exc:
            rows.append({'index': index, 'id': item.get('id') if isinstance(item, dict) and
                         type(item.get('id')) is int else None,
                         'status': 'invalid_manifest_entry',
                         'error_type': type(exc).__name__,
                         'files': [], 'glb_candidates': []})
    report = {'schema': 1, 'entries': rows, 'note':
              'Local inventory only. Permission flags and evidence need human verification. '
              'No runtime manifest changed; no models imported or published.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--archives', type=Path, required=True)
    p.add_argument('--evidence', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    p.add_argument('--stage-approved', type=Path, help='Optional local-only GLB review copies, never PATROL assets')
    a = p.parse_args()
    output = run(a.manifest, a.archives, a.evidence, a.report, a.stage_approved)
    print(json.dumps([{'id': i['id'], 'status': i['status'], 'files': len(i['files'])}
                      for i in output['entries']], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
