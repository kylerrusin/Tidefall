/** Local-only stdin QA fixtures. No production import, HTTP route, or client state injection. */
import { createInterface } from "node:readline";
import {readFileSync} from 'node:fs';
import { startServer } from "../server";
import { creatureClearance } from "../src/creatures";
import { ground } from "../src/model";
import { environment } from "../src/survival";
import {Expedition} from "../src/simulation";
import { Water } from "../src/water";
const running = await startServer(Number(process.env.PORT ?? 4174));
const lines = createInterface({ input: process.stdin });
const protectedRooms=new WeakSet(),wrappedRooms=new WeakSet(),frozenRooms=new WeakSet(),staticRooms=new WeakSet();
const applyCommand=(line:string)=>{if(!line.trim())return;
  try {
    const requested=JSON.parse(line);if(requested.create&&!running.rooms.has(requested.code))running.rooms.set(requested.code,new Expedition(requested.code,requested.seed??42,requested.mode==='preview'?'preview':'survival'));
    const cmd = requested,
      room = running.rooms.get(cmd.code);
    if (!room) throw new Error("Unknown room");
    if(cmd.protect===false)protectedRooms.delete(room);
    if(cmd.static===false)staticRooms.delete(room);if(cmd.static)staticRooms.add(room);
    if(cmd.freeze===false)frozenRooms.delete(room);if(cmd.freeze)frozenRooms.add(room);
    if(cmd.protect||cmd.freeze){protectedRooms.add(room);if(!wrappedRooms.has(room)){wrappedRooms.add(room);const step=room.step.bind(room);room.step=(dt)=>{if(staticRooms.has(room)&&room.status==='running'){room.lastActive=Date.now();return;}const frozenTime=room.time;if(protectedRooms.has(room))for(const p of room.players.values()){p.health=100;p.temperature=37;p.oxygen=100;}step(dt);if(frozenRooms.has(room))room.time=frozenTime;};}}
    if(cmd.start&&room.players.size&&room.status==='ready'){for(const p of room.players.values()){p.ready=true;p.loaded=true;}room.action(room.host,'start');}
    if(typeof cmd.clockOnly==='number')room.time=cmd.clockOnly;if(cmd.extraction){room.updateExtraction();room.world.step();}
    if (typeof cmd.time === "number") {
      if (cmd.time < room.time) {
        room.water = new Water(room.seed);room.water.duration=room.extraction.timeline.duration;
        room.time = 0;
        if(room.tsunami){room.tsunami.triggered=false;room.tsunami.sourceVolume=0;}
      }
      for (let t = room.time; t < cmd.time; t += 0.5){if(room.tsunami&&!room.tsunami.triggered&&t>=room.tsunami.triggerAt){const e=room.tsunami;e.sourceVolume=room.water.disturbSurface(e.x,e.z,e.amplitude,e.radius);e.triggered=true;}room.water.advance(Math.min(0.5, cmd.time - t), environment(t,room.seed,room.extraction.timeline.duration).sea); }
      room.time = cmd.time;
    }
    if(Array.isArray(cmd.doors))for(const config of cmd.doors){const d=room.doors.find(d=>d.id===config.id);if(d&&typeof config.target==='boolean')d.target=config.target;}
    for (const config of cmd.players ?? []) {
      const p = [...room.players.values()].find(
        (p) => p.color === config.color,
      );
      if (!p) continue;
      if (config.position) {
        const { x, z } = config.position,
          y =
            config.position.y ??
            (config.surface
              ? room.water.sample(x, z).level - 0.25
              : ground(x, z, room.seed) + 1.01);
        Object.assign(p, {
          x,
          y,
          z,
          vx: 0,
          vy: 0,
          vz: 0,
          pushX: 0,
          pushZ: 0,
          coyote: 0,
          jumpBuffer: 0,
          airTime: 0,
        });
        room.bodies.get(p.id)!.setTranslation(p, true);
      }
      for (const key of [
        "health",
        "oxygen",
        "temperature",
        "canisters", "medicine", "cells", "compounds", "fuel",
      ] as const)
        if (typeof config[key] === "number") p[key] = config[key];
      if (typeof config.insulated === "boolean") p.insulated = config.insulated;
    }
    if(Array.isArray(cmd.creatures))for(const config of cmd.creatures){const s=room.stalkers[config.id];if(!s)continue;Object.assign(s,config);if(config.x!==undefined&&config.z!==undefined&&config.y===undefined)s.y=ground(s.x,s.z,room.seed)+creatureClearance(s.kind);room.stalkerColliders[s.id].setEnabled(s.health>0);room.stalkerBodies[s.id].setTranslation(s,true);}
    room.world.propagateModifiedBodyPositionsToColliders();for(const action of cmd.actions??[]){const p=[...room.players.values()].find(p=>p.color===action.color);if(p)room.action(p.id,action.type);}if(cmd.extraction){room.updateExtraction();room.world.step();}room.world.propagateModifiedBodyPositionsToColliders();
    console.log(
      JSON.stringify({
        code: room.code,
        seed: room.seed,
        time: room.time,
        status: room.status,
        players: [...room.players.values()].map((p) => ({
          id: p.id,
          color: p.color,
          x: p.x,
          y: p.y,
          z: p.z,
          alive: p.alive,
          health: p.health,
          oxygen: p.oxygen,
          temperature: p.temperature,
          canisters: p.canisters,
          cause: p.deathCause,
        })),
        extraction:room.extraction,
        cavern: room.water.sample(-46, 12),
      }),
    );
  } catch (e) {
    console.error(String(e));
  }
};
lines.on('line',applyCommand);
// Optional local file control avoids Windows terminal line buffering during browser QA.
const fixtureFile=process.env.TIDEFALL_QA_COMMAND_FILE;if(fixtureFile){let previous='';setInterval(()=>{try{const text=readFileSync(fixtureFile,'utf8');if(text!==previous){previous=text;applyCommand(text);}}catch{}},250);}
