import {ExplorationControls} from './ExplorationControls';
import {SampleInventory} from './SampleInventory';
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CombatOverlay } from "./CombatOverlay";
import {AutoInspection,DiscoveryLog} from "./inspection";
import {RESCUE} from "./extraction";
import { StarMap } from "./StarMap";
import {facility} from './facility';
import { planetForSeed } from "./planets";
import { connection } from "./client";
import { controls, updateUI } from "./controls";
import { GameScene } from "./scene";
import { Diagnostics } from "./Diagnostics";
import {TerrainQAPanel} from "./TerrainQAPanel";
import { soundscape } from "./audio";
import { Snapshot, astronomy, ground } from "./model";
import {
  EYE_HEIGHT,
  SHELTERS,
  shelterPlacements,
  SUIT_COLORS,
  environment,
  promptFor,
} from "./survival";
import { relativeLook } from "./pointer";
import "./style.css";
const clock = (time: number) =>
  Math.floor(Math.max(0, time) / 60) +
  ":" +
  String(Math.floor(Math.max(0, time) % 60)).padStart(2, "0");
const names = ["Ivory", "Amber", "Violet", "Jade"];
const itemNames = {
  1: "Kinetic pulse rifle",
  2: "Oxygen canister",
  3: "Artificial field",
};
function App() {
  const [, refresh] = useState(0),
    [joinOpen, setJoinOpen] = useState(false),
    [help, setHelp] = useState(false),
    [homeSettings, setHomeSettings] = useState(false),
    [starMap,setStarMap]=useState(false),
    [code, setCode] = useState(""),
    [quality, setQuality] = useState(
      () => import.meta.env.DEV&&new URLSearchParams(location.search).has("terrainQA")?true:sessionStorage.getItem("tidefall-quality") !== "low",
    ),
    [audio, setAudio] = useState(true),
    [copied, setCopied] = useState(false),
    [noticeUntil, setNoticeUntil] = useState(0);
  const statusBefore = useRef("");
  useEffect(()=>{const url=new URL(location.href);if(!url.searchParams.has("terrainQA")){url.searchParams.delete("mode");history.replaceState(null,"",url);refresh(n=>n+1);}},[]);
  useEffect(() => {
    const off = connection.subscribe(() => refresh((n) => n + 1)),
      update = () => refresh((n) => n + 1);
    window.addEventListener("tidefall-ui", update);
    return () => {
      off();
      window.removeEventListener("tidefall-ui", update);
    };
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("tidefall-player") ?? "{}",
      );
      if (
        typeof saved.code === "string" &&
        saved.code.length === 5 &&
        typeof saved.token === "string"
      ) {
        setCode(saved.code);
        connection.join(saved.code);
      }
    } catch {}
  }, []);
  const state = connection.state,
    p = state?.players.find((q) => q.id === connection.id),
    running = state?.status === "running",
    finished = state?.status === "finished",
    alive = state?.players.filter((q) => q.alive).length ?? 0,
    e = environment(state?.time ?? 0,state?.seed??42,state?.extraction.timeline.duration),
    tide = astronomy(state?.time ?? 0);
  // A fresh/rejoined scene restores the server-owned equipment selection once.
  useEffect(()=>{if(p){controls.slot=p.equipped;updateUI();}},[p?.id]);
  controls.enabled =
    !!running &&
    !!p && (p.alive||p.extractedAt!==null) &&
    connection.connected &&
    !controls.menu &&
    !controls.inventory &&
    !controls.tutorial;
  useEffect(() => {
    if (running && statusBefore.current !== "running") {
      const first =
        sessionStorage.getItem("tidefall-survival-tutorial") !== "seen";
      controls.tutorial = first;
      controls.menu = false;
      controls.inventory = false;
      controls.spectating = "";
      updateUI();
    }
    if (finished) {
      controls.release?.();
      controls.menu = false;
      controls.inventory = false;
      controls.tutorial = false;
      updateUI();
    }
    statusBefore.current = state?.status ?? "";
  }, [state?.status]);
  useEffect(() => {
    if (state?.noticeId) setNoticeUntil(performance.now() + 4300);
  }, [state?.noticeId]);
  useEffect(() => {
    if (running && p && !p.alive) {
      controls.inventory = false;
      controls.menu = false;
      controls.tutorial = false;
      updateUI();
    }
  }, [p?.alive, running]);
  const resume = () => {
    controls.menu = false;
    controls.inventory = false;
    controls.tutorial = false;
    sessionStorage.setItem("tidefall-survival-tutorial", "seen");
    soundscape.enable(audio);
    controls.capture?.();
    updateUI();
  };
  const menu = () => {
    controls.menu = true;
    controls.inventory = false;
    controls.release?.();
    connection.send("pause");
    updateUI();
  };
  const leave = () => {
    controls.release?.();
    controls.menu = false;
    controls.inventory = false;
    controls.tutorial = false;
    connection.leave();
    updateUI();
  };
  const settings = (
    <>
      <label className="setting">
        Graphics
        <select
          aria-label="Graphics"
          value={quality ? "high" : "low"}
          onChange={(ev) => {
            setQuality(ev.target.value === "high");
            sessionStorage.setItem("tidefall-quality", ev.target.value);
          }}
        >
          <option value="high">High</option>
          <option value="low">Low · fewer pixels, no shadows</option>
        </select>
      </label>
      <label className="setting">
        Mouse sensitivity
        <input
          aria-label="Mouse sensitivity"
          type="range"
          min="0.0008"
          max="0.005"
          step="0.0001"
          defaultValue={controls.sensitivity}
          onChange={(ev) => {
            controls.sensitivity = Number(ev.target.value);
          }}
        />
      </label>
      <label className="setting">
        Invert Y
        <input
          aria-label="Invert Y"
          type="checkbox"
          defaultChecked={controls.invertY}
          onChange={(ev) => {
            controls.invertY = ev.target.checked;
          }}
        />
      </label>
      <label className="setting">
        Environmental audio
        <input
          aria-label="Environmental audio"
          type="checkbox"
          checked={audio}
          onChange={(ev) => {
            setAudio(ev.target.checked);
            soundscape.enable(ev.target.checked);
          }}
        />
      </label>
      <p className="muted">
        Mouse capture uses relative movement. Escape releases it. Click Resume
        to capture again.
      </p>
    </>
  );
  const warning =
    p && p.alive
      ? p.oxygen < 25
        ? "Oxygen low · equip a canister with 2"
        : p.temperature > 39
          ? "Thermal exposure · leave the vents"
          : p.coldStage!=="normal"
            ? `${p.coldStage==="critical"?"CRITICAL":p.coldStage==="severe"?"Severe":"Early"} cold exposure · thermal supplies or shelter`
            : p.shelter
              ? e.front > 0.8
                ? "Shelter seal lost · pressure front"
                : "Shelter sealed · move to leave"
              : ""
      : "";
  const prompt = p?.alive && state ? promptFor(p, state) : "";
  const playing =
    running && !controls.menu && !controls.inventory && !controls.tutorial;
  return (
    <main>
      <CombatOverlay />
      <AutoInspection />
      {state && starMap && <StarMap seed={state.seed} host={state.host===connection.id} close={()=>setStarMap(false)} select={planet=>{connection.send("destination",{planet});setStarMap(false);}}/>}
      {state && connection.prediction?.seed!==state.seed && <div className="overlay descent"><section className="panel"><span className="eyebrow">ORBITAL DESCENT</span><h2>{planetForSeed(state.seed).name}</h2><p>Surveying the surface and preparing collision systems…</p><div className="descent-line"/></section></div>}
      <div className="scene">
        <GameScene state={state} quality={quality} />
      </div>
      <div
        className={
          "atmospheric-veil " +
          (!state || state.status === "ready" ? "title-shade" : "")
        }
      />
      <div
        className={"water-veil " + (controls.underwater ? "submerged" : "")}
      />
      {p?.alive && p.health < 30 && <div className="danger-veil" />}
      {p?.alive&&p.coldStage!=="normal"&&<div className={`cold-veil ${p.coldStage}`}/>}
      <Diagnostics />{import.meta.env.DEV&&<><TerrainQAPanel/><ExplorationControls/></>}
      {!state && (
        <>
          <header className="home-header">
            <span className="brand">TIDEFALL</span>
            <span>PLANETARY SURVIVAL SURVEY</span>
          </header>
          <section className="title-screen">
            <p className="eyebrow">THE OCEAN WILL COME BACK.</p>
            <h1>
              Survive the
              <br />
              <em>Planet.</em>
            </h1>
            <p className="title-copy">
              A changing coast. A rescue to reach.
              <br />
              Survive, then reach extraction.
            </p>
            <div className="title-actions">
              <button
                className="primary"
                disabled={connection.pending}
                onClick={() => {
                  soundscape.enable(audio);
                  connection.join();
                }}
              >
                {connection.pending ? "Connecting…" : "Create Game"}
                <span>Begin</span>
              </button>
              <button className="secondary" onClick={() => setJoinOpen(true)}>
                Join Game<span>Begin</span>
              </button>
            </div>
            <div className="quiet-actions">
              <button onClick={() => setHelp(true)}>How to Play</button>
              <button onClick={()=>{connection.requestedMode=connection.requestedMode==="preview"?"survival":"preview";refresh(n=>n+1);}}>{connection.requestedMode==="preview"?"30-minute survival":"4-minute judging preview"}</button>
              <button onClick={() => setHomeSettings(true)}>Settings</button>
            </div>
            {connection.error && (
              <p className="error" role="alert">
                {connection.error}
              </p>
            )}
          </section>
          <footer className="home-footer">
            <span></span>
            <span>FIRST PERSON SURVIVAL</span>
          </footer>
        </>
      )}
      {state?.status === "ready" && (
        <div className="overlay">
          <section className="panel lobby">
            <div className="panel-top">
              <span className="eyebrow">SURFACE UPLINK ESTABLISHED</span>
              <button aria-label="Leave room" onClick={leave}>
                ×
              </button>
            </div>
            <h2>{state.seed<0?"Outlast the fracture.":"Outlast the tide."}</h2><small>{state.extraction.timeline.mode==="preview"?"4-MINUTE JUDGING PREVIEW":"NORMAL SURVIVAL · 30 MIN + 3 MIN BOARDING"}</small>
            <button className="destination-button" onClick={()=>setStarMap(true)}><span>{planetForSeed(state.seed).name.toUpperCase()} · {planetForSeed(state.seed).gravity.toFixed(2)} m/s²</span><strong>Star map</strong></button>
            <p>
              Find high ground, gather supplies, and survive longer than
              everyone else.
            </p>
            <button
              className="room-code"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(state.code)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
            >
              ROOM <strong>{state.code}</strong>
              <span>{copied ? "COPIED" : "COPY INVITE"}</span>
            </button>
            <ul className="crew-list">
              {state.players.map((q) => (
                <li key={q.id}>
                  <i style={{ background: SUIT_COLORS[q.color] }} />
                  <span>
                    {names[q.color]} {q.id === p?.id ? "(you)" : ""}
                    <small>
                      {q.id === state.host
                        ? "HOST"
                        : "ASTRONAUT " + (q.color + 1)}
                    </small>
                  </span>
                  <b>
                    {!q.connected ? "OFFLINE" : q.ready ? "READY" : "NOT READY"}
                  </b>
                </li>
              ))}
            </ul>
            <div className="lobby-controls">
              <button
                className={p?.ready ? "secondary ready" : "secondary"}
                onClick={() => connection.send("ready")}
              >
                {p?.ready ? "Ready ✓" : "I'm ready"}
              </button>
              {p?.id === state.host && (
                <button
                  className="primary"
                  disabled={
                    !state.players
                      .filter((q) => q.connected)
                      .every((q) => q.ready && q.loaded) || connection.prediction?.seed!==state.seed
                  }
                  onClick={() => {
                    connection.send("start");
                    soundscape.enable(audio);
                  }}
                >
                  {state.players.filter((q) => q.connected).length === 1
                    ? "Start practice"
                    : "Start match"}
                  <span>Begin</span>
                </button>
              )}
            </div>
            <p className="muted">
              {state.players.filter((q) => q.connected).length === 1
                ? "Invite a friend for a competitive match. Solo practice is available."
                : "Everyone starts apart with the same suit. Last astronaut alive wins."}
            </p>
          </section>
        </div>
      )}
      {playing && p && (
        <>
          <div className="survival-top">
            <span className="tide-pill">
              <i />
              {state.tsunami && state.time>=state.tsunami.warningAt && state.time<state.tsunami.triggerAt+25 ? (state.time<state.tsunami.triggerAt?`TSUNAMI WARNING · ${clock(state.tsunami.triggerAt-state.time)}`:"TSUNAMI · CLIMB INLAND") : state.time >= state.extraction.timeline.announce
                ? "EXTRACTION · " + clock(state.extraction.timeline.end - state.time)
                : e.front > 0
                  ? state.seed<0?"RADIANT FRONT":"COLD FRONT"
                  : e.front > 0
                    ? (state.seed<0?"RADIANT FRONT IN ":"COLD FRONT IN ") + clock(state.extraction.timeline.end - state.time)
                    : e.storm > 0
                      ? (e.storm>.7?"SEVERE STORM":"STORM BUILDING")
                      : state.seed<0 ? "BASALT FRONTIER" : tide.rising
                        ? "WATER RISING"
                        : "TIDE RECEDING"}
            </span>
            <span className="survivors">
              {state.extraction.boarded.length?`${alive} EXPOSED · ${state.extraction.boarded.length} ABOARD`:<>{alive} <span>{alive === 1 ? "SURVIVOR" : "SURVIVORS"}</span></>}
            </span>
            <button aria-label="Open menu" onClick={menu}>
              Ⅱ
            </button>
          </div>
          {p.alive ? (
            <>
              <div className={`reticle ${performance.now()<controls.flashUntil?"firing":""} ${prompt?"interactable":""} ${(p.weaponEnergy<8 || state.time-p.firedAt<.32)?"empty":""}`} aria-label="First-person crosshair">
                ·
              </div>
              <div className="vitals">
                <div className={p.health < 30 ? "vital critical" : "vital"}>
                  <span>+</span>
                  <meter
                    aria-label="Health"
                    min="0"
                    max="100"
                    value={p.health}
                  />
                  <b>{Math.ceil(p.health)}</b>
                </div>
                {(controls.underwater || p.oxygen < 25) && (
                  <div className={p.oxygen < 25 ? "vital critical" : "vital"}>
                    <span>O₂</span>
                    <meter
                      aria-label="Oxygen"
                      min="0"
                      max="100"
                      value={p.oxygen}
                    />
                    <b>{Math.ceil(p.oxygen)}</b>
                  </div>
                )}
              </div>
              <div className="quick-use">{p.medicine>0&&<button disabled={p.health>=100} onClick={()=>connection.send("medical")}>{state.seed<0?"H · Repair · ":"H · Heal · "}{p.medicine}</button>}{p.canisters>0&&(state.seed<0?p.temperature>37.1:p.oxygen<95)&&<button onClick={()=>connection.send(state&&state.seed<0?"coolant":"oxygen")}>{state.seed<0?"O · Coolant · ":"O · Oxygen · "}{p.canisters}</button>}{p.cells>0&&<button disabled={p.fuel>=95&&p.weaponEnergy>=95&&p.energy>=95} onClick={()=>connection.send("cell")}>B · Charge · {p.cells}</button>}{p.compounds>0&&<button disabled={p.thermalUntil>state.time} onClick={()=>connection.send("thermal")}>T · Thermal · {p.compounds}</button>}</div>
              <div className="equipped">
                <span>{controls.slot}</span>
                {controls.slot===2&&state.seed<0?"Coolant canister":itemNames[controls.slot]}
                {controls.slot === 1 && (p.rifleMode==="sampling"?" · SAMPLE · V combat":" · COMBAT · V sample") + " · " + Math.floor(p.weaponEnergy) + "%"}
                {controls.slot === 2 && " · " + p.canisters}
                {controls.slot === 3 && " · " + Math.floor(p.energy) + "%"}
                <small>E · KIT & CHART</small>
              </div>
              {(p.thrusting || p.fuel<95) && <div className="flight-fuel"><span>JET {Math.ceil(p.fuel)}%</span><meter aria-label="Jetpack fuel" min={0} max={100} value={p.fuel}/>{p.grounded && p.rechargeDelay===0?<small>RECHARGING</small>:null}</div>}

              <div className="context" role="status">
                {performance.now()<noticeUntil&&facility(state.seed).rooms.some(r=>r.record===state.notice)?state.notice:prompt ||
                  (Math.abs(p.x)>140||p.z< -138?"Escarpment boundary · return to the survey basin":p.z>136?"Offshore hazard · return inland":"") ||
                  warning ||
                  (performance.now() < noticeUntil ? state.notice : "")}
              </div>
              {!controls.locked && (
                <div
                  className={
                    "capture-hint " +
                    (controls.lockState === "blocked" ? "blocked" : "")
                  }
                >
                  <button onClick={resume}>
                    {controls.lockState === "blocked"
                      ? "Mouse capture unavailable · Retry"
                      : "Click to capture mouse"}
                  </button>
                  {controls.lockMessage &&
                    performance.now() - controls.lockChangedAt < 7000 && (
                      <small role="status">{controls.lockMessage}</small>
                    )}
                </div>
              )}
              <TouchControls />
            </>
          ) : (
            <div className={"spectator "+(p.extractedAt!==null?"aboard":"")}>
              <span className="eyebrow">
                {p.extractedAt!==null?"ABOARD RESCUE":p.participant ? "SUIT SIGNAL ENDED" : "JOINED IN PROGRESS"}
              </span>
              <h3>
                {p.participant ? p.deathCause : "You’ll enter the next round."}
              </h3>
              <p>{p.extractedAt!==null?"Protected aboard until departure":<>                {p.participant
                  ? "Survived " + clock(p.diedAt ?? 0) + " · "
                  : ""}
                Spectating{" "}
                {
                  names[
                    state.players.find((q) => q.id === controls.spectating)
                      ?.color ?? 0
                  ]
                }
</>}</p>
              <button
                className="secondary"
                onClick={() => {
                  const living = state.players.filter((q) => q.alive);
                  const i = living.findIndex(
                    (q) => q.id === controls.spectating,
                  );
                  controls.spectating =
                    living[(i + 1) % living.length]?.id ?? "";
                  updateUI();
                }}
              >
                Next astronaut
              </button>
              <button className="text-button" onClick={resume}>
                Capture mouse to look
              </button>
            </div>
          )}
        </>
      )}
      {running && controls.tutorial && (
        <div className="overlay">
          <section className="panel tutorial">
            <span className="eyebrow">
              EXPLORE, PREPARE, SURVIVE AND OUTLAST
            </span>
            <h2>
              {state && state.seed<0 ? <>The ground holds<br/>the heat.</> : <>The moon controls<br/>the tides.</>}
            </h2>
            <p>
              Find high ground, gather supplies, and survive longer than
              everyone else.
            </p>
            <div className="key-guide">
              <span>
                <kbd>WASD</kbd> Move
              </span>
              <span>
                <kbd>MOUSE</kbd> Look
              </span>
              <span>
                <kbd>SPACE</kbd> Jump and hold to fly
              </span>
              <span>
                <kbd>X</kbd> Collect and operate doors
              </span>
              <span>
                <kbd>E / TAB</kbd> Inventory & chart
              </span>
            </div>
            <button className="primary" onClick={resume}>
              Enter the surface<span>Begin</span>
            </button>
            <button className="text-button" onClick={resume}>
              Skip introduction
            </button>
          </section>
        </div>
      )}
      {controls.menu && state && (
        <div className="overlay">
          <section className="panel">
            <span className="eyebrow">SUIT CONFIGURATION</span>
            <h2>A moment to breathe.</h2>
            <p className="muted">The planet keeps moving while you are here.</p>
            {settings}
            <button className="primary" onClick={resume}>
              Resume<span>Begin</span>
            </button>
            <button className="text-button" onClick={leave}>
              Leave room
            </button>
            {controls.lockMessage && (
              <p className="error">{controls.lockMessage}</p>
            )}
          </section>
        </div>
      )}
      {playing&&p?.rifleMode==='sampling'&&!controls.inventory&&!controls.menu&&<div className="sampling-status" role="status"><strong>GEOLOGICAL SAMPLING · V combat</strong><span>{p.sampleNotice||'Aim at exposed geology within 10 m · click or F'}</span><small>E inventory · X interact</small></div>}
      {playing&&p?.cabin&&<div className="cabin-controls">{p.cabin.seat!==null?'SEATED · X to stand when flight permits':'CABIN · WASD to walk · approach seat and X'}<small>Restraints lock during launch and release in stable flight.</small><button onClick={()=>connection.send('interact')}>{p.cabin.seat!==null?'Leave seat':'Sit nearby'}</button></div>}
      {playing&&state?.extraction.site&&<div className="extraction-beacon">{state.extraction.phase==='boarding'?`RESCUE OPEN · ${Math.ceil(state.extraction.closes-state.time)}s · Enter the ramp, then X aboard`:state.extraction.phase==='departing'?'RESCUE DEPARTING':`RESCUE INBOUND · ${Math.max(0,Math.ceil(state.extraction.opens-state.time))}s`}<small>Beacon {Math.round(state.extraction.site.x)}, {Math.round(state.extraction.site.z)} · TAB chart</small></div>}
      {controls.inventory && state && p && (
        <div className="overlay">
          <section className="panel inventory">
            <div className="panel-top">
              <span className="eyebrow">FIELD KIT AND SURFACE CHART</span>
              <button aria-label="Close inventory" onClick={resume}>
                ×
              </button>
            </div>
            <h2>Travel light.</h2>
            <DiscoveryLog/>
            <SampleInventory player={p}/>
            <div className="inventory-grid">
              <div>
                <div className="kit-slots">
                  {([1, 2, 3] as const).map((slot) => (
                    <button
                      key={slot}
                      className={controls.slot === slot ? "selected" : ""}
                      onClick={() => {
                        controls.slot = slot;
                        connection.send("equip",{position:{slot}});
                        updateUI();
                      }}
                    >
                      <kbd>{slot}</kbd>
                      <strong>{slot===2&&state.seed<0?"Coolant canister":itemNames[slot]}</strong>
                      <small>
                        {slot === 1
                          ? "Kinetic pulse · 0.32s cadence"
                          : slot === 2
                            ? p.canisters + (state.seed<0?" stored · cools chassis by 1.2°C":" stored · +65 oxygen each")
                            : Math.floor(p.energy) +
                              "% charge · Q reverse · R recall"}
                      </small>
                    </button>
                  ))}
                </div>
                <dl className="suit-status">
                  <div>
                    <dt>Suit</dt>
                    <dd>{Math.ceil(p.health)}%</dd>
                  </div>
                  <div>
                    <dt>Oxygen</dt>
                    <dd>{Math.ceil(p.oxygen)}%</dd>
                  </div>
                  <div>
                    <dt>{state.seed<0?"Chassis temperature":"Core temperature"}</dt>
                    <dd>{p.temperature.toFixed(1)}°C</dd>
                  </div>
                  <div>
                    <dt>Thermal liner</dt>
                    <dd>{p.insulated ? "Fitted" : "None"}</dd>
                  </div>
                  <div>
                    <dt>Emergency thrust</dt>
                    <dd>{Math.ceil(p.fuel)} / 100</dd>
                  </div>
                </dl>
                <div className="field-resources"><button disabled={p.cells===0} onClick={()=>connection.send("cell")}>B · Energy cell · {p.cells}</button><button disabled={p.compounds===0||p.thermalUntil>state.time} onClick={()=>connection.send("thermal")}>T · Thermal compound · {p.compounds}</button><button disabled={p.medicine===0 || p.health>=100} onClick={()=>connection.send("medical")}>Medical supply · {p.medicine} · +32 health</button><button disabled={p.minerals<3} onClick={()=>connection.send("service")}>Field service · {p.minerals}/3 minerals</button><small>{p.thermalUntil>state.time?`Thermal protection · ${Math.ceil(p.thermalUntil-state.time)}s`:"Medical and mineral supplies are recovered in the field."}</small></div>
              </div>
              <SurfaceMap state={state} />
            </div>
            <button
              className="secondary"
              disabled={controls.slot === 1 || !p.alive}
              onClick={() => {
                if (controls.slot === 2) connection.send(state.seed<0?"coolant":"oxygen");
                if (controls.slot === 3 && controls.aim.valid)
                  connection.anchor({
                    ...controls.aim,
                    sign: controls.polarity,
                  });
              }}
            >
              {controls.slot === 2
                ? state.seed<0?"Use coolant canister":"Use oxygen canister"
                : controls.slot === 3
                  ? "Deploy field at reticle"
                  : "Equip an item to use"}
            </button>
            <button disabled={!p.alive} onClick={()=>connection.send("carry")}>{state.objects.some(o=>o.carriedBy===p.id)?"Release carried sample":"Carry nearby sample"}<small>G</small></button>
            <div className="drop-actions">{([['bio',p.medicine,'Medical'],['cell',p.cells,'Energy'],['thermal',p.compounds,'Thermal'],[state.seed<0?'coolant':'oxygen',p.canisters,state.seed<0?'Coolant':'Oxygen'],['mineral',p.minerals,'Mineral']] as [string,number,string][]).map(([kind,count,label])=><button key={kind} disabled={!count||!p.alive} onClick={()=>connection.send('drop',{position:{kind}})}>Drop {label}</button>)}</div>
            <p className="muted">
              Oxygen is consumed underwater. Hold C to dive; release to float.
              Space assists ascent. Close physical compartment doors to shelter from wind and cold. G carries portable samples.
            </p>
            <button className="primary" onClick={resume}>
              Return to the surface<span>Begin</span>
            </button>
          </section>
        </div>
      )}
      {finished && state && (
        <div className="overlay">
          <section className="panel results">
            <span className="eyebrow">
              {state.practice
                ? "PRACTICE COMPLETE"
                : state.winnerIds.length > 1
                  ? "SHARED FIRST PLACE"
                  : "LAST ASTRONAUT STANDING"}
            </span>
            <h2>
              {state.practice
                ? "Your time on the surface."
                : state.winnerIds.length > 1
                ? state.players.some(p=>p.extractedAt!==null)?"Shared extraction.":state.players.some(p=>p.alive)?"Shared survival.":"The planet takes all."
                : names[
                    state.players.find((q) => q.id === state.winnerIds[0])
                      ?.color ?? 0
                  ] + " outlasted the expedition."}
            </h2>
            <p>{state.result}</p>
            <table>
              <thead>
                <tr>
                  <th>Rank and astronaut</th>
                  <th>Survived</th>
                  <th>Suit record</th>
                </tr>
              </thead>
              <tbody>
                {state.standings.map((s) => {
                  const q = state.players.find((q) => q.id === s.id)!;
                  return (
                    <tr key={s.id} className={s.winner ? "winner" : ""}>
                      <td>
                        <span
                          className="suit-dot"
                          style={{ background: SUIT_COLORS[q.color] }}
                        />
                        {s.rank} · {names[q.color]}
                        {q.id === p?.id ? " (you)" : ""}
                      </td>
                      <td>{clock(s.time)}</td>
                      <td>{s.cause}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {state.host === p?.id ? (
              <div className="title-actions">
                <button
                  className="primary"
                  onClick={() => connection.send("rematch")}
                >
                  Rematch<span>↻</span>
                </button>
                <button
                  className="secondary"
                  onClick={() => connection.send("rematch", { newSeed: true })}
                >
                  New coastline
                </button>
              </div>
            ) : (
              <p className="muted">Waiting for the host to start a rematch.</p>
            )}
            <button className="text-button" onClick={leave}>
              Leave room
            </button>
          </section>
        </div>
      )}
      {joinOpen && !state && (
        <div className="overlay">
          <section className="panel compact">
            <div className="panel-top">
              <span className="eyebrow">JOIN A SHARED PLANET</span>
              <button
                aria-label="Close join"
                onClick={() => setJoinOpen(false)}
              >
                ×
              </button>
            </div>
            <h2>Find your crew.</h2>
            <label className="room-input">
              Room code
              <input
                aria-label="Room code"
                autoFocus
                maxLength={5}
                value={code}
                placeholder="ABCDE"
                onChange={(ev) => setCode(ev.target.value.toUpperCase())}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" && code.length === 5) {
                    connection.join(code);
                    setJoinOpen(false);
                  }
                }}
              />
            </label>
            <button
              className="primary"
              disabled={code.length !== 5 || connection.pending}
              onClick={() => {
                soundscape.enable(audio);
                connection.join(code);
                setJoinOpen(false);
              }}
            >
              Join Game<span>Begin</span>
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="overlay">
          <section className="panel">
            <span className="eyebrow">THE PLANET IS THE ADVERSARY</span>
            <h2>
              Explore. Prepare.
              <br />
              Outlast.
            </h2>
            <p>
              Gather oxygen and thermal protection. Learn the high routes. A
              rising tide and a cold front will drive you from safety. The last
              astronaut alive wins.
            </p>
            <p>
              WASD move · Shift sprint · Space jumps and provides emergency thrust · C dive
              · X collects and operates doors · 1–3 or wheel equip · click fires or uses equipment ·
              E or Tab kit and chart · X interact · V sampling mode · Escape menu.
            </p>
            <p className="muted">
              Oxygen lasts about 45 seconds submerged. Two canisters fit in your
              kit. Shelter seals protect one astronaut until the final pressure
              front. Same-tick eliminations share first place.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Understood<span>Begin</span>
            </button>
          </section>
        </div>
      )}
      {homeSettings && !state && (
        <div className="overlay">
          <section className="panel">
            <span className="eyebrow">SUIT CONFIGURATION</span>
            <h2>Make yourself at home.</h2>
            {settings}
            <button className="primary" onClick={() => setHomeSettings(false)}>
              Done<span>Begin</span>
            </button>
          </section>
        </div>
      )}
      {state && !connection.connected && (
        <div className="network-warning" role="alert">
          {connection.error || "Reconnecting to the planet…"}
        </div>
      )}
    </main>
  );
}
function SurfaceMap({ state }: { state: Snapshot }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const size = 260,
      scale = size / 320;
    c.width = c.height = size;
    ctx.fillStyle = "#283b40";
    ctx.fillRect(0, 0, size, size);
    for (let j = 0; j < 65; j++)
      for (let i = 0; i < 65; i++) {
        const h = ground(i * 5 - 160, j * 5 - 160, state.seed);
        ctx.fillStyle =
          state.water[j * 65 + i] > h + 0.1
            ? "#335e69"
            : h > 24
              ? "#9b9a7b"
              : h > 12
                ? "#6e7d6d"
                : "#858876";
        ctx.fillRect(i * 4, j * 4, 4, 4);
      }
    ctx.fillStyle="#b2decb";ctx.beginPath();ctx.moveTo(48,27);ctx.lineTo(60,27);ctx.lineTo(54,37);ctx.closePath();ctx.fill();ctx.font="10px sans-serif";ctx.fillText("Survey cave",38,22);
    for (const s of shelterPlacements(state.seed)) {
      ctx.fillStyle = "#e2b96f";
      ctx.fillRect((s.x + 160) * scale - 3, (s.z + 160) * scale - 3, 6, 6);
    }
    if(state.extraction.site){const site=state.extraction.site;ctx.strokeStyle="#9eece4";ctx.lineWidth=2;ctx.strokeRect((site.x+160)*scale-5,(site.z+160)*scale-5,10,10);}
    for (const p of state.players) {
      if (!p.alive) continue;
      ctx.fillStyle = SUIT_COLORS[p.color];
      ctx.beginPath();
      ctx.arc(
        (p.x + 160) * scale,
        (p.z + 160) * scale,
        p.id === connection.id ? 4 : 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }, [state]);
  return (
    <figure className="surface-map">
      <canvas
        ref={canvas}
        aria-label="Coastline chart showing shelters and surviving astronauts"
      />
      <figcaption>
        AMBER MARKS SHELTERS · SUIT COLORS MARK ASTRONAUTS
        <br />
        {environment(state.time,state.seed,state.extraction.timeline.duration).stage} · {clock(state.time)} elapsed
      </figcaption>
    </figure>
  );
}
function TouchControls() {
  const pad = useRef<HTMLDivElement>(null),
    look = useRef<{ x: number; y: number } | null>(null);
  const reset = () => {
    controls.x = controls.z = 0;
  };
  return (
    <div className="touch-controls">
      <div
        className="touch-look"
        onPointerDown={(e) => {
          look.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!look.current) return;
          Object.assign(
            controls,
            relativeLook(
              controls.yaw,
              controls.pitch,
              e.clientX - look.current.x,
              e.clientY - look.current.y,
              controls.sensitivity * 1.2,
              controls.invertY,
            ),
          );
          look.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          look.current = null;
        }}
        onPointerCancel={() => {
          look.current = null;
        }}
      />
      <div
        ref={pad}
        className="touch-pad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          controls.x = Math.max(
            -1,
            Math.min(1, (e.clientX - r.x - r.width / 2) / 35),
          );
          controls.z = Math.max(
            -1,
            Math.min(1, -(e.clientY - r.y - r.height / 2) / 35),
          );
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const r = e.currentTarget.getBoundingClientRect();
          controls.x = Math.max(
            -1,
            Math.min(1, (e.clientX - r.x - r.width / 2) / 35),
          );
          controls.z = Math.max(
            -1,
            Math.min(1, -(e.clientY - r.y - r.height / 2) / 35),
          );
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
      >
        <span>MOVE</span>
      </div>
      <div className="touch-actions">
        <button
          onPointerDown={() => {
            controls.jump = true;
          }}
          onPointerUp={() => {
            controls.jump = false;
          }}
          onPointerCancel={() => {
            controls.jump = false;
          }}
        >
          ↑
        </button>
        <button
          onPointerDown={() => {
            controls.dive = true;
          }}
          onPointerUp={() => {
            controls.dive = false;
          }}
          onPointerCancel={() => {
            controls.dive = false;
          }}
        >
          DIVE
        </button>
        <button onClick={() => connection.send("interact")}>X</button>
        <button onClick={() => controls.useItem?.()}>USE</button>
        <button
          onClick={() => {
            controls.inventory = true;
            controls.release?.();
            updateUI();
          }}
        >
          KIT
        </button>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
