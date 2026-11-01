import {WebSocket} from 'ws';
import {writeFileSync} from 'node:fs';
const code=process.argv[2]??'SUB42',seed=Number(process.argv[3]??42);
writeFileSync('substrate-fixture.json',JSON.stringify({create:true,code,seed}));await new Promise(r=>setTimeout(r,650));
const ws=new WebSocket('ws://127.0.0.1:4177/ws');let started=false,staged=false;
ws.on('open',()=>ws.send(JSON.stringify({type:'join',code})));
ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='state'&&m.state.status==='ready'&&!started){started=true;for(const a of [{type:'loaded',position:{seed}},{type:'ready'},{type:'start'}])ws.send(JSON.stringify(a));}if(m.type==='state'&&m.state.status==='running'&&!staged){staged=true;writeFileSync('substrate-fixture.json',JSON.stringify({code,time:70,freeze:true,protect:true,static:true}));console.log('Pinned '+code+' / '+seed);}});
ws.on('error',e=>{console.error(e.message);process.exitCode=1;});process.on('SIGINT',()=>{ws.close();process.exit(0);});
