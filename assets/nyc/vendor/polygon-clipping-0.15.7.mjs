import './polygon-clipping-0.15.7.umd.mjs';
const polygonClipping=globalThis.polygonClipping;
if(!polygonClipping||typeof polygonClipping.difference!=='function'||
   typeof polygonClipping.union!=='function')
  throw new Error('Vendored polygon-clipping 0.15.7 failed to initialise');
export default polygonClipping;
