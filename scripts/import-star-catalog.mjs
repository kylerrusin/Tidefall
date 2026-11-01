import fs from "node:fs";
import crypto from "node:crypto";
const source="https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const response=await fetch(source);if(!response.ok)throw new Error(`HYG HTTP ${response.status}`);const csv=await response.text();
function fields(line){const out=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){out.push(value);value="";}else value+=c;}out.push(value);return out;}
const lines=csv.trim().split(/\r?\n/),header=fields(lines.shift());
const rows=lines.map(l=>Object.fromEntries(fields(l).map((v,i)=>[header[i],v]))).filter(s=>+s.dist<100000&&+s.dist>=0&&s.absmag!=="");
const planets=JSON.parse(fs.readFileSync(new URL("../src/data/exoplanets.json",import.meta.url))).records,selected=new Map();
for(const host of planets){const ra=host.ra*Math.PI/180,dec=host.dec*Math.PI/180,pos=[host.sy_dist*Math.cos(dec)*Math.cos(ra),host.sy_dist*Math.cos(dec)*Math.sin(ra),host.sy_dist*Math.sin(dec)];
  const ranked=rows.map(s=>({s,mag:+s.absmag+5*Math.log10(Math.hypot(+s.x-pos[0],+s.y-pos[1],+s.z-pos[2])/10)})).filter(v=>Number.isFinite(v.mag)).sort((a,b)=>a.mag-b.mag).slice(0,100);
  for(const {s} of ranked)selected.set(s.id,s);
}
const records=[...selected.values()].map(s=>({id:`HYG ${s.id}`,hip:s.hip?+s.hip:null,name:s.proper||s.bf||`HIP ${s.hip}`,raHours:+s.ra,decDegrees:+s.dec,distancePc:+s.dist,absoluteMagnitude:+s.absmag,earthMagnitude:+s.mag,colorIndex:s.ci!==""?+s.ci:null,position:[+s.x,+s.y,+s.z],velocity:[+s.vx,+s.vy,+s.vz],pmRA:+s.pmra,pmDEC:+s.pmdec,distanceError:null,radialVelocity:s.rv!==""?+s.rv:null}));
fs.writeFileSync(new URL("../src/data/stars.json",import.meta.url),JSON.stringify({source,author:"David Nash / Astronexus; Hipparcos, Yale Bright Star, Gliese",license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",sourceSha256:crypto.createHash("sha256").update(csv).digest("hex"),epoch:2000,equinox:"ICRS/J2000 approximation",selection:"Union of 100 brightest reconstructed stars from each expedition host; uncertain sentinel distances excluded",records},null,2)+"\n");
console.log(JSON.stringify({downloadBytes:csv.length,stars:records.length}));
