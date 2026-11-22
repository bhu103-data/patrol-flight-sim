# PATROL NYC 1:1 C185 airborne-equation integration pilot

## Why this is different from the free camera

The opt-in NYC TRUE-SCALE viewer from draft #248 and real 2022 OTI roadbed
subtile from #273 previously flew only a WASD camera; neither reused
PATROL's aircraft speed, turning, pitch, or building-impact logic.

This child adds a **separate optional C185 airborne-only game control
profile** to that exact one-metre east/north scene, by importing
\`assets/nyc/nyc-c185-metre-airborne.mjs\`. It is **not the full original
C185 aircraft simulator engine**. The source coefficients and airborne
control formulas are taken directly from the existing production
\`index.html\` \`AIRCRAFT.seaplane\` and \`advanceFlight(dt)\`:
\`cruise:19.2\`, \`boost:25.5\`, \`turn:.93\`,
\`pitchResponse:2.05\`, \`maxPitch:.45\`;
\`speed=lerp(speed,targetSpeed,dt*2.8)\`;
\`yaw+=turn*turnCoefficient*dt\`;
\`pitch=lerp(pitch,pitchControl*maxPitch,dt*pitchResponse)\`;
\`bank=lerp(bank,-turn*.92,dt*4.5)\`;
\`forward=[sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch)]\`,
with the original seaplane airborne passive vertical drop
\`dt*(boost?.25:1.25)\`.

C185 source program treats these numeric speeds as **game units/s**.
Although this new view uses 1 world unit = 1 local metre, the source
game's aircraft coefficients do *not* certify 19.2 or 25.5 **real**
metres/s for an actual Cessna 185. This pilot is for continuity of PATROL's
flight-handling equations in the georeferenced viewer, not real aircraft
performance or FAA simulation accuracy.

## How to use it

Normal launcher > **NYC TRUE-SCALE** > select **C185 airborne cockpit
(prototype)**, or open:
\`assets/nyc/nyc-true-scale-flight.html?flight=patrol-c185\`.

- A/D or Left/Right = yaw
- W/S or Up/Down = climb/dive pitch
- Space or Shift = boost (source PATROL C185 afterburner analogue)
- B = slow to PATROL's 16-unit brake target
- Click the same button to return to untouched WASD free-camera mode.

For the current pilot the camera sits in the aircraft's **cockpit-frame
viewpoint**, not a 3-D rendering of the complete C185. Scene +X true east,
scene -Z true north; the source airborne function has +Z north. The
\`cameraYaw=PI-physicsYaw\` transform preserves exact direction while
all source FIDs and all actual OTI geometry remain unrotated.

A swept aircraft flight path is sampled every **0.25 metre** (and
four 1.2m lateral/longitudinal clearance probes plus center) against
original OTI building polygon prisms and HEIGHTROOF metre values.
A collision rejects movement and stops speed rather than flying through
a facade or teleporting to an invented safe building. Vertical model
ground uses the conservative **5 m** floor because this source dataset
does NOT provide official local street elevation or datum.

## What this absolutely does NOT implement

- The full \`advanceFlight(dt)\` state machine, C185 takeoff, floats,
  water contact buoyancy, gear, landing, taxi, weapons or original
  aircraft mesh/audio/HUD. They remain intact in the normal PATROL maps,
  NOT ported to this optional viewer.
- No actual building facade/window/roof details beyond parent #248;
  source OTI HEIGHTROOF footprints remain dated and approximate.
- No current 2026 road/sidewalk/plaza, legally permitted lane turn
  graph or DOT signal timing; #273 has only eleven 2022 roadbed polygons.
- No WGS84 vertical datum, surveyed ground height or native-GPU FPS QA.
- No aircraft model visible in cockpit view. **Do not claim complete
  aircraft support** solely because the camera now follows an airborne
  subset.

## Required QA evidence

1. Node import of the **real** C185 constants and exact equation
   substring checks against PATROL's source \`index.html\`.
2. Full Node regression and two CI paths, plus source-tail tests for
   118 OTI buildings, same projected origin, 11 OTI source road FIDs,
   source prism collision, 0.25m swept anti-tunnel behavior and default
   free-camera backward compatibility.
3. Real Chromium native WebGL2 launcher + \`?flight=patrol-c185\`
   cockpit screenshots before/after pressing pitch, turn and boost.
   Verify pose moves in one metre frame; do not pass if browser has
   GL errors or the model is silently a free camera.
4. Real aircraft + source geometry overlap, map switching, low
   quality and native physical GPU performance remain blocked pending
   independent review.

This is a **stacked Draft on #273** and must not be merged to \`main\`,
shared integration, or the original aircraft map until full upstream
and graphics QA. All code is original or derived by the same
repository source; no third-party models or images imported.
