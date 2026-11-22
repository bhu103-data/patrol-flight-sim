#!/usr/bin/env python3
"""Download *official* Kenney CC0 packs for PATROL NYC asset preflight.

Read-only source validation on an isolated draft PR. This tool does not
modify game runtime, download paid material or install unlicensed art.
"""
from __future__ import annotations
import collections
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
import zipfile

PACKS = {
    "roads": {
        "url": "https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip",
        "official_page": "https://kenney.nl/assets/city-kit-roads",
        "keywords": ("trafficlight", "traffic-light", "traffic_light", "traffic signal"),
    },
    "watercraft": {
        "url": "https://kenney.nl/media/pages/assets/watercraft-kit/a335cfed49-1713519620/kenney_watercraft-pack.zip",
        "official_page": "https://kenney.nl/assets/watercraft-kit",
        "keywords": ("shipcargo", "ship-cargo", "ship_cargo", "ship", "ferry"),
    },
}
OUT = pathlib.Path("nyc-asset-audit/official-source")
OUT.mkdir(parents=True, exist_ok=True)
results = {
    "source": "Kenney official CC0 asset archive; modifications allowed, commercial use and redistribution allowed",
    "license_text_url": "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
    "purpose": "read-only source archive validation; assets not integrated",
    "packs": {},
}

for tag, info in PACKS.items():
    entry = dict(info)
    try:
        req = urllib.request.Request(info["url"], headers={
            "User-Agent": "PATROL-NYC-source-license-audit/1.0",
            "Accept": "application/zip,application/octet-stream,*/*",
        })
        total = 0
        data = bytearray()
        with urllib.request.urlopen(req, timeout=50) as response:
            final = urllib.parse.urlsplit(response.geturl())
            if final.scheme != "https" or final.hostname not in {"kenney.nl", "www.kenney.nl"}:
                raise ValueError("disallowed source host: " + str(final.hostname))
            if (declared := response.headers.get("Content-Length")) and int(declared) > 15_000_000:
                raise ValueError("source exceeded per-file byte cap")
            while chunk := response.read(1048576):
                total += len(chunk)
                if total > 15_000_000:
                    raise ValueError("source exceeded streamed byte cap")
                data.extend(chunk)
        zip_path = OUT / (tag + "-original.zip")
        zip_path.write_bytes(data)
        with zipfile.ZipFile(zip_path) as zf:
            bad = zf.testzip()
            if bad:
                raise ValueError("ZIP failed CRC: " + bad)
            members = zf.infolist()
            if sum(i.file_size for i in members) > 180_000_000:
                raise ValueError("Unpacked ZIP would exceed 180MB cap")
            for member in members:
                p = pathlib.PurePosixPath(member.filename)
                if member.filename.startswith("/") or any(s == ".." or ":" in s for s in p.parts):
                    raise ValueError("Unsafe ZIP entry path")
            paths = [f.filename for f in members if not f.is_dir()]
            entry["zip_file_count"] = len(paths)
            entry["suffix_counts"] = dict(collections.Counter(pathlib.PurePosixPath(s).suffix.lower() for s in paths))
            entry["matches"] = [s for s in paths if any(k in s.lower().replace(" ", "") for k in info["keywords"])][:90]
            entry["licence_candidates"] = [s for s in paths if any(q in s.lower() for q in ("license", "licence", "readme", "credit"))][:25]
            entry["sample_files"] = paths[:35]
            entry["license_file_excerpts"] = {}
            for name in entry["licence_candidates"]:
                if pathlib.PurePosixPath(name).suffix.lower() in (".txt",".md") and zf.getinfo(name).file_size < 100_000:
                    entry["license_file_excerpts"][name] = zf.read(name).decode("utf8", "replace")[:1600]
            entry["glb_candidates"] = [s for s in paths if s.lower().endswith((".glb", ".gltf")) and
                any(k in s.lower().replace(" ","") for k in info["keywords"])][:50]
        entry["status"] = "DOWNLOADED_CRC_OK"
        entry["download_bytes"] = len(data)
        entry["sha256"] = hashlib.sha256(data).hexdigest()
        print(tag, "OK", len(data), "bytes", "matches", len(entry["matches"]),
              "glTF matches", len(entry["glb_candidates"]))
        for found in entry["glb_candidates"][:12]:
            print("  source asset:", found)
    except Exception as exc:
        entry["status"] = "FAILED"
        entry["failure"] = type(exc).__name__ + ": " + str(exc)[:600]
        print(tag, "FAIL", entry["failure"])
    results["packs"][tag] = entry

(OUT / "official-source-audit.json").write_text(json.dumps(results, indent=2, ensure_ascii=False)+"\n")
if not any(info["status"] == "DOWNLOADED_CRC_OK" for info in results["packs"].values()):
    raise SystemExit("Official Kenney ZIP retrieval failed; no substitute third-party content used")
