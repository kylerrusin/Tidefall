/** Local participant for the isolated, frozen terrain comparison. Never imported by the game. */
import {WebSocket} from 'ws';
import {writeFileSync} from 'node:fs';
const ws=new WebSocket('ws://127.0.0.1:4176/ws');let started=false,staged=false;
ws.on('open',()=>ws.send(JSON.stringify({type:'join',code:'RELF0'})));
ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='state'&&m.state.status==='ready'&&!started){started=true;for(const message of [{type:'loaded',position:{seed:42}},{type:'ready'},{type:'start'}])ws.send(JSON.stringify(message));}if(m.type==='state'&&m.state.status==='running'&&!staged){staged=true;writeFileSync('relief-fixture.json',JSON.stringify({code:'RELF0',time:70,freeze:true,protect:true,static:true}));console.log('RELF0 ready: seed 42, t70, isolated port 4176');}});
ws.on('error',error=>{console.error(error.message);process.exitCode=1;});
process.on('SIGINT',()=>{ws.close();process.exit(0);});
