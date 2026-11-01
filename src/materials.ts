import {TRIPLANAR_GLSL} from './triplanar';
import {SURFACE_COVER_GLSL} from './terrain-material';
import {terrainQA} from './terrain-qa';
import {rockPbr,rockPbrReady} from './pbr-rock';
import * as THREE from "three";
export const environmentUniforms = {
  time: { value: 0 },
  tide: { value: 10 },
  storm: { value: 0 },
  thermal: { value: 0 },
};
import { geologicalTexture as grainTexture } from "./geological-texture";
/** Retain the pre-Round-11 albedo/roughness response, without its grain, cavity or bump layers. */
export function terrainSurfaceMaterial(distant=false){
  const mat=new THREE.MeshStandardMaterial({color:'white',vertexColors:true,roughness:.94,metalness:0});
  mat.userData.geological=true;mat.userData.smoothTerrain=true;
  // The distant continuation keeps its existing coarse appearance and receives no repeated maps.
  if(distant)return mat;
  mat.onBeforeCompile=shader=>{
    shader.uniforms.pbrAlbedo={value:rockPbr.albedo};shader.uniforms.pbrRough={value:rockPbr.roughness};shader.uniforms.pbrReady=rockPbrReady;shader.uniforms.uTide=environmentUniforms.tide;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrainPosition;varying float vTerrainRock;attribute vec3 surfaceField;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 terrainPosition=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nterrainPosition=instanceMatrix*terrainPosition;\n#endif\nvTerrainPosition=(modelMatrix*terrainPosition).xyz;vTerrainRock=1.-smoothstep(.12,.7,surfaceField.x+surfaceField.y*.16);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrainPosition;varying float vTerrainRock;uniform sampler2D pbrAlbedo,pbrRough;uniform float pbrReady,uTide;').replace('#include <color_fragment>',`#include <color_fragment>
// Existing v10 photograph luminance, gently modulated rather than painted over every unit.
float terrainPhoto=dot(texture2D(pbrAlbedo,vTerrainPosition.xz/2.4).rgb,vec3(.2126,.7152,.0722));
float terrainWet=(1.-smoothstep(uTide-.2,uTide+.7,vTerrainPosition.y))*.45;
diffuseColor.rgb*=mix(1.,clamp(1.+(terrainPhoto-.07219)*2.0,.88,1.12),pbrReady*(.28+.72*vTerrainRock))*(1.-terrainWet*.4);`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(.94,clamp(texture2D(pbrRough,vTerrainPosition.xz/2.4).r,.75,.98),pbrReady*vTerrainRock);`);
  };
  mat.customProgramCacheKey=()=> 'tidefall-terrain-coherent-grain-v2';
  return mat;
}
/** World-space procedural bedding/grain: no fetched textures or per-tick material reconstruction. */
export function geologicalMaterial(
  color: string,
  layered = true,
  vertexColors = false,
  styles=false,
  treatment=0,
  blended=false,
  distant=false,
) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    vertexColors,
  });
  mat.userData.geological=true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.geoDebug=import.meta.env?.DEV?terrainQA.mode:{value:0};shader.uniforms.geoRepair=import.meta.env?.DEV?terrainQA.repaired:{value:1};
    shader.uniforms.pbrAlbedo={value:rockPbr.albedo};shader.uniforms.pbrNormal={value:rockPbr.normal};shader.uniforms.pbrRough={value:rockPbr.roughness};shader.uniforms.pbrAO={value:rockPbr.occlusion};shader.uniforms.pbrReady=rockPbrReady;
    shader.uniforms.uTide = environmentUniforms.tide;
    shader.uniforms.geoTexture = { value: grainTexture };
    shader.uniforms.uThermal = environmentUniforms.thermal;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vGeo;varying vec3 vGeoNormal;varying vec3 vStyle;varying vec3 vField,vCoverColor,vUnitColor;varying float vMaterialLod;${styles?'attribute vec3 surfaceStyle;':''}${blended?'attribute vec3 surfaceField,coverColor,unitColor;attribute float materialLod;':''}`)
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vec4 geo=vec4(transformed,1.0);
#ifdef USE_INSTANCING
geo=instanceMatrix*geo;
#endif
vGeo=(modelMatrix*geo).xyz;vGeoNormal=inverseTransformDirection(normalize(transformedNormal),viewMatrix);vStyle=${styles?'surfaceStyle':`vec3(${treatment.toFixed(1)},.1,.2)`};vField=${blended?'surfaceField':'vec3(0.,0.,1.)'};vCoverColor=${blended?'coverColor':'vec3(.3)'};vUnitColor=${blended?'unitColor':'vec3(.5)'};vMaterialLod=${blended?'materialLod':'0.'};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vGeo;varying vec3 vGeoNormal;varying vec3 vStyle;varying vec3 vField,vCoverColor,vUnitColor;varying float vMaterialLod;uniform float uTide;uniform float uThermal;uniform sampler2D geoTexture;uniform sampler2D pbrAlbedo,pbrNormal,pbrRough,pbrAO;uniform float pbrReady;uniform float geoDebug;uniform float geoRepair;
${TRIPLANAR_GLSL}
${SURFACE_COVER_GLSL}
vec3 rockWeights(){vec3 n=geoRepair>.5?normalize(vGeoNormal):normalize(cross(dFdx(vGeo),dFdy(vGeo)));vec3 w=pow(abs(n),vec3(4.));return w/max(.001,w.x+w.y+w.z);}
vec3 rockSample(sampler2D map,vec3 p){vec3 w=rockWeights(),n=normalize(vGeoNormal);vec2 x=geoRepair>.5?geoUvX(p,n,2.4):p.zy/2.4,y=geoRepair>.5?geoUvY(p,n,2.4):p.xz/2.4,z=geoRepair>.5?geoUvZ(p,n,2.4):p.xy/2.4;return texture2D(map,x).rgb*w.x+texture2D(map,y).rgb*w.y+texture2D(map,z).rgb*w.z;}
float geoCavity(){float value=0.;if(geoRepair<.5){value=texture2D(geoTexture,vGeo.xz*.085).a;}else{vec3 n=normalize(vGeoNormal),w=rockWeights();value=texture2D(geoTexture,geoUvX(vGeo,n,11.7647)).a*w.x+texture2D(geoTexture,geoUvY(vGeo,n,11.7647)).a*w.y+texture2D(geoTexture,geoUvZ(vGeo,n,11.7647)).a*w.z;}return value;}
float geoNoise(vec3 p){vec3 n=normalize(vGeoNormal),w=abs(normalize(cross(dFdx(vGeo),dFdy(vGeo))));w/=max(.001,w.x+w.y+w.z);if(geoRepair>.5)w=rockWeights();vec2 x=geoRepair>.5?geoUvX(p,n,7.6923077):p.zy*.13,y=geoRepair>.5?geoUvY(p,n,7.6923077):p.xz*.13,z=geoRepair>.5?geoUvZ(p,n,7.6923077):p.xy*.13;return dot(w,vec3(texture2D(geoTexture,x).r,texture2D(geoTexture,y).r,texture2D(geoTexture,z).r));}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
${distant?'vec3 apronBaseColor=diffuseColor.rgb;':''}
float geoDetail=geoRepair>.5?1.-smoothstep(80.,240.,length(cameraPosition-vGeo)):1.;
float grain=mix(.23,geoNoise(vGeo*5.5)*.24+geoNoise(vGeo*.36)*.18,geoDetail);
float bedding=${layered ? "sin((vGeo.y+vGeo.x*.055+geoNoise(vGeo*.23)*2.)*2.8)*.012*(1.-abs(normalize(cross(dFdx(vGeo),dFdy(vGeo))).y))" : "sin(vGeo.x*2.1+geoNoise(vGeo*.4)*3.)*.008"};
float wet=(1.-smoothstep(uTide-.2,uTide+.7,vGeo.y))*.45;
float coverHeight=mix(.5,rockSample(geoTexture,vGeo).r,geoDetail);vec4 surfaceState=geologicalCoverage(normalize(vGeoNormal),vField,coverHeight);
float weatherPockets=smoothstep(.4,.62,coverHeight),loose=${blended?'surfaceState.z+surfaceState.y*weatherPockets*.55':'smoothstep(4.4,5.,vStyle.x)'},beds=1.-smoothstep(.35,.8,abs(vStyle.x-2.)),crust=1.-smoothstep(.35,.8,abs(vStyle.x-4.));
if(geoDebug==22.&&(distance(vGeo.xz,vec2(96.,-60.))<24.||distance(vGeo.xz,vec2(-91.,25.))<24.||distance(vGeo.xz,vec2(-107.,-35.))<24.)){loose=0.;surfaceState=vec4(1.,0.,0.,0.);}
float cracks=geoCavity()*.025*(1.-loose)*geoDetail;if(geoDebug==4.)cracks=0.;
float lamina=sin((vGeo.y+vGeo.x*.055)*18.)*.028*beds*geoDetail;bedding*=geoDetail;
float pits=pow(1.-geoNoise(vGeo*3.),4.)*vStyle.y*.1*geoDetail;
float veins=smoothstep(.67,.88,geoNoise(vGeo*.7))*vStyle.z*.03*geoDetail;
float photoLuma=dot(rockSample(pbrAlbedo,vGeo),vec3(.2126,.7152,.0722)),photoAO=rockSample(pbrAO,vGeo).r;if(geoDebug==4.)photoAO=1.;
diffuseColor.rgb*=mix(1.,clamp(1.+(photoLuma-.07219)*1.4,.90,1.10)*mix(.98,1.,photoAO),pbrReady*(1.-loose*.9));
diffuseColor.rgb*=.78+grain+bedding*${blended?'beds':'(.3+beds)'}+lamina-wet-cracks-pits+crust*.06+veins;
${blended?`vec3 rockColor=diffuseColor.rgb;float sedimentGrain=geoNoise(vGeo*18.);vec3 sedimentColor=vCoverColor*(.975+sedimentGrain*.05)*(1.-wet*.6);vec3 weatheredColor=mix(rockColor,sedimentColor,weatherPockets*.55);diffuseColor.rgb=rockColor*surfaceState.x+weatheredColor*surfaceState.y+sedimentColor*surfaceState.z;`:''}
${distant?`// Coarse apron appearance: existing parent/cover fields, not repeated photographic detail.
// Linear albedo luminance .07219 and AO .97020 are sampled means of the existing rock maps.
vec4 apronCover=geologicalCoverage(normalize(vGeoNormal),vField,.5);
float apronPhoto=mix(1.,(.52+.07219*2.)*mix(.65,1.,.97020),pbrReady);
vec3 apronRock=apronBaseColor*1.01*apronPhoto*(1.-wet),apronSoil=vCoverColor*(1.-wet*.6);
vec3 apronMacro=apronRock*apronCover.x+mix(apronRock,apronSoil,.24)*apronCover.y+apronSoil*apronCover.z;
diffuseColor.rgb=mix(apronMacro,diffuseColor.rgb,geoDetail);`:''}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\nroughnessFactor=mix(.72+geoNoise(vGeo*4.)*.25,.38,wet);roughnessFactor=mix(roughnessFactor,clamp(rockSample(pbrRough,vGeo).r,.55,.99),pbrReady*(1.-wet)*(1.-loose));${blended?'roughnessFactor=mix(roughnessFactor,mix(.96,.65,wet),surfaceState.z);':''}${distant?'roughnessFactor=mix(dot(apronCover.xyz,vec3(.83472,.9,.96)),roughnessFactor,geoDetail);':''}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
if(geoDebug!=2.${distant?'&&geoDetail>.001':''}){
if(geoDebug!=18.){
// Surface-gradient bump detail in world metres; no terrain UV seams.
float geoRelief=((geoNoise(vGeo*mix(4.8,18.,loose))-.5)*mix(.055,.012,loose)+sin((vGeo.y+vGeo.x*.055)*18.)*.015*beds-geoCavity()*.08*(1.-loose))*(1.-wet*.7);
geoRelief*=geoDetail*.2;vec3 geoDx=geoRepair>.5?dFdx(-vViewPosition):normalize(dFdx(-vViewPosition)),geoDy=geoRepair>.5?dFdy(-vViewPosition):normalize(dFdy(-vViewPosition));
vec3 geoR1=cross(geoDy,normal),geoR2=cross(normal,geoDx);
float geoDet=dot(geoDx,geoR1)*faceDirection;
if(abs(geoDet)>.00001)normal=normalize(abs(geoDet)*normal-sign(geoDet)*(dFdx(geoRelief)*geoR1+dFdy(geoRelief)*geoR2));
}if(geoDebug!=19.&&geoDetail>.001){
vec3 wn=normalize(cross(dFdx(vGeo),dFdy(vGeo)))*faceDirection,w=rockWeights(),nx=texture2D(pbrNormal,vGeo.zy/2.4).xyz*2.-1.,ny=texture2D(pbrNormal,vGeo.xz/2.4).xyz*2.-1.,nz=texture2D(pbrNormal,vGeo.xy/2.4).xyz*2.-1.;
if(geoRepair>.5){wn=normalize(vGeoNormal);nx=texture2D(pbrNormal,geoUvX(vGeo,wn,2.4)).xyz*2.-1.;ny=texture2D(pbrNormal,geoUvY(vGeo,wn,2.4)).xyz*2.-1.;nz=texture2D(pbrNormal,geoUvZ(vGeo,wn,2.4)).xyz*2.-1.;}
vec3 mapped=geoRepair>.5?geoMappedNormal(wn,w,nx,ny,nz):normalize(vec3(nx.z*sign(wn.x),nx.y,nx.x)*w.x+vec3(ny.x,ny.z*sign(wn.y),ny.y)*w.y+vec3(nz.x,nz.y,nz.z*sign(wn.z))*w.z);normal=normalize(mix(normal,normalize(mat3(viewMatrix)*mapped),.06*pbrReady*(1.-loose)*geoDetail));}}
`,
      );
    if(import.meta.env?.DEV)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
if(geoDebug==1.)gl_FragColor.rgb=vec3(.42);
if(geoDebug==5.){vec3 w=rockWeights(),n=normalize(vGeoNormal);vec2 uv=geoRepair>.5?(w.x>w.y&&w.x>w.z?geoUvX(vGeo,n,2.4):w.y>w.z?geoUvY(vGeo,n,2.4):geoUvZ(vGeo,n,2.4)):(w.x>w.y&&w.x>w.z?vGeo.zy/2.4:w.y>w.z?vGeo.xz/2.4:vGeo.xy/2.4);gl_FragColor.rgb=vec3(fract(uv),.2);}
if(geoDebug==6.)gl_FragColor.rgb=rockWeights();
if(geoDebug==8.)gl_FragColor.rgb=vec3(.06/(1400.-gl_FragCoord.z*(1400.-.06)));
if(geoDebug==9.)gl_FragColor.rgb=vUnitColor;
if(geoDebug==10.)gl_FragColor.rgb=vec3(surfaceState.w);
if(geoDebug==11.)gl_FragColor.rgb=vec3(acos(clamp(normalize(vGeoNormal).y,-1.,1.))/1.57079633);
if(geoDebug==12.)gl_FragColor.rgb=vec3(vField.x);
if(geoDebug==13.)gl_FragColor.rgb=vec3(surfaceState.x);
if(geoDebug==14.)gl_FragColor.rgb=vec3(surfaceState.y);
if(geoDebug==15.)gl_FragColor.rgb=vec3(surfaceState.z);
if(geoDebug==16.)gl_FragColor.rgb=vMaterialLod<.5?vec3(.1,.8,.2):vMaterialLod<1.5?vec3(.9,.55,.1):vec3(.6,.2,.9);
if(geoDebug==17.)gl_FragColor.rgb=vec3(geoCavity());
`);
    shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
float hotZone=exp(-dot(vGeo.xz-vec2(68.,2.),vGeo.xz-vec2(68.,2.))/135.);
float hotVein=pow(abs(sin(vGeo.x*1.6+sin(vGeo.z*.9)*2.)),28.);
totalEmissiveRadiance+=vec3(1.,.18,.025)*uThermal*hotZone*hotVein*.6;`);
  };
  mat.customProgramCacheKey = () => `tidefall-geology-coherent-v1-${layered}-${vertexColors}-${styles}-${treatment}-${blended}-${distant}${distant?'-coarse-v1':''}`;
  return mat;
}
