# TIDEFALL — Survive the Planet: Round 8 report

Continues checkpoint `fc8636c` on `codex/tidefall-expedition`. No game restart or parallel engine was introduced. Shared network contracts remain in `src/model.ts`; physics, placement, prediction, water, creatures and inventory extend their existing paths. Resolve application source is unchanged. The previous round reports are historical.

## 1. Root cause of jagged shorelines and hill spikes

The old 129² render grid mapped each vertex to a rounded 65² hydraulic cell. Wet vertices used free-surface elevation; dry vertices used **local bed height minus 8 cm**. Full triangles connected both kinds. A dry hill vertex could therefore pull a water triangle many meters uphill. Interpolated fragment depth/discard and additional wave displacement could hide only part of that already-invalid face. Independent vertex-height easing also lagged wet/dry transitions. This was a render reconstruction/topology defect, not evidence that the conservative solver had generated an equally tall water column.

## 2. Exact water corrections

`hydraulic-surface.ts` reconstructs finite free-surface elevations with a bounded one-cell wet-neighbor extension; it never substitutes a high dry bed as water elevation. Interpolation uses the terrain's triangle convention. `shoreline.ts` clips every actual 2.5 m terrain triangle along its linear depth-zero contour, triangulates only the wet polygon, rejects zero-area faces and emits nonnegative depths. Waves vanish with depth at the contour. There is no independent per-vertex easing across dry terrain.

Rendering, authoritative water contact and client prediction share that reconstruction. The conservative 65²/5 m finite-volume hydraulic state, wetting/drying, connected boundary forcing and audited flux/source volumes remain the authority. The fixed render buffers rebuild only when a new snapshot arrives; wind waves remain GPU cosmetics/shared contact oscillations. Reusable nodes, fast wet/dry branches and allocation-free interpolation cut rebuilding from 18.4 ms median / 26.7 ms p95 initially to **2.85 / 4.70 ms** in the measured run.

Tests cover finite/positive depths, six water regimes, depth-contour clipping, nondegenerate faces, surface-height bounds, all-dry omission, shared server/client contact, resting lakes, conservation and connected wetting/drying. The one-cell shoreline extension is a reduced reconstruction, not increased hydraulic resolution; very narrow sills/channels remain under-resolved.

## 3. Geological formation and transitions

The existing broad uplift, subsidence, fault relief, drainage incision, coastal basin and volcanic rift sequence remains. A cached seeded terrain stage redistributes loose talus while retaining resistant rock scarps and the established spawn pad. The material database now holds density, friction, strength, resistance, conductivity, solubility, permeability and repose angle. Smooth lithological weights replace hard landscape color bands in terrain and rocks; fault/vent fracture masks also influence permeability and chemistry.

Render vertices, Rapier terrain, support footprints and ground queries all consume the same generated heightfield. Static rock friction and dynamic basalt/carbonate properties reference shared geological values. This approximates geological history at generation time; it does not erode the map or dissolve rigid bodies during a match.

## 4. Slopes

The narrow coastal fault transition widened from 8 to 15 m; the volcanic wall transition widened from 11 to 20 m. Twenty conservative relaxation passes move excess loose cover toward lower neighbors using a 32° nominal talus criterion. Bedrock-dominated scarps, outer ridges and prepared spawn terrain are exempt. This is a local transport criterion, not a proof of a global 32° gradient bound on every contact.

A separate three-seed scan (`42`, `38969`, `82300`) checked 2,053 sediment-dominated locations: maximum sampled slope **26.54°**, zero above 33°. Shared-surface, geological-contact and deterministic-generation checks pass. Shelter placement searches up to 36 m around its nominal site; the regression run found and repaired an earlier random-seed failure rather than accepting an unsupported footing.

## 5. Creature effectiveness and behavior

Stalker sensing increases to 36 m, chase speed to 5.7 m/s and melee cooldown to 1.65 s. Melee rises modestly to 28 damage; spores to 26: four substantial hits can eliminate an unprepared suit. Existing line-of-sight, windup, committed strike direction, projectile sweeps, stagger, cover/navigation and physical drops remain. Reef Burrowers defend their home region (16 m) or retaliate when hurt instead of treating every distant suit as prey.

Coastal depth/current/temperature limits and storm retreat remain physical event responses. Coarse productivity limits further encounters and eligible habitat locations; arrivals remain bounded rather than unlimited timer-generated populations. Pyrax retains separate heat-tolerant drones and tracked sentinels. No conventional exposed biology or vegetation is generated there. Existing planted-foot procedural rigs remain; the trait model ties support proportions to gravity and distinguishes ecological roles. This is a small template grammar, not simulated evolution, full swimming or excavated burrowing.

## 6. Faster, measured tsunami

Moving the source into a dry low-tide coast failed calibration: it did not create a useful incoming wave. The selected scenario instead warns at **1:15**, releases at **1:30**, and uses a nearer submerged source at approximately `(seeded x ±15 m, z=50 m)`, 16 m characteristic radius and 8 m source amplitude. The same depth-dependent solver propagates it; no projectile-like speed multiplier was added.

The reference benchmark at source x=0 measured warning-to-hazard times of **15.0, 16.3, 19.8 and 21.6 s** at z=35, 20, 0 and -10 m. Hazard means >0.5 m additional depth or >1 m/s current difference from a matched no-event basin. Maximum sampled additional inundation was **2.37 m**, current difference **22.83 m/s**, and volume-accounting residual approximately **5.1×10⁻⁹ m³**. These are gameplay-model results for one seed/path, not real-exoplanet predictions or guaranteed arrival times everywhere.

The disturbance is an initial sea-surface displacement from a modeled submarine slip. Moving seafloor rupture, breaking waves and full momentum advection remain absent. Actual currents affect swim movement, buoyant objects, route availability and coastal creature retreat. Character current input is capped and dynamic drops use CCD; extreme shallow-cell currents still warrant broader stress testing.

## 7. Physical extraction and multiplayer

The server announces rescue at **5:00**, starts approach at **5:20**, descends to a validated landing site at **6:00**, opens boarding for **55 seconds**, departs at **6:55** and finalizes at **7:10**. Several candidate sites are checked for complete footprint variation, slope, water and solid clearance. The flight stays high over regional terrain, then descends vertically through the clear landing column. It is prescribed flight, not orbital mechanics.

A cargo rescue model, engine pods/plumes, lighting, solid hull and deployed front stair/ramp use shared part dimensions. Server and prediction update the same collision parts. E boarding requires a live connected suit, the correct phase, local boarding region and unobstructed access; remote/early boarding fails. Boarding disables combat/physical exposure, records extraction and prevents return. The aboard camera follows the ship. Extracted players rank above deaths, then by remaining health; equal health ties. All extracted suits receive the same 7:10 survival duration, so earlier boarding does not earn extra survival time. Existing earlier last-survivor wins remain.

Two independent WebSockets verified approach, identical ship/field snapshots, forbidden distant boarding, both boards, departure, unequal-health ranking and matching results. **Two independent browser clients also walked to the ramp with WASD, pressed E, and displayed the same shared extraction result.** Staged health protection made the browser result an equal-health tie; the unequal-health result is covered by the network test. If no site can be validated, the nine-minute fallback reports stranded suits, not fictitious successful extraction.

## 8. Collection and inventory

Loose creature resources and portable consumables collect within 1.55 m through the existing exclusive server grant/capacity routine. Visibility prevents collection through solids. Mineral nodes, liners, the floating crate and shelters retain E interactions. Physical loose resources now use small, density-consistent dimensions: creature drops are at most 15 kg, and portable classification also checks radius. Large bodies remain in-world for pushing or the existing field equipment.

Tab retains direct H/O/B/T use, descriptions/counts, field conversion and chart, and adds discovery records and drop buttons. Dropped reserves create bounded physical items, decrement the authoritative inventory once and have a short pickup delay. Invalid/prototype and cross-world canister kinds are rejected. General inventory storage for arbitrary non-resource objects is not implemented; this round covers meaningful consumables/resources rather than putting boulders or living animals into the kit.

## 9. Shared planetary profile and physics

The retained NASA Archive records provide source query/date and catalog constraints; asymmetric mass/radius uncertainties survive in typed observational metadata. Missing stellar metallicity stays null. Values expose units, evidence category, dependencies, assumptions, source and uncertainty fields. Versioned `coast-v8` / `chassis-v8` scenarios separate gas composition, pressure, albedo, redistribution, greenhouse offset, salinity, heat flux, geological history and biological assumptions.

Reusable tested functions calculate GM/R² gravity, escape speed, equilibrium temperature, gas-mixture molar mass, ideal-gas density, scale height, approximate vapor saturation, saline density/viscosity/freezing and blackbody spectral color ratios. Baseline air temperature explicitly combines equilibrium temperature with modeled redistribution/greenhouse terms. Equilibrium temperature is never labeled actual surface temperature. `SIM-M01` is a stable synthetic satellite identifier: modeled/unconfirmed, with parent, mass/radius/orbit/phase and limited stability statement. Instant Roche/Hill screening remains; long-term migration lifetime is unknown.

## 10. Implemented couplings and update ownership

- Observed stellar/planetary inputs plus explicit scenario assumptions determine gravity, baseline thermal load, air density, spectrum and scale height.
- Modeled H₂O abundance, pressure, temperature and parcel cooling determine condensation/cloud fraction. Pyrax has no modeled water clouds; ash remains a separate obscurant.
- Light/clouds, moisture and temperature drive statistical productivity; productivity bounds coastal encounters and vegetation placement.
- Fracture/lithology masks influence permeability, hydrothermal chemical supply and visible mineral context.
- A 17² field updates every two seconds: upstream transport, moisture/salinity changes, hydrothermal supply, simplified microbial reaction, then habitat productivity. Microbial consumption feeds back on reduced-sulfur availability.
- Tides/inundation change moisture, chemistry transport, habitat access and density/viscosity-dependent water forces. Exposure includes direct corrosive-brine contact where the local modeled chemistry supports it, without instantaneous infection.

Fast movement/contacts/projectiles/ship collision remain fixed-step. Static terrain/materials cache per seed. The solver and slow fields precede AI/exposure/object forces; clients receive seed, time, coarse state and authoritative outcomes. Chemical advection is a bounded reduced concentration model, not conservative reactive transport. Ocean baseline temperature is an assumed thermal reservoir; full ocean heat transport, atmospheric mass exchange and climate evolution are not solved.

## 11. Organism generation and adaptation

A small ecological grammar selects coastal biological roles versus protected volcanic machinery, with gravity-related support, pressure/solvent/temperature suitability, phototrophic production and hydrothermal energy proxies. Six-limbed low-body coastal locomotion and armored territorial behavior reuse the established reliable rig/controller. Initial habitat checks and later arrivals use actual dry/thermal/clearance conditions, and the finite encounter budget reads productivity. There is no unsupported large-animal biosphere on Pyrax.

This is evolutionary-history-inspired scenario design. It is not a quantitative food-web energetics model, offspring simulation or proof that these organisms could evolve on TRAPPIST-1 e. Microbial activity is a coarse speculative field, not thousands of actors or an infectious-enemy mechanic.

## 12. Automatic scientific inspection

The white reticle now shows a compact **upper-left panel automatically after a stable dwell**. I is no longer required; the old separate celestial panel is removed. Nearby physical hits take priority through the prediction world's raycast and scene metadata. Water uses the shared hydraulic field. Celestial selection keeps angular coordinates, atmospheric visibility and terrain occlusion; optional N scanner still identifies faint targets without brightening them.

Panels cover geological material, liquids/current/salinity, weather/pressure, creatures, vegetation, supplies, physical objects, shelters, rescue ship and celestial objects, with clear modeled/observed/derived/speculative status. Unknown values are omitted or null. A bounded 48-entry session discovery log in Tab records identity, planet, location and explanation. Explanations use actual tide/event/chemical state rather than unrelated narrative. Browser inspection demonstrated automatic water, geological, atmosphere and creature panels; Round 7's catalog transform/selection tests also remain green. A full Round 8 browser sweep of every star/moon/planet label was not performed.

## 13. Scientific evidence and assumptions

TRAPPIST-1 e and 55 Cancri e remain the real reference planets. Observations do not establish either world's detailed surface, local weather, pressure, biology or moon. The Archive composite table can combine publications and is explicitly not represented as a single internally fitted interior model. Scientific references consulted/reused:

- [NASA Archive parameter definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
- [NASA TAP guidance](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html)
- [USGS water density](https://www.usgs.gov/water-science-school/science/water-density)
- [TRAPPIST-1 e](https://science.nasa.gov/exoplanet-catalog/trappist-1-e/) and [55 Cancri e atmospheric evidence](https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/) retained from Round 7

The marine atmosphere/ocean/biology, satellite and protected robotic nightside exploration are assumptions, not astronomical discoveries. HYG attribution/CC BY-SA catalog data terms remain in `src/data/README.md`.

## 14. Performance measurements

`npx tsx scripts/round8-benchmark.ts` samples 900 ticks/world, discards 180 warmup ticks and retains 720 samples. Complete server-step median/p95: **Tidefall 0.814/2.302 ms; Pyrax 0.462/1.043 ms**. Maxima: 6.17 and 3.15 ms. Hydraulic advance of 100 ms simulation time costs 0.449 ms median / 0.631 ms p95 in the event run. Shoreline reconstruction: 2.85/4.70 ms; 46,476 emitted vertices in the measured view/state. This is CPU reconstruction cost, not isolated GPU terrain time.

The short-run heap deltas were +4.41 MB / -1.67 MB (GC-dependent, not a leak test). Full JSON snapshot sizes were approximately 91.3/66.5 kB; at 10 Hz, uncompressed payload is about 0.91/0.67 MB/s per client before framing. Further packing/deltas would be valuable. A two-client 1280×720 embedded-browser storm view on High recorded **27 FPS, 36.4 ms frame, 42.2 ms p95, 151 draw calls and 164k triangles**, with ~1 ms local RTT. Deliberate fixture teleports/clock jumps generated corrections; these are not evidence of normal-play correction frequency. Native GPU profiling and isolated terrain timing are unmeasured. High graphics still needs optimization.

## 15. Tests and visual evidence

Final Tidefall: **107 passed, 0 failed**; typecheck passed; production build passed with the existing large-chunk warning; production health/HTML/two referenced assets smoke passed. Five independent-WebSocket tests ran. Resolve root: **385 passed, 1 private-fixture skip**, typecheck passed. Earlier highly parallel runs hit network welcome deadlines under CPU load. The test command now limits test-file concurrency to two; the final complete run passed all 107 tests in 37.0 seconds. A compile-time overly narrow moon-parameter type was fixed and final typecheck rerun successfully.

Actual local browser captures live in `C:/Users/Kyler/.codex/visualizations/2026/10/27/01a17ca5-3a0b-7fc3-9d88-a4b268b141d6/`:

- `tidefall-round8-before-shore.png` / `tidefall-round8-after-steep-shore.png`: same seed 38969 and nominal steep-coast location; materials, water state and camera placement are not a pixel-identical controlled render.
- `tidefall-round8-beach.png`, `tidefall-round8-inlet.png`, `tidefall-round8-flooded-cave.png`, `tidefall-round8-tsunami-inundation.png`, `tidefall-round8-high-tide.png`: different terrain/water regimes inspected for climbing faces, cracks and penetration. Underwater views still expose the affordable triangulated surface/transparent rendering style.
- `tidefall-round8-rescue-approach.png`, `tidefall-round8-rescue-landed.png`, `tidefall-round8-extraction-results.png`: shared ship, ramp and actual two-browser boarding/result verification.
- `tidefall-round8-creature-encounter.png`: staged creature target, automatic inspection and keyboard rifle discharge/tracer from the muzzle.
- `tidefall-round8-performance.png`: live High diagnostics.

Captures use the isolated local stdin preview harness to select a seed, place actors, advance/freeze environmental time and protect health. They are staged regression inspections, not an unmodified human match. No new public debug endpoint exists. The embedded host blocks Pointer Lock; native mouse capture, unlimited turning and native firing were not re-certified. Existing pointer/prediction regression tests remain green. The normal development listener was restored and `/health` confirmed readiness on port 4173. Public hosting and Docker execution were not performed.

## 16. Remaining defects/limits by severity

1. **High:** High graphics is below 60 FPS in the embedded browser; full snapshots are bandwidth-heavy. Native input/GPU and prolonged four-player latency/soak testing remain necessary.
2. **Medium:** 5 m reduced hydrodynamics and one-cell contour reconstruction cannot resolve narrow barriers, breaking waves or all underwater transparency artifacts. Event danger/arrival has been calibrated for reference stations, not every seed.
3. **Medium:** Ship model/flight are intentionally simple; ecology, chemistry, thermal reservoirs and anatomical support are reduced scenario proxies. General carrying/storage of arbitrary non-resource objects, true burrowing/swimming rigs and biological food-web conservation remain future work.
4. **Medium:** Outer jet-accessible safety clamps from Round 7 remain. Long-term exomoon stability, precision ephemerides and full atmospheric/chemical transport are unresolved. No additional ice world was added.
5. **Low:** Discovery history is bounded session memory rather than a persistent cross-match encyclopedia; touch-device and exhaustive celestial-label browser QA remain outstanding.

## 17. Exact run and deployment commands

PowerShell, fresh install only requires `ci`:

```powershell
Set-Location C:\Users\Kyler\Resolve
npm --prefix tidefall ci
npm run tidefall
# Open http://localhost:4173/ in Edge or Chrome; keep the process running.
```

Validation/production:

```powershell
Set-Location C:\Users\Kyler\Resolve\tidefall
npm test
npm run typecheck
npm run build
npx tsx scripts/production-smoke.ts
npx tsx scripts/round8-benchmark.ts
npm start
```

HTTP, `/health` and `/ws` share PORT 4173. HOST defaults to `::`; use `127.0.0.1` for local-only binding. Production requires a persistent Node host, HTTPS and WebSocket upgrade forwarding. Rooms are single-process/in-memory and reset on restart. No live astronomy service is required during play. Container instructions supplied, not executed:

```powershell
Set-Location C:\Users\Kyler\Resolve
docker build -t tidefall-round8 .\tidefall
docker run --rm --name tidefall-round8 -p 4173:4173 tidefall-round8
```

## 18. Three highest-value remaining improvements

1. Profile native GPU terrain/shadows and ship/inspection costs; pack/delta coarse fields and water snapshots, and run a sustained four-player session with native Pointer Lock certification.
2. Test multiple coastal paths/seeds and abrupt inundation against higher-resolution reference scenes, improving narrow-sill/underwater rendering while preserving conservation and shared contact geometry.
3. Polish the cargo rescue silhouette/boarding presentation and creature rigs, then strengthen ecological energy/chemistry accounting before adding species or planets.
