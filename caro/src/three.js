'use strict';
// Three.js loads through the import map (see index.html); app scripts wait on window.threeReady.
window.threeReady = Promise.all([import('three'), import('three/addons/utils/BufferGeometryUtils.js')])
  .then(([core, utils]) => { window.THREE = { ...core, mergeGeometries: utils.mergeGeometries }; });
