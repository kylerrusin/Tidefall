import type {ObjectState} from './model';
/** Portable physical resources must fit a suit kit; larger bodies stay in the world. */
export function objectInteraction(o:Pick<ObjectState,'mass'|'radius'|'active'>){
 if(o.active===false)return 'inactive';
 if(!Number.isFinite(o.mass)||!Number.isFinite(o.radius)||o.mass<=0||o.radius<=0)return 'invalid';
 return o.mass<=15&&o.radius<=.2?'portable resource':'heavy movable object';
}
