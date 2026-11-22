# Tidewater water-rendering reference

PATROL's compact analytic ocean is informed by the open-source Tidewater
project while remaining an original WebGL2/GLSL implementation that preserves
PATROL's existing maps, flight controls, water height, and floatplane physics.

- Reference repository: <https://github.com/zzzhengqi/tidewater>
- Reviewed reference commit: `d6afdd88c1883c8138e8c1bac8e8e2b18e066228`
- Upstream code license: MIT (`LICENSE` in the reference repository)
- Reviewed files: `src/ocean/WaterMaterial.js` and
  `src/ocean/WaterSurface.js`

No Tidewater third-party art, audio, textures, or models are copied by this
patch. Such assets retain their own licenses and require separate review before
redistribution.

## This patch

The view-direction fix removes an invalid `abs()` fold from PATROL's reflected
sky ray. A ray below the horizon is now clamped to the horizon instead of being
mirrored into the upper hemisphere. This prevents a false bright globe/arc in
sun-facing views without changing wave displacement or buoyancy.
