/** Local QA participant keeps the frozen room connected while the browser hot reloads. */
import {WebSocket} from 'ws';
import {writeFileSync} from 'node:fs';
const ws=new WebSocket('ws://127.0.0.1:4175/ws');let started=false,staged=false;
ws.on('open',()=>ws.send(JSON.stringify({type:'join',code:'R12QA'})));
ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='welcome')console.log('Pinned QA room '+m.code);if(m.type==='state'&&m.state.status==='ready'&&!started){started=true;for(const message of [{type:'loaded',position:{seed:42}},{type:'ready'},{type:'start'}])ws.send(JSON.stringify(message));}if(m.type==='state'&&m.state.status==='running'&&!staged){staged=true;writeFileSync('round12-fixture.json',JSON.stringify({code:'R12QA',time:70,freeze:true,protect:true,static:true,probe:Date.now()}));console.log('Frozen material room running; camera seed 42 / time 70');}});
ws.on('error',e=>{console.error(e.message);process.exitCode=1;});
process.on('SIGINT',()=>{ws.close();process.exit(0);});
