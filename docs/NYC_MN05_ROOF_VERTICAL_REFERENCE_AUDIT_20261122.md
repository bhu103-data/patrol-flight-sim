# NYC MN05 2014 roof vertical-reference audit

**READ-ONLY RESEARCH / QA. NOT A RUNTIME ROOF IMPORT.** This child of #285
does not modify the live PATROL Manhattan map, aircraft, traffic, collision,
other city maps, or the main branch. Its purpose is to test whether authentic
2014 NYC DCP roof elevations can be reconciled with current official OTI
building height attributes before anyone uses the source Z values in a game
world.

## Why a separate vertical audit is required

The official NYC DCP 3D Building Model metadata describes a 2014 aerial survey,
a hybrid CityGML LOD 1/1.5 and LOD 2 model, and a 95-percent vertical accuracy
of approximately ±1.6 ft. It says the source model used building-footprint
ground-elevation and roof-height attributes where possible, and a DEM ground
lattice when constructing buildings. However, that 3D-model metadata does not
explicitly declare the vertical datum of the Rhino model's Z coordinate.

The separate NYC OTI Building Footprints metadata states:
- **GROUNDELEV** is the lowest building-ground elevation in feet; it is NAVD88
  for records collected photogrammetrically or from modern sources.
- **HEIGHTROOF** is the roof height above ground elevation, not an elevation
  above sea level.
- **GEOMSOURCE** distinguishes photogrammetric capture from manual/other sources.

NYC's 2017 LiDAR metadata explicitly specifies NAVD88 Geoid 12B. This is useful
cross-source evidence, but it does not by itself prove that every 2014 Rhino
roof Z uses the same datum.

Official references:
- NYC DCP 3D Model dataset: https://data.cityofnewyork.us/d/u5j4-zxpn
- NYC DCP 3D Model metadata:
  https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_3DBuildingModel.md
- NYC OTI Building Footprints metadata:
  https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md
- NYC LiDAR summary:
  https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_LiDAR_Summary.md
- NYC Open Data terms: https://opendata.cityofnewyork.us/overview/

## Audit method

1. Reuse the exact SHA-pinned 2014 MN05 Rhino model and roof-mesh extraction
   produced by #285. The latest source extraction contained 1,403 cached roof
   mesh patches, 10,669 triangles and 13,330 vertices. Source XY is EPSG:2263
   US survey feet converted into the Times Square local WGS84 metre frame;
   source Z remains raw until the Rhino document unit setting is recorded.
2. Reuse assets/nyc/times-square-footprints.json, the existing official NYC
   OTI FID/HEIGHTROOF snapshot. The audit keeps the same single-outer-ring
   eligibility rule as the 118-building metric massing pilot. It does not fill
   courtyard holes or invent a nearest-neighbour building assignment.
3. Query the official OTI FeatureServer for the same FIDs at audit time:
   FID, BIN, DOITT_ID, HEIGHTROOF, GROUNDELEV, CNSTRCT_YR,
   LSTMODDATE, GEOMSOURCE, and FEAT_CODE.
4. Associate each original roof object with a footprint only when its actual
   projected mesh vertices and centroid provide a sufficiently strong,
   unambiguous polygon containment match. Ambiguous and unmatched objects are
   reported, not force-snapped.
5. Compare source roof-top Z with GROUNDELEV + HEIGHTROOF only when Rhino
   document units are recognised and the OTI record is marked photogrammetric
   with both elevation attributes present. A stricter historical subset
   additionally requires a building construction year no later than 2014, a
   last-modified date no later than 2014-12-31, and FEAT_CODE=2100.
6. Report signed and absolute differences, sample counts and the DCP ±1.6 ft
   published accuracy band. This is a comparison of a historical model to
   current OTI attributes; it is not an independent survey.

## Fail-closed rules

- verticalDatumStatus is always NOT_CERTIFIED in this audit.
- runtimeImportAllowed is always false.
- Unknown Rhino model units disable numeric Z comparison.
- Missing OTI attributes, non-photogrammetric geometry sources, holes,
  ambiguous footprint matches, and post-2014 edits are explicitly retained as
  exclusions/uncertainties.
- A small difference from current OTI roof-top attributes is supporting
  evidence only. It cannot silently turn the DCP model's undocumented Z datum
  into a verified NAVD88 datum.
- The temporary 627 MB .3dm file is deleted before CI artifacts are uploaded.
  Only bounded JSON provenance, roof mesh evidence and the comparison report
  are retained.

## Next gate

Only after the audit demonstrates a sufficiently large, spatially unambiguous
and historically comparable sample should a separate opt-in preview be
considered. Even then, the preview must preserve the original source Z and
document the vertical transformation; no automatic production-map cutover is
permitted. Current facades, current roof condition, 2026 as-built geometry,
photographic registration, collision migration and native-GPU performance
remain separate acceptance requirements.
