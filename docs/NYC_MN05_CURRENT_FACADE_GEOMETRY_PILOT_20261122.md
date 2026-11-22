# NYC MN05 current-building facade geometry pilot

**READ-ONLY GEOMETRY EXTRACTION / QA. NOT A RUNTIME IMPORT.**

This pilot extracts original 2014 NYC DCP MN05 building FootPrint Surface and
Facade Surface cached meshes for a bounded set of current Times Square
buildings. It is a child of the current/historic vertical-reference audit
(#314). No production map, aircraft, road, traffic, collision or other city is
modified.

## Candidate buildings

A building is admitted only when the current OTI audit reports:
- FEAT_CODE 2100 and photogrammetric geometry source;
- construction year no later than 2014;
- current LSTSTATYPE is Constructed;
- original 2014 roof top Z differs from current GROUNDELEV + HEIGHTROOF by
  no more than ±1.6 ft;
- no same BIN/DOITT_ID match in the bounded Building Historic result with
  Alteration, Demolition, Merged or marked-for-demolition status.

This is a preview candidate rule, not a claim that the building is unchanged or
that the 2014 model is current 2026 as-built geometry. The LSTMODDATE field is
retained as provenance only; it is not treated as the date of a building
alteration.

## Source geometry

- Original source: NYC DCP 2014 Manhattan MN05 Rhino 3DM, pinned SHA from #285.
- Horizontal coordinates: EPSG:2263, NY Long Island NAD83, US survey feet,
  converted through the existing official projection helper into local metres.
- Rhino document units: Feet.
- Layers: Buildings::FootPrint Surface and Buildings::Facade Surface.
- Facades are extracted only from cached Rhino display tessellation attached
  to original Brep faces. No synthetic facade planes, convex hulls, boxes,
  guessed windows or sampled NURBS surfaces are generated.
- The FootPrint Surface Z is initially labelled a source base-Z candidate.
  Its planarity, per-building match and agreement with OTI GROUNDELEV must be
  measured before it is used as ground elevation.
- Relative source roof height is computed as source roof-top Z minus the
  matched FootPrint Surface Z candidate, then compared with OTI HEIGHTROOF.
  This relative-height comparison does not require declaring the absolute
  vertical datum, but it still depends on correct building matching.

## Bounds and fail-closed behaviour

- At most 150,000 facade triangles and 250,000 facade vertices are admitted.
- Facade objects are matched by local-metre footprint containment. Ambiguous,
  partial and unmatched faces are reported, not force-snapped.
- The source 3DM is temporary and is deleted before artifact upload.
- The report always states verticalDatumStatus=NOT_CERTIFIED and
  runtimeImportAllowed=false.
- A successful extraction is not proof of 2026 facade accuracy, material
  realism, photographic registration, collision compatibility or game FPS.

## Next gate

If the FootPrint Surface Z candidates and relative roof heights agree with
official OTI measurements for a sufficiently large subset, a separate
opt-in WebGL preview may render the original 2014 facade and roof meshes over
their matched current footprints. It must remain a QA preview until a separate
visual and temporal-accuracy review passes.
