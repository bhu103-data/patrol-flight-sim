# NYC MSFS scenery addon import audit (2026-11-23)

Scope: investigate public Flightsim.to addon listings as **candidates** for the PATROL WebGL flight simulator. This file is an audit ledger, **not** a download inventory or evidence of permission to reuse.

## Licensing gate

- Flightsim.to Terms of Service (last updated February 2026), §4.2: creators retain copyright. §4.3 grants the **platform** operational rights; it does not grant PATROL republishing rights. §4.5 grants users access/download/use for **personal, recreational purposes in accordance with the purpose of the service**. §4.13 requires users to assess third-party IP rights. Source: https://flightsim.to/terms
- The standard MSFS download permission is **not a license to extract, modify, convert to WebGL, commit to GitHub, or redistribute inside PATROL**. Author-specific written permission or a compatible published license is needed for each original asset and its dependencies.
- No attempt was made to access the account password or use another person's account: Terms §§1 and 3 restrict sharing credentials/account access.
- Local `workspace/creds.txt`, full addon/attachment manifest, and actual downloaded archives **were not accessible in this execution context**. Therefore archive filenames, hashes, internal model formats, credits in embedded ReadMe files, and conversion quality are NOT verified. No addon archive has been downloaded or imported here.
- The pre-existing PATROL `assets/nyc/scenario-manifest.json` already uses original/authored and audited approved GLBs for WTC, Empire and Chrysler. Preserve these and keep `main` unchanged.

## Public candidate review, sequential order

| Step | Addon / public page | Observed release metadata | Relevant scope | Import gate |
| --- | --- | --- | --- | --- |
| 1 | [20546 New York City Landmarks](https://flightsim.to/addon/20546/new-york-city-landmarks), edpatino | v2.10, 119.75 MB; page says 48 landmarks; requires EDHK Lights & Objects Developers Pack and totof helicopter library V2 | Manhattan, Queens, Bronx, Manhattan heliports | **BLOCKED for PATROL import**: no explicit derivative/redistribution grant identified on listing; embedded ReadMe/credits unavailable; dependencies have separate rights |
| 2 | [35245 New York City – George Washington Bridge](https://flightsim.to/addon/35245/new-york-city-george-washington-bridge), blondejfx | v1.1, 703.02 KB; listing credits ilesoft82 for model | George Washington Bridge | **BLOCKED**: permission needed from model rights holder(s), not just uploader |
| 3 | [35536 New York City – Queensboro Bridge](https://flightsim.to/addon/35536/new-york-city-queensboro-bridge) | v1.0, 3.68 MB | Queensboro / Ed Koch Bridge | **BLOCKED**: no PATROL-compatible redistribution grant identified |
| 4 | [24123 Water fix – New York City, New York, USA](https://flightsim.to/addon/24123/water-fix-new-york-city-new-york-usa) | v1.3.1, 129.62 KB; modular MSFS Community-folder water exclusion package | Harbor, rivers, airport/coast water | **BLOCKED for import**; additionally MSFS scenery exclusion rules are not directly reusable as PATROL GIS/coastline meshes |
| 5 | [81670 New York: POI and improvements](https://flightsim.to/addon/81670/new-york-poi-and-improvements) | publicly listed New York building updates and POI markers | Manhattan, Brooklyn, Queens, broader NY state | **BLOCKED**: no express model/texture derivative and redistribution permission identified |

These five are independently identifiable public candidates, **not claimed to be the user's complete existing addon list**. All statuses relate to redistribution inside PATROL; permitted personal MSFS usage is a distinct matter.

## Required next action for each candidate

1. Obtain an authorized permission/license statement covering asset extraction (if relevant), adaptation to a different renderer/game, distribution through PATROL's public GitHub repository and website, and sublicensing/dependencies where needed.
2. If licensed and archive can be accessed through an authorized process, inventory file list, ReadMe/credits, content hashes, formats, textures and triangle counts before conversion.
3. Convert only cleared mesh/texture components to glTF/GLB with source/author/license metadata. Review scale, orientation, WebGL texture formats, LOD, compression and draw calls.
4. Test in an **isolated PR branch** against the existing GLB import manifest, road/water/building clearance, aircraft collision, map switching, performance and actual Chromium WebGL screenshots. Do not overwrite `main` or existing unrelated branches.
5. If permission is denied or remains ambiguous, use the existing PATROL-authored landmarks and independent permitted datasets (NYC OTI footprints, suitably licensed CC0 assets) instead. Do not copy the MSFS package.

## Execution checkpoint

- Done: verified current PATROL source manifest; checked Flightsim.to public listing metadata for the five candidates; checked current platform Terms.
- Not done: full pre-existing attachment manifest, secure signed-in archive download, ReadMe/mesh inspection, permission grants, import, runtime QA.
- Decision: **zero third-party MSFS models committed** while their cross-game redistribution rights remain unverified.
- Main baseline at audit creation: `6aee03e32cd06967451007d15d5fd9502f92de36`. This record is stored on independent audit branch only.
