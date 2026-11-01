import type { DamageEvent, Snapshot, V3 } from "./model";
/** Consume authoritative IDs once, independent of snapshot repetition/reconciliation. */
export class Feedback {
  room = ""; time = 0; damageId = 0; pulseId = -1;
  weak=false;
  incoming: DamageEvent | null = null; damageAt = -10000; hitAt = -10000;
  consume(s: Snapshot, id: string, now: number) {
    const key = s.code + ":" + s.seed;
    if (key !== this.room || s.time < this.time) { this.room=key; this.damageId=0; this.pulseId=-1; this.incoming=null; this.damageAt=this.hitAt=-10000; }
    this.time=s.time;
    const sounds: { kind: "damage" | "hit"; source: V3 | null; amount: number }[]=[];
    for (const e of s.damageEvents) {
      if(e.id<=this.damageId) continue;
      this.damageId=Math.max(this.damageId,e.id);
      if(e.victim===id && s.time-e.time<0.8) { this.incoming=e; this.damageAt=now; sounds.push({kind:"damage",source:e.source,amount:e.amount}); }
    }
    for(const pulse of s.pulses) {
      if(pulse.id<=this.pulseId) continue;
      this.pulseId=Math.max(this.pulseId,pulse.id);
      if(pulse.shooter===id && (pulse.kind==="creature" || pulse.kind==="player")) { this.hitAt=now;this.weak=!!pulse.weak; sounds.push({kind:"hit",source:pulse.to,amount:0}); }
    }
    return sounds;
  }
  kick(now: number) { const t=(now-this.damageAt)/1000; return t>=0 && t<0.4 ? Math.sin(t*35)*Math.exp(-t*12)*Math.min(1,(this.incoming?.amount??0)/14) : 0; }
}
export const feedback = new Feedback();
