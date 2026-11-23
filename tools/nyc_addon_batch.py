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
    if len(raw) < 32 or len(raw) > MAX_GLB_BYTES:
        raise ValueError('GLB size outside PATROL budget')
    magic, version, length = struct.unpack_from('<III', raw, 0)
    if magic != 0x46546c67 or version != 2 or length != len(raw):
        raise ValueError('invalid GLB2 header')
    json_size, json_type = struct.unpack_from('<II', raw, 12)
    if json_type != 0x4e4f534a or json_size < 2 or 20 + json_size > len(raw):
        raise ValueError('invalid GLB JSON chunk')
    doc = json.loads(raw[20:20 + json_size].decode('utf-8').rstrip(' \x00'))
    triangles = 0
    accessors = doc.get('accessors', [])
    for mesh in doc.get('meshes', []):
        for prim in mesh.get('primitives', []):
            if prim.get('mode', 4) != 4:
                raise ValueError('PATROL supports triangle primitives only')
            a = prim.get('indices', prim.get('attributes', {}).get('POSITION'))
            if not isinstance(a, int) or a < 0 or a >= len(accessors):
                raise ValueError('primitive accessor missing')
            count = accessors[a].get('count')
            if not isinstance(count, int) or count < 3 or count % 3:
                raise ValueError('invalid triangle index count')
            triangles += count // 3
    if triangles < 1 or triangles > MAX_TRIANGLES:
        raise ValueError('triangle budget exceeded or model empty')
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
        except (ValueError, UnicodeError, KeyError, TypeError, IndexError) as exc:
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
        except (ValueError, OSError, TypeError, KeyError, IndexError) as exc:
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
