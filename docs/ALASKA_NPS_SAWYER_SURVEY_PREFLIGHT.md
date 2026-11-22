# Alaska Sawyer / South Sawyer — NPS 2.5 m survey source preflight

Status: **read-only acquisition gate, not a terrain integration**. This branch
neither changes PATROL runtime nor distributes third-party model/texture bytes.

## What is known from the US Government source catalog

Publisher: US National Park Service DataStore reference **2314560**.
Official discovery:
https://catalog.data.gov/dataset/multi-decadal-observations-of-glacier-thinning-survey-geotiffs
NPS metadata:
https://irma.nps.gov/DataStore/Reference/Profile/2314560

| Claimed archive | NPS resource | Official listed download |
| --- | --- | --- |
| Sawyer_2p5m.zip | 744015 | https://irma.nps.gov/DataStore/DownloadFile/744015?Reference=2314560 |
| SouthSawyer_2p5m.zip | 744024 | https://irma.nps.gov/DataStore/DownloadFile/744024?Reference=2314560 |

The catalog describes **2.5 m pixel GeoTIFFs** from airborne lidar
surveys spanning **1994–2022**. It says rasters are in the glacier's
**local UTM projection**; ZIP contents, survey dates, actual footprints,
NoData, and vertical reference have not yet been inspected. These may be
sparse survey flight strips, **not** a complete 2.5 m DEM of Tracy Arm.
Public US-government source does not remove the need to retain provenance.

NPS data are **not a verified 2026 glacier front**. The USGS reports that the
**2025-08-10 South Sawyer landslide and tsunami** changed the local scene:
https://www.usgs.gov/programs/landslide-hazards/science/2025-tracy-arm-landslide-generated-tsunami

## Reproducible, limited probe

    python3 tests/test_alaska_nps_survey_preflight.py
    python3 tools/alaska/probe_nps_sawyer_surveys.py --offline
    python3 tools/alaska/probe_nps_sawyer_surveys.py --timeout 20

The network probe:
- requests HTTP HEAD (which may fail without disqualifying a valid source);
- requests only the first 64 bytes via HTTP Range, **reads at most 16 bytes**
  even if a server ignores Range, and closes the response immediately;
- records status, MIME, Content-Range, reported length if available and first
  8 signature bytes (not the file contents);
- rejects HTML/JSON error pages and a response without ZIP local header
  PK 03 04; saves JSON regardless of success or failure;
- returns a failing status for any blocked source.

Even PASS_LIMITED_HTTP_PROBE proves **only** a reachable ZIP *header*, not
a successful full archive download, source SHA256, GeoTIFF entries, coordinate
systems, licensed texture, or any visual/game performance. An inaccessible
endpoint is reported BLOCKED, not silently replaced with an invented asset.

The isolated GitHub workflow uploads JSON for reproducible review and leaves
the source branch a **Draft**.

## Critical geographic identity and elevation-datum caveat (source verified)

**Do not infer a Tracy Arm glacier from `Sawyer` in a filename.**
The official [NPS source README](https://irma.nps.gov/DataStore/DownloadFile/747319?Reference=2314560)
specifically describes `Sawyer_2p5m.zip` as containing
`SawyerCanada`, `SawyerEast`, and `SawyerWest`.
The DOI [catalog spatial extent](https://catalog.data.gov/dataset/multi-decadal-observations-of-glacier-thinning-survey-geotiffs)
is **[-158.342865,56.6082,-135.094727,68.43901]** (WGS84
lon/lat bounding box). Its east bound **-135.094727** lies well west of
the actual Tracy Arm Sawyer/South Sawyer study extent **[-133.2893,
57.7280,-132.9704,58.0102]** in NOAA AK1803-CM-T. Either these
packages are another named glacier group or the *aggregate catalog
spatial metadata* is inaccurate. We must inspect **each original
GeoTIFF's transformed footprint**, not trust a matching name or the
catalog aggregate rectangle. A geographic envelope overlap is at most
a *candidate*: NoData can still occupy all overlapping pixels.

The same original NPS README specifies 32-bit float heights
**above the WGS 84 ellipsoid**, source horizontal coordinates in
glacier-local UTM meters, and **NoData -9999**. Those ellipsoid
heights **cannot** be mixed directly with a 3DEP or tide-gauge
**orthometric/tidal** height without verifying the other source's
vertical reference and using an explicit geoid/datum conversion.
The archived measurements are 1994–2022, not a 2026 glacier front.

The audit's two-archive PASS gate requires each package to have at
least one GeoTIFF bounding box intersect the documented NOAA study AOI.
If either archive is outside, it exits nonzero as
`BLOCKED_GEOGRAPHIC_IDENTITY`, preserving SHA256/extent evidence.
Even a `BOTH_GEOGRAPHIC_CANDIDATES_METADATA_ONLY` result does not
certify valid raster pixels, a 2026 ice edge, or game integration.

## Actual NPS full-ZIP provenance (verified; historical surveys only)

Completed GitHub [full-download QA #45040122846](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040122846),
[original JSON artifact #14761785937](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040122846/artifacts/14761785937).
Source branch head at that run: `afcd7711167249d5826f1fb778ab43acd250a34d`.
The job **downloaded both complete ZIP archives, opened them and read
each TIFF's geotags**, before deleting all source raster bytes.
Only metadata JSON was uploaded:

| NPS source | ZIP bytes | ZIP SHA-256 | Actual GeoTIFFs | NOAA study box overlap | Old game box overlap |
| --- | ---: | --- | ---: | ---: | ---: |
| Sawyer 744015 | 210,863,678 | `c38f2f9a82ca6b37516850ca1591e7fd0a6b4812907de7e49033a0578d52ced2` | 6 (2009, 2010, 2011, 2013, 2016, 2020) | 6/6 | 6/6 |
| SouthSawyer 744024 | 268,850,370 | `77cc291293542a0fb559e644ed2fc16e2657c85801897eefa27f88ba817542af` | 8 (2000, 2009, 2010 twice, 2011, 2013, 2016, 2020) | 7/8 | 4/8 |

The original TIFFs report **2.5 m** XY spacing, `NoData=-9999`,
WGS84 UTM zone 8N (`EPSG:32608` horizontal or compound CRS).
`SouthSawyer.2020.157.2p5m.tif` WGS84 bbox:
`[-133.1182196,57.5771063,-132.5219717,57.9595571]`.
This 2020 TIFF envelope overlaps the NOAA Tracy Arm study AOI,
but **does not overlap the old PATROL DEM bbox**.

The DOI **aggregate** dataset bbox east bound of -135.094727 is
demonstrably incompatible with these original TIFF geotags near
-133/-132. Thus the aggregate spatial summary is unreliable for
these particular files. Do not reject them as 'wrong Sawyer' solely from
the aggregate rectangle; nor infer valid lidar pixels or an observed
2026 glacier margin just because a TIFF bounding rectangle overlaps.

### New valid-pixel sample check

The full audit now has an explicit opt-in `--sample-valid-pixels`
mode: for each actual TIFF it reads a nearest-neighbour sampled
**maximum 512×512** grid of the projected NOAA study window,
checks source NoData/finite pixel masks, transforms each candidate
sample's centre back to **WGS84**, and counts only pixels inside the
actual geographic study bbox. Passing requires a **positive** valid
measurement sample in each of the two source packages. **Zero sample
hits are inconclusive for thin/sparse lidar strips** and must block
acceptance, not be called a proven absence of data. Likewise, a
positive hit proves a source sample exists but **does not measure complete
terrain coverage**. Pixel-specific survey epoch, vertical reference,
NoData masks, post-2025 glacier shape and local collision/flight
integration remain independently gated.

## Next genuine data milestone (NOT performed by this patch)

1. Confirm ZIP size from a verified response; then obtain a bounded full ZIP
   via an approved source and compute SHA256. Never auto-extract arbitrary
   archive paths or accept corrupt/oversized ZIP entries.
2. List all GeoTIFF survey dates and valid 2.5 m raster footprints in source
   UTM CRS, including per-raster affine transforms, vertical datum and NoData.
   Compute **real** geographic coverage for each glacier and the map AOI.
3. Choose a time-identified glacier surface and separately the rocky/coastal
   **USGS 5 m IfSAR** terrain coverage; do not use lidar strips to pretend
   to fill the whole fjord.
4. Reconcile NPS elevation vertical reference, NOAA shore tidal/water datum
   and the WGS84/ENU foundation in Draft #230. NOAA CUSP shoreline evidence
   and active waterline discrepancy are already in Draft #201. Do not duplicate
   that shoreline extraction.
5. Only then implement an independent opt-in geographic tile with shared CPU,
   terrain worker, shader, floatplane water height and collision transform.
   Require four fixed-game camera/altitude/heading real-world comparisons and
   native GPU cost metrics. Keep old map fallback untouched.

No edits to main, shared integration, #201, #212, #230, or other maps.
