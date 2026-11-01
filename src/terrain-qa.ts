import {celestial} from './celestial';
import substrateCameras from '../evidence/global-substrate/cameras.json';
import cameraManifest from '../evidence/round12/cameras.json';
import reliefCameras from '../evidence/terrain-relief/cameras.json';
import {ground} from './model';
export type TerrainCamera={id:string;label:string;position:[number,number,number];target:[number,number,number];fov:number;seed:number;time:number;scenario:string};
// Freeze comparisons independently of newly added support geometry.
export function terrainCameras(){return [...lowMoonViews,{id:'M200',label:'M200 · moon through low cloud bank',position:[0,35,-105],target:[-965.9258262890684,278.1275485345228,-193.74848309336784],fov:12,seed:42,time:200,scenario:'tidefall'},{id:'S0',label:'S0 · rescue hatch exterior',position:[-12,27,-128],target:[-12,25.8,-113],fov:60,seed:33014,time:1980,scenario:'tidefall'},...moonViews,...cameraManifest.views,...geomorphologyViews,...reliefCameras,...substrateCameras] as TerrainCamera[];}
const lowMoonViews=[50,100,200,-100,-200].map((x,i)=>{const d=celestial(200).direction;return {id:'ML'+i,label:'ML'+i+' · low cloud observer',position:[x,35,-105],target:[x+d.x*1000,35+d.y*1000,-105+d.z*1000],fov:12,seed:42,time:200,scenario:'tidefall'};});
const moonViews=Array.from({length:3},(_,i)=>{const d=celestial(70).direction,eye:[number,number,number]=[i*350,35,-105];return {id:'M'+i,label:'M'+i+' · moon/cloud line of sight',position:eye,target:[eye[0]+d.x*1000,eye[1]+d.y*1000,eye[2]+d.z*1000],fov:12,seed:42,time:70,scenario:'tidefall'};});
const geomorphologyViews:TerrainCamera[]=[
 {id:'D2',label:'D2 · reconstructed hillside / eye level',position:[0,ground(0,-65,42)+1.7,-65],target:[5,ground(5,-43,42)+1,-43],fov:62,seed:42,time:70,scenario:'tidefall'},
 {id:'E2',label:'E2 · broadened fault / eye level',position:[-77,ground(-77,25,42)+1.7,25],target:[-110,ground(-110,25,42)+1,25],fov:68,seed:42,time:70,scenario:'tidefall'},
 {id:'L1',label:'L1 · western hills / landing eye level',position:[0,24.7,-105],target:[-460,35,-220],fov:62,seed:42,time:70,scenario:'tidefall'},
 {id:'R1',label:'R1 · western landform survey',position:[-20,44.492,-105],target:[-460,25,-220],fov:55,seed:42,time:70,scenario:'tidefall'},
 {id:'R2',label:'R2 · eastern landform survey',position:[80,49.804,-105],target:[300,30,-460],fov:55,seed:42,time:70,scenario:'tidefall'},
 {id:'P1',label:'P1 · Pyrax night corridor',position:[82,42.212,-102],target:[82,41.8,-84],fov:70,seed:-43,time:70,scenario:'pyrax'},
 {id:'P2',label:'P2 · Pyrax night laboratory',position:[76.5,42.212,-105],target:[69,41.8,-103.5],fov:70,seed:-43,time:70,scenario:'pyrax'},
 {id:'P3',label:'P3 · Pyrax outside flashlight',position:[82,42.212,-114],target:[82,41.8,-110],fov:70,seed:-43,time:70,scenario:'pyrax'}
];
export const TERRAIN_DEBUG_MODES=[['0','Rendered'],['1','A · neutral unlit'],['2','B · no detail normals'],['3','C · displacement off'],['4','D · AO and shadows off'],['5','E · projection coordinates'],['6','F · triplanar weights'],['7','G · wireframe'],['8','G · depth'],['9','Bedrock unit'],['10','Surface cover'],['11','Slope angle'],['12','Deposition'],['13','Exposed rock'],['14','Weathered rock'],['15','Sediment'],['16','Terrain LOD'],['17','Planar cavity coordinates'],['18','No height bump only'],['19','No photographic normals only'],['20','Water coverage'],['21','Water wireframe'],['22','Original rock reuse / A C E'],['23','Neutral clay geometry'],['24','Lighting: no emission'],['25','Lighting: diffuse only'],['26','Lighting: no transparency'],['27','Lighting: freeze light poses']] as const;
export const terrainQA={active:false,renderProfile:{width:0,height:0,shadows:false,antialias:false},view:null as TerrainCamera|null,mode:{value:0},repaired:{value:1},sun:0,probe:'',flashlight:true,cloudCover:-1,slowCamera:false,water:true,waterPart:'both',samples:true,appliedView:'',renderedView:'',renderedMode:-1,renderedRepair:-1,renderedSun:-1};


export function qaSunDirection(normal:{x:number;y:number;z:number}){if(!import.meta.env?.DEV||!terrainQA.active||!terrainQA.sun)return normal;const elevation=(terrainQA.sun===1?12:55)*Math.PI/180,azimuth=.7;return {x:Math.cos(elevation)*Math.cos(azimuth),y:Math.sin(elevation),z:Math.cos(elevation)*Math.sin(azimuth)};}
