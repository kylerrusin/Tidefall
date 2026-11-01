import { ambientRange } from "./climate";
import { useEffect, useRef, useState } from "react";
import { PLANETS, planetaryScience, SIM_MOON, destinationSeed, type PlanetId } from "./planets";
import { ground } from "./model";
import {previewPixel} from './planet-preview';
import neighbors from './data/neighbors.json';
export function StarMap({seed,host,close,select}:{seed:number;host:boolean;close:()=>void;select:(id:PlanetId)=>void}){
  const [selected,setSelected]=useState<PlanetId>(seed<0?"pyrax":"tidefall"),canvas=useRef<HTMLCanvasElement>(null),p=PLANETS[selected];
  useEffect(()=>{
    const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    const world=destinationSeed(seed,selected),image=ctx.createImageData(128,128);
    for(let z=0;z<128;z++)for(let x=0;x<128;x++){
      const i=(z*128+x)*4;image.data.set(previewPixel(world,(x-63.5)/60,(z-63.5)/60),i);
    }
    ctx.putImageData(image,0,0);
  },[seed,selected]);
  return <div className="overlay star-overlay"><section className="star-panel">
    <div className="panel-top"><span className="eyebrow">EXOPLANET SURVEY DESTINATIONS</span><button aria-label="Close star map" onClick={close}>×</button></div>
    <div className="star-grid"><div className="orbital-map">
      <div className="system-label system-left">TRAPPIST-1<small>M dwarf · 12.43 pc from Earth</small></div><div className="system-label system-right">55 CANCRI<small>G-type host · 12.59 pc from Earth</small></div>
      <svg viewBox="0 0 600 400" aria-label="Selected observed planetary orbits with logarithmic distance scaling"><defs><radialGradient id="m-star"><stop offset="0" stopColor="#ffe7b8"/><stop offset=".65" stopColor="#eb9161"/><stop offset="1" stopColor="#a5432c"/></radialGradient><radialGradient id="g-star"><stop offset="0" stopColor="#fff8df"/><stop offset="1" stopColor="#e9bd7c"/></radialGradient></defs>{(['tidefall','pyrax'] as const).map((id,i)=>{const p=PLANETS[id],other=neighbors.records.find(n=>n.hostname===p.observed.hostname)!,cx=i?450:155;return <g key={id}><circle cx={cx} cy="180" r={i?19:13} fill={i?'url(#g-star)':'url(#m-star)'}/>{[p.observed,{...other,pl_orbsmax:other.pl_orbsmax}].map((body,k)=>{const radius=55+50*Math.log(body.pl_orbsmax/p.orbit)/Math.log(other.pl_orbsmax/p.orbit);return <g key={body.pl_name}><title>{body.pl_name}. Observed orbit {body.pl_orbsmax} AU. Period {body.pl_orbper} days. Phase is illustrative.</title><ellipse cx={cx} cy="180" rx={radius} ry={radius*.6}/>{k===1&&<><circle cx={cx-radius*.78} cy={180-radius*.6*.626} r="4" fill="#b0c4cc"/><text x={cx-radius*.9} y={180-radius*.6*.626-13} fill="#c4d3d6" fontSize="10">{body.pl_name}</text></>}</g>;})}<text x={cx} y="285" textAnchor="middle" fill="#8babae" fontSize="10">{p.orbit} AU · {p.observed.pl_orbper.toFixed(3)} days</text></g>;})}</svg>
      {(["tidefall","pyrax"] as const).map((id,i)=><button key={id} title={PLANETS[id].observed.pl_name+" · "+PLANETS[id].subtitle} className={`planet-choice ${id} ${selected===id?"selected":""}`} style={{left:i?"85%":"35%",top:"53%"}} onClick={()=>setSelected(id)}><i/><span>{PLANETS[id].name.toUpperCase()}<small>{PLANETS[id].observed.pl_name}</small></span></button>)}
      <small>SELECTED KNOWN ORBITS · LOGARITHMIC DISTANCES · ILLUSTRATIVE PHASES</small>
    </div><div className="destination-info">
      <canvas ref={canvas} width={128} height={128} aria-label={`${p.name} terrain preview`}/>
      <span className="eyebrow">{p.subtitle}</span><h2>{p.name}</h2><p>{p.geology}</p><p className="scenario-note">{p.scenario}</p>
      <dl><div><dt>Difficulty</dt><dd>{p.difficulty}</dd></div><div><dt>Stellar distance</dt><dd>{p.orbit} AU</dd></div><div><dt>Gravity</dt><dd>{p.gravity.toFixed(2)} m/s²</dd></div><div><dt>Atmosphere</dt><dd>{p.atmosphere}</dd></div><div><dt>Modeled regional range</dt><dd>{ambientRange(destinationSeed(seed,selected)).min} to {ambientRange(destinationSeed(seed,selected)).max} °C</dd></div><div><dt>Hazards</dt><dd>{p.hazards}</dd></div></dl>
      <details className="science-profile"><summary>Scientific profile · measurements and assumptions</summary><b>OBSERVATIONAL CONSTRAINTS</b><dl><div><dt>Planet mass</dt><dd>{p.observed.pl_bmasse} +{p.observed.pl_bmasseerr1} / {p.observed.pl_bmasseerr2} Earth</dd></div><div><dt>Planet radius</dt><dd>{p.observed.pl_rade} +{p.observed.pl_radeerr1} / {p.observed.pl_radeerr2} Earth</dd></div><div><dt>Orbital period</dt><dd>{p.observed.pl_orbper} days</dd></div><div><dt>Eccentricity</dt><dd>{p.observed.pl_orbeccen}</dd></div><div><dt>Incident flux</dt><dd>{p.irradiation} Earth</dd></div><div><dt>Host mass and radius</dt><dd>{p.observed.st_mass} solar masses and {p.observed.st_rad} solar radii</dd></div><div><dt>Host temperature</dt><dd>{p.observed.st_teff} K</dd></div><div><dt>Host luminosity</dt><dd>{p.observed.luminosity.toPrecision(3)} solar</dd></div></dl><b>DERIVED AND MODELED</b><p>Scenario {planetaryScience(destinationSeed(seed,selected)).scenario.version} · escape speed {(planetaryScience(destinationSeed(seed,selected)).escapeVelocity.value/1000).toFixed(1)} km/s · equilibrium {Math.round(planetaryScience(destinationSeed(seed,selected)).equilibrium.value)} K (not surface temperature) · assumed pressure {(planetaryScience(destinationSeed(seed,selected)).pressure.value/1000).toFixed(0)} kPa.</p>{p.water&&<p>{SIM_MOON.id} — modeled satellite; unconfirmed. Instantaneous Roche and Hill screening; long-term migration remains unresolved.</p>}<b>MODELED</b><p>Synchronous rotation; assumed spin axis, survey longitude, atmosphere, weather and terrain. Gravity derives from mass and radius.</p><b>UNKNOWN AND SPECULATIVE</b><p>{p.unknown}</p><a href={p.robotic?"https://science.nasa.gov/exoplanet-catalog/55-cancri-e/":"https://science.nasa.gov/exoplanet-catalog/trappist-1-e/"} target="_blank" rel="noreferrer">NASA planet record</a></details>
      <button className="primary" disabled={!host || selected===(seed<0?"pyrax":"tidefall")} onClick={()=>select(selected)}>{host?"Set destination":"The host chooses the destination"}<span>Select</span></button>
    </div></div>
  </section></div>;
}
