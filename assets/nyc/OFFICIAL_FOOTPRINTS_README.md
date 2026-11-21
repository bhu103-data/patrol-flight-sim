# Lower Manhattan municipal building footprint pilot

**Source**: New York City Office of Technology and Innovation (OTI), `BUILDING_view` feature layer 0, via the official public ArcGIS service:

- [Official NYC Open Data dataset](https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue)
- [NYC OTI GIS building metadata](https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md)
- [NYC Open Data terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje)
- [Official ArcGIS feature service](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0)

Snapshot acquired on **2026-11-20**; the source dataset is updated periodically. Exact extraction query and transformation coefficients are embedded next to the records in `official-financial-footprints.json`.

## Scope, fidelity and limitations

- The JSON contains a **non-exhaustive subset of 60 buildings**, selected from the first 150 returned by a roof-height-ordered query inside a limited downtown WGS84 bounding rectangle.
- Exterior footprint polygon **shape topology** and building identifiers originate with the municipal dataset; the **positions and heights are transformed and compressed** into PATROL's fictional world. The output is **not** accurate real-world 1:1 geography, a survey-grade reconstruction, a photogrammetric capture or a complete GIS export.
- The source's `HEIGHT_ROOF` is a height above ground, **in feet**. PATROL scales this field to game units, capped at 48 units; it is not an architectural height including spires.
- The roof mesh ignores interior courtyards/holes, and some nearly collinear vertices can produce one fewer non-degenerate roof triangle while maintaining the same overall roof area.
- This layer complements rather than replaces all the existing Manhattan procedural buildings and authored landmarks. One WTC and other manually authored landmark geometry are preserved.
- No Google Maps imagery, 3D Tiles or third-party model files are copied.

## Runtime and performance

The flight setup loads the **same-origin static JSON** before starting the terrain worker. If it fails, the existing procedural-city path remains available.

During worker terrain generation, anonymous buildings overlapping the 60 municipal polygon footprints are omitted. The worker generates matching roof elevations; the main-thread collision lookup tests the polygon, not only its rectangular bound. Official building walls and triangular roofs are **batched into the existing city mesh**, without separate per-building draw calls. Both the static JSON and polygon window generation are geographically bounded.

## Test

```bash
node --test tests/nyc-oti-footprints.test.mjs
```

Tests cover data provenance, polygon geometry, roof-area coverage, bounded dimensions, worker parcel generation and collision-path integration.

**Browser smoke-testing remains required** on supported WebGL2 hardware before treating any FPS or visual improvement as measured.
