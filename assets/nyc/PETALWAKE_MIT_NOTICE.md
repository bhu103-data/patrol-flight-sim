# Petalwake MIT source reuse in PATROL NYC

Upstream: https://github.com/jjcm/petalwake
Revision reviewed: `25443cef0eba802052d9ef24c94ba3c4157b6f2e` (2026-11-21)
Source portions adapted:
- `src/world/town.js`, `Town.update()`: three-tier near/mid/far chunk LOD by camera-to-AABB distance. Adapted to PATROL's native WebGL2 renderer; does not copy Three.js or terrain buffers.
- `src/world/water.js`: half-vector microfacet sun-glitter calculation, scoped to NYC rainy bridgehead roads in `index.html` (no planar water reflection or extra framebuffers).
- `tools/town/layout.py`: deterministic, chunk-based placement *concept* only (not copied Python code).

The new `assets/nyc/petalwake-road-chunks.js` and adapted wet-road highlights do not import third-party image assets, meshes, generated art or Petalwake's Three.js runtime. PATROL's existing controls, traffic routes and rendering infrastructure remain in use.

The following copyright notice and MIT permission text are preserved from upstream:

```text
MIT License

Copyright (c) 2026 Jacob Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
