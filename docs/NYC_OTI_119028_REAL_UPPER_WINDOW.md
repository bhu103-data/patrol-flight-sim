# NYC OTI DOITT_ID 119028 — physical second-storey window sample

## Scope and evidence
- A **single** second-storey window on source polygon edge **12** of NYC OTI `DOITT_ID 119028`, previously inspected using a source-matched street camera; the parent PR now uses a *different* source-anchored west-harbor camera looking at **OTI 65190**. That default parent camera is not evidence for the 119028 upper window. The official source ring midpoint on this edge is approximately game `(-102.88,-487.14)`.
- Changes only the existing runtime `buildOfficialFootprintMesh` renderer within `index.html`; cut the *opaque upper wall itself* into four remaining source-aligned panels. A glass pane is placed **0.12 compressed PATROL world units behind** the source wall, with four connected jamb/lintel/sill return faces. The old floating glass and ornate trim for that window are not generated, so there is no double façade.
- All other 99 official polygons, source footprint and height data, existing terrain/collision index, destroyed buildings, LOD fallback, road geometry, bridge approaches, water, weather, Alaska, Las Vegas, and aircraft flight physics remain unchanged. Existing WebGL2 PBR tags 9 (masonry) and 10 (glass) are reused without new material pass or independent draw call.

## Source and licensing
- [NYC OTI BUILDING dataset (5zhs-2jue)](https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue) and [NYC Open Data terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje) for **footprint and HEIGHT_ROOF only**.
- Reused snapshot `assets/nyc/official-financial-footprints.json` and its documented source query / compressed PATROL projection under `assets/nyc/OFFICIAL_FOOTPRINTS_README.md`.
- Existing PATROL-authored surface geometry and shared native renderer only; no downloaded models, photographs, textures or training. Poly Haven CC0 PBR material information remains in `assets/nyc/PBR_TEXTURE_SOURCES.md`. **Window position, dimensions and finish are explicitly artistic approximation**, not measured architecture or a street-level survey.

## Geometry and performance budget
- Parent PR #106: **8,898** façade quads and **1,164** roof triangles for the 100-building pilot.
- This patch: **8,894** façade quads / **1,164** roof triangles = 17,788 + 1,164 = **18,952** mesh triangles. Replacing the old first-floor glass + multi-face trim yields **four fewer quads** (eight fewer triangles) overall, despite adding a true opening and joined side returns.
- New GLB files: **0**. New texture files: **0**. Independent draw calls: **0**. Original OTI full-pilot hard cap: **under 9,000 façade quads**.
- Node test `tests/nyc-oti-119028-recessed-upper-window.test.mjs` checks source edge, absence of opaque wall at the window center, inset pane, normal direction, four physical reveals, unchanged roof and LOD.
- Browser evidence is still required for this **child branch**: compare the same source-door camera (`12-oti-doorway-street.png`, clear noon and zoom 68) against PR #106 parent using source-matched controls. The default skyline zoom 42 alone cannot prove a tiny upper-wall opening. Report software SwiftShader p50/p95 frame intervals as diagnostics only; hardware FPS and free-flight near-ground collision require separate testing.
- **Draft PR only** layered on PR #106; do not merge child before parent, do not modify `main` or shared integration.

## Branch reconciliation and visual acceptance
This child is based on the latest parent camera and original universal WebGL screenshot health check. The `12-oti-doorway-street.png` screenshot from the parent is now a **65190** west-harbor entrance view, not a view of this `119028` window. Previously captured 119028 A/B snapshots exist but were part of failed whole-scene smoke runs (20 color bins). Do not call this window visually approved or merge until a distinct, unobstructed 119028 camera or actual low-flight screenshot is obtained. The scripted source-window ROI is diagnostic only; all screenshots retain the >32 color-bin health guard.
