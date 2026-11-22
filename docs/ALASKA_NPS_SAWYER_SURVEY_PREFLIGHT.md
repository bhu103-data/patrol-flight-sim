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
