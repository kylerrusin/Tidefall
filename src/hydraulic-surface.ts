/** Reconstruct free surface, never interpolate the dry bed into water elevation.
 * A dry node receives only a one-cell wet-neighbor extension for contouring.
 * The finite-volume solver still owns connectivity and conserved depths. */
export function reconstructSurface(levels:ArrayLike<number>,n:number){
  const eta=new Float64Array(n*n).fill(NaN);
  for(let k=0;k<eta.length;k++){
    if(levels[k]>-90&&Number.isFinite(levels[k])){eta[k]=levels[k];continue;}
    const x=k%n,z=Math.floor(k/n);let sum=0,count=0;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)if(x+i>=0&&x+i<n&&z+j>=0&&z+j<n){const v=levels[(z+j)*n+x+i];if(v>-90&&Number.isFinite(v)){sum+=v;count++;}}
    if(count)eta[k]=sum/count;
  }
  return eta;
}
const cache=new WeakMap<object,Float64Array>();
export const invalidateSurface=(levels:object)=>{cache.delete(levels);wetCache.delete(levels);};
const wetCache=new WeakMap<object,Float64Array>();
export function wetSupport(levels:ArrayLike<number>){let support=wetCache.get(levels);if(!support){support=Float64Array.from({length:65*65},(_,i)=>Number.isFinite(levels[i])&&levels[i]>-90?1:0);wetCache.set(levels,support);}return support;}
export function surfaceGrid(levels:ArrayLike<number>,n=65){let eta=cache.get(levels);if(!eta){eta=reconstructSurface(levels,n);cache.set(levels,eta);}return eta;}
export function gridSample(eta:ArrayLike<number>,x:number,z:number,n=65,dx=5){
  const gx=Math.max(0,Math.min(n-1.000001,(x+160)/dx)),gz=Math.max(0,Math.min(n-1.000001,(z+160)/dx)),i=Math.floor(gx),j=Math.floor(gz),a=gx-i,b=gz-j,k=j*n+i;
  const lower=a+b<=1,va=eta[lower?k:k+n+1],vb=eta[lower?k+1:k+n],vc=eta[lower?k+n:k+1],wa=lower?1-a-b:a+b-1,wb=lower?a:1-a,wc=lower?b:1-b;
  if((wa>1e-7&&!Number.isFinite(va))||(wb>1e-7&&!Number.isFinite(vb))||(wc>1e-7&&!Number.isFinite(vc)))return NaN;
  return (wa>1e-7?va*wa:0)+(wb>1e-7?vb*wb:0)+(wc>1e-7?vc*wc:0);
}
export type ShoreVertex={x:number;z:number;y:number;depth:number;u:number;v:number};
/** Sutherland–Hodgman on the linear depth contour of each actual terrain triangle. */
export function clipWetTriangle(triangle:ShoreVertex[]){
  const polygon:ShoreVertex[]=[];
  for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],aw=a.depth>0,bw=b.depth>0;if(aw)polygon.push(a);if(aw!==bw){const t=a.depth/(a.depth-b.depth);polygon.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t,depth:0,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}}
  return polygon;
}
