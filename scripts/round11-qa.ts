/** Local-only deterministic camera-position staging for paired browser screenshots. No production import. */
import {writeFileSync} from 'node:fs';
import {solidHeight} from '../src/surface-query';
import {facility} from '../src/facility';
import {biosphere} from '../src/biology';
const name=process.argv[2]??'shelf',code=process.argv[3]??'R11QA',seed=name.startsWith('pyrax')?-43:42,f=facility(seed);
const plant=biosphere(42).find(p=>p.habitat==='rocky upland'&&p.y<25&&Math.abs(p.x)<70)!;
const sites:Record<string,[number,number,number?]>={shelf:[0,-65],fault:[-98,-38],highland:[104,-81],shore:[35,48],edge:[148,60],plants:[plant.x,plant.z-4],facility:[f.x,f.z-8,f.y+1.01],'pyrax-atmosphere':[82,-139],'pyrax-facility':[f.x,f.z-12,f.y+1.01],clouds:[0,-65]};
const p=sites[name];if(!p)throw new Error('Unknown QA case '+name);const [x,z]=p,time=name==='clouds'?120:seed<0?5:70,y=p[2]??solidHeight(x,z,seed)+1.01;
writeFileSync('round11-fixture.json',JSON.stringify({code,create:true,seed,mode:'preview',time,freeze:true,protect:true,players:[{color:0,position:{x,y,z}}],probe:Date.now()}));console.log(JSON.stringify({case:name,code,seed,time,x,y,z}));
