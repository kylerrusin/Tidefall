export type Normal3={x:number;y:number;z:number};
export const ROCK_TEXTURE_METRES=2.4;
export function unitNormal(n:Normal3){const d=Math.hypot(n.x,n.y,n.z);return Number.isFinite(d)&&d>1e-10?{x:n.x/d,y:n.y/d,z:n.z/d}:{x:0,y:1,z:0};}
export function triplanarWeights(n:Normal3,k=4){n=unitNormal(n);const a=[Math.abs(n.x)**k,Math.abs(n.y)**k,Math.abs(n.z)**k],sum=a.reduce((s,v)=>s+v,0);return a.map(v=>v/sum) as [number,number,number];}
export function triplanarCoordinates(p:Normal3,n:Normal3,scale=ROCK_TEXTURE_METRES){n=unitNormal(n);const s=[n.x<0?-1:1,n.y<0?-1:1,n.z<0?-1:1],d=Math.max(.0001,scale);return [[-p.z*s[0]/d,p.y/d],[p.x/d,-p.z*s[1]/d],[p.x*s[2]/d,p.y/d]];}
/** Common right-handed projection frames. Flat maps contribute zero delta to the geometric normal. */
export function triplanarNormal(n:Normal3,maps:Normal3[]){n=unitNormal(n);const w=triplanarWeights(n),s=[n.x<0?-1:1,n.y<0?-1:1,n.z<0?-1:1],[a,b,c]=maps.map(unitNormal),d=[[(a.z-1)*s[0],a.y,-a.x*s[0]],[b.x,(b.z-1)*s[1],-b.y*s[1]],[c.x*s[2],c.y,(c.z-1)*s[2]]];return unitNormal({x:n.x+d.reduce((v,p,i)=>v+p[0]*w[i],0),y:n.y+d.reduce((v,p,i)=>v+p[1]*w[i],0),z:n.z+d.reduce((v,p,i)=>v+p[2]*w[i],0)});}
export const TRIPLANAR_GLSL=`
vec3 geoSigns(vec3 n){return vec3(n.x<0.?-1.:1.,n.y<0.?-1.:1.,n.z<0.?-1.:1.);}
vec2 geoUvX(vec3 p,vec3 n,float scale){return vec2(-p.z*geoSigns(n).x,p.y)/scale;}
vec2 geoUvY(vec3 p,vec3 n,float scale){return vec2(p.x,-p.z*geoSigns(n).y)/scale;}
vec2 geoUvZ(vec3 p,vec3 n,float scale){return vec2(p.x*geoSigns(n).z,p.y)/scale;}
vec3 geoMappedNormal(vec3 n,vec3 w,vec3 a,vec3 b,vec3 c){vec3 s=geoSigns(n);a=normalize(a);b=normalize(b);c=normalize(c);return normalize(n+vec3((a.z-1.)*s.x,a.y,-a.x*s.x)*w.x+vec3(b.x,(b.z-1.)*s.y,-b.y*s.y)*w.y+vec3(c.x*s.z,c.y,(c.z-1.)*s.z)*w.z);}
`;
