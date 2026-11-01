# Round 2 — stability, immersion and expedition gameplay

October 27, 2026. This extends the existing Tidefall application and its Rapier, WebSocket, water and astronomy systems. Resolve source and unrelated working changes were preserved. No dependency migration or public deployment was performed.

## 1. Localhost diagnosis and startup

The supplied page was unreachable because no process was listening on port 4173: the earlier preview had been stopped. The repository's ordinary `npm run dev` launches Resolve, not Tidefall; the game previously required changing into its subdirectory. Its server used a single IPv4 bind and did not watch backend changes. These made the correct service easy to miss or leave stale. Missing dependencies and a frontend proxy were not the reproduced cause.

The root now has an explicit `tidefall` script. One watched process starts HTTP, authoritative `/ws`, and Vite HMR `/vite-hmr` on the same port. The default dual-stack bind supports IPv4/IPv6 localhost. HOST and PORT are configurable; startup prints the address and socket path. `/health` identifies Tidefall. Port conflicts are reported without killing another service. Shutdown closes HMR sockets before shared HTTP, fixing a close/restart hang discovered by the new startup test. A loading/retry view and connection indicator expose startup, joining and reconnect failures.

From any directory, with this workspace's installed dependencies:

```powershell
npm --prefix C:\Users\Kyler\Resolve run tidefall
```

Open [localhost:4173](http://localhost:4173/) or [127.0.0.1:4173](http://127.0.0.1:4173/). Keep the command running. The final watched server was left running; a fresh browser loaded the application. HTTP `/`, `/src/main.tsx` and `/health` were checked. Fresh checkout: `npm --prefix tidefall ci` from the repository root. Production: `npm --prefix tidefall run build`, then `npm --prefix tidefall start`. A remote/container host needs a reachable address or forwarding; its localhost is not automatically the user's computer.

## 2–4. Movement, jump and camera causes and repairs

The old local avatar followed authoritative 10 Hz snapshots, extrapolating horizontally while retaining snapshot vertical positions. The camera independently eased toward another target at a different rate. This caused visible disagreement and stair-step jumping despite a fixed server loop. There was no local prediction or input acknowledgement/replay. Ground snap remained enabled during ascent, thrust immediately followed jumping, and the swim response fought gravity. The camera clamped pitch to `[-0.15, 0.95]` and only changed a height offset (`3 + pitch * 4`), rather than orbiting a sphere.

The repair establishes explicit physics authority and presentation:

* A fixed 60 Hz accumulator drives server physics. Water advances at 20 Hz with internal stable substeps; snapshots remain 10 Hz.
* Server and local prediction use the same capsule locomotion and static collision construction. Sequence acknowledgements discard consumed commands and replay pending inputs. Avatar and camera share one interpolated local position. Snapshot receipt preserves the actual rendered position and interpolation history. Presentation offsets never move the authoritative body.
* Remote avatars use a 120 ms snapshot buffer, including vertical position and shortest-path yaw.
* Contact queries drive grounding. Small autosteps, slope limits, 100 ms coyote time and 120 ms jump buffering improve traversal. Ascending motion disables ground snap. A 160 ms airborne hold separates jumping from thrust; fuel use/recharge is deterministic.
* Suit flotation supports weight and seeks a breathable draft. Hold C to dive, release to float up, and Space for thrust. The late dive repair has both browser interaction coverage and a six-second numerical descent / seven-second resurfacing regression.
* Spherical orbit permits full yaw and ±80° pitch. Collision rays include shared terrain, cave and structures; the local avatar hides when too close. Pointer lock has a drag fallback, sensitivity, Y inversion, arrow-key look and touch controls. Looking does not fire a field.

Dynamic rocks remain authoritative. Prediction treats their last received positions as kinematic obstacles, so contact/force interactions can still require corrections.

## 5. Geological and visual improvements

The compact map and key mission coordinates remain. Deterministic terrain now combines tilted uplift, a fault escarpment, branching drainage cuts, sediment flats, shelves, channels, an island and an eastern volcanic source. Terrain rendering/collision share 129×129 vertices at 2.5 m spacing. The natural fracture-aligned cavern arch uses the same shell for rendering and physics. This is erosion-informed procedural construction, not a geological-history simulation.

World-space bedding, a seamless small grain texture, regional masks and restrained mineral coloration distinguish carbonate, regolith, sediment and basalt. Vegetation placement uses slope, elevation, tidal salinity and hydrothermal-source distance; instancing and inexpensive wind motion keep cost bounded. The moon adds procedural maria/craters, relief and star-oriented illumination. Its approximately 20° visible diameter is intentional artistic enlargement, roughly twelve times the configured physical angular diameter. Sky gradient, haze, distant ridges, warm lighting, underwater tint, animated limbs, exhaust and a suit lamp improve depth and motion.

The connected shallow-water model was preserved. Water vertices interpolate numerical elevations with fixed index topology. Depth color, Fresnel response, shoreline/obstacle foam, glints and wave detail improve the surface. Wetness and optics remain visual approximations. Numerical dry sills still control connected flooding; disconnected depressions do not simply receive a global ocean plane. Separate cave meshes do not obstruct the hydraulic grid; body-displaced water, breaking waves and full advective momentum remain omitted.

Performance work includes replacing expensive fragment trigonometric grain with a small procedural texture, memoizing scene topology/events, instancing vegetation/details, replacing hundreds of React radar cells with a canvas, bounding HUD updates and lazy-loading prediction/Rapier after joining. F3 exposes rolling mean/p95/max frame time, FPS, physics duration, RTT, corrections, ground state, pitch, pending commands and scene counts. Low graphics mode reduces rendering cost.

## 6. Mission experience

The lobby states **recover three cores → restore the observatory beacon → return to the lander**, shows teammates/controls and offers Launch Expedition. A skippable 3.5-second survey introduces the coast. Persistent stages, bearing/distance, contextual guidance, radar and tide/extraction clocks explain the current task.

The cavern is a low-tide traversal encounter; flooded collection is rejected by authority. The hydrothermal core requires actual displacement of a shared porous boulder. The observatory core can require swimming/diving. All three enable E at the submerged relay pedestal; its restored beacon then enables E extraction at the lander. Success/failure summaries explain outcomes and score cores, beacon, crew, time and recoveries. Same-seed/new-world rematches remain.

The field tool has an aim ghost, range feedback and object lines, and affects boulders, floating objects and teammates. Its bounded actuator was retuned to a 70 kN cap with a softened range-limited kernel, acceleration cap and finite charge. A small lander-side boulder supports practice. Original synthesized surf, wind, steam, footsteps, thrust, tool/discovery feedback and tide warnings replace the simple drone. These are approximations, not a spatial acoustic solver.

## 7. Changed files

* `../package.json`: explicit root game command.
* `package.json`, `server.ts`, `index.html`: watched same-port startup, hosting lifecycle and visible loading fallback.
* `src/model.ts`, `src/geometry.ts`, `src/world.ts`: shared game contracts, deterministic geology and common collision construction.
* `src/locomotion.ts`, `src/prediction.ts`, `src/presentation.ts`, `src/client.ts`: fixed controller, prediction/replay, buffered presentation, diagnostics data and connection lifecycle.
* `src/CameraRig.tsx`, `src/controls.ts`, `src/Diagnostics.tsx`: orbit/input, camera collision, controls and development measurements.
* `src/simulation.ts`, `src/mission.ts`: mission gates, wayfinding, fields, hazards and scoring.
* `src/landscape.tsx`, `src/materials.ts`, `src/scene.tsx`, `src/FieldEffects.tsx`, `src/audio.ts`: terrain/water, atmosphere/moon, plants/avatar animation, tool/audio feedback.
* `src/main.tsx`, `src/style.css`: lobby, HUD, radar, settings, touch and summary.
* `tests/game.test.ts`, `tests/network.test.ts`, `tests/movement.test.ts`, `tests/mission.test.ts`, `tests/startup.test.ts`, `tests/preview.ts`: regressions, multiplayer lifecycle and isolated visual fixtures.
* `README.md`, `VERIFICATION.md`, `ROUND2.md`: operating instructions, evidence and limits.

## 8. Tests and browser evidence

| Check | Result |
| --- | --- |
| Tidefall `npm test` | **31 passed, 0 failed, 0 skipped** |
| Tidefall `npm run typecheck` | Passed |
| Tidefall `npm run build` | Passed; main JS 323.54 KB gzip, lazy prediction/Rapier 1,670.40 KB gzip |
| Resolve `npm test` | **386 total: 385 passed, 0 failed, 1 skipped** |
| Resolve `npm run typecheck -- --incremental false` | Passed |
| Startup integration | HTTP frontend, transformed entry and game WebSocket on one port; port-conflict rejection, clean close and restart |
| Real WebSockets | Shared seed/time, core deduplication, fields/body snapshots, reconnect secret, beacon, both extraction actions, matching success/score, new-seed rematch |
| Browser console | No errors in the final two-client dive/beacon/extraction flow |

The optional Resolve real-PDF/OCR Foundation Schedule test remains skipped for missing prerequisites. Incremental output was disabled to avoid the pre-existing locked build-info file. No generated Resolve output belongs to this change. Vite's large lazy WASM warning remains. Fiber still emits a THREE.Clock deprecation warning; the former soft-shadow warning was removed by choosing a supported shadow type.

New regressions cover identical locomotion at 30/60/144 render FPS, stable ground contact, jump impulse/ascent, shared prediction, 100 ms delayed reconciliation, exact continuity on snapshot receipt, remote vertical interpolation, ±80° orbit/yaw wrap, strafe conventions, flotation/diving, gated cores, beacon/extraction and startup lifecycle. Existing orbital scaling/gravity, hydraulic barriers/volume/nonnegative states, flood/recession, buoyancy/drag, bounded force and finite-transform tests continue passing.

Actual browser testing included held walking/sprinting across regions, jumping/thrust, nearby walls and cavern camera collision, ±80° extremes, inversion/low graphics, physical boulder removal, two shared core recoveries, refresh/reconnect and an 80 ms delayed client. An unassisted attempt reached the vent and cavern cores but **did not complete the full expedition**. It exposed missing controlled diving, subsequently repaired.

The final dedicated visual-QA room used `tests/preview.ts` stdin fixtures to advance water numerically, relocate the crew and supply the other cores. From a staged surface arrival, actual C/E recovered the observatory core. Actual diving/movement/E restored the submerged relay. Both clients then used E after staged return travel and showed **3 cores, restored beacon, 2 returned crew, score 5,567**. Staged travel/inventory is not an unassisted victory; fixture corrections do not represent normal movement jitter.

One warmed single embedded view measured **80 FPS, 12.5 ms mean, 14.7 ms p95**, and approximately 17–20 ms maximum at that observation. Two canvases sharing the host typically measured about 30–48 FPS; a delayed low-mode movement run measured 41 FPS / 33.3 ms p95. Startup/context switches produced much longer frames. These are local observations, not universal 60 FPS certification. An earlier correction counter included presentation offsets; the final counter measures simulation error, so historical totals are not directly comparable. The exact snapshot-continuity test covers the resulting repair.

A subsequent final-controller single-view smoke held movement for 24 seconds and sprint/thrust for 2.5 seconds: 53 FPS, 19.0 ms mean, 34.6 ms p95 and 54.4 ms maximum at capture, with fuel reduced to 44 and health 100. Its correction count rose from two launch-settling events to four. This confirms usable continuous control, but also shows that sustained 60 FPS and zero corrections are not achieved in every local run.

Actual captures in the ignored local `screenshots/round2/` directory:

| File | Evidence |
| --- | --- |
| `01-single-view-performance.png` | Warm single-view diagnostics |
| `02-landscape.png` | Final coastal composition |
| `03-cavern-core.png` | Unassisted second core inside cavern |
| `04-delayed-client-movement.png` | Two avatars after continuous delayed movement; predates final counter repair |
| `05-camera-up-80.png`, `06-camera-down-80.png` | Sky at −80°, ground at +80° |
| `07-observatory-dive.png` | Actual submerged recovery after staged surface arrival |
| `08-beacon-restored.png` | Shared result after actual relay interaction |
| `09-team-extracted.png` | Matching two-client success, staged inventory/travel |
| `10-final-movement-thrust.png` | Final-controller sustained movement/thrust and measured frame budget |

No independent WAN, four-player load, physical mobile device, complete manual final victory, Docker execution or public hosting is claimed. Touch/audio/environmental art need device/listening and playtest feedback. Scientific limits are detailed in README: reduced local-inertial flow, parametric chemistry, speculative force actuator, fixed-density buoyancy and artistic astronomical scaling.

## 9. Commands and URLs

The exact absolute development command and both local URLs are above. From the repository root:

```powershell
npm --prefix tidefall test
npm --prefix tidefall run typecheck
npm --prefix tidefall run build
npm test
npm run typecheck -- --incremental false
```

## 10. Remaining issues, ranked

**Medium:** Two embedded views do not consistently meet 60 FPS here. Dynamic-object/field contacts can require corrections because prediction lacks authoritative rigid-body history. Large lazy WASM affects first join. WAN/four-player/mobile and complete unassisted final mission remain unverified; dive/return difficulty needs playtesting before submission.

**Medium, hosting:** Rooms remain single-process/in-memory and disappear on restart. Production requires a persistent WebSocket-capable host; cross-process routing and persistence are absent.

**Low:** Backend hot restarts reset development rooms; an already loaded page may need Retry/reload before hosting anew. THREE.Clock emits a compatibility warning. Surface art/collision and the reduced water/chemistry/audio models retain documented approximations. Optional discovery progression and transmitted rigid-body rotations remain absent.

No critical startup, baseline locomotion/jump, restricted-pitch or mission-state blocker remained in the tested flows. This is bounded by the stated coverage.

## 11. Next three priorities

1. Run complete timed expeditions with independent players on two remote machines, including loss/jitter and four-player reconnects; tune cave, dive, relay and extraction windows from results.
2. Profile GPU cost on representative desktop/mobile hardware, reduce water/shadow/material cost and improve first-join WASM delivery. Reproduce dynamic-contact corrections before expanding prediction complexity.
3. Refine cave/observatory routes and environmental storytelling from playtests, with a teachable gravity-tool encounter and stronger spatial sound; retain authoritative water and mission gates.
