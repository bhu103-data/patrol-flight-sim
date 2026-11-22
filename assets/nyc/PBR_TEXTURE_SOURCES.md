# Additional PBR texture maps (Poly Haven CC0)

The NYC facade material shader integrates five additional maps with permission under CC0:

* concrete_wall_008_diff_1k.jpg
* concrete_wall_008_nor_gl_1k.jpg
* concrete_wall_008_arm_1k.jpg
* asphalt_04_nor_gl_1k.jpg
* asphalt_04_arm_1k.jpg

Source project employing these Poly Haven CC0 assets: https://github.com/cyancity/yolo-mini-fps

Use https://polyhaven.com/license for exact CC0 terms. This is not material extracted from Google Maps.
The 512px GPU decode size is a performance optimization; files are 1k original JPEGs.

## 1:1 NYC reference viewer

The opt-in nyc-true-scale-flight.html viewer reuses the seven local CC0 maps
through loadNycPbrTextures: wall diffuse/normal/ARM, asphalt diffuse/normal/ARM,
and damaged-concrete diffuse. The maps are decoded to 512px GPU textures for
bounded memory use. World-space mapping uses the same wall and road scale as the
main PATROL NYC PBR material adapter.

These are generic tileable surface materials, not building-specific photographs,
not facade survey textures, and not imagery extracted from Google Maps. The
2014 MN05 meshes remain geometry-only historical visual references.
