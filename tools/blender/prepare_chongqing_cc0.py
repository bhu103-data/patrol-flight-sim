"""Fetch two explicitly allowlisted Poly Haven CC0 photographs for Blender.

Optional (offline material defaults are retained when not downloaded):
    python tools/blender/prepare_chongqing_cc0.py

Images are NOT copied from Google Maps, another game, or paid Scenario models.
Sources are consistent with the existing PATROL Chongqing PBR runtime.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import os
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "generated"
MAX_IMAGE_BYTES = 3 * 1024 * 1024
SOURCES = {
    "wood_planks_diff_1k.jpg": (
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/"
        "wood_planks/wood_planks_diff_1k.jpg"
    ),
    "clay_roof_tiles_03_diff_1k.jpg": (
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/"
        "clay_roof_tiles_03/clay_roof_tiles_03_diff_1k.jpg"
    ),
}


def validate_jpeg(data: bytes, name: str) -> None:
    if not 1024 <= len(data) <= MAX_IMAGE_BYTES:
        raise ValueError(f"Texture {name} is outside budget: {len(data)} bytes")
    if data[:2] != b"\xff\xd8" or data[-2:] != b"\xff\xd9":
        raise ValueError(f"Texture {name} was not a valid JPEG stream")


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        output = TARGET / name
        if output.is_file():
            data = output.read_bytes()
            validate_jpeg(data, name)
            print(f"Reused approved CC0 image: {name}, sha256={sha256(data).hexdigest()}")
            continue
        request = Request(url, headers={"User-Agent": "PATROL-CC0-Blender-Authoring/1.0"})
        with urlopen(request, timeout=45) as response:
            data = response.read(MAX_IMAGE_BYTES + 1)
        validate_jpeg(data, name)
        temporary = output.with_suffix(".part")
        try:
            temporary.write_bytes(data)
            os.replace(temporary, output)
        finally:
            temporary.unlink(missing_ok=True)
        print(f"Downloaded Poly Haven CC0 image: {name}, sha256={sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
