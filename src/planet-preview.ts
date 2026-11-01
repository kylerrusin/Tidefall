import {geology,ground,astronomy} from './model';
import {planetForSeed} from './planets';
import {stellarSpectrum} from './planet-physics';
/** Shaded spherical projection of the actual generated survey terrain. Geography is modeled. */
export function previewPixel(seed:number,x:number,y:number):[number,number,number,number]{const r2=x*x+y*y;if(r2>1)return [0,0,0,0];const nz=Math.sqrt(1-r2),wx=x*158,wz=y*158,p=planetForSeed(seed),g=geology(wx,wz,seed),h=g.height,sea=astronomy(0).level,star=stellarSpectrum(p.observed.st_teff),light=Math.max(.04,-x*.45-y*.35+nz*.8),edge=(1-nz)**3;
 const water=p.water&&h<sea,color=water?[.035,.19,.24]:g.color,relief=Math.max(.45,Math.min(1.2,.8+(ground(wx-2,wz-2,seed)-h)*.13));return [0,1,2].map((k)=>Math.round(Math.max(0,Math.min(1,color[k]*light*relief*(.6+star[k]*.4)+edge*(p.water?[.09,.21,.29]:[.2,.1,.04])[k]))*255)).concat(255) as [number,number,number,number];}
