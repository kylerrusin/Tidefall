import type { InstancedMesh } from "three";
/** Matrix uploads do not invalidate Three's cached aggregate culling volumes. */
export function refreshInstanceBounds(mesh: InstancedMesh, displacement = 0) {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.boundingBox?.expandByScalar(displacement);
  if(mesh.boundingSphere)mesh.boundingSphere.radius+=displacement;
}

export const visibilityReport={text:""};
