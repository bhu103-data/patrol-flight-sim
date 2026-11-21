# C185 water contact and external asset review

## Implemented
The WebGL game separates pontoon-clear water contact from solid collision. A hard arrival on clear water is an assisted landing: speed is reduced, the floats stay above the water, and a spray effect marks contact. A taxi heading into an obstacle stops at the previous clear footprint. Collision with a real vessel, dock, bridge or terrain remains possible. This behavior is for the existing game, not aircraft operational guidance.

The C185 uses its real model scale in every external camera. Each pontoon has its own speed-dependent wash. The original Blender asset remains installed as the player model.

## Mature project study
[FlightGear YASim Gear.cpp](https://github.com/FlightGear/flightgear/blob/next/src/FDM/YASim/Gear.cpp) distinguishes solid contact from water contact and damps the inward component of contact velocity. PATROL adopts the separation and dissipative behavior in its own lightweight flight code; no FlightGear code was copied. [FGAddon dhc2F](https://sourceforge.net/p/flightgear/fgaddon/4885/) is a source-backed Beaver floatplane, which is a different airframe and is not a C185 replacement.

## Candidate acceptance
- [Sketchfab Cessna185](https://sketchfab.com/3d-models/cessna185-6453c2d8d08d4be6b08412794e28b152), manilov.ap: public metadata shows CC BY 4.0, downloadable, 32,441 faces. Description is a landplane; original mesh not verified to have floats. Candidate for an actual visual inspection, not enabled.
- [Grab3D Seaplane](https://grab3d.com/models/vehicles/seaplane/): CC0 and 19,850 triangles per publisher; a stylized generic model, not an accurate 185. Not enabled.
- A player-model replacement must have traceable redistribution rights, two correct floats, validated waterline and real C185 proportions, and pass the existing 2 MB / 50,000 triangle asset gate before WebGL comparison. Do not silently relabel a different aircraft.
