# Round 5 — controls and shared creature encounters

Implemented in the existing Tidefall application on 2026-10-28. This checkpoint also includes the previously uncommitted Round 4 rock colliders, rifle and initial creature work. No new map, inventory or crafting system was introduced.

## Control diagnosis and repair

The reported free-look failure did not reproduce in native Edge during this continuation: the user explicitly confirmed that restoring Edge and moving the mouse without holding a button turns the view. The embedded browser **does** reject Pointer Lock. Its diagnostics showed mouse events arriving but being discarded because the actual canvas was not locked; a hidden cursor or a non-null lock on a different element is insufficient evidence.

The native automation controller could not complete the extended hardware checks. It had previously stopped on URL verification, and this continuation's window-resize attempt minimized Edge. The user restored it and supplied the free-look confirmation. Do not represent this as automated proof of physical 360-degree turning, vertical limits or sprint/fire/resume combinations.

CameraRig remains the sole owner of local look. Mouse events are captured on document, checked against the active canvas and menu state, and applied as relative displacement without frame-delta multiplication. Large valid deltas are no longer truncated at 300 units. Pointer-session epochs prevent an old rejected request from corrupting a later capture; cleanup removes the input handlers and item callback. Camera matrices are updated before aim queries, camera options are stable across scene renders, and the authoritative rifle uses the same tested look-direction convention. The old server comparison against a delayed movement-snapshot yaw was removed so a fast legitimate turn does not silently reject a shot.

F3 reports event counts, applied events, latest deltas, discard reason, yaw/pitch, controller owner and pre-render quaternion overwrite detection. The embedded-browser observation showed zero overwrites. Diagnostics and their keyboard handlers are disabled in production. My initial suspicion that the server and Three.js used different aim mathematics was checked and rejected; their direction formulas agree.

## Why creatures previously failed

The old loop selected the nearest player every physics tick, used body-center visibility, discarded targets immediately when occluded, and offered only a 1.8 m contact approach with no traveling ranged attack. There was no retained noise location or route around an obstruction. A separate presentation defect compounded the problem: scene memoization omitted pulse IDs, so newly accepted shots could lack a mounted tracer.

The replacement uses the existing authoritative room and Rapier world. Contracts remain in `src/model.ts`; tuning is centralized in `src/combat.ts`. `src/creatures.ts` extends that simulation rather than creating client-side AI.

## Implemented behavior

States are idle, patrol, suspicious, investigate, alert, chase, position, windup, attack, recover, search, retreat, stagger and dead. Decisions run at 10 Hz; character collision and projectile sweep run at the existing fixed 60 Hz. Snapshots run at approximately 10 Hz.

| Parameter | Value |
| --- | --- |
| Creature health / spawn grace | 72 / 8 seconds |
| Vision | 30 m, 150-degree field, Rapier occlusion |
| Hearing | walking 10 m, sprinting 19 m, gunfire 48 m |
| Target commitment / remembered sighting | 2.2 / 10 seconds |
| Patrol / chase speed | 1.3 / 4.1 m/s |
| Melee | 2.7 m, ±0.9 rad arc, 0.7 s windup, 12 damage, 2.3 s cooldown |
| Ranged | 7–22 m, 1.1 s charge, 14 m/s spore, 14 damage, 4.8 s cooldown |
| Projectile | 0.18 m swept sphere, 3.5 s maximum life |
| Concurrent attack windups/executions | At most two creatures |

Hearing stores a location, not the continuously updated transform of an unseen player. Visible targets remain committed rather than switching every frame. The last 220 ms of windup commits the attack direction; a late dodge can leave the melee arc. Spores have actual travel time, swept collision, shared IDs and a frozen discharge trajectory with limited lead. Solid terrain, rocks, props and player colliders participate. Death cancels windup and removes owned projectiles. A rifle hit interrupts the creature with bounded stagger and knockback.

Local bounded A* plans through collision-clear, slope-limited points, at most once per 0.9 seconds. Four-way edges avoid cutting obstacle corners. A collision-stuck timer causes replanning/search. Habitats are searched deterministically for dry, collision-free positions; six seed fixtures exercise this. Wet routes are rejected, rising water and thermal danger cause retreat toward higher dry terrain, deep water/vents can damage organisms, and fast moving props emit bounded noise stimuli. The initial encounter threatens an unattended player within twenty seconds in the tested seed.

## Feedback and rendering

Authoritative damage events carry monotonic IDs, victim, source position, amount, kind, attack and time. Clients consume each once. Incoming damage displays a camera-relative source indicator, brief red edge flash (amber for exposure), impact tone, critical-health warning and a small decaying additive roll. Local yaw and pitch are preserved. Successful player/creature hits produce a marker and tone only after authoritative confirmation; misses and rock hits do not confirm a living-target hit. Rock, prop and organic impacts have different visual/audio treatment.

The predator now has a reusable articulated six-leg rig, three overlapping dorsal plates, an underside, sensory head, mandibles, antennae, hooked feet and reactive luminescent organs. Breathing, scanning, gait, alert, charge, discharge, melee, stagger and death are driven by server state and actual speed. Foot-height sampling follows the shared terrain; it is approximate procedural placement, not a full animation/IK asset pipeline. Limb segments use one instanced draw per organism, shared geometry/materials and throttled distant detail. Corpses collapse visually and disappear after five seconds; no persistent ragdoll simulation is allocated.

Creature and projectile transforms use the existing snapshot history. Scene memoization now includes effect IDs, so newly created pulses and spores mount reliably. Terrain and rocks add world-space surface-gradient normal detail, wetness-dependent smoothing and a distinct shader cache key. Original synthesized stereo panning and distance attenuation communicate creature alerts, charge, attack, movement and death.

F4 shows collision wireframes, perception sectors, paths, last-known/target rays, melee arcs and projectile velocity. F3 adds health, state, target, path length, attack ID/type, cooldown and AI duration. These tools are development-only.

## Verification actually performed

- Tidefall: **65 tests passed, zero failures**; typecheck and production build passed.
- Resolve: **385 passed, one existing skip**, zero failures; root typecheck passed. The skipped private-corpus fixture is unrelated to Tidefall.
- Camera unit/integration mathematics: repeated turns, pitch clamp, right/left convention, agreement with a real Three.js camera direction, and stale request rejection after release/recapture.
- Perception: 12 m detection, FOV/range rejection, solid cover, gunfire investigation, remembered location, deterministic dry habitat selection across six seeds.
- Combat: ranged windup and travel, swept wall collision, exactly one damage event per spore, melee warning/cooldown, range and committed-arc dodges, death cancellation, physical rifle impulse, occluded rifle shots and dead-shooter rejection.
- Navigation: local A* and an actual Rapier creature moving around a wall without passing through it.
- Presentation: damage-bearing signs, repeated-snapshot feedback deduplication, no hit marker for misses, procedural pose transitions, continuous creature snapshot interpolation.
- Two genuinely independent WebSockets: same target, windup timeline/attack ID, identical projectile positions on the same tick, one shared damage event, victim feedback deduplication, both players damaging the same creature, synchronized death and disconnect continuation. Existing pickup, field, survival, result and rematch checks also pass.
- Two independent browser tabs: different astronaut identities joined the same room, readied, started and displayed two survivors. Detailed synchronized shooting was verified through the two socket clients; it was not a full two-person hardware playtest.
- Live browser encounter: articulated creatures rendered; a ranged windup appeared in diagnostics; health fell in 14-point hits; an unattended astronaut was eliminated with `Stalker spore` attribution; rematch returned to the ready lobby. Movement and the development collision overlay were also exercised. The embedded browser visibly reports its capture restriction.

The environmental full-arc fixture now explicitly disables predators to isolate thermal/tidal survival; separate combat tests cover the newly dangerous idle-player case. Existing movement/prediction fixtures still pass without disabling creatures.

## Measured performance

One local sequential benchmark, seed 42, fixed ticks, 120 warmup steps and 600 measured steps per case, synthetic health reset to keep the encounter running:

| Case | Physics median / p95 / max | AI median / p95 / max |
| --- | --- | --- |
| No live creatures | 0.241 / 0.833 / 3.157 ms | 0.001 / 0.004 / 0.026 ms |
| Three live creatures | 0.355 / 0.935 / 3.272 ms | 0.140 / 0.262 / 2.412 ms |

Repeat with `npx tsx scripts/benchmark.ts`. A separate run concurrent with build/tests produced a 21.36 ms physics outlier; it is recorded rather than treated as representative steady-state performance.

At 1280×720, High, in the local embedded browser's rolling frame sample: warmed preview without creature meshes measured **15.3 ms mean / 16.6 ms p95 / 16.9 ms max**, 59 draw calls and 84k triangles. One live encounter observation measured **17.5 ms mean / 23.7 ms p95 / 40.4 ms max**, 202 calls and 106k triangles. These are observed samples, not a controlled cross-device FPS guarantee; native Edge and other local processes were also open. Smooth 60 FPS on all target hardware is not established.

The production client is about 1.18 MB before gzip; the physics/prediction chunk is about 4.34 MB (1.67 MB gzip). Vite continues to warn about that chunk. Startup cost, draw calls/shadows and simultaneous browser contexts remain material bottlenecks.

## Files and evidence

New: `src/combat.ts`, `creatures.ts`, `navigation.ts`, `feedback.ts`, `CombatOverlay.tsx`, `CreatureView.tsx`, `creature-animation.ts`, `CreatureDiagnostics.tsx`, `tests/round4.test.ts`, `tests/round5.test.ts`, `scripts/benchmark.ts`, and this report.

Updated: `CameraRig.tsx`, `pointer.ts`, `controls.ts`, `model.ts`, `simulation.ts`, `prediction.ts`, `presentation.ts`, `scene.tsx`, `Diagnostics.tsx`, `audio.ts`, `materials.ts`, `main.tsx`, `style.css`, `world.ts`, `tests/network.test.ts`, `tests/survival-arc.test.ts`, `tsconfig.json` and `README.md`.

Actual browser screenshots were displayed during verification. Saved captures are in this chat's visualization folder: `tidefall-round5-combat.png` shows the elimination cause, and `tidefall-round5-encounter.png` shows a live predator on the coast. No video was captured. Generated builds, logs, dependencies and unrelated Resolve changes are excluded from the checkpoint.

## Remaining defects / practical limits, ranked

1. **Manual verification:** the complete hardware matrix (more than 360 degrees, near-vertical look, sprint/jump/fire, Escape and Resume preserving aim) was not rerun. Native free mouse-look was confirmed by the user. In Edge, use F3 to compare yaw/pitch before/after Escape/Resume; turn repeatedly without holding a button, then repeat while sprinting and jumping. Applied-event count should rise and overwrite count stay zero.
2. **Navigation coverage:** routes are local and bounded; complex caves, large cliffs and moving-prop jams can still result in search/retreat rather than an optimal global route. Procedural foot contact and the core hitbox are approximations. Wider terrain/hardware playtesting is still needed.
3. **Performance/presentation:** the large physics download and occasional frame spikes remain. Audio uses stereo panning/distance, not full acoustic occlusion/HRTF. Water impacts and complex status effects are not a separate new simulation. Rigid-body rotation transmission remains an older limitation.

## Run

From `C:\Users\Kyler\Resolve`:

```powershell
npm run tidefall
```

Open **http://localhost:4173/** in Edge or Chrome. Dependencies are already installed. Fresh checkout: `npm --prefix tidefall ci`. Keep the server running; server-source edits reset in-memory rooms.

```powershell
npm --prefix tidefall test
npm --prefix tidefall run typecheck
npm --prefix tidefall run build
npm --prefix tidefall start
```

Production needs a persistent Node host and WebSocket forwarding on the same origin. No public deployment was performed.
