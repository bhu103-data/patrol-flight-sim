# NYC Times Square traffic-control pilot — sources, scope and QA

This patch adds a **game-space approximation**, not surveyed signal cabinet locations,
to the already-authored southbound Seventh Avenue traffic loop near the simulated
West 44th Street crossing. PATROL's Manhattan streets and city parcels are
compressed and procedural. None of the numbers in the 90-second signal plan
should be described as actual DOT timing for 7 Av at W 44 St.

## Official references and legal intent

- NYC DOT, Traffic Signals: https://www.nyc.gov/html/dot/html/infrastructure/signals.shtml
- NYC DOT, Traffic Signs: https://www.nyc.gov/html/dot/html/infrastructure/signs.shtml
- NYC DOT, Pedestrian Safety Action Plan: https://www.nyc.gov/html/dot/html/pedestrians/ped-safety-action-plan.shtml — leading pedestrian intervals provide at least **seven seconds** of head start.
- NYC CEQR Transportation Appendix (2025): https://www.nyc.gov/assets/oec/technical-manual/2025_ceqr_tm_appendix_transportation.pdf — right turn on red generally prohibited in NYC except where expressly permitted by sign.
- NYC Street Design Manual, Type M-2A pole: https://www.nycstreetdesign.info/index.php/lighting/type-m-2a-signal-pole — city standard pole style, visually referenced rather than copied.
- NYC DCP LION street centerline: https://www.nyc.gov/content/planning/pages/resources/datasets/lion — official future source for physical lane direction, geometry and street identity. **Not imported**, since the current game grid has no verifiable geographic transformation to LION.
- Photographic shape reference only: NYC intersection yellow 3-lamp housings, black/white ONE WAY, dark WALK box and green street-name blades. No image, copyrighted photo, brand, texture or model imported.

## Exact implemented model rules

- The existing one-way Seventh Avenue circulation path runs from game (12,54) toward (12,-40), then returns via the western northbound loop. Only its existing 18 vehicle actors (8 yellow taxis, one patrol car, 9 mixed cars) now bind to `timesSeventhControlledDistance`.
- Model-controlled southbound stop is **47.8** route units from route start (car center near z=6.2); actual white stop bar is around z=4.45, with a crosswalk around z=-2. Cars cannot enter on a red and the model grants no red right-turn exception.
- Model controller cycle = 90 seconds: 0–7 s red + WALK (pedestrian lead), 7–16 s green + WALK, 16–40 s green + hand, 40–44 s amber + hand, 44–90 s red + hand. Actual DOT-specific phasing would require the agency's real signal timing plan, which is unavailable here.
- A pure analytic distance clock integrates holds without teleporting actors when red changes to green. It is independent of frame rate and synchronized to the displayed light state in game `sceneryTime`.
- The original single-player rendered street surface adds a painted stop line, crossing, one-way southbound arrow, W 44 ST / 7 AV street blades, ONE WAY and NO TURN ON RED regulatory reminders on a model M-2A-style pole.
- Traffic and WALK heads are five small prebuilt original meshes (red-WALK, green-WALK, green-hand, amber-hand, red-hand). One variant is drawn per frame, with one additional draw batch and no per-frame geometry upload. All five variants and GPU buffers are disposed on map replacement.
- The treatment is guarded to city + detailed graphics and performs terrain/lot checks before adding fixtures. Other maps and graphics-compat mode remain unchanged.

## Important limits and next gates

- This is **one controlled junction**, not a blanket Manhattan traffic inventory or verified one-way map. Existing random decorative traffic lights on the wider synthetic grid remain static and are not claimed to synchronize with actors.
- Pedestrian actors on neighboring unrelated routes are not yet connected to the crossing's WALK right-of-way model. This model does not simulate city-wide queues, emergency preemption, protected bike-turn phases, transit priority or verified real-time DOT green-wave offsets.
- Required before merge: source-exact controller tests, full Node regressions, real Chromium WebGL2 Times Square street/low-flight fixed-camera screenshots of red/green/amber + WALK/head, probe both moving/held southbound cars, no GL errors, map-switch/low-graphics fallback and native GPU frame-time when available.
- No external network assets, paid model, video, training or additional shaders.
