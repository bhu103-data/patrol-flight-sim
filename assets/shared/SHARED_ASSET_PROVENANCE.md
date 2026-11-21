# Shared street asset prototype

## Selected asset

- **Asset:** `kenney-traffic-light.glb` (one low-poly traffic-light prop)
- **Original source:** [Kenney City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)
- **License:** Creative Commons CC0, as declared on the source page and in
  `KENNEY_CITY_KIT_ROADS_LICENSE.txt`. Attribution is not required.
- **Source package:** `kenney_city-kit-roads.zip`, SHA-256
  `374A4552115CBD11B4EC5C930EE31A533562DC78A09AF249A655D03F7EA3B959`
- **Checked-in GLB:** 20,344 bytes; SHA-256
  `6C9EE253B7370E1043168493B2E662B349484A0CDD02100CFF04D9D8D1BD9ABB`;
  1 mesh, 1 node, 212 triangles.
- **Source bounds:** X ±0.0726, Y 0..0.515, Z ±0.045 units. Prototype scale
  `5.83` gives a 3.00-unit signal height, matching PATROL's compressed
  street-detail scale without changing a city manifest.

## Integration decision

This is a **reusable candidate only**. It is staged under `assets/shared/`
and is not enabled by NYC or Chongqing manifests, so it cannot replace or
conflict with the other landmark work. The comparison page uses the same
PerspectiveCamera, lights and target for the existing procedural signal and
the Kenney GLB: `tools/shared_asset_comparison.html`.

Blender is not installed on this machine, so no Blender export was claimed.
`tools/blender/shared_traffic_light_author.py` is the optional local
Blender import/scale/export path for a later visual review. The checked-in
GLB is the original Kenney GLB and is directly compatible with Blender.

## Rollback

Delete the two files under `assets/shared/` and the comparison/staging files;
no production loader or manifest was changed. If later enabled, keep the
procedural signal as the fallback and gate the asset behind the existing
same-origin GLB validation.
