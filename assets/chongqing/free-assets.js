// Verified, free redistribution candidates for Chongqing's modular asset pipeline.
// These entries are review metadata only: the runtime keeps procedural landmark
// geometry and existing bundled textures as the safe fallback.
export const CHONGQING_FREE_ASSETS = Object.freeze([
  {
    id: 'polyhaven-street-lamp-01',
    category: 'street-furniture',
    provider: 'Poly Haven',
    author: 'Josh Dean',
    source: 'https://polyhaven.com/a/street_lamp_01',
    license: 'CC0',
    redistribution: true,
    sourceSizeMB: 31.41,
    sourceTriangles: 31000,
    status: 'review-only',
    use: 'Optional distant street-light study; keep PATROL instanced lamps for the active corridor.'
  },
  {
    id: 'polyhaven-street-lamp-02',
    category: 'street-furniture',
    provider: 'Poly Haven',
    author: 'Josh Dean',
    source: 'https://polyhaven.com/a/street_lamp_02',
    license: 'CC0',
    redistribution: true,
    sourceSizeMB: 26.6,
    sourceTriangles: 20000,
    status: 'review-only',
    use: 'Optional wall-mounted shop-light study; not a landmark replacement.'
  },
  {
    id: 'polyhaven-concrete-wall-008',
    category: 'replaceable-material',
    provider: 'Poly Haven',
    author: 'Poly Haven contributors',
    source: 'https://polyhaven.com/a/concrete_wall_008',
    license: 'CC0',
    redistribution: true,
    status: 'bundled',
    use: 'Existing photographic facade/terrain PBR stream in assets/nyc/.'
  },
  {
    id: 'ambientcg-concrete-014',
    category: 'replaceable-material',
    provider: 'ambientCG',
    author: 'ambientCG contributors',
    source: 'https://ambientcg.com/view?id=Concrete014',
    license: 'CC0 1.0',
    redistribution: true,
    status: 'candidate',
    use: 'Optional concrete variation for retaining walls; do not replace Chongqing landmarks.'
  }
]);

export const CHONGQING_LANDMARK_ASSET_POLICY = Object.freeze({
  geometry: 'procedural-original',
  protectedLandmarks: ['Hongyadong', 'Qiansimen Bridge', 'Raffles City', 'Liziba'],
  replacementRequires: ['verified-license', 'same-origin-file', 'triangle-budget', 'visual-review'],
  scenarioCloud: false
});
