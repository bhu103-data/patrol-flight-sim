# NYC reality reconstruction — reference protocol (2026-11-20)

PATROL stays a WebGL2 flight game; it is **not** a Google Earth scrape.

## Scene reference & legal sources
* Visual location verification: https://www.google.com/maps/search/?api=1&query=Times+Square+New+York
* Google photorealistic 3D model service: https://developers.google.com/maps/documentation/tile/3d-tiles-overview
* The Google Map Tiles API requires a project/API key, billing, terms compliance, tile copyright attributions and **live retrieval**. Do not download, copy, trace, convert, or redistribute Google's imagery or 3D mesh in this repository: https://developers.google.com/maps/documentation/tile/policies
* NYC municipal official footprints with height_roof: https://data.cityofnewyork.us/d/3g6p-4u5s
* NYC digital twin reference: https://github.com/mkturkcan/valdrada — WebGL2/MIT software; underlying city datasets need individual license compliance. A source of facade typology, street widths, building footprints and streaming design.
* OpenStreetMap (if used): https://www.openstreetmap.org/copyright — ODbL attribution and share-alike obligations for derivatives.
* Landmark architectural sources:
  * Empire State: https://www.esbnyc.com/about/facts-figures
  * Liberty: https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm
  * Brooklyn Bridge: https://whc.unesco.org/en/tentativelists/6232
* Asset materials: Poly Haven CC0, see assets/nyc/THIRD_PARTY_NOTICES.md.

## Landmark materials and visual targets
1. **Empire State Building**: warm Indiana limestone with measurable relief, granite at ground, aluminum/stainless ornaments and dark red original-window metalwork. Model floor spacing, Art Deco vertical piers, setbacks and the mast; never substitute a 13 KB approximation merely because it is a GLB.
2. **Chrysler**: white-grey brick and stainless steel tiered arched crown, recessed window bays and distinguishable spire.
3. **Statue of Liberty**: hammered copper sheets with nonuniform verdigris, granite-clad pedestal, actual robe silhouette, crown rays, tablet, and reflective gilt torch flame.
4. **Brooklyn Bridge**: Gothic stone towers, four main steel cables, droppers and diagonal stays, raised pedestrian timber boardwalk, anchorages, truss understructure; maintain road/ship collision bounds.
5. **Times Square**: massive static LED panels (different artwork per screen, real screen frames, pixels at near range), store glazing, illuminated cornices and controlled rain reflections. Do not copy current real advertising photography or brand trademarks without permission.
6. **One WTC**: changing diamond glass sections, reflective low-iron glazing, narrow tapered prismatic shape, antenna.
7. **Street life**: sedan-car proportions, rounded wheels, taxi sign, patrol lightbar, aircraft nacelles/canopy, harbor ferry decks and safety rails.

## Engine constraints
* Existing scene uses invented positions and a nonuniformly compressed city coordinate system. `landmark-reference.json` stores independent GPS reference values alongside existing PATROL game x/z. **It cannot yet be advertised as 1:1 survey scale**.
* Do not use Google GPS values to reconstruct new geometry from Google Maps imagery; derive geometry from independent NYC Open Data and authorized 3D model sources.
* Use near-hero meshes only in nine focus zones; decimate far city, 3D occlusion / LOD, max ~512-2048px atlas per material.
* Validate actual WebGL2 rendering, runtime FPS and camera screenshots before claiming AAA realism.
