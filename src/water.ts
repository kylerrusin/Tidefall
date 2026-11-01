import {solidHeight} from './surface-query';
import { DX, GRID, GRAVITY, SIZE, astronomy, terrain, ground } from "./model";
import {reconstructSurface,gridSample} from './hydraulic-surface';
import { planetForSeed } from "./planets";
import { waveContact } from "./waves";
/** Reduced local-inertial shallow-water model (Bates-style). Continuity is conservative;
 * edge discharge has pressure and Manning friction but omits advective acceleration.
 * This is an explicitly reduced hydraulic model, not a full Saint-Venant solver.
 * Dry sill heights prevent disconnected basins filling. Boundary volume is audited. */
export class Water {
  bed: Float64Array;
  h: Float64Array;
  qx: Float64Array;
  qz: Float64Array;
  boundaryVolume = 0;
  initialVolume = 0;
  time = 0;
  sourceVolume=0;
  dry = false;
  reconstructed:Float64Array|null=null;
  custom=false;
  duration=1800;
  constructor(
    public seed = 42,
    public n = GRID,
    public dx = DX,
    customBed?: number[],
    level = astronomy(0).level,
  ) {
    this.custom=!!customBed;
    this.bed = Float64Array.from(
      customBed ??
        Array.from({ length: n * n }, (_, k) =>
          solidHeight(
            (k % n) * dx - SIZE / 2,
            Math.floor(k / n) * dx - SIZE / 2,
            seed,
          ),
        ),
    );
    this.h = new Float64Array(n * n);
    this.qx = new Float64Array(n * n);
    this.qz = new Float64Array(n * n);
    this.dry=!planetForSeed(seed).water && !customBed;
    if(this.dry)return;
    const queue: number[] = [],
      seen = new Set<number>();
    for (let x = 0; x < n; x++)
      if (this.bed[(n - 1) * n + x] < level) {
        queue.push((n - 1) * n + x);
        seen.add((n - 1) * n + x);
      }
    for (let p = 0; p < queue.length; p++) {
      const k = queue[p];
      this.h[k] = Math.max(0, level - this.bed[k]);
      for (const j of this.neighbors(k))
        if (!seen.has(j) && this.bed[j] < level) {
          seen.add(j);
          queue.push(j);
        }
    }
    this.initialVolume = this.volume();
  }
  neighbors(k: number) {
    const n = this.n,
      r = Math.floor(k / n),
      c = k % n;
    return [
      c > 0 ? k - 1 : -1,
      c < n - 1 ? k + 1 : -1,
      r > 0 ? k - n : -1,
      r < n - 1 ? k + n : -1,
    ].filter((j) => j >= 0);
  }
  volume() {
    return this.h.reduce((a, b) => a + b, 0) * this.dx * this.dx;
  }
  advance(duration: number, level: number) {
    if(this.dry){this.time+=duration;return;}
    let remaining = duration;
    while (remaining > 1e-8) {
      let max = 1;
      for (const h of this.h) max = Math.max(max, h);
      const dt = Math.min(
        remaining,
        0.12,
        (0.35 * this.dx) / Math.sqrt(planetForSeed(this.seed).gravity * max),
      );
      this.step(dt, level);
      remaining -= dt;
      this.time += dt;
    }
  }
  step(dt: number, level: number) {
    this.reconstructed=null;
    const GRAVITY=planetForSeed(this.seed).gravity;
    const n = this.n,
      dx = this.dx,
      area = dx * dx;
    const edge = (a: number, b: number, old: number) => {
      const ea = this.bed[a] + this.h[a],
        eb = this.bed[b] + this.h[b],
        hf = Math.max(0, Math.max(ea, eb) - Math.max(this.bed[a], this.bed[b]));
      if (hf < 0.002) return 0;
      let q =
        (old - (GRAVITY * hf * dt * (eb - ea)) / dx) /
        (1 +
          (GRAVITY * 0.035 ** 2 * dt * Math.abs(old)) /
            Math.max(0.001, hf ** (7 / 3)));
      const donor = q > 0 ? a : b;
      return (
        Math.sign(q) * Math.min(Math.abs(q), (this.h[donor] * dx) / (4 * dt))
      );
    };
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const k = z * n + x;
        if (x < n - 1) this.qx[k] = edge(k, k + 1, this.qx[k]);
        if (z < n - 1) this.qz[k] = edge(k, k + n, this.qz[k]);
      }
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const k = z * n + x;
        const net =
          (x > 0 ? this.qx[k - 1] : 0) -
          (x < n - 1 ? this.qx[k] : 0) +
          (z > 0 ? this.qz[k - n] : 0) -
          (z < n - 1 ? this.qz[k] : 0);
        this.h[k] = Math.max(0, this.h[k] + (net * dt) / dx);
      }
    for (let x = 0; x < n; x++) {
      const k = (n - 1) * n + x,
        newH = Math.max(0, level - this.bed[k]);
      this.boundaryVolume += (newH - this.h[k]) * area;
      this.h[k] = newH;
    }
  }
  sample(x: number, z: number) {
    const i = Math.max(
        0,
        Math.min(this.n - 1, Math.round((x + SIZE / 2) / this.dx)),
      ),
      j = Math.max(
        0,
        Math.min(this.n - 1, Math.round((z + SIZE / 2) / this.dx)),
      ),
      k = j * this.n + i;
    return {
      ...this.contactAt(x,z,k),
      u: this.h[k] > 0.05 ? this.qx[k] / this.h[k] : 0,
      v: this.h[k] > 0.05 ? this.qz[k] / this.h[k] : 0,
    };
  }
  contactAt(x:number,z:number,k:number){
    if(this.custom)return {depth:this.h[k],level:this.bed[k]+this.h[k]};
    if(this.dry)return {depth:0,level:-100};
    this.reconstructed??=reconstructSurface(this.levels(),this.n);
    const eta=gridSample(this.reconstructed,x,z,this.n,this.dx);
    return {depth:Number.isFinite(eta)?Math.max(0,eta-solidHeight(x,z,this.seed)):0,level:Number.isFinite(eta)?eta:-100};
  }
  levels() {
    const result=new Array<number>(this.h.length);
    for(let k=0;k<this.h.length;k++){const h=this.h[k];result[k]=h>0.025?Math.round((h+this.bed[k])*100)/100:-100;}
    return result;
  }
  surface(x:number,z:number,time:number){return waveContact(this.sample(x,z),x,z,time,this.seed,this.duration);}
  /** Equivalent initial sea-surface displacement from a localized submarine slip.
   * Balanced uplift/subsidence lobes; no moving wall or global level override. */
  disturbSurface(x:number,z:number,amplitude:number,radius:number){
    this.reconstructed=null;
    if(this.dry)return 0;const positive=new Float64Array(this.h.length),negative=new Float64Array(this.h.length);
    let a=0,b=0;for(let j=0;j<this.n;j++)for(let i=0;i<this.n;i++){
      const k=j*this.n+i;if(this.h[k]<2)continue;const r2=(i*this.dx-SIZE/2-x)**2+(j*this.dx-SIZE/2-z)**2;
      if(r2>(radius*3.5)**2)continue;positive[k]=Math.exp(-r2/radius**2);negative[k]=Math.exp(-r2/(radius*1.8)**2);a+=positive[k];b+=negative[k];
    }
    if(b===0)return 0;const ratio=a/b,scale=amplitude/Math.max(.1,1-ratio);let volume=0;
    for(let k=0;k<this.h.length;k++){const delta=Math.max(-this.h[k]*.8,scale*(positive[k]-ratio*negative[k]));this.h[k]+=delta;volume+=delta*this.dx*this.dx;}
    this.sourceVolume+=volume;return volume;
  }
}
