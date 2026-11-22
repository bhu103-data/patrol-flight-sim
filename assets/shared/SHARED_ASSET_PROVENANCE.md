# Shared street asset prototype

## Selected asset

- **Asset:** `kenney-traffic-light.glb` (one low-poly traffic-light prop)
- **Original source:** [Kenney City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)
- **License:** Creative Commons CC0, as declared on the source page and in
  `KENNEY_CITY_KIT_ROADS_LICENSE.txt`. Attribution is not required.
- **Source package:** `kenney_city-kit-roads.zip`, SHA-256
  `374A4552115CBD11B4EC5C930EE31A533562DC78A09AF249A655D03F7EA3B959`
- **Checked-in source GLB:** 20,344 bytes; SHA-256
  `6C9EE253B7370E1043168493B2E662B349484A0CDD02100CFF04D9D8D1BD9ABB`;
  1 mesh, 1 node, 212 triangles. It retains Kenney's external texture
  reference for source fidelity.
- **Blender export candidate:** `kenney-traffic-light-blender.glb`, 25,692
  bytes; SHA-256
  `88B0BCC09F483F145F9D729638CC4C8CCFE602C3B86E7EA7F48B938725441FB9`; 1 mesh, 1 node, 212 triangles, embedded PNG.
- **Source bounds:** X ±0.0726, Y 0..0.515, Z ±0.045 units. Prototype scale
  `5.83` gives a 3.00-unit signal height, matching PATROL's compressed
  street-detail scale without changing a city manifest.

## Integration decision

This is a **reusable candidate only**. It is staged under `assets/shared/`
and is not enabled by NYC or Chongqing manifests, so it cannot replace or
conflict with the other landmark work. The comparison page uses the same
PerspectiveCamera, lights and target for the existing procedural signal and
the Kenney GLB: `tools/shared_asset_comparison.html`.

Blender 5.3.0 was found at
`C:/Users/Rose1-824/Tools/blender-portable/blender.exe` and ran
`tools/blender/shared_traffic_light_author.py` successfully. The export
embeds `colormap.png`, applies the 5.83 scale, and is the candidate used by
the comparison page. The original Kenney GLB and its source texture remain
separate for provenance.

## Rollback

Delete the two files under `assets/shared/` and the comparison/staging files;
no production loader or manifest was changed. If later enabled, keep the
procedural signal as the fallback and gate the asset behind the existing
same-origin GLB validation.
