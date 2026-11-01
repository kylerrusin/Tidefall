import test, { before } from "node:test";
import assert from "node:assert/strict";
import { Expedition, initPhysics } from "../src/simulation";
import { shelterPlacements, HARD_LIMIT } from "../src/survival";
import { ground } from "../src/model";
before(async () => initPhysics());
test("a full fixed-step storm arc rewards collected protection and ends within the survival window", () => {
  const r = new Expedition("FULLARC",42,"preview"),
    p = r.join(),
    q = r.join();
  // Isolate the environmental survival arc. Creature encounters are exercised in
  // round5 and network tests; an idle astronaut can now be killed by predators.
  for (const enemy of r.stalkers) {
    enemy.health = 0; enemy.state = "dead";
    r.stalkerColliders[enemy.id].setEnabled(false);
  }
  r.action(p.id, "ready");
  r.action(q.id, "ready");
  r.action(p.id, "start");
  r.directorAt=Infinity;
  const s = shelterPlacements(r.seed)[0];
  Object.assign(p, { x: s.x, y: s.y + 1.01, z: s.z });
  r.bodies.get(p.id)!.setTranslation(p, true);
  r.bodies.get(p.id)!.setNextKinematicTranslation(p);
  r.world.step();
  r.action(p.id, "interact");
  assert.equal(p.insulated, true);
  r.action(p.id, "interact");
  assert.equal(p.shelter, s.id);
  let escaped=false,boarded=false;
  while(r.status==="running"&&r.time<HARD_LIMIT+.1){if(!escaped&&r.time>60){escaped=true;Object.assign(p,{x:110,y:ground(110,-35,r.seed)+1.01,z:-35});r.bodies.get(p.id)!.setTranslation(p,true);r.bodies.get(p.id)!.setNextKinematicTranslation(p);}if(!boarded&&r.time>=r.extraction.opens+1&&r.extraction.site){boarded=true;const site=r.extraction.site;for(const [i,v] of [p,q].entries()){Object.assign(v,{x:site.x+(i?.6:-.6),z:site.z-3,y:site.y+1});r.bodies.get(v.id)!.setTranslation(v,true);r.bodies.get(v.id)!.setNextKinematicTranslation(v);}r.world.step();r.action(p.id,'interact');r.action(q.id,'interact');}r.step();}
  assert.equal(r.status, "finished");
  assert.ok(r.time >= 240 && r.time <= 240.1);
  assert.ok(r.winnerIds.includes(p.id));
  assert.ok(p.extractedAt!==null&&q.extractedAt!==null);assert.ok(p.temperature>q.temperature);assert.match(q.deathCause,/Extracted/);
  assert.ok([...r.water.h].every((h) => Number.isFinite(h) && h >= 0));
  console.log(
    "Natural storm result at",
    r.time.toFixed(2),
    "seconds; protected temperature",
    p.temperature.toFixed(2),
  );
  r.dispose();
});
