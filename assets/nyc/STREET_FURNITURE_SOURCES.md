# Manhattan street furniture V11 — design references and limits

This model is an **original procedural game-scale interpretation** of NYC
street details, not a City GIS street-furniture inventory or measured street
survey. Everything is bounded to PATROL's Manhattan WebGL2 map.

## References
- NYC DOT, *NYC Street Design Manual — Furnishings*
  https://www.nycstreetdesign.info/furniture
- NYC DOT, *Bus Stop Shelter*
  https://www.nycstreetdesign.info/furniture/bus-stop-shelter
- NYC DOT, *Pedestrian Mobility Plan* (street furniture/clear walking zone)
  https://www.nyc.gov/html/dot/html/pedestrians/pedestrian-mobility.shtml
- NYC DOT, *WalkNYC wayfinding signs*
  https://www.nyc.gov/html/dot/html/pedestrians/walknyc.shtml
- NYC Street Design Manual, *Furniture Siting Guidelines*
  https://www.nycstreetdesign.info/sites/default/files/2020-02/Furniture_Siting_Guidelines.pdf

## Implementation
- Curated low-budget set of sidewalk furniture types: glazed steel bus-stop
  shelter, CityRack-like bike racks, WalkNYC-style map kiosks, street trees
  with granite tree beds, bent-arm streetlights, and detectable-warning pads.
- Original meshes/colors only; no NYC DOT/JCDecaux/brand logos or proprietary
  advertisements reproduced. Their design is for visual reference only.
- Models are not exact locations or permitted actual New York installations.
- Uses cityLotAt on center and four corners to exclude known existing building
  footprints. This is approximate clearance, not a legal sidewalk site plan.
- Cap of 82 additional street furniture groups, including no more than 12
  shelters, 26 bike-rack groups, 17 wayfinding signs, 26 tree pits and 25
  streetlights, located only at detailed roads. Many site candidates are
  deliberately rejected.
- Food cart wheels sit at the ground surface, with 10-sided umbrellas,
  stainless facings and separate condiments; props are no longer placed in
  water or occupied building volumes.
- Asphalt texture and building visuals remain managed by the existing WebGL2
  renderer and CC0 atlas.
- New traffic signal meshes still display static phases. Vehicle stopping,
  pedestrian countdown and synchronizing intersection phases are **not yet
  fully implemented**, and should not be described as such.

## Verification
- JavaScript module and three inline game scripts parse.
- Independent simulated geometry/finite-coordinate tests pass, including
  an all-buildings-rejected collision test.
- Real browser visual/asset loading performance should be checked separately.
