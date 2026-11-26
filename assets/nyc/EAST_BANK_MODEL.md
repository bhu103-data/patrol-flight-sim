# East River and South Bronx building models

Source: the [TUM NYC CityGML LoD1 open-data release](https://www.asg.ed.tum.de/en/gis/projects/3d-city-model-of-new-york-city/), using the local archive
`work/nyc-full/NYC_Buildings_CityGML_20150907.zip`. Borough selection uses
the first digit of the New York Building Identification Number. The build
reads the archive directly, retains each building's polygon at ground level,
and derives height from its source envelope. It does not substitute rectangles
for the source outline.

From the project root:

```sh
python tools/nyc/build-east-bank-footprints.py work/nyc-full/NYC_Buildings_CityGML_20150907.zip assets/nyc/east-bank-footprints-v2.json
node --test tests/nyc-manhattan-coverage.test.mjs
```

Geometry covers the Brooklyn, western Queens and South Bronx portions that
fit the flight scene. Coordinates are adapted to its compressed geography,
not a 1:1 map. Runtime water, clearance, overlap and per-cell limits reduce the
number of rendered parcels. Brick, windows and roof materials are authored
approximations, not archival facade textures. The 2015 source is not current.

## Manhattan and runtime data

The Manhattan snapshot is derived from [NYC Open Data Building Footprints](https://data.cityofnewyork.us/City-Government/Building-Footprints/5zhs-2jue)
via the [manhattan-3d packed source](https://github.com/anchitjaincfa/manhattan-3d).
To regenerate the Manhattan JSON, place that project's
`data/manhattan_payload.json` at `assets/nyc/source/manhattan_payload.json` and run
`node tools/nyc/build-manhattan-footprints.mjs` from the project root.

Regenerate both runtime packs with `node tools/nyc/pack-runtime-footprints.mjs`.
The browser prefers the compact packs and falls back to the matching JSON.
Raw archives, experimental GLBs, and local backups are not required.
