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
import re
import urllib.parse
import urllib.request
import zipfile

PACKS = {
    "roads": {
        "official_page": "https://kenney.nl/assets/city-kit-roads",
        "keywords": ("trafficlight", "traffic-light", "traffic_light", "traffic signal"),
    },
    "watercraft": {
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
        # Kenney no longer serves a stable static /media ZIP URL. Its
        # own public download button fetches a temporary signed link via
        # /download-link/<hex-encoded assets/slug> without payment.
        official_page = info["official_page"]
        req_page = urllib.request.Request(official_page, headers={
            "User-Agent": "PATROL-NYC-source-license-audit/1.0",
            "Accept": "text/html",
        })
        with urllib.request.urlopen(req_page, timeout=30) as response:
            if urllib.parse.urlsplit(response.geturl()).hostname not in ("kenney.nl", "www.kenney.nl"):
                raise ValueError("Untrusted publisher page redirect")
            page_html = response.read(250_001)
        if len(page_html) > 250_000:
            raise ValueError("Unexpectedly large publisher page")
        match = re.search(rb"data-download-id=['\"]([0-9a-fA-F]+)['\"]", page_html)
        if not match:
            raise ValueError("Kenney official button has no download ID")
        download_id = match.group(1).decode("ascii")
        expected = "assets/" + official_page.rsplit("/", 1)[-1]
        if bytes.fromhex(download_id).decode("ascii") != expected:
            raise ValueError("Kenney download link ID does not match expected pack")
        api_url = "https://kenney.nl/download-link/" + download_id
        api_req = urllib.request.Request(api_url, headers={
            "User-Agent": "PATROL-NYC-source-license-audit/1.0",
            "Accept": "application/json",
            "Referer": official_page,
        })
        with urllib.request.urlopen(api_req, timeout=30) as response:
            api_payload = json.loads(response.read(20_001))
        url = api_payload.get("url")
        if not isinstance(url, str):
            raise ValueError("Kenney official API did not return a signed ZIP link: "
                             + str(sorted(api_payload)))
        link = urllib.parse.urlsplit(url)
        if link.scheme != "https" or not (link.hostname == "kenney.nl" or
                                                link.hostname.endswith(".kenney.nl")):
            raise ValueError("Unexpected Kenney download endpoint host: " + str(link.hostname))
        entry["delivery_host"] = link.hostname
        entry["download_method"] = "publisher landing page + official signed download API"
        req = urllib.request.Request(url, headers={
            "User-Agent": "PATROL-NYC-source-license-audit/1.0",
            "Accept": "application/zip,application/octet-stream,*/*",
        })
        total = 0
        data = bytearray()
        with urllib.request.urlopen(req, timeout=50) as response:
            final = urllib.parse.urlsplit(response.geturl())
            if final.scheme != "https" or not (final.hostname == "kenney.nl" or final.hostname.endswith(".kenney.nl")):
                raise ValueError("disallowed source host: " + str(final.hostname))
            if (declared := response.headers.get("Content-Length")) and int(declared) > 15_000_000:
                raise ValueError("source exceeded per-file byte cap")
            while chunk := response.read(1048576):
                total += len(chunk)
                if total > 15_000_000:
                    raise ValueError("source exceeded streamed byte cap")
                data.extend(chunk)
        if not data.startswith(b"PK\x03\x04"):
            raise ValueError("Official response not ZIP: " + repr(bytes(data[:50])))
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
