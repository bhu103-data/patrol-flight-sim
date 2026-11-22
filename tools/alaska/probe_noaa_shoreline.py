#!/usr/bin/env python3
"""Probe NOAA's public shoreline services safely, with bounded responses.

Diagnostic only. Does not import the statewide CUSP into PATROL.
"""
from __future__ import annotations
import datetime
import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

OUT = pathlib.Path("alaska-official-aoi-results/noaa-shoreline-probe")
OUT.mkdir(parents=True, exist_ok=True)
ALLOWED = {"www.ngs.noaa.gov", "geodesy.noaa.gov", "nsde.ngs.noaa.gov"}
TESTS = [
    ("ngs_www_wfs", "https://www.ngs.noaa.gov/GeoServer/NSDE/ows?service=WFS&version=1.1.0&request=GetCapabilities", "xml"),
    ("ngs_geodesy_wfs", "https://geodesy.noaa.gov/GeoServer/NSDE/ows?service=WFS&version=1.1.0&request=GetCapabilities", "xml"),
    ("ngs_www_wms", "https://www.ngs.noaa.gov/GeoServer/NSDE/ows?service=WMS&version=1.3.0&request=GetCapabilities", "xml"),
    ("noaa_nsde_home", "https://nsde.ngs.noaa.gov/", "html"),
    ("noaa_cusp_alaska_zip_head", "https://geodesy.noaa.gov/dist_shoreline/Alaska.zip", "head"),
]
report = {
    "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "aoi": [-133.265, 57.851, -133.135, 57.923],
    "datasets": "NOAA National Shoreline or CUSP, public website diagnostics only",
    "results": {},
}

for key, url, kind in TESTS:
    entry = {"url": url, "mode": kind}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PATROL-Alaska-public-NOAA-audit/1.0"}, method="HEAD" if kind == "head" else "GET")
        with urllib.request.urlopen(req, timeout=30) as resp:
            final = resp.geturl()
            if urllib.parse.urlsplit(final).scheme != "https" or urllib.parse.urlsplit(final).hostname not in ALLOWED:
                raise ValueError("unexpected redirect")
            entry["http_status"] = resp.status
            entry["final_url"] = final
            entry["content_type"] = resp.headers.get("Content-Type")
            entry["content_length"] = resp.headers.get("Content-Length")
            entry["last_modified"] = resp.headers.get("Last-Modified")
            entry["accept_ranges"] = resp.headers.get("Accept-Ranges")
            if kind != "head":
                raw = resp.read(3_000_001)
                if len(raw) > 3_000_000:
                    raise ValueError("capabilities/page response exceeds 3 MB")
                entry["response_bytes"] = len(raw)
                if kind == "xml":
                    root = ET.fromstring(raw)
                    entry["xml_root"] = root.tag
                    entry["features"] = [n.text for n in root.iter() if n.tag.rsplit("}", 1)[-1] == "Name" and n.text][:100]
                    (OUT / f"{key}.xml").write_bytes(raw)
                else:
                    decoded = raw.decode("utf-8", errors="replace")
                    entry["script_src"] = re.findall(r'<script[^>]+src=["\']([^"\']+)', decoded, flags=re.I)[:30]
                    entry["asset_links"] = re.findall(r'(?:https://|/)[^"\' ]+(?:zip|geojson|wfs)[^"\' ]*', decoded, flags=re.I)[:20]
                    (OUT / f"{key}.html").write_bytes(raw)
        print("OK", key, entry.get("content_length"), entry.get("xml_root", ""))
    except Exception as exc:
        entry["error"] = f"{type(exc).__name__}: {str(exc)[:400]}"
        print("FAIL", key, entry["error"])
    report["results"][key] = entry

(OUT / "probe-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("NOAA shoreline service probe completed")
