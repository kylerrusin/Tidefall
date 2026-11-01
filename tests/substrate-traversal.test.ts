import test from 'node:test';
import {substrateTraversal} from '../scripts/substrate-traversal';
import assert from 'node:assert/strict';
import {Expedition,initPhysics} from '../src/simulation';
import {solidHeight} from '../src/surface-query';
test('real capsule walks two geological contacts on each world and lands after jetpack thrust',async()=>{for(const seed of [42,-43])await substrateTraversal(seed);});
test('initial loose equipment spawns above the same solid substrate used for collision',async()=>{await initPhysics();for(const seed of [42,-43]){const room=new Expedition('SUB-PROPS',seed);for(const o of room.objects)assert.ok(o.y-o.radius>=solidHeight(o.x,o.z,seed)+.29);room.dispose();}});
