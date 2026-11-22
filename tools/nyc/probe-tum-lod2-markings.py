#!/usr/bin/env python3
"""Bounded official-source investigation, not a city-model import.

TUM-derived CityGML street marking surfaces from NYC municipal Open Data:
https://www.asg.ed.tum.de/gis/projekte/new-york-city-3d/
TUM permits free usage but underlying NYC Open Data terms still apply.
Do not write any geometry to a live PATROL scene until real coordinates,
vertical datum, semantic role and 2026 chronology are verified.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = ("https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/"
          "NYC/NYC_street_space_CityGML_LoD2/"
          "NYC_CityGML_LoD2_Median_Painted.zip")
MAX_DOWNLOAD = 25 * 1024 * 1024
MAX_UNCOMPRESSED_MEMBER = 500 * 1024 * 1024
ARTIFACT = Path("artifacts/nyc-tum-lod2-markings")


def probe():
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    output = ARTIFACT / "probe.json"
    summary = {
        "source": SOURCE,
        "provenance": "TUM NYC 3D Open Data derived from NYC Open Data",
        "dataVintage": "historic, earlier than 2026",
        "useRestrictions": ["NYC original dataset terms apply",
                            "not approved as contemporary surveyed street markings",
                            "source CRS, footprint intersection and vertical datum require QA"],
        "readyToRender": False,
    }
    try:
        req = urllib.request.Request(SOURCE, headers={
            "User-Agent": "PATROL open-data provenance verifier/1.0",
            "Accept": "application/zip"})
        raw = bytearray()
        with urllib.request.urlopen(req, timeout=70) as response:
            summary["httpStatus"] = response.status
            summary["contentType"] = response.headers.get("Content-Type")
            advertised = response.headers.get("Content-Length")
            if advertised and int(advertised) > MAX_DOWNLOAD:
                raise ValueError("Official sample exceeds bounded 25 MiB download budget")
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                raw.extend(block)
                if len(raw) > MAX_DOWNLOAD:
                    raise ValueError("Source exceeded bounded 25 MiB download budget")
        local = ARTIFACT / "source.zip"
        local.write_bytes(raw)
        summary.update({"archiveBytes": len(raw),
                        "sha256": hashlib.sha256(raw).hexdigest()})
        with zipfile.ZipFile(local) as z:
            valid = []
            for info in z.infolist():
                if info.is_dir():
                    continue
                if info.file_size > MAX_UNCOMPRESSED_MEMBER:
                    raise ValueError("Source archive member unexpectedly large")
                path = Path(info.filename)
                if path.is_absolute() or ".." in path.parts:
                    raise ValueError("Unsafe ZIP member path")
                valid.append(info)
            summary["members"] = [{
                "name": x.filename, "uncompressedBytes": x.file_size,
                "compressedBytes": x.compress_size} for x in valid[:30]]
            xml = [x for x in valid if x.filename.lower().endswith((".gml", ".xml"))]
            if not xml:
                raise ValueError("No CityGML/XML files found in official source ZIP")
            info = max(xml, key=lambda x: x.file_size)
            summary["xmlMember"] = info.filename
            with z.open(info) as f:
                beginning = f.read(256 * 1024)
            head = beginning.decode("utf-8", errors="replace")
            summary["xmlRootSnippet"] = head[:900]
            summary["detectedSrsNames"] = sorted(set(re.findall(
                r'srsName=[\'\"]([^\'\"]+)', head)))[:16]
            sample = re.findall(r'<(?:[A-Za-z0-9_]+:)?posList[^>]*>(.*?)</',
                                head, re.DOTALL)
            summary["posListExamples"] = [
                re.sub(r"\s+", " ", x.strip())[:240] for x in sample[:4]
            ]
            if not head.lstrip().startswith(("<?xml", "<")):
                raise ValueError("GML XML header was not found")
        summary["acquired"] = True
    except Exception as exc:
        summary["acquired"] = False
        summary["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        # Do not re-upload raw historical CityGML until the terms and
        # geometry are independently reviewed; keep only metadata evidence.
        # A same-job source extractor may use this for measured geometry
        # clipping. Never publish the unreviewed raw ZIP as a repo asset.
        if os.environ.get("PATROL_KEEP_GML") != "1":
            (ARTIFACT / "source.zip").unlink(missing_ok=True)
        output.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not summary.get("acquired"):
        raise SystemExit(1)


if __name__ == "__main__":
    probe()
