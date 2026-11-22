# Las Vegas: Venetian Campanile belfry — visual and source audit

## Scope

Only the existing game-space Venetian campanile at x=-11, z=8 is remodeled.
The former opaque 4.32-unit upper cube is replaced with a real open belfry:
four corner piers, three arched openings on each of four faces, 96 voussoir
quads, a cap and stone stringcourses, plus narrow shaft openings and brick
corner pilasters. The original clock, spire, canals and traffic are preserved.

The gameplay scene is spatially compressed. This is a **reference-inspired
authored lightweight model, not a survey or photogrammetric reconstruction**.
No building photographs, commercial materials or third-party meshes are
included, downloaded or redistributed.

## Source / permissions

* The Venetian Resort's own architectural description confirms the campanile
  is modeled after the Venetian original, with bell tower detailing:
  https://www.venetianlasvegas.com/resort/attractions/art-and-architecture.html
* General visual cues can be checked in building imagery; no copyrighted
  image is embedded or texture sampled. Colors and vertices are authored here.
* The new code is governed by the repository's existing license. This patch
  adds no separate dependency or licensed asset.

## Explicit preservation

* The original `solidAt('Venetian Campanile', -11, 8, ground,
  ground+16.4, 1.925, 1.925)` collision volume is retained exactly.
* Spire collision top is unchanged at ground+20.75.
* Existing full-world terrain/ridges, flight, canyon, gondola and map switching
  are not modified.
* Bell openings are physical empty space inside **visual** geometry but the
  original conservative building obstacle remains solid for safety.
* Typical added visual geometry: 96 arch quads (192 triangles) plus fewer than
  115 batched box primitives; no texture or WebGL draw-call changes.

## QA

`node --test tests/vegas-venetian-campanile.test.mjs` tests geometry,
footprint scope, actual openings, clock/spire preservation and collision.
`node scripts/vegas-campanile-browser-smoke.mjs` captures near/far noon/night
photos from the in-game `Venetian Campanile Close-up` scenic camera
(Playwright Chromium SwiftShader). Artifacts and viewport diagnostics are
saved to `artifacts/vegas-campanile/`.

This is not a Windows hardware FPS benchmark and not a strict photo match.
Do not merge without checking fixed-camera browser screenshots for roof,
arches, clock visibility, occlusion and silhouette.
