import {BufferGeometry,BufferAttribute} from 'three';
import {geologicalShape} from './geological-shapes';
/** The existing fractured structural family, reused at its cheapest LOD. No spherical seed. */
const shape=geologicalShape('fractured',3,2);
export const ROCK_CONTACT_VERTICES=shape.vertices;
export const ROCK_INDICES=shape.indices;
export const ROCK_GEOMETRY=new BufferGeometry();ROCK_GEOMETRY.setAttribute('position',new BufferAttribute(shape.vertices,3));ROCK_GEOMETRY.setIndex(new BufferAttribute(shape.indices,1));ROCK_GEOMETRY.computeVertexNormals();ROCK_GEOMETRY.computeBoundingBox();ROCK_GEOMETRY.computeBoundingSphere();
/** Eight-triangle fractured wedge for sub-15 cm gravel, rather than round dodecahedra. */
export const GRAVEL_GEOMETRY=new BufferGeometry();GRAVEL_GEOMETRY.setAttribute('position',new BufferAttribute(new Float32Array([-1,-.2,-.7,.8,-.2,-.8,1,-.1,.55,-.7,-.2,.8,-.6,.6,-.3,.55,.35,.3]),3));GRAVEL_GEOMETRY.setIndex([0,2,1,0,3,2,0,1,4,1,5,4,1,2,5,2,3,5,3,4,5,3,0,4]);GRAVEL_GEOMETRY.computeVertexNormals();

export const REFERENCE_SAMPLE_Y=.995-Math.min(...Array.from(ROCK_CONTACT_VERTICES).filter((_,i)=>i%3===1))*.18-.005;
