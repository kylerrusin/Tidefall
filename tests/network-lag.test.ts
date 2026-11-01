import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {Expedition,initPhysics} from '../src/simulation';
import {startServer} from '../server';
import {packGrid,unpackGrid,packSnapshot,unpackSnapshot,SNAPSHOT_CODEC} from '../src/domain/snapshot-wire';
import type {Snapshot} from '../src/model';
before(()=>initPhysics());
const json=<T>(v:T):T=>JSON.parse(JSON.stringify(v));

test('lossless grid transport preserves mixed wet/dry values and rejects malformed runs',()=>{
 for(const values of [[],Array(4225).fill(-100),Array.from({length:4225},(_,i)=>i%19?0:i/100),Array.from({length:65},(_,i)=>i*1.414)])assert.deepEqual(unpackGrid(json(packGrid(values))),values);
 assert.throws(()=>unpackGrid({runs:[10001,0],length:4225}));assert.throws(()=>unpackGrid({runs:[1,0],length:2}));
});
test('packed snapshots retain every authoritative value and scope cached fields to their world/version',()=>{
 for(const seed of[42,-43]){const r=new Expedition('PACK1',seed);r.join();const full=json(r.snapshot()),first=unpackSnapshot(json(packSnapshot(full)),null),next=unpackSnapshot(json(packSnapshot(full,false)),first);assert.deepEqual(first,full);assert.deepEqual(next,full);assert.ok(JSON.stringify(packSnapshot(full,false)).length<JSON.stringify(full).length*.65);assert.throws(()=>unpackSnapshot(packSnapshot(full,false),null));assert.throws(()=>unpackSnapshot(packSnapshot({...full,seed:seed+1},false),first));assert.throws(()=>unpackSnapshot(packSnapshot({...full,fieldsVersion:full.fieldsVersion+1},false),first));r.dispose();}
});
test('stationary doors retain collision while avoiding repeated kinematic updates',()=>{
 const r=new Expedition('DOORS',42),d=r.doors.find(d=>d.id==='airlock-outer')!,body=r.doorBodies.get(d.id)!,move=body.setNextKinematicTranslation.bind(body);let updates=0;body.setNextKinematicTranslation=p=>{updates++;move(p);};r.updateDoors(0);r.world.step();const initial=updates;for(let i=0;i<60;i++)r.updateDoors(1/60);assert.equal(updates,initial);assert.equal(body.collider(0).isEnabled(),false);d.target=false;for(let i=0;i<60;i++){r.updateDoors(1/60);r.world.step();}assert.equal(d.open,0);assert.ok(updates>initial);assert.equal(body.collider(0).isEnabled(),true);const closed=updates;for(let i=0;i<60;i++)r.updateDoors(1/60);assert.equal(updates,closed);r.dispose();
});
test('resting dry objects stay asleep but water and active fields wake them',()=>{
 const r=new Expedition('SLEEP',42),p=r.join();p.ready=p.loaded=true;r.action(p.id,'start');const dry=r.objects.findIndex(o=>r.water.sample(o.x,o.z).depth<=.02),wet=r.objects.findIndex(o=>r.water.sample(o.x,o.z).depth>1);assert.ok(dry>=0&&wet>=0);const body=r.props[dry];body.sleep();r.step();assert.equal(body.isSleeping(),true);const pos=body.translation();r.anchors.push({owner:p.id,x:pos.x+3,y:pos.y+1,z:pos.z,sign:1,life:10});r.step();assert.equal(body.isSleeping(),false);r.anchors=[];const float=r.props[wet],o=r.objects[wet],water=r.water.sample(o.x,o.z);float.setTranslation({x:o.x,y:water.level-o.radius*.5,z:o.z},true);float.sleep();r.step();assert.equal(float.isSleeping(),false);r.dispose();
});

test('compact and legacy sockets share the same snapshots and refresh fields on a destination change',async t=>{
 const server=await startServer(0,true),port=(server.server.address()as{port:number}).port;t.after(()=>server.close());
 const connect=async(code='',compact=false)=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws'),messages:any[]=[];let previous:Snapshot|null=null;ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='state'){m.wire=m.state;previous=unpackSnapshot(m.state,previous);m.state=previous;if(m.state.status==='ready')ws.send(JSON.stringify({type:'loaded',position:{seed:m.state.seed}}));}messages.push(m);if(messages.length>200)messages.shift();});await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',code,...(compact?{codec:SNAPSHOT_CODEC}:{})}));const wait=(fn:(m:any)=>boolean)=>new Promise<any>((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{const found=messages.find(fn);if(found){clearInterval(timer);resolve(found);}else if(Date.now()-start>10000){clearInterval(timer);reject(Error('Socket state timed out'));}},10);});return {ws,wait,messages};};
 const a=await connect('',true),welcome=await a.wait(m=>m.type==='welcome'),b=await connect(welcome.code);t.after(()=>{a.ws.close();b.ws.close();});await b.wait(m=>m.type==='welcome');const packed=await a.wait(m=>m.wire?.codec===SNAPSHOT_CODEC&&!m.wire.fields);assert.ok(packed.state.fields.length);const legacy=await b.wait(m=>m.type==='state'&&m.state.tick===packed.state.tick);assert.deepEqual(packed.state.water,legacy.state.water);assert.deepEqual(packed.state.fields,legacy.state.fields);a.ws.send(JSON.stringify({type:'destination',planet:'pyrax'}));const moved=await a.wait(m=>m.wire?.codec===SNAPSHOT_CODEC&&m.state.seed<0);assert.ok(moved.state.fields.length);const r=server.rooms.get(welcome.code)!;for(const p of r.players.values())p.ready=p.loaded=true;a.ws.send(JSON.stringify({type:'start'}));const running=await a.wait(m=>m.type==='state'&&m.state.status==='running'),shared=await b.wait(m=>m.type==='state'&&m.state.status==='running'&&m.state.tick===running.state.tick);assert.deepEqual(running.state,shared.state);
});
