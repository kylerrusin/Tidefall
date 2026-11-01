/** Keep the original brightening response, but release automatic exposure slowly.
 * For the same targets this never produces less light than the former 8/s response. */
export function lampIntensity(current:number,target:number,dt:number){return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*(target<current?1.4:8)));}
