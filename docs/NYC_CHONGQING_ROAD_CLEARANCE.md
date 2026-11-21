# Road and building non-overlap — Manhattan / Chongqing

Implemented on `main`, November 2026. These are **compressed game-space reconstructions**, not a 1:1 surveyed street and building dataset.

## Safety contract

**No procedural building is allowed to overlap the physical area of a generated road.** Road width includes sidewalk/curb envelope and 0.8–2.35 extra game units where appropriate. Test the building's whole footprint rather than only its center. Never leave a building collider behind when the corresponding mesh is removed.

**NYC:** The launcher (`index.html`) checks 2D intersections between generated city parcels and the `CITY_STREETS` centerlines plus the waterfront expressway and its ramps, expanding the test by 5.85 units. Conflicting parcels are removed from both `cityLots` and the collision spatial hash (not merely hidden visually). `assets/nyc/nyc-street-network.js` additionally samples the full width of each procedurally drawn avenue, cross street, curb and sidewalk with at most 1.8-unit spacing and conservative 0.95-unit square clearance probes, skipping an affected road if any building is present. Painted crossings only appear when *both* connecting streets survived and every tested intersection corner is clear. Street furniture, shelters, tree pits and food-cart canopy spaces use a larger 2.35-unit radius so they cannot intersect walls. The more faithful authored Broadway/Times Square district retains its previously protected plaza and GIS bands.

**Chongqing:** `assets/chongqing/road-clearance.js` defines the six canonical curved terrace street paths, an exact segment-to-expanded-rectangle intersection test and an elevation-aware road clipper. `urban-architecture.js` rejects the **full visible + collision** tower footprint near any street, any of the two long bridges, or an adjacent tower. The final asphalt paths are built **after** all background towers, Hongyadong details, Raffles City and Liziba add their colliders. They are cut at the actual occupied boundary rather than painted underneath. True high bridge undersides are intentionally passable by roads at a different elevation.

Chongqing street centerlines, black/white taxi markings, curb geometry, yellow taxis, pedestrian crossings, traffic poles, wet asphalt and lamp-reflection decals use the **same shared 72-unit collision spatial index**. A taxi that reaches a blocked corridor reverses rather than going through a building. Crossings choose a free site if the original hotpot-side street is occupied. No expensive full-city O(N buildings) test runs independently for every taxi each frame.

## Testing

- `node --test tests/chongqing-road-clearance.test.mjs`: exact swept segment/box tests, clipping, elevated underpasses, coherent six-road layouts and actual procedural tower placement. A fixed-seed run produced **210 city background towers with zero road/bridge/other-tower footprint collisions**.
- `node --test tests/chongqing-street-occupancy.test.mjs`: deliberate obstructing buildings; validates taxis, crossing relocation, lamps, road paint, puddles and lamp reflection patches.
- `node --test tests/nyc-road-clearance.test.mjs`: Manhattan gridded asphalt, sidewalk, crosswalk, expressway/ramp and city parcel protection, using the real module and controlled fixtures including a narrow wall placed between former samples.
- `node --test tests/chongqing-*.test.mjs tests/nyc-road-clearance.test.mjs`: both maps' regressions.
- GitHub Actions: `.github/workflows/chongqing-visual.yml` runs unit tests and launches Chromium for NYC and Chongqing screenshots. Screenshots and failure reports go to the workflow artifact, when the workflow actually runs.

**Known limits:** Geometric probes are conservative for safety and may result in a shorter road or a vacant city parcel instead of an overlap. Existing non-road decorative objects and intentional structural overlaps (e.g. a bridge attached to its own pylon) are not treated as accidental road/building collisions. The available environment has **not yet validated real GPU screenshots or measured FPS**; do not claim an unconditional zero-overlap guarantee for assets outside these generation paths until a browser visual pass is performed.
