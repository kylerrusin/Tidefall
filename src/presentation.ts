import { Player, Snapshot, V3 } from "./model";
import { lerpAngle } from "./locomotion";
type Frame = { time: number; players: Player[]; objects: Snapshot["objects"]; stalkers: Snapshot["stalkers"]; projectiles: Snapshot["projectiles"] };
/** Presentation samples a time buffer, never a freshly arriving transform. */
export class SnapshotBuffer {
  frames: Frame[] = [];
  arrival = 0;
  push(state: Snapshot, now: number) {
    if (this.frames.length && state.time < this.frames.at(-1)!.time)
      this.frames = [];
    this.frames.push({
      time: state.time,
      players: state.players,
      objects: state.objects,
      stalkers: state.stalkers,
      projectiles: state.projectiles,
    });
    if (this.frames.length > 24) this.frames.shift();
    this.arrival = now;
  }
  sample(id: string, now: number): Player | undefined {
    const last = this.frames.at(-1);
    if (!last) return;
    const t = last.time + Math.min(0.2, Math.max(0, now - this.arrival)) - 0.12;
    let a = this.frames[0],
      b = last;
    for (let i = 1; i < this.frames.length; i++)
      if (this.frames[i].time >= t) {
        a = this.frames[i - 1];
        b = this.frames[i];
        break;
      }
    const p = a.players.find((p) => p.id === id),
      q = b.players.find((p) => p.id === id);
    if (!p || !q) return q ?? p;
    const f =
      b.time > a.time
        ? Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)))
        : 1;
    return {
      ...q,
      x: p.x + (q.x - p.x) * f,
      y: p.y + (q.y - p.y) * f,
      z: p.z + (q.z - p.z) * f,
      yaw: lerpAngle(p.yaw, q.yaw, f),
      cabin:p.cabin&&q.cabin&&p.cabin.seat===q.cabin.seat?{...q.cabin,x:p.cabin.x+(q.cabin.x-p.cabin.x)*f,y:p.cabin.y+(q.cabin.y-p.cabin.y)*f,z:p.cabin.z+(q.cabin.z-p.cabin.z)*f}:q.cabin,
    };
  }
  sampleObject(id: number, now: number) {
    const last = this.frames.at(-1);
    if (!last) return;
    const t = last.time + Math.min(0.2, Math.max(0, now - this.arrival)) - 0.12;
    let a = this.frames[0],
      b = last;
    for (let i = 1; i < this.frames.length; i++)
      if (this.frames[i].time >= t) {
        a = this.frames[i - 1];
        b = this.frames[i];
        break;
      }
    const p = a.objects.find((o) => o.id === id),
      q = b.objects.find((o) => o.id === id);
    if (!p || !q) return q ?? p;
    const f =
      b.time > a.time
        ? Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)))
        : 1;
    let rotation=q.rotation;if(p.rotation&&q.rotation){const a=p.rotation,b=q.rotation,sign=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w<0?-1:1,x=a.x+(b.x*sign-a.x)*f,y=a.y+(b.y*sign-a.y)*f,z=a.z+(b.z*sign-a.z)*f,w=a.w+(b.w*sign-a.w)*f,n=Math.hypot(x,y,z,w)||1;rotation={x:x/n,y:y/n,z:z/n,w:w/n};}
    return {
      ...q,
      rotation,
      x: p.x + (q.x - p.x) * f,
      y: p.y + (q.y - p.y) * f,
      z: p.z + (q.z - p.z) * f,
    };
  }
  sampleStalker(id: number, now: number) {
    const last=this.frames.at(-1); if(!last)return;
    const t=last.time+Math.min(.2,Math.max(0,now-this.arrival))-.12;
    let a=this.frames[0],b=last;
    for(let i=1;i<this.frames.length;i++)if(this.frames[i].time>=t){a=this.frames[i-1];b=this.frames[i];break;}
    const p=a.stalkers.find(s=>s.id===id),q=b.stalkers.find(s=>s.id===id);if(!p||!q)return q??p;
    const f=b.time>a.time?Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time))):1;
    return {...q,x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f,z:p.z+(q.z-p.z)*f,yaw:lerpAngle(p.yaw,q.yaw,f)};
  }
  sampleProjectile(id: number, now: number) {
    const last=this.frames.at(-1);if(!last)return;
    const t=last.time+Math.min(.2,Math.max(0,now-this.arrival))-.12;
    let a=this.frames[0],b=last;
    for(let i=1;i<this.frames.length;i++)if(this.frames[i].time>=t){a=this.frames[i-1];b=this.frames[i];break;}
    const p=a.projectiles.find(p=>p.id===id),q=b.projectiles.find(p=>p.id===id);if(!p||!q)return q??p;
    const f=b.time>a.time?Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time))):1;
    return {...q,x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f,z:p.z+(q.z-p.z)*f};
  }
}
export const diagnostics = {
  fps: 0,textureCount:0,textureEstimateMB:0,cloudGpuMs:null as number|null,waterGpuMs:null as number|null,
  frameMs: 0,
  p95: 0,
  maxMs: 0,
  physicsMs: 0,
  rtt: 0,
  corrections: 0,
  correctionMeters: 0,
  grounded: false,
  colliders: 0,
  objects: 0,
  drawCalls: 0,
  triangles: 0,
  frames: [] as number[],
  measuring: false,
  moonScreen: "",
  frameCount: 0,
  mouseEvents: 0,
  lookEvents: 0,
  movementX: 0,
  movementY: 0,
  lookDiscard: "none",
  cameraOwner: "CameraRig",
  cameraOverwrites: 0,
  renderedYaw: 0,
  renderedPitch: 0,
  aiMs: 0,
};
export function recordFrame(dt: number) {
  const ms = dt * 1000;
  diagnostics.frames.push(ms);
  if (diagnostics.frames.length > 300) diagnostics.frames.shift();
  diagnostics.frameMs =
    diagnostics.frames.reduce((a, b) => a + b, 0) / diagnostics.frames.length;
  diagnostics.fps = 1000 / Math.max(1, diagnostics.frameMs);
  if (++diagnostics.frameCount % 30 === 0) {
    const values = [...diagnostics.frames].sort((a, b) => a - b);
    diagnostics.p95 = values[Math.floor(values.length * 0.95)];
    diagnostics.maxMs = values.at(-1) ?? 0;
  }
}
export function correctionOffset(previous: V3, next: V3) {
  const d = Math.hypot(
    previous.x - next.x,
    previous.y - next.y,
    previous.z - next.z,
  );
  return d > 6
    ? { x: 0, y: 0, z: 0 }
    : {
        x: previous.x - next.x,
        y: previous.y - next.y,
        z: previous.z - next.z,
      };
}
