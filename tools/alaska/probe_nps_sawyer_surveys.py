#!/usr/bin/env python3
"""Read-only, bounded HTTP byte preflight for NPS Sawyer glacier survey ZIPs.

This does NOT download whole archives, inspect GeoTIFF/CRS, or change PATROL
terrain. Successful ZIP signatures prove reachability, not geographic coverage.
"""
import argparse
import json
import pathlib
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

CATALOG = (
    "https://catalog.data.gov/dataset/"
    "multi-decadal-observations-of-glacier-thinning-survey-geotiffs"
)
SOURCES = (
    ("Sawyer", "744015"),
    ("SouthSawyer", "744024"),
)
ROOT = "https://irma.nps.gov/DataStore/DownloadFile/"
REFERENCE = "?Reference=2314560"
USER_AGENT = "PATROL-GIS-source-preflight/1.0 (read-only public data QA)"


def download_url(file_id):
    if not file_id.isdecimal():
        raise ValueError("NPS resource ID must contain digits only")
    return ROOT + file_id + REFERENCE


def is_archive_header(content_type, prefix):
    """Reject an HTML/error page pretending to be a downloaded archive."""
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime in ("text/html", "text/plain", "application/json"):
        return False
    return prefix.startswith(b"PK\x03\x04")


def inspect(name, file_id, timeout):
    record = {
        "name": name,
        "resource_id": file_id,
        "publisher": "US National Park Service",
        "listed_zip": name + "_2p5m.zip",
        "catalog": CATALOG,
        "url": download_url(file_id),
        "status": "BLOCKED",
        "head_status": None,
        "get_status": None,
        "content_type": None,
        "head_content_length": None,
        "content_range": None,
        "signature_hex": None,
        "final_host": None,
        "bytes_read": 0,
        "error": None,
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/zip,*/*"}
    try:
        req = Request(record["url"], headers=headers, method="HEAD")
        with urlopen(req, timeout=timeout) as response:
            record["head_status"] = response.status
            record["head_content_length"] = response.headers.get("Content-Length")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        # HEAD may legitimately be unsupported. GET Range is the decisive step.
        record["head_error"] = str(exc)[:240]

    try:
        req = Request(record["url"], headers={
            **headers, "Range": "bytes=0-63", "Accept-Encoding": "identity"
        }, method="GET")
        with urlopen(req, timeout=timeout) as response:
            record["get_status"] = response.status
            record["content_type"] = response.headers.get("Content-Type")
            record["content_range"] = response.headers.get("Content-Range")
            record["final_host"] = urlparse(response.geturl()).hostname
            if response.status not in (200, 206):
                raise ValueError("Unexpected HTTP " + str(response.status))
            # If a server ignores Range, read only 16 bytes then close.
            prefix = response.read(16)
            record["bytes_read"] = len(prefix)
            record["signature_hex"] = prefix[:8].hex()
            if not is_archive_header(record["content_type"], prefix):
                raise ValueError("Response is not a ZIP local-file header")
            if response.status == 206:
                span = record["content_range"] or ""
                if not span.startswith("bytes 0-"):
                    raise ValueError("HTTP partial response did not start at byte 0")
            record["status"] = "REACHABLE_ZIP_HEADER_ONLY"
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        record["error"] = (type(exc).__name__ + ": " + str(exc))[:400]
    return record


def run(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true",
                        help="emit pinned source manifest without network access")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--output",
                        default="artifacts/alaska-nps-sawyer-source-preflight.json")
    args = parser.parse_args(argv)
    if not 1 <= args.timeout <= 60:
        parser.error("timeout must be between 1 and 60 seconds")
    result = {
        "scope": "read-only range preflight, NOT a complete GeoTIFF audit",
        "license_claim": "NPS government public-domain catalog; reconfirm per ZIP",
        "survey_period_catalog": "1994-2022 (NOT a post-2025 glacier survey)",
        "catalog": CATALOG,
        "network_tested": not args.offline,
        "sources": [
            (inspect(name, file_id, args.timeout) if not args.offline else {
                "name": name, "resource_id": file_id,
                "url": download_url(file_id), "status": "NOT_NETWORK_TESTED"
            })
            for name, file_id in SOURCES
        ],
        "not_verified": [
            "complete ZIP bytes and SHA256",
            "GeoTIFF entries and survey timestamps",
            "raster footprint, CRS, vertical datum and NoData",
            "fitness for a post-2025 South Sawyer glacier front",
            "game WebGL integration and hardware performance",
        ],
    }
    result["status"] = ("CATALOG_ONLY" if args.offline else
        "PASS_LIMITED_HTTP_PROBE" if all(
            item["status"] == "REACHABLE_ZIP_HEADER_ONLY"
            for item in result["sources"]) else "BLOCKED")
    path = pathlib.Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if args.offline or result["status"] == "PASS_LIMITED_HTTP_PROBE" else 2


if __name__ == "__main__":
    sys.exit(run())
