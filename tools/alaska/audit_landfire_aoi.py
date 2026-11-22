#!/usr/bin/env python3
"""Read-only Tracy Arm LANDFIRE 2025 / USGS 3DEP alignment audit.

Runs only in CI/offline QA. Never rewrites PATROL's elevation, collision, shore
or aircraft systems. Input files must be officially sourced AOI TIFFs.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject

BBOX = (-133.265, 57.851, -133.135, 57.923)
GRID = 256
GAME_SPAN = 1920
SAMPLE_POINTS = {
    "alaska_respawn": (-19, -667),
    "harbor": (151, -525),
    "upper_glacier": (130, 558),
}

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def decode_dem(path: Path) -> np.ndarray:
    data = json.loads(path.read_text())
    if (data.get("format") != "usgs-3dep-u16le-v1"
        or data.get("width") != GRID or data.get("height") != GRID
        or data.get("bbox") != list(BBOX)
        or data.get("crs") != "EPSG:4326"):
        raise ValueError("Unexpected USGS DEM format, dimensions, CRS, or bounding box")
    raw = base64.b64decode(data["heightsBase64"], validate=True)
    if len(raw) != GRID * GRID * 2:
        raise ValueError("Invalid USGS height count")
    # Source DEM explicitly uses south-first rows.
    return np.frombuffer(raw, dtype="<u2").reshape(GRID, GRID)

def aligned_raster(path: Path) -> tuple[np.ndarray, dict]:
    with rasterio.open(path) as source:
        if (source.count != 1 or source.crs is None or
            source.crs.to_epsg() != 3338 or source.dtypes[0] != "int16"):
            raise ValueError(f"Unexpected official LANDFIRE TIFF: {path}")
        dest = np.zeros((GRID, GRID), dtype=np.int16)
        reproject(
            source=rasterio.band(source, 1), destination=dest,
            src_transform=source.transform, src_crs=source.crs,
            src_nodata=source.nodata,
            dst_transform=from_bounds(*BBOX, GRID, GRID),
            dst_crs="EPSG:4326", dst_nodata=0,
            resampling=Resampling.nearest
        )
        detail = {
            "source_sha256": digest(path.read_bytes()),
            "bytes": path.stat().st_size,
            "source_crs": source.crs.to_string(),
            "source_bounds": list(source.bounds),
            "source_pixel_type": source.dtypes[0],
            "source_nodata": source.nodata,
        }
    # Rasterio writes north-first rows; DEM and PATROL use south-first.
    return np.flipud(dest).copy(), detail

def erode_1px_land(land: np.ndarray) -> np.ndarray:
    # Conservative terrain-only border: no tree within one DEM pixel of water.
    pad = np.pad(land, 1, mode="constant", constant_values=False)
    safe = land.copy()
    for di in range(3):
        for dj in range(3):
            safe &= pad[di:di + GRID, dj:dj + GRID]
    return safe

def nearest_game_cell(x: int, z: int) -> tuple[int, int]:
    # Confirmed by tests/alaska-usgs-dem.test.mjs: north -> geographic east.
    u, v = x / GAME_SPAN + 0.5, z / GAME_SPAN + 0.5
    col = min(GRID-1, max(0, int(round(v * GRID - .5))))
    row = min(GRID-1, max(0, int(round((1-u) * GRID - .5))))
    return row, col

def write_gzip(path: Path, data: np.ndarray) -> dict:
    raw = data.astype(np.uint8, copy=False).tobytes()
    with path.open("wb") as target:
        with gzip.GzipFile(fileobj=target, mode="wb", filename="", mtime=0,
                           compresslevel=9) as gz:
            gz.write(raw)
    return {
        "file": path.name, "uncompressed_bytes": len(raw),
        "compressed_bytes": path.stat().st_size,
        "sha256": digest(path.read_bytes()),
    }

def run(input_dir: Path, dem_path: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    dem = decode_dem(dem_path)
    data, sources = {}, {}
    for layer in ("EVT", "EVC", "EVH"):
        path = input_dir / f"LANDFIRE_{layer}_AOI.tif"
        if not path.is_file():
            raise FileNotFoundError(path)
        data[layer], sources[layer] = aligned_raster(path)
        if np.count_nonzero(data[layer] == 0):
            raise ValueError(f"{layer} has zero/unmapped cells after reprojection")

    evc, evh, evt = data["EVC"], data["EVH"], data["EVT"]
    # USGS LF2025 cover + vegetation height dictionary categories.
    water, snow = evc == 11, evc == 12
    bare, sparse = evc == 31, evc == 100
    tree = (evc >= 110) & (evc <= 199)
    shrub = (evc >= 210) & (evc <= 299)
    herb = (evc >= 310) & (evc <= 399)
    categories = [water, snow, bare, sparse, tree, shrub, herb]
    category_names = ["water", "snow_ice", "bare", "sparse",
                      "trees", "shrub", "herb"]
    if not np.all(np.sum(np.stack(categories), axis=0) == 1):
        raise ValueError("Unknown or overlapping EVC class IDs")
    if not np.array_equal(tree, (evh >= 101) & (evh <= 199)):
        raise ValueError("Tree lifeform differs between EVC and EVH")
    if not np.array_equal(water, evh == 11):
        raise ValueError("Water category differs between EVC and EVH")

    dem_land = dem > 3
    dem_water = ~dem_land
    water_on_dem_land = water & dem_land
    landcover_on_dem_water = (~water) & dem_water
    trees_on_dem_water = tree & dem_water
    safe_terrain = erode_1px_land(dem_land)
    safe_tree = tree & safe_terrain

    report = {
        "kind": "PATROL_ALASKA_LANDFIRE_USGS_DEM_READONLY_QA_V1",
        "status": "DIAGNOSTIC_ONLY_NOT_RUNTIME_INTEGRATED",
        "real_source": "USGS LANDFIRE 2025 Alaska EVT EVC EVH ImageServer",
        "license": "U.S. public-domain USGS data, resampled and filtered; original source and changes retained",
        "bbox_wgs84": list(BBOX),
        "grid": [GRID, GRID],
        "orientation": "south-first; game mapping rotates source 90 degrees once",
        "resampling": "EPSG:3338 to EPSG:4326 nearest neighbor",
        "source_tiffs": sources,
        "dem_sha256": digest(dem_path.read_bytes()),
        "valid_pixels": GRID * GRID,
        "category_counts": {name: int(mask.sum()) for name,mask in zip(category_names,categories)},
        "coastline_comparison": {
            "dem_water_cells_height_le_3m": int(dem_water.sum()),
            "landfire_water_cells": int(water.sum()),
            "both_water_cells": int((water & dem_water).sum()),
            "landfire_water_on_dem_land_cells": int(water_on_dem_land.sum()),
            "landfire_nonwater_on_dem_water_cells": int(landcover_on_dem_water.sum()),
            "landfire_trees_on_dem_water_cells": int(trees_on_dem_water.sum()),
            "water_mismatch_fraction_all_pixels": round(
                float((water_on_dem_land | landcover_on_dem_water).mean()), 6),
        },
        "tree_safety": {
            "original_tree_cells": int(tree.sum()),
            "safe_tree_cells": int(safe_tree.sum()),
            "removed_tree_cells": int((tree & ~safe_tree).sum()),
            "safe_tree_on_dem_water_cells": int((safe_tree & dem_water).sum()),
            "buffer": "one full DEM cell (3x3 erosion of land); not GIS-verified shoreline",
            "does_not_place_individual_trees": True,
        },
        "game_sample_points": {},
        "limitations": [
            "USGS 3DEP and LANDFIRE 2025 are not contemporaneous.",
            "DEM elevation <=3m is an approximate water classification, not NOAA surveyed shoreline.",
            "No collision, flight physics, existing forest geometry, or shading changed.",
            "A safe-tree staging mask does not validate a WebGL frame rate.",
        ],
    }
    for name, (x,z) in SAMPLE_POINTS.items():
        row,col = nearest_game_cell(x,z)
        report["game_sample_points"][name] = {
            "game_xz": [x,z], "southfirst_row_col": [row,col],
            "dem_elevation_m": int(dem[row,col]),
            "landfire_evc_code": int(evc[row,col]),
            "landfire_evt_code": int(evt[row,col]),
            "source_tree": bool(tree[row,col]),
            "safe_tree": bool(safe_tree[row,col]),
        }
    report["outputs"] = [
        write_gzip(output_dir / "safe_tree_dem_margin1.southfirst.u8.gz",
                   safe_tree),
        write_gzip(output_dir / "dem_water.southfirst.u8.gz", dem_water),
    ]
    (output_dir / "alignment-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("alaska-official-aoi-results"))
    parser.add_argument("--dem", type=Path, default=Path("assets/alaska/tracy-arm-3dep.json"))
    parser.add_argument("--output", type=Path,
                        default=Path("alaska-official-aoi-results/qa"))
    args = parser.parse_args()
    results = run(args.input, args.dem, args.output)
    print(json.dumps({
        "coastline_comparison": results["coastline_comparison"],
        "tree_safety": results["tree_safety"],
        "game_sample_points": results["game_sample_points"],
        "outputs": results["outputs"],
    }, indent=2))
