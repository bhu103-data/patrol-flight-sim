# NYC MN05 cached rooftop mesh topology QA

## Purpose

This child branch follows the deliberate negative result in PR #285. The exact
2014 NYC DCP MN05 source is a Rhino Brep model; the previous inspector could
not reconstruct exact source trim loops through the exposed polyline API.
This branch checks whether the original Brep faces already contain bounded,
topologically usable cached meshes. It does not pretend those meshes are exact
NURBS trim curves.

## Pinned source and provenance

- Dataset: NYC 3D Model by Community District, Manhattan Community District 05.
- Original capture: 2014 aerial survey; municipal metadata last updated 2018.
- Official model ZIP SHA-256:
  `71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2`
- Original Rhino 3DM SHA-256:
  `b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57`
- Source CRS: EPSG:2263, NAD83 New York Long Island East, US survey feet.
- Source layers: Buildings / RoofTop Surface. The inspector selects only
  source roof Breps intersecting the bounded Times Square metre ROI.
- The original model bytes are downloaded only inside one ephemeral Actions
  job, then deleted. Only bounded JSON metadata and a small mesh sample are
  uploaded as a seven-day QA artifact.

## What the new gate measures

- Reads `BrepFace.GetMesh(MeshType.Any)` from the original hash-pinned Rhino
  Breps. This is a cached source tessellation, not an exact NURBS boundary.
- Validates finite XYZ vertices, triangle/quad indices, non-degenerate
  triangles, edge incidence, manifoldness, closed boundary loops, holes,
  projected loop area and self-intersections.
- Confirms cached vertices remain inside their source Brep bounds.
- Exports no more than 12 small source mesh samples, with original source
  coordinates, local projected XY metres, original faces and boundary-loop
  indices. Raw Z is preserved and is not converted.
- Records Rhino model unit system and absolute tolerance, but does not treat
  either as proof of the vertical datum.

## Explicit non-claims and release gates

This QA does **not** establish:

- the source vertical unit or vertical datum;
- a per-building match between 2014 source objects and 2022 OTI FIDs;
- whether a building has changed between the 2014 capture and 2026;
- the cached mesh's maximum chord deviation from the original Brep surface;
- a finished WebGL asset, a real facade material, or a production runtime
  import.

The report must keep `sourceVerticalDatumVerified=false`,
`sourceFidMatched=false`, `sourceTemporalCurrent=false`,
`readyForWebGLPreview=false`, and `runtimeImportAccepted=false`. A successful
topology check only authorizes a separate, opt-in source-mesh preview
investigation. It does not approve replacing the live PATROL city.

Attribution for any future redistributed derivative must identify NYC DCP and
DOITT, the 2014 source vintage, the source dataset/version, and the modifications
made. The City's public-data terms and source disclaimer remain applicable.
