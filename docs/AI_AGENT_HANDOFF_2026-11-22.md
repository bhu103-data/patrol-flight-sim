# PATROL Gemini and Claude handoff — 2026-11-22

This file records the useful state extracted from the user's existing Gemini and
Claude conversations. It is a handoff record, not proof that the described code
exists in this checkout or has passed tests. Any item marked unrun or paused must
be rechecked against the current repository before implementation.

## Gemini — New York Harbor / Lower Manhattan

The copied Gemini response explicitly stopped short of claiming a repository
implementation. It consolidated a proposed local integration and acceptance
checklist:

- Candidate PR #151 water-reflection change: replace `abs(reflDir.y)` with
  `max(reflDir.y, 0.002)` while preserving the existing normalized mixed normal,
  reflection/clamp/sky-sampling constraints. Keep the work draft until a real
  local A/B test exists.
- Proposed native WebGL2 modules were named
  `src/sky/atmosphere_clouds_gl2.js`, `src/water/tidewater_gl2.js`, and
  `src/water/patrol_tidewater_adapter.js`. Gemini described them as unrun; their
  presence and suitability must not be assumed.
- A proposed wake interoperability contract exposes only
  `setExternalWakeTexture(tex, boundsVec4)` using `RGBA8`, without replacing the
  ferry hull, spray, or existing wake implementation.
- Proposed local gates were named `scripts/verify_tidewater_local.ps1`,
  `scripts/collect_patrol_context.ps1`, `scripts/run_tidewater_acceptance.js`, and
  `test_tidewater_nyc.html`. Gemini described all of them as unrun.
- Proposed map work covered DUMBO, Alaska, Las Vegas, and a common map director,
  but no result was represented as landed or tested.

Gemini's requested evidence before proceeding:

1. PR #151 same-camera sun-facing/opposite-facing captures at sun elevations
   `0.5–1.5°`, `4°`, and `15°` with `day=1`, `twilight=0`, `cloud=0.16`, plus a
   conflict check against PR #104.
2. Actual `patrol_tidewater_report_*.json`, Console/WebGL errors, or
   `tidewater_handoff_snapshot.txt`.
3. The current `index.html` / `patrol.html` WebGL2 initialization, water/sky draw,
   buoyancy-height query, and map-switch code before producing a line-accurate
   patch.

Gemini also required keeping `preserveDrawingBuffer: true`, avoiding an automatic
`?graphics=low` redirect, preserving flight controls, and not duplicating the
ferry hull.

## Claude — Brooklyn Bridge street-flight sample

The Claude conversation reported a repository/PR deduplication pass rather than a
finished patch:

- `main` already contains Brooklyn Bridge code and roughly 50 bridgehead-related
  PRs were identified for deduplication.
- The reported scan found no reviewed branch changing bridge towers, cables, or
  arch geometry.
- The next stated action was to read the authoritative NYC data/license records
  and capture a `main` baseline screenshot in Chromium/WebGL2.
- The run paused when the free usage allowance ended. No completed branch change
  or verified screenshot was reported in the extracted response.

## Claude — NYC real-3D / Liberty review

The visible Claude run reported these intermediate observations:

- PR heads in the #233–#254 range were fetched for comparison.
- `main` was described as using a small approximately 37 KB MIT Liberty model.
- The scenario manifest's Liberty entry was reported as `enabled:false`, while
  `scenario/liberty.glb` was absent in that inspected state.
- PATROL's `x,z` mapping was identified as a non-uniform compressed game-space
  transform rather than surveyed one-to-one scale.
- `toktx` 4.4.0 was available in that environment.
- Claude planned a local-only LOD build using the SHA-verified Liberty GLB from
  PR #253 as LOD0, but the run paused after creating a file. The extracted chat
  did not provide a pushed commit, final file content, or completed tests.

## Claude — PR #151 water-reflection review

The visible final state retained two unresolved tasks:

1. Check whether PR #104 conflicts with PR #151. The GitHub API was rate limited;
   Claude noted that fetching `pull/104/head` directly could avoid that API path.
2. Locate the source of GPU A/B noise in the water comparison.

This run also paused when the free usage allowance ended. It did not report a
verified fix or merge-ready commit.

## Integration rule

Treat all three external-agent sections as research leads. Before using any of
them, verify the named files and current PR heads, inspect licenses, reproduce the
defect in the production flight map, make a minimal reversible change, and run the
repository's targeted and cross-map regression checks. Do not enable an asset or
claim completion from these chat records alone.
