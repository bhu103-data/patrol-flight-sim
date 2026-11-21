// NYC-only street material finish for the existing Poly Haven CC0 photo atlases.
// Source files, licensing and original names: assets/nyc/THIRD_PARTY_NOTICES.md
// No added network requests, geometry, shaders, or WebGL texture units.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function path(ctx, points, width, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  ctx.restore();
}

/**
 * Overlay restrained, close-range wear on the already bundled 1K CC0 asphalt
 * and damaged-concrete diffuse maps, and correlate asphalt sealant to the
 * existing CC0 ARM roughness channel (G). The PBR normal map is untouched.
 * The engine samples these as REPEAT textures, so marks fade toward edges;
 * no new texture, draw pass, image download, or global shader is introduced.
 *
 * This material is shared by NYC roads; DUMBO/Brooklyn Bridge is the QA sample
 * location, not an exclusive spatial mask (that requires a shader change).
 */
export function finishNycStreetAtlases(asphalt, sidewalk, asphaltArm) {
  const width = asphalt.width, height = asphalt.height;
  if (width !== 512 || height !== 512 ||
      sidewalk.width !== width || sidewalk.height !== height ||
      asphaltArm.width !== width || asphaltArm.height !== height) {
    throw Error('Unexpected NYC street atlas size');
  }
  const random = seededRandom(0xD00B0121);
  const road = asphalt.getContext('2d');
  const walk = sidewalk.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const seam = mask.getContext('2d');

  // Uneven mill-and-fill repairs: no solid high-contrast checkerboard.
  // Keep all paths inside the atlas and let the original asphalt grain lead.
  for (const outline of [
    [[56, 82], [89, 76], [146, 79], [182, 85], [238, 82], [265, 89]],
    [[296, 198], [338, 203], [366, 196], [406, 201], [468, 195]],
    [[115, 350], [144, 360], [196, 356], [232, 365], [293, 361]]
  ]) {
    path(road, outline, 6.2, '#24282a', 0.60);
    path(road, outline.map(([x, y]) => [x, y + 2.3]), 1.2,
      '#adaaa3', 0.18);
    path(seam, outline, 6.2, '#ffffff', 0.82);
  }

  // Hairline fatigue cracks and mineral flecks: subpixel to a few pixels,
  // without a regular stamp pattern that would dominate a repeated tile.
  for (let i = 0; i < 75; i++) {
    const x = 18 + random() * 475, y = 18 + random() * 475;
    const length = 3 + random() * 14;
    const points = [[x, y], [x + length * 0.43, y + random() * 3 - 1.5],
      [x + length, y + random() * 5 - 2.5]];
    path(road, points, 0.8 + random() * 0.85, '#141a1b',
      0.15 + random() * 0.24);
    if (i % 4 === 0) {
      path(seam, points, 1.2, '#ffffff', 0.27);
    }
  }
  for (let i = 0; i < 1000; i++) {
    const x = 5 + random() * 502, y = 5 + random() * 502;
    const radius = 0.35 + random() * 0.95;
    road.save();
    road.globalAlpha = 0.035 + random() * 0.075;
    road.fillStyle = random() > 0.55 ? '#d9d3c7' : '#1a2424';
    road.fillRect(x, y, radius, radius);
    road.restore();
  }

  // Concrete slab joints, chipped aggregate and soot from the same existing
  // damaged-concrete CC0 photograph. The engine already has a world-space
  // sidewalk-joint shader, so these marks deliberately stay less pronounced.
  for (const line of [
    [[137, 12], [139, 104], [136, 207], [141, 295], [138, 495]],
    [[19, 339], [120, 341], [226, 337], [325, 340], [493, 338]]
  ]) {
    path(walk, line, 2.6, '#292e2b', 0.29);
    path(walk, line.map(([x, y]) => [x + 1.8, y + 1.5]),
      0.9, '#e7dfd0', 0.13);
  }
  for (let i = 0; i < 130; i++) {
    const x = 10 + random() * 492, y = 10 + random() * 492;
    walk.save();
    walk.globalAlpha = 0.035 + random() * 0.10;
    walk.fillStyle = random() > 0.5 ? '#332f2a' : '#ddd8cb';
    walk.beginPath();
    walk.ellipse(x, y, 0.6 + random() * 2.4,
      0.3 + random() * 1.5, random() * 3.14, 0, Math.PI * 2);
    walk.fill();
    walk.restore();
  }

  // Preserve the original AO and metallic channels. Vary only roughness G:
  // weathered aggregate is matte, filled seams are locally smoother.
  const arm = asphaltArm.getContext('2d', { willReadFrequently: true });
  const pixels = arm.getImageData(0, 0, width, height);
  const marks = seam.getImageData(0, 0, width, height).data;
  const bytes = pixels.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const block = (Math.imul(x >> 4, 73856093) ^
                     Math.imul(y >> 4, 19349663)) >>> 0;
      const coarse = (block / 4294967295 - 0.5) * 24;
      const fine = ((Math.imul(x + 7, 374761393) ^
                     Math.imul(y + 19, 668265263)) >>> 0) /
                     4294967295 - 0.5;
      const seal = marks[i + 3] / 255;
      bytes[i + 1] = Math.max(126, Math.min(242,
        Math.round(bytes[i + 1] * 0.99 + coarse + fine * 9 - seal * 52)));
    }
  }
  arm.putImageData(pixels, 0, 0);
}
