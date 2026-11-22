# NYC Liberty — audited CC0 production opt-in, 3-distance LOD (Draft)

## Scope and de-duplication
This is a **child of #130** (which itself stacks on #103), not an independent reinvention of the statue GLB. The **same exact existing asset blob** is reused; no additional .glb is committed by this child. It changes the real native PATROL `index.html` renderer, not a standalone city/box preview.

Checked overlapping Times Square initiatives #233, #234, #235, #236, #237, #239, #240 and #248: they primarily establish true-metre geo massing and street lines; #248 adds separate opt-in flythrough and touches `index.html`. This child focuses only on NYC Liberty at the existing *compressed* PATROL placement, on top of validated #130 shape-collision work. Do not cherry-pick whole #248 or overwrite its launcher.

**Actual new visuals:** launch the game at `/index.html?nycLibertyCC0=1`, select Manhattan and `Scenic Views > Statue of Liberty`. It renders the audited Statue of Liberty model with articulated robes, torch, crown, tablet, pedestal and its pre-baked 1024x1024 base-color atlas; no more single stylized body in the near view. Default game URL remains unchanged. `?nycModels=legacy` takes precedence for rollback.

## Source, rights and compression

| Data | Verified source/state |
|---|---|
| Original creator/publisher | Innerscene, original Statue of Liberty on its pedestal |
| Model page | https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f |
| Usage terms | https://www.innerscene.com/tools/library/terms |
| Declared rights | **CC0 1.0**; modification and redistribution permitted |
| Original | ~10.53 MB, 58,295 triangles, four source images — previously fetched in #103, not re-fetched here |
| Existing optimized binary | `assets/nyc/scenario/liberty.glb` already on parent #103 |
| Source-bound asset SHA-256 | `34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225` |
| Optimized binary | **913,936 bytes, 15,900 triangles**, one **1024x1024 embedded PNG base color atlas**, 91,160 bytes |
| Texture compression | The atlas is already baked and PNG-compressed; the native WebGL2 runtime generates **GPU mipmaps**. **KTX2/Basis transcoding NOT done**; do not claim native GPU compressed texture memory. |
| Spatial truth | Illustrative game-scale statue, **NOT** lidar, surveyed placement, photogrammetry or true size; separate true-metre pilots do not change this. |

## LOD, rollbacks, collider

- **Near**: within 105 game units of eye OR plane, draw 15.9k-triangle source-backed CC0 mesh and its embedded single atlas.
- **Mid**: 105–275 units away from BOTH, reuse the original tiny in-repo `statue-of-liberty.glb` already decoded as the failure fallback. No second download. If unavailable, retain approved full model.
- **Far**: 275+ units away from BOTH, choose the lower-triangle source among already available bundled low GLB and existing procedural silhouette. This avoids increasing triangle cost for distant scenes; it does not synthesize new box skyscrapers or remote impostor textures.
- **Failure**: disabled by default; if opt-in GLB fails HTTP/size/decoder, original bundled or procedural monument remains; `nycModels=legacy` disables imports regardless of opt-in.
- **Collision**: consumes #130's exact 16-band **shape-conservative** scenario collider near the island only for the model fingerprint. Far LOD cannot downgrade while the aircraft is close. No floatplane wave, water buoyancy, main route, bridge, skyline, Chongqing or Vegas files are edited by this child.
- **Loading**: existing 8-MiB GLB limit and source manifest permission gate remain. Only opt-in Liberty can bypass its still-disabled manifest flag; all other entries behave as before.

## Gates / evidence

```sh
node --test tests/nyc-liberty-cc0-production-optin.test.mjs
node --test tests/*.test.mjs
node tools/nyc/check-liberty-glb.mjs assets/nyc/scenario/liberty.glb
# browser runner uses Playwright + PNGJS + local server
node scripts/nyc-liberty-production-lod-browser.mjs
```

New GitHub workflow will verify actual native PATROL WebGL default vs opt-in same-camera screenshot differences and `?nycModels=legacy` rollback. All environment checks are run from this exact branch. Software SwiftShader screenshots prove real rendering but **do not prove native Windows GPU FPS**.

### Not complete / release gate

1. **Do not merge to main yet**: parent #103 staged asset + #130 collider must pass central human inspection of torch/tablet orientation, Fort Wood pedestal overlap, actual hand-flown seaplane and fighter near plaza, and Windows hardware performance.
2. Long-range model-to-model LOD silhouette popping is still possible; compare medium and far screenshots in a controlled fixed camera before enabling by default.
3. This PR is a landmark asset replacement, **not complete city reconstruction**. 1:1 Manhattan streets and real roofs remain in #233–#248; this change does not pretend to solve them.
4. Keep all references / licenses documented; never copy Google 3D data or unlicensed street photography.
