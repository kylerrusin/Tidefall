import { replenishMedical } from "../src/resources";
import { ground } from "../src/model";
import {facility} from '../src/facility';
import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startServer } from "../server";
import { COMBAT } from "../src/combat";
import { Feedback } from "../src/feedback";
type Message = {
  type: string;
  id?: string;
  token?: string;
  code?: string;
  state?: import("../src/model").Snapshot;
};
function client(url: string, autoLoad=true) {
  const ws = new WebSocket(url);
  let loadedSeed:number|undefined;
  const queue: Message[] = [],
    waiters: {
      test: (m: Message) => boolean;
      resolve: (m: Message) => void;
      timer: ReturnType<typeof setTimeout>;
    }[] = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString()) as Message;
    if(autoLoad && m.type==="state" && m.state!.status==="ready" && (m.state!.seed!==loadedSeed || m.state!.players.some(p=>!p.loaded))){loadedSeed=m.state!.seed;ws.send(JSON.stringify({type:"loaded",position:{seed:loadedSeed}}));}
    queue.push(m);
    if (queue.length > 100) queue.shift();
    for (const w of [...waiters])
      if (w.test(m)) {
        clearTimeout(w.timer);
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(m);
      }
  });
  return {
    ws,
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    wait: (predicate: (m: Message) => boolean) => {
      const existing = queue.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise<Message>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Network state timed out: " +
                  predicate.toString() +
                  "; recent " +
                  JSON.stringify(
                    queue.slice(-3).map((m) => ({
                      type: m.type,
                      status: m.state?.status,
                      seed: m.state?.seed,
                      host: m.state?.host,
                      error: (m as unknown as { message?: string }).message,
                    })),
                  ),
              ),
            ),
          5000,
        );
        waiters.push({ test: predicate, resolve, timer });
      });
    },
    opened: new Promise<void>((r) => ws.on("open", r)),
  };
}
test("two genuine WebSockets share supplies, physics, hazards, elimination, result and rematch", async () => {
  const server = await startServer(0, true),
    port = (server.server.address() as { port: number }).port;
  const a = client(`ws://localhost:${port}/ws`);
  let b: ReturnType<typeof client> | undefined,
    c: ReturnType<typeof client> | undefined;
  try {
    await a.opened;
    a.send({ type: "join" });
    const wa = await a.wait((m) => m.type === "welcome");
    b = client(`ws://localhost:${port}/ws`);
    await b.opened;
    b.send({ type: "join", code: wa.code });
    const wb = await b.wait((m) => m.type === "welcome");
    a.send({ type: "ready" });
    b.send({ type: "ready" });
    await a.wait(
      (m) =>
        m.type === "state" &&
        m.state!.players.length === 2 &&
        m.state!.players.every((p) => p.ready),
    );
    a.send({ type: "start" });
    const s1 = (await a.wait((m) => m.type === "state" && m.state!.time > 0.3))
        .state!,
      s2 = (await b.wait((m) => m.type === "state" && m.state!.time >= s1.time))
        .state!;
    assert.equal(s1.seed, s2.seed);
    assert.equal(s2.players.length, 2);
    assert.ok(Math.abs(s1.time - s2.time) < 0.2);
    assert.ok(s2.players.every((p) => p.alive));
    const room = server.rooms.get(wa.code!)!,
      p = room.players.get(wa.id!)!,
      q = room.players.get(wb.id!)!,
      supply = room.supplies[0];
    // Both socket clients observe the same server-validated shot and creature state.
    p.x = -10; p.z = -113; p.y = ground(p.x, p.z, room.seed) + 1;
    q.x = -10; q.z = -107; q.y = p.y;
    room.bodies.get(p.id)!.setTranslation(p, true);
    room.bodies.get(q.id)!.setTranslation(q, true);
    room.world.propagateModifiedBodyPositionsToColliders();
    room.world.step(); // Refresh the query broadphase after the fixture teleport.
    a.send({ type: "fire", position: { yaw: 0, pitch: 0 } });
    const shotA = (await a.wait(m => m.type === "state" && m.state!.players.find(v => v.id === q.id)?.health === 82)).state!;
    const shotB = (await b.wait(m => m.type === "state" && m.state!.tick === shotA.tick)).state!;
    assert.deepEqual(shotA.stalkers, shotB.stalkers);
    assert.equal(shotB.players.find(v => v.id === q.id)!.health, 82);
    // Proximity fixture; actual contested pickup actions traverse both separate sockets.
    for (const [i, v] of [p, q].entries()) {
      v.x = supply.x + i * 1.1;
      v.y = supply.y + 1;
      v.z = supply.z;
      room.bodies.get(v.id)!.setTranslation(v, true);
    }
    room.world.propagateModifiedBodyPositionsToColliders();
    a.send({ type: "interact" });
    b.send({ type: "interact" });
    const pickup = (
      await a.wait((m) => m.type === "state" && !!m.state!.supplies[0].takenBy)
    ).state!;
    assert.equal(
      pickup.players.reduce((sum, p) => sum + p.canisters, 0),
      1,
    );
    assert.ok([wa.id, wb.id].includes(pickup.supplies[0].takenBy!));
    a.send({ type: "anchor", position: { x: p.x, y: p.y + 4, z: p.z } });
    const fieldA = (
        await a.wait((m) => m.type === "state" && m.state!.anchors.length === 1)
      ).state!,
      fieldB = (
        await b.wait(
          (m) =>
            m.type === "state" &&
            m.state!.anchors.length === 1 &&
            m.state!.tick === fieldA.tick,
        )
      ).state!;
    assert.deepEqual(fieldA.objects, fieldB.objects);
    assert.deepEqual(fieldA.water, fieldB.water);
    b.ws.close();
    await new Promise((r) => setTimeout(r, 100));
    c = client(`ws://localhost:${port}/ws`);
    await c.opened;
    c.send({ type: "join", code: wa.code, token: wb.token });
    const wc = await c.wait((m) => m.type === "welcome");
    assert.equal(wc.id, wb.id);
    const restored = (await c.wait((m) => m.type === "state")).state!;
    assert.equal(restored.supplies[0].takenBy, pickup.supplies[0].takenBy);
    assert.equal(restored.players.length, 2);
    // Stage vulnerable submersion, then let normal authoritative oxygen/hazard ticks eliminate q.
    room.anchors = [];
    q.x = 8;
    q.z = 64;
    q.y = ground(8, 64, room.seed) + 1;
    q.oxygen = 0;
    q.health = 0.05;
    q.input = {
      x: 0,
      z: 0,
      yaw: 0,
      jump: false,
      dive: true,
      sprint: false,
      seq: q.ack,
    };
    room.bodies.get(q.id)!.setTranslation(q, true);
    const endA = (
        await a.wait(
          (m) => m.type === "state" && m.state!.status === "finished",
        )
      ).state!,
      endB = (
        await c.wait(
          (m) => m.type === "state" && m.state!.status === "finished",
        )
      ).state!;
    assert.deepEqual(endA.winnerIds, [p.id]);
    assert.deepEqual(endA.standings, endB.standings);
    assert.equal(
      endB.players.find((v) => v.id === q.id)!.deathCause,
      "Oxygen depleted",
    );
    assert.equal(endB.players.find((v) => v.id === q.id)!.alive, false);
    a.send({ type: "rematch", newSeed: true });
    const rematch = (
      await c.wait(
        (m) =>
          m.type === "state" &&
          m.state!.status === "ready" &&
          m.state!.seed !== s1.seed,
      )
    ).state!;
    assert.equal(rematch.time, 0);
    assert.equal(rematch.players.length, 2);
    assert.ok(
      rematch.players.every(
        (p) => p.alive && p.oxygen === 100 && !p.ready && p.diedAt === null,
      ),
    );
    assert.ok(rematch.supplies.every((s) => s.takenBy === null));
    assert.equal(server.rooms.get(wa.code!)!.tokens.get(wa.id!), wa.token);
  } finally {
    a.ws.terminate();
    b?.ws.terminate();
    c?.ws.terminate();
    await server.close();
  }
});

test("two independent sockets share creature target, telegraph, projectile, damage IDs and death",async()=>{
  const server=await startServer(0,true),port=(server.server.address() as {port:number}).port;
  const a=client(`ws://localhost:${port}/ws`);let b:ReturnType<typeof client>|undefined;
  try {
    await a.opened;a.send({type:"join"});const wa=await a.wait(m=>m.type==="welcome");
    b=client(`ws://localhost:${port}/ws`);await b.opened;b.send({type:"join",code:wa.code});const wb=await b.wait(m=>m.type==="welcome");
    a.send({type:"ready"});b.send({type:"ready"});await a.wait(m=>m.type==="state"&&m.state!.players.length===2&&m.state!.players.every(p=>p.ready));
    a.send({type:"start"});await a.wait(m=>m.type==="state"&&m.state!.time>.1);
    const room=server.rooms.get(wa.code!)!,p=room.players.get(wa.id!)!,q=room.players.get(wb.id!)!,s=room.stalkers[0];
    for(const enemy of room.stalkers.slice(1)){enemy.health=0;enemy.state="dead";room.stalkerColliders[enemy.id].setEnabled(false);}
    Object.assign(p,{x:-10,z:-113,y:24,vx:0,vz:0});Object.assign(q,{x:-13,z:-113,y:24,vx:0,vz:0});
    for(const player of [p,q])room.bodies.get(player.id)!.setTranslation(player,true);
    Object.assign(s,{x:-10,z:-101,y:ground(-10,-101,room.seed)+.82,yaw:Math.PI,state:"idle",targetId:null});
    room.stalkerBodies[0].setTranslation(s,true);room.time=8.1;room.world.step();
    const windup=(await a.wait(m=>m.type==="state"&&m.state!.stalkers[0].state==="windup")).state!;
    const same=(await b.wait(m=>m.type==="state"&&m.state!.tick===windup.tick)).state!;
    assert.equal(windup.stalkers[0].targetId,p.id);assert.deepEqual(same.stalkers,windup.stalkers);assert.ok(windup.stalkers[0].until>windup.time);
    const projectile=(await a.wait(m=>m.type==="state"&&m.state!.projectiles.length>0)).state!;
    const projectileB=(await b.wait(m=>m.type==="state"&&m.state!.tick===projectile.tick)).state!;
    assert.deepEqual(projectileB.projectiles,projectile.projectiles);
    const hurt=(await a.wait(m=>m.type==="state"&&m.state!.damageEvents.some(e=>e.victim===p.id&&e.kind==="spore"))).state!;
    const hurtB=(await b.wait(m=>m.type==="state"&&m.state!.tick===hurt.tick)).state!;
    assert.deepEqual(hurt.damageEvents,hurtB.damageEvents);assert.equal(hurt.players.find(v=>v.id===p.id)!.health,100-COMBAT.stalker.projectileDamage);
    const f=new Feedback();assert.equal(f.consume(hurt,p.id,10).filter(e=>e.kind==="damage").length,1);assert.equal(f.consume(hurtB,p.id,20).length,0);
    const fire=(sender:ReturnType<typeof client>,player:typeof p)=>sender.send({type:"fire",position:{yaw:Math.atan2(s.x-player.x,s.z-player.z),pitch:Math.atan2(player.y+.65-s.y,Math.hypot(s.x-player.x,s.z-player.z))}});
    fire(a,p);fire(b,q);await a.wait(m=>m.type==="state"&&m.state!.stalkers[0].health===54);
    await new Promise(resolve=>setTimeout(resolve,400));fire(a,p);fire(b,q);
    await a.wait(m=>m.type==="state"&&m.state!.stalkers[0].health===18);
    await new Promise(resolve=>setTimeout(resolve,400));fire(a,p);
    const dead=(await a.wait(m=>m.type==="state"&&m.state!.stalkers[0].state==="dead")).state!;
    const deadB=(await b.wait(m=>m.type==="state"&&m.state!.tick===dead.tick)).state!;
    assert.equal(dead.stalkers[0].health,0);assert.deepEqual(dead.stalkers,deadB.stalkers);assert.equal(dead.projectiles.length,0);
    assert.deepEqual(dead.supplies,deadB.supplies);assert.equal(dead.supplies.filter(v=>v.id==="loot-0-0").length,1);
    const loot=room.supplies.find(v=>v.id==="loot-0-0")!;
    for(const [i,player] of [p,q].entries()){const x=loot.x+(i?1.2:-1.2);Object.assign(player,{x,y:ground(x,loot.z,room.seed)+1.01,z:loot.z});room.bodies.get(player.id)!.setTranslation(player,true);}
    room.world.step();
    a.send({type:"interact"});b.send({type:"interact"});
    const picked=(await a.wait(m=>m.type==="state"&&!!m.state!.supplies.find(v=>v.id==="loot-0-0")?.takenBy)).state!;
    const pickedB=(await b.wait(m=>m.type==="state"&&m.state!.tick===picked.tick)).state!;
    assert.deepEqual(picked.supplies,pickedB.supplies);assert.equal(picked.players.reduce((sum,p)=>sum+p.medicine,0),1);
    b.ws.close();await a.wait(m=>m.type==="state"&&m.state!.players.some(v=>v.id===q.id&&!v.connected));
  }finally{a.ws.terminate();b?.ws.terminate();await server.close();}
});

test("host-only destinations synchronize both sockets, reset inventories and wait for world-specific loading",async()=>{
  const server=await startServer(0,true),url=`ws://localhost:${(server.server.address() as {port:number}).port}/ws`,a=client(url),b=client(url,false);
  try{
    await a.opened;a.send({type:"join"});const wa=await a.wait(m=>m.type==="welcome");await b.opened;b.send({type:"join",code:wa.code});const wb=await b.wait(m=>m.type==="welcome");
    b.send({type:"destination",planet:"pyrax"});b.send({type:"ready"});const initial=(await a.wait(m=>m.type==="state"&&m.state!.players.some(p=>p.id===wb.id&&p.ready))).state!;assert.equal(initial.planet,"tidefall");
    server.rooms.get(wa.code!)!.players.get(wa.id!)!.minerals=8;a.send({type:"destination",planet:"pyrax"});
    const selected=(await a.wait(m=>m.type==="state"&&m.state!.planet==="pyrax")).state!,same=(await b.wait(m=>m.type==="state"&&m.state!.tick===selected.tick&&m.state!.planet==="pyrax")).state!;
    assert.equal(selected.seed,same.seed);assert.equal(selected.time,same.time);assert.deepEqual(selected.stalkers,same.stalkers);assert.ok(selected.stalkers.every(s=>s.kind==="surveyor"||s.kind==="sentinel"));assert.deepEqual(selected.water,same.water);assert.equal(selected.players.find(p=>p.id===wa.id)!.minerals,0);assert.ok(selected.water.every(v=>v===-100));
    a.send({type:"ready"});b.send({type:"ready"});await a.wait(m=>m.type==="state"&&m.state!.planet==="pyrax"&&m.state!.players.every(p=>p.ready));a.send({type:"start"});
    b.send({type:"loaded",position:{seed:initial.seed}});await new Promise(resolve=>setTimeout(resolve,150));assert.equal(server.rooms.get(wa.code!)!.status,"ready");
    b.send({type:"loaded",position:{seed:selected.seed}});await a.wait(m=>m.type==="state"&&m.state!.planet==="pyrax"&&m.state!.players.every(p=>p.loaded));a.send({type:"start"});
    const live=(await b.wait(m=>m.type==="state"&&m.state!.status==="running")).state!;assert.equal(live.planet,"pyrax");a.send({type:"destination",planet:"tidefall"});await new Promise(resolve=>setTimeout(resolve,150));assert.equal(server.rooms.get(wa.code!)!.seed,selected.seed);
  }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});

test("two clients share exclusive medkits, quick healing, replenishment and a tsunami trigger",async()=>{
  const server=await startServer(0,true),url=`ws://localhost:${(server.server.address() as {port:number}).port}/ws`,a=client(url),b=client(url);
  try{
    await a.opened;a.send({type:"join"});const wa=await a.wait(m=>m.type==="welcome");await b.opened;b.send({type:"join",code:wa.code});const wb=await b.wait(m=>m.type==="welcome");
    a.send({type:"ready"});b.send({type:"ready"});await a.wait(m=>m.type==="state"&&m.state!.players.length===2&&m.state!.players.every(p=>p.ready&&p.loaded));a.send({type:"start"});await a.wait(m=>m.type==="state"&&m.state!.status==="running");
    const room=server.rooms.get(wa.code!)!,p=room.players.get(wa.id!)!,q=room.players.get(wb.id!)!;room.directorAt=Infinity;
    for(const s of room.stalkers){s.health=0;room.stalkerColliders[s.id].setEnabled(false);}
    const med=room.supplies.find(s=>s.id.startsWith("med-"))!,generation=med.generation!;assert.ok(med);
    for(const [i,player] of [p,q].entries()){const x=med.x+(i?.95:-.95);Object.assign(player,{x,y:ground(x,med.z,room.seed)+1.01,z:med.z});room.bodies.get(player.id)!.setTranslation(player,true);}room.world.step();
    a.send({type:"interact"});b.send({type:"interact"});const pickup=(await a.wait(m=>m.type==="state"&&!!m.state!.supplies.find(s=>s.id===med.id)?.takenBy)).state!,pickupB=(await b.wait(m=>m.type==="state"&&m.state!.tick===pickup.tick)).state!;
    assert.deepEqual(pickup.supplies,pickupB.supplies);assert.equal(p.medicine+q.medicine,1);const owner=room.players.get(med.takenBy!)!,sender=owner.id===p.id?a:b;
    owner.health=45;owner.medicine=2;sender.send({type:"medical"});sender.send({type:"medical"});const healed=(await a.wait(m=>m.type==="state"&&m.state!.players.some(v=>v.id===owner.id&&v.health===77))).state!,healedB=(await b.wait(m=>m.type==="state"&&m.state!.tick===healed.tick)).state!;
    assert.deepEqual(healed.players,healedB.players);assert.equal(owner.medicine,1);
    replenishMedical(room,true);for(const [i,player] of [p,q].entries()){Object.assign(player,{x:i?10:-10,y:24,z:-115});room.bodies.get(player.id)!.setTranslation(player,true);}room.world.step();room.time+=130;replenishMedical(room,true);
    const returned=(await a.wait(m=>m.type==="state"&&m.state!.supplies.some(s=>s.id===med.id&&s.generation!>generation))).state!,returnedB=(await b.wait(m=>m.type==="state"&&m.state!.tick===returned.tick)).state!;assert.deepEqual(returned.supplies,returnedB.supplies);
    room.time=room.tsunami!.triggerAt-.001;const surge=(await a.wait(m=>m.type==="state"&&m.state!.tsunami?.triggered===true)).state!,surgeB=(await b.wait(m=>m.type==="state"&&m.state!.tick===surge.tick)).state!;
    assert.deepEqual(surge.tsunami,surgeB.tsunami);assert.deepEqual(surge.water,surgeB.water);assert.equal(surge.tsunami!.id,1);assert.ok(surge.water.every(Number.isFinite));
  }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});

test('two independent sockets share automatic loot and a complete physical extraction ranking',async()=>{
 const server=await startServer(0,true),url=`ws://localhost:${(server.server.address() as {port:number}).port}/ws`,a=client(url),b=client(url);
 try{await a.opened;a.send({type:'join'});const wa=await a.wait(m=>m.type==='welcome');await b.opened;b.send({type:'join',code:wa.code});const wb=await b.wait(m=>m.type==='welcome');a.send({type:'ready'});b.send({type:'ready'});await a.wait(m=>m.type==='state'&&m.state!.players.every(p=>p.ready&&p.loaded));a.send({type:'start'});await a.wait(m=>m.type==='state'&&m.state!.status==='running');const r=server.rooms.get(wa.code!)!,p=r.players.get(wa.id!)!,q=r.players.get(wb.id!)!;r.directorAt=Infinity;for(const c of r.stalkers){c.health=0;r.stalkerColliders[c.id].setEnabled(false);}
 const med=r.supplies.find(s=>s.id.startsWith('med-'))!;for(const [i,v] of [p,q].entries()){Object.assign(v,{x:med.x+(i?.6:-.6),y:med.y+.7,z:med.z});r.bodies.get(v.id)!.setTranslation(v,true);}r.world.step();const picked=(await a.wait(m=>m.type==='state'&&!!m.state!.supplies.find(s=>s.id===med.id)?.takenBy)).state!,pickedB=(await b.wait(m=>m.type==='state'&&m.state!.tick===picked.tick)).state!;assert.deepEqual(picked.supplies,pickedB.supplies);assert.equal(p.medicine+q.medicine,1);
 r.time=r.extraction.timeline.approach+2;const approaching=(await a.wait(m=>m.type==='state'&&m.state!.extraction.phase==='approaching')).state!,other=(await b.wait(m=>m.type==='state'&&m.state!.tick===approaching.tick)).state!;assert.deepEqual(approaching.extraction,other.extraction);assert.deepEqual(approaching.fields,other.fields);assert.ok(approaching.extraction.site);a.send({type:'interact'});assert.equal(p.extractedAt,null);
 r.time=r.extraction.opens+1;await a.wait(m=>m.type==='state'&&m.state!.extraction.phase==='boarding');const site=r.extraction.site!;for(const [i,v] of [p,q].entries()){Object.assign(v,{x:site.x+(i?.6:-.6),y:site.y+1,z:site.z-3,health:i?90:70});r.bodies.get(v.id)!.setTranslation(v,true);r.bodies.get(v.id)!.setNextKinematicTranslation(v);}r.world.step();a.send({type:'interact'});b.send({type:'interact'});const aboard=(await a.wait(m=>m.type==='state'&&m.state!.extraction.boarded.length===2)).state!,aboardB=(await b.wait(m=>m.type==='state'&&m.state!.tick===aboard.tick)).state!;assert.deepEqual(aboard.extraction,aboardB.extraction);assert.equal(aboard.status,'running');r.time=r.extraction.closes+.01;await a.wait(m=>m.type==='state'&&m.state!.extraction.phase==='departing');r.time=r.extraction.timeline.end;const final=(await a.wait(m=>m.type==='state'&&m.state!.status==='finished')).state!,finalB=(await b.wait(m=>m.type==='state'&&m.state!.tick===final.tick)).state!;assert.deepEqual(final.standings,finalB.standings);assert.deepEqual(final.winnerIds,[q.id]);assert.equal(final.standings[0].id,q.id);
 }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
