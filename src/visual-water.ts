import {invalidateSurface} from './hydraulic-surface';
/** Buffered presentation only. Dry cells never blend with a dry-bed sentinel. */
export class VisualWater {
 readonly levels=new Float64Array(65*65).fill(-100);
 readonly x=new Float64Array(65*65);readonly z=new Float64Array(65*65);
 private fromX=new Float64Array(65*65);private fromZ=new Float64Array(65*65);private from=new Float64Array(65*65);private to: ArrayLike<number>|null=null;
 private ux:ArrayLike<number>=[];private uz:ArrayLike<number>=[];private at=0;private previous=-Infinity;private last=-Infinity;private span=.1;
 receive(levels:ArrayLike<number>,x:ArrayLike<number>,z:ArrayLike<number>,now:number){
  if(levels===this.to)return;this.from.set(this.levels);this.fromX.set(this.x);this.fromZ.set(this.z);this.span=Math.max(.05,Math.min(.15,now-this.previous));this.previous=now;this.at=now;this.ux=x;this.uz=z;
  if(!this.to){this.levels.set(Array.from(levels));this.from.set(this.levels);}this.to=levels;this.last=-Infinity;
 }
 update(now:number){if(!this.to||now-this.last<1/30)return false;this.last=now;const a=Math.max(0,Math.min(1,(now-this.at)/this.span));let changed=false;
  for(let i=0;i<this.levels.length;i++){const target=this.to[i],old=this.from[i],wet=Number.isFinite(target)&&target> -90,value=wet?(old> -90&&Number.isFinite(old)?old+(target-old)*a:target):-100;if(value!==this.levels[i])changed=true;this.levels[i]=value;const oldX=this.x[i],oldZ=this.z[i];this.x[i]=wet?this.fromX[i]+((this.ux[i]??0)-this.fromX[i])*a:0;this.z[i]=wet?this.fromZ[i]+((this.uz[i]??0)-this.fromZ[i])*a:0;if(this.x[i]!==oldX||this.z[i]!==oldZ)changed=true;}
  if(changed)invalidateSurface(this.levels);return changed;
 }
}
