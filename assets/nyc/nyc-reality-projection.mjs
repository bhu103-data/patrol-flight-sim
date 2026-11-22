// Experimental NYC Reality geometry layer; intentionally independent of PATROL's compressed world.
// Coordinate source: the repository's November 2026 municipal Times Square footprint snapshot.
// One Three.js world unit equals one physical meter. No facade/road accuracy is implied.
export const NYC_REALITY_ORIGIN = Object.freeze({
  lon: -73.9864883, lat: 40.756421, elevationMeters: 0
});
export const WGS84 = Object.freeze({
  a: 6378137, f: 1 / 298.257223563
});

function ecef(lon, lat, height) {
  if (![lon, lat, height].every(Number.isFinite) ||
      Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    throw new RangeError('Invalid WGS84 coordinate');
  }
  const longitude = lon * Math.PI / 180;
  const latitude = lat * Math.PI / 180;
  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  const sinLon = Math.sin(longitude);
  const cosLon = Math.cos(longitude);
  const e2 = WGS84.f * (2 - WGS84.f);
  const radius = WGS84.a / Math.sqrt(1 - e2 * sinLat * sinLat);
  return [
    (radius + height) * cosLat * cosLon,
    (radius + height) * cosLat * sinLon,
    (radius * (1 - e2) + height) * sinLat
  ];
}

export function lonLatToENU(lon, lat, heightMeters = 0, origin = NYC_REALITY_ORIGIN) {
  const a = ecef(lon, lat, heightMeters);
  const b = ecef(origin.lon, origin.lat, origin.elevationMeters);
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  const latitude = origin.lat * Math.PI / 180;
  const longitude = origin.lon * Math.PI / 180;
  const cl = Math.cos(latitude), sl = Math.sin(latitude);
  const co = Math.cos(longitude), so = Math.sin(longitude);
  return [
    -so * dx + co * dy,                       // East (metres)
    -sl * co * dx - sl * so * dy + cl * dz,  // North (metres)
    cl * co * dx + cl * so * dy + sl * dz    // Up (metres)
  ];
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

export function projectMunicipalFeature(feature, origin = NYC_REALITY_ORIGIN) {
  if (!feature || !Number.isSafeInteger(feature.fid) ||
      !Number.isFinite(feature.heightFt) || feature.heightFt <= 0 ||
      !Array.isArray(feature.rings) || feature.rings.length !== 1) {
    throw new TypeError('Unsupported or incomplete municipal polygon; do not invent courtyard fills');
  }
  const ring = feature.rings[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 128 ||
      !samePoint(ring[0], ring[ring.length - 1])) {
    throw new TypeError('A closed, bounded exterior ring is required');
  }
  const vertices = ring.slice(0, -1).map(point => {
    if (!Array.isArray(point) || point.length !== 2 ||
        !point.every(Number.isFinite)) {
      throw new TypeError('Non-finite WGS84 polygon vertex');
    }
    const [east, north] = lonLatToENU(point[0], point[1], 0, origin);
    return [east, north];
  });
  const area = vertices.reduce((sum, a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
  if (!Number.isFinite(area) || Math.abs(area) < 0.01) {
    throw new TypeError('Degenerate municipal footprint');
  }
  return {
    fid: feature.fid,
    heightMeters: feature.heightFt * 0.3048,
    footprintMeters: vertices,
    signedAreaMeters2: area
  };
}

export function auditTimesSquareSnapshot(snapshot, origin = NYC_REALITY_ORIGIN) {
  if (!snapshot || !Array.isArray(snapshot.features) ||
      !String(snapshot.source || '').includes('NYC Building Footprints')) {
    throw new TypeError('Expected the bundled NYC municipal snapshot');
  }
  const accepted = [], rejected = [], seen = new Set();
  for (const feature of snapshot.features) {
    try {
      if (seen.has(feature.fid)) throw new TypeError('Duplicate source FID');
      seen.add(feature.fid);
      accepted.push(projectMunicipalFeature(feature, origin));
    } catch (err) {
      rejected.push({ fid: feature?.fid ?? null, reason: err.message });
    }
  }
  return {
    originalCount: snapshot.features.length,
    accepted,
    rejected,
    origin,
    units: 'WGS84 ENU, 1 world unit = 1 meter',
    knownLimits: [
      'Snapshot is a limited 2026 sample, not every building in the district',
      'Footprints and roof heights are sourced; facades and ground elevation are not',
      'Road centerlines, true road widths, traffic signals and terrain are not yet implemented',
      'Multi-ring buildings are withheld rather than silently closing courtyards'
    ]
  };
}
