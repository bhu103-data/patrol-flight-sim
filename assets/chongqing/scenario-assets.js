// Optional Scenario-for-Blender Chongqing landmark adapter.
// Never replaces procedural geometry until a reviewed same-origin GLB is loaded.
// Scenario generation/payment and the local Blender MCP are NOT called here.
export const MAX_SCENARIO_BYTES = 8 * 1024 * 1024;
export const MAX_SCENARIO_TRIANGLES = 25000;

export function checkScenarioManifest(manifest, preview = false) {
  if (!manifest || manifest.schema_version !== 1) throw Error('Unsupported Scenario manifest');
  const spec = manifest.hongyadong;
  if (!spec || typeof spec !== 'object' ||
      typeof spec.file !== 'string' ||
      !/^generated\/[a-zA-Z0-9_-]+\.glb$/.test(spec.file)) {
    throw Error('Scenario GLB must be an approved local generated/*.glb file');
  }
  if (!Array.isArray(spec.position) || !Array.isArray(spec.scale) ||
      spec.position.length !== 3 || spec.scale.length !== 3 ||
      ![...spec.position, ...spec.scale, spec.rotation_y].every(Number.isFinite) ||
      spec.position.some(n => Math.abs(n) > 4000) ||
      spec.scale.some(n => n <= 0 || n > 5)) {
    throw Error('Scenario transform is outside supported game-space bounds');
  }
  if (spec.enabled && (typeof spec.license !== 'string' || !spec.license.trim())) {
    throw Error('Activating a public GLB requires a verified redistribution license');
  }
  return {spec, shouldLoad: spec.enabled === true || preview};
}

export function validateScenarioGLB(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw Error('Scenario asset must be an ArrayBuffer');
  const length = buffer.byteLength;
  if (length < 40 || length > MAX_SCENARIO_BYTES) throw Error('Scenario asset exceeds GLB size limits');
  const view = new DataView(buffer);
  const u32 = n => view.getUint32(n, true);
  if (u32(0) !== 0x46546c67 || u32(4) !== 2 || u32(8) !== length) {
    throw Error('Invalid GLB version or length');
  }
  const jsonLength = u32(12), binHeader = 20 + jsonLength;
  if (u32(16) !== 0x4e4f534a || jsonLength < 4 || jsonLength % 4 ||
      binHeader + 8 > length || u32(binHeader + 4) !== 0x004e4942 ||
      u32(binHeader) !== length - binHeader - 8) {
    throw Error('Invalid GLB chunks');
  }
  let gltf;
  try {
    gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  } catch {
    throw Error('Malformed GLB glTF JSON');
  }
  if (!gltf.asset || gltf.asset.version !== '2.0') throw Error('Not glTF 2.0');
  if ((gltf.extensionsRequired || []).length) {
    throw Error('GLB uses extensions requiring unsupported external decoders');
  }
  if (!Array.isArray(gltf.buffers) || gltf.buffers.length !== 1 ||
      gltf.buffers[0].uri || gltf.buffers[0].byteLength > u32(binHeader)) {
    throw Error('External or invalid GLB buffer');
  }
  const views = gltf.bufferViews || [];
  if (views.length > 2500) throw Error('Too many GLB views');
  for (const item of views) {
    const offset = item.byteOffset ?? 0;
    if (item.buffer !== 0 || !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(item.byteLength) || offset < 0 ||
        item.byteLength < 0 || offset + item.byteLength > u32(binHeader)) {
      throw Error('Invalid GLB buffer view');
    }
  }
  const images = gltf.images || [];
  if (images.length > 8 || images.some(img =>
    img.uri !== undefined || !Number.isInteger(img.bufferView) ||
    !['image/png','image/jpeg','image/webp'].includes(img.mimeType) ||
    !views[img.bufferView] || views[img.bufferView].byteLength > 4*1024*1024)) {
    throw Error('Only embedded, budgeted PNG/JPEG/WebP images are supported');
  }
  if ((gltf.nodes || []).length > 1024 || (gltf.materials || []).length > 80 ||
      (gltf.meshes || []).length > 80) {
    throw Error('Scene graph exceeds the landmark budget');
  }
  let triangles = 0;
  const accessors = gltf.accessors || [];
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) {
        throw Error('Only triangle primitives are supported');
      }
      const pos = accessors[primitive.attributes?.POSITION];
      const count = primitive.indices !== undefined
        ? accessors[primitive.indices]?.count : pos?.count;
      if (!pos || !Number.isSafeInteger(count) || count % 3 !== 0) {
        throw Error('Invalid triangle accessor');
      }
      triangles += count / 3;
      if (triangles > MAX_SCENARIO_TRIANGLES) throw Error('Scenario triangle budget exceeded');
    }
  }
  if (triangles < 500) throw Error('Scenario landmark needs at least 500 triangles');
  return {bytes:length,triangles,images:images.length};
}

// Used only after the manifest is enabled, or an explicit ?scenario=hongyadong preview.
// The original collision index stays in use. Failures never hide the old model.
export async function loadOptionalHongyadong({
  THREE, scene, detailBuild, search = '', fetcher = fetch, decodeModel
}) {
  const preview = new URLSearchParams(search).get('scenario') === 'hongyadong';
  const manifestResponse = await fetcher('./assets/chongqing/scenario-manifest.json');
  if (!manifestResponse.ok) throw Error('Scenario manifest unavailable');
  const manifest = await manifestResponse.json();
  const {spec,shouldLoad} = checkScenarioManifest(manifest,preview);
  if (!shouldLoad) return {active:false,reason:'Not enabled; procedural scene retained'};
  const target = './assets/chongqing/' + spec.file;
  const response = await fetcher(target);
  if (!response.ok) throw Error('Scenario GLB unavailable: ' + response.status);
  const declaredBytes = Number(response.headers?.get?.('content-length') || 0);
  if (declaredBytes > MAX_SCENARIO_BYTES) throw Error('Scenario GLB exceeds size limit');
  const buffer = await response.arrayBuffer();
  const audit = validateScenarioGLB(buffer);
  let asset;
  if (decodeModel) {
    asset = await decodeModel(buffer);
  } else {
    const {GLTFLoader} = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
    asset = await new Promise((resolve,reject) =>
      new GLTFLoader().parse(buffer, '', resolve, reject));
  }
  const model = asset.scene || asset;
  if (!model?.isObject3D) throw Error('Scenario decoder returned no Three.js scene');
  model.position.set(...spec.position);
  model.rotation.y = spec.rotation_y;
  model.scale.set(...spec.scale);
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (![size.x,size.y,size.z].every(n => Number.isFinite(n) && n > 0 && n < 500)) {
    throw Error('Scenario landmark bounds are invalid');
  }
  // Only swap the facade geometry AFTER successfully decoding, measuring
  // and inserting the GLB. Keep old obstacle volumes and bridge unchanged.
  scene.add(model);
  try {
    detailBuild.setHongyadongReplacement(true);
  } catch (error) {
    scene.remove(model);
    throw error;
  }
  let active = true;
  return {
    active, audit, bounds:[size.x,size.y,size.z],
    restore() {
      if (!active) return;
      detailBuild.setHongyadongReplacement(false);
      scene.remove(model);
      active = false;
    }
  };
}
