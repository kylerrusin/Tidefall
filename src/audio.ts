import {GEOLOGY} from './geological-catalog';
import { Player, Snapshot, chemistry } from "./model";
import { environment } from "./survival";
import { damageBearing } from "./combat";
import {doorRecipes} from './facility';
/** Original synthesized audio. AudioContext is only created by a user gesture. */
class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  wind: GainNode | null = null;
  surf: GainNode | null = null;
  steam: GainNode | null = null;
  jet: GainNode | null = null;
  muted = true;
  lastStep = 0;
  notice = -1;
  anchor = "";
  lastRising = false;
  filter: BiquadFilterNode | null = null;
  lastOxygen = 0;
  creatureCues = new Map<number, string>();
  lastCreatureStep = new Map<number, number>();
  pulseId = -1;
  room = "";
  cold="normal";quake="";
  doorCues=new Map<string,boolean>();flightCue='';
  enable(on: boolean) {
    this.muted = !on;
    if (!this.context && on) {
      const c = (this.context = new AudioContext()),
        master = (this.master = c.createGain());
      master.gain.value = 0.2;
      this.filter = c.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 14000;
      master.connect(this.filter);
      this.filter.connect(c.destination);
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
        data = buffer.getChannelData(0);
      let a = 731;
      for (let i = 0; i < data.length; i++) {
        a = (Math.imul(a, 1664525) + 1013904223) | 0;
        data[i] = (a >>> 0) / 2147483648 - 1;
      }
      const noise = (frequency: number) => {
        const source = c.createBufferSource(),
          filter = c.createBiquadFilter(),
          gain = c.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = frequency;
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        return gain;
      };
      this.wind = noise(450);
      this.surf = noise(900);
      this.steam = noise(2500);
      this.jet = noise(1300);
    }
    if (this.context) {
      if (on) void this.context.resume();
      else void this.context.suspend();
    }
  }
  tone(frequency: number, duration = 0.2, volume = 0.12, end = frequency) {
    const c = this.context;
    if (!c || this.muted) return;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(frequency, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(end, c.currentTime + duration);
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(volume, c.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(this.master!);
    o.start();
    o.stop(c.currentTime + duration + 0.05);
  }
  spatialTone(source: {x:number;y:number;z:number}, listener: Player, frequency: number, duration: number, end: number) {
    const c=this.context;if(!c||this.muted)return;
    const distance=Math.hypot(source.x-listener.x,source.y-listener.y,source.z-listener.z);
    if(distance>50)return;
    const o=c.createOscillator(),g=c.createGain(),pan=c.createStereoPanner();
    pan.pan.value=Math.sin(damageBearing(source,listener,listener.yaw));
    o.type="triangle";o.frequency.setValueAtTime(frequency,c.currentTime);o.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);
    g.gain.setValueAtTime(.001,c.currentTime);g.gain.linearRampToValueAtTime(.13/(1+distance*.08),c.currentTime+.025);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);
    o.connect(g);g.connect(pan);pan.connect(this.master!);o.start();o.stop(c.currentTime+duration+.02);
  }
  update(
    p: Player | undefined,
    state: Snapshot | null,
    underwater: boolean,
    now: number,
  ) {
    const c = this.context;
    if (!c || this.muted || !p || !state) return;
    const room=state.code+":"+state.seed;
    if(room!==this.room){this.room=room;this.creatureCues.clear();this.lastCreatureStep.clear();this.pulseId=-1;}
    if(p.coldStage!==this.cold){if(p.coldStage!=="normal")this.tone(p.coldStage==="critical"?180:320,.3,.09,160);this.cold=p.coldStage;}
    const quake=state.tsunami&&state.time>=state.tsunami.warningAt?`${state.tsunami.id}:${state.tsunami.triggered}`:"";if(quake&&quake!==this.quake){this.tone(42,1.4,.3,26);this.quake=quake;}
    for(const door of state.doors){const previous=this.doorCues.get(door.id);if(previous!==undefined&&previous!==door.target){const recipe=doorRecipes(state.seed).find(d=>d.id===door.id);if(recipe)this.spatialTone(recipe,p,door.target?160:240,.65,90);}this.doorCues.set(door.id,door.target);}
    if(state.extraction.phase!==this.flightCue){this.flightCue=state.extraction.phase;if(this.flightCue==='departing'&&p.extractedAt!==null){this.tone(150,2,.12,55);this.tone(720,.3,.08,900);}if(this.flightCue==='boarding'&&state.extraction.site)this.spatialTone(state.extraction.site,p,300,.6,600);}
    for(const s of state.stalkers){
      const cue=s.state+":"+s.stateSince;
      if(this.creatureCues.get(s.id)!==cue){
        if(s.state==="alert")this.spatialTone(s,p,140,.5,420);
        if(s.state==="windup" && (s.kind==="ridgeback"||s.kind==="sentinel"))this.spatialTone(s,p,65,1.1,180);
        if(s.state==="windup" && s.kind!=="ridgeback"&&s.kind!=="sentinel")this.spatialTone(s,p,s.attackKind==="ranged"?340:100,s.attackKind==="ranged"?.8:.5,s.attackKind==="ranged"?850:220);
        if(s.state==="attack")this.spatialTone(s,p,s.attackKind==="ranged"?750:95,.18,65);
        if(s.state==="dead")this.spatialTone(s,p,210,.6,40);
        this.creatureCues.set(s.id,cue);
      }
      if(s.health>0 && Math.hypot(s.vx,s.vz)>.6 && now-(this.lastCreatureStep.get(s.id)??0)>520){this.spatialTone(s,p,s.kind==="ridgeback"?42:95,s.kind==="ridgeback"?.19:.09,30);this.lastCreatureStep.set(s.id,now);}
    }
    for(const pulse of state.pulses)if(pulse.id>this.pulseId){
      this.pulseId=pulse.id;
      if(pulse.kind==="sample")this.spatialTone(pulse.to,p,GEOLOGY[pulse.unitId??""]?.family==="mineral"?640:GEOLOGY[pulse.unitId??""]?.family==="sediment"?110:260,.18,90);
      else if(pulse.hit && pulse.kind!=="sample-reject" && pulse.kind!=="creature" && pulse.kind!=="player")this.spatialTone(pulse.to,p,pulse.kind==="object"?310:160,.12,65);
    }
    const set = (gain: GainNode | null, v: number) =>
        gain?.gain.setTargetAtTime(v, c.currentTime, 0.3),
      region = chemistry(p.x, p.z, 0,state.seed);
    this.filter?.frequency.setTargetAtTime(
      underwater ? 600 : 14000,
      c.currentTime,
      0.2,
    );
    set(
      this.wind,
      underwater
        ? 0.008
        : Math.min(
            0.22,
            0.03 +
              Math.max(0, p.y) * 0.002 +
              environment(state.time,state.seed,state.extraction.timeline.duration).storm * 0.08,
          ),
    );
    set(
      this.surf,
      state.seed<0 ? 0 : underwater ? 0.08 : 0.06 + 0.03 * Math.sin(now * 0.0005) ** 2,
    );
    set(this.steam, Math.max(0, (region.temperature - 20) / 100) * 0.16);
    set(this.jet, p.thrusting ? 0.2 : 0);
    if (
      p.grounded &&
      Math.hypot(p.vx, p.vz) > 2 &&
      now - this.lastStep > (p.input.sprint ? 270 : 410)
    ) {
      this.lastStep = now;
      this.tone(p.x > 65 ? 180 : p.y < 10 ? 100 : 145, 0.075, 0.08, 60);
    }
    const anchors = state.anchors
      .map(
        (a) =>
          a.owner + ":" + a.sign + ":" + a.x.toFixed(1) + ":" + a.z.toFixed(1),
      )
      .join("|");
    if (anchors !== this.anchor && anchors) {
      this.tone(320, 0.25, 0.15, 80);
    }
    this.anchor = anchors;
    if (state.noticeId !== this.notice) {
      if (this.notice >= 0 && /secured|fitted|replenished|applied/.test(state.notice)) {
        this.tone(440, 0.3, 0.12, 660);
        setTimeout(() => this.tone(880, 0.4, 0.1), 160);
      }
      this.notice = state.noticeId;
    }
    const rising = state.time > 180 && state.time < 420;
    if (rising && !this.lastRising) this.tone(180, 0.8, 0.15, 90);
    this.lastRising = rising;
    if (p.alive && p.oxygen < 25 && now - this.lastOxygen > 2500) {
      this.tone(520, 0.18, 0.14, 300);
      this.lastOxygen = now;
    }
  }
}
export const soundscape = new Soundscape();
