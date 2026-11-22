#!/usr/bin/env bash
# Decode publisher Meshopt + KTX2 source into uncompressed embedded-PNG GLBs.
# Target: PATROL's current custom GLB 2.0 decoder (no Meshopt/BasisU).
set -euo pipefail
source_dir="nyc-harbor-audit/official-tevy"
output_dir="nyc-harbor-audit/staged"
mkdir -p "$output_dir"
gltf-transform --version || true
for lod in 0 1 2; do
  src="$source_dir/tevy-car-ferry-lod$lod-source.glb"
  png_step="$output_dir/.ferry-lod$lod-decompressed-texture.glb"
  output="$output_dir/tevy-ro-ro-lod$lod.glb"
  test -s "$src"
  # CLI must remove Meshopt geometry extension on write; KTX2 becomes PNG.
  gltf-transform ktxdecompress "$src" "$png_step"
  gltf-transform dequantize "$png_step" "$output"
  rm "$png_step"
  test -s "$output"
  echo "COMPLETED ferry LOD$lod: $(wc -c <"$output") bytes"
done
python3 tools/nyc/validate_cc0_ferry_staged.py
