# TIDEFALL Round 7 — implementation and verification

Implemented in the existing game on `codex/tidefall-expedition`; the previous Round 6 checkpoint is `0074c33`. Resolve's application code and unrelated generated changes are outside this checkpoint. The existing `src/model.ts` remains the shared gameplay contract, extended for thermal stages, quick supplies, resource generations, species and geological events. Render/collision foundations and rifle transforms are centralized rather than duplicated.

## 1. Rock-shadow diagnosis and repair

The old directional shadow used a roughly 200 m / 1024-texel footprint and a -0.001 bias across about 500 m of light-space depth: approximately 20 cm shadow texels and 50 cm depth displacement. This combination produced coarse, detached dark patches near rocks. There is no SSAO, contact-shadow postprocess or cascaded-shadow system in this renderer, so removing an imagined AO pass would not address this pipeline. Rocks use ordinary single-sided shared geometry/materials.

The light now follows the player, with a 128 m / 2048-texel coverage (~6.25 cm), a 1–360 m shadow range, -0.00004 bias, 0.035 m normal bias and restrained filtering. Terrain and rocks receive the same directional shadow. Browser captures show coherent contact in the inspected coastal view; exhaustive solar-elevation/distance sweeps were not performed. Synchronous worlds deliberately do not cycle through an invented Earth day.

## 2. Ground contact and foundations

`placement.ts` samples 25 points across each complete shelter footprint and searches nearby sites, rejecting height variation above 2.8 m. Floors sit above the highest sampled terrain. Four footings sample their own footprints and bury their bases; an entrance stair connects to the local surface. The exact cuboid parts drive both Rapier collision and visible meshes. Shelters, seals, map locations and their insulation pickups use the relocated placement. Rocks avoid shelter clearances. Small supplies sample their footprint with slight burial rather than using an unchecked center pivot. Four-seed tests check all support bases, floor separation and render/collider parts.

## 3. Hostiles, morphology and locomotion

Tidefall retains speculative coastal biology: quick six-limbed Tidal Stalkers and heavier armored Reef Burrowers (the historical internal key remains `ridgeback`). Stance feet retain world-space plants, swing feet lift, gaits depend on speed, and bodies follow slope. Current/depth limits cause coastal creatures to retreat. Existing perception, remembered targets, navigation, attack windup, stagger, cover tests and death/physical loot stay integrated.

Pyrax has separate mechanical meshes and behavior: hovering articulated surveyors with visible propulsion and ion projectiles, and tracked armored sentinels with charge attacks and a rear reactor weak region. Hovering is an explicit controller rather than unexplained floating anatomy. Mechanical heat, water tolerance and darkness sensing differ from biology. Initial habitats use terrain, heat, water and solid-clearance checks.

Stalker melee is 26 damage (four hits from full health), spores 24 (five hits), Burrower charge 36 (three hits), surveyor ion hits 26 and sentinel charge 38. Attacks remain telegraphed and collision/line-of-sight validated. Foot sliding is reduced, but the rigs are procedural articulated meshes, not production skeletal assets or a full biomechanical solver. Burrow excavation/subsurface simulation is not implemented. CRYON and its ice ecology are deferred; this release concentrates on the two existing worlds.

## 4. Exposure and survival balance

A lumped thermal model uses 140 kJ/K effective heat capacity, metabolism/activity, controlled suit heat, wind-dependent air exchange, much stronger immersion exchange, wetness, insulation, shelter and thermal supplies. Stages are normal, cold (<36°C), severe (<35°C, modest movement penalty) and critical (<33.5°C). Health loss requires sustained critical exposure and is bounded at 4 HP/s. Drowning/thermal damage use the worst current exposure rather than stacking several unexplained drains. Shelter and thermal treatment recover core temperature; compounds regulate toward 37°C for 60 seconds.

Tests cover minutes of ordinary exposure, faster immersion, warning progression, insulation and recovery. Pyrax uses an explicitly fictional shielded robotic chassis: external 900°C-plus load maps into an internal equipment temperature envelope; it is not a claim humans can stand on 55 Cancri e. Coolant replaces oxygen supplies there. At nine minutes, surviving players now extract and share first place instead of being killed by a fabricated instantaneous cryogenic collapse. Earlier last-survivor outcomes and same-tick elimination ties remain.

## 5. Immediate medical use and replenishment

H consumes one med reserve and restores 32 HP immediately through the server. Full health does not waste treatment; a one-second cooldown prevents rapid repeated use. Compact contextual buttons and the kit expose the same actions. Capacity is two medical reserves. Authoritative feedback confirms collection/use and health change.

The resource director checks every five seconds, targets two dry accessible medical supplies (three for larger crews), and reuses a maximum of five generated slots. It rotates among twelve eligible sites with 55–95-second cooldowns informed by crew/time, avoids survivors within 10 m, checks slope, water, heat, solid clearance and nearby supplies. Uncollected generated supplies expire after 120 seconds with a reuse delay. IDs plus generations and exclusive server collection prevent duplicates. Availability is a target subject to valid terrain and cooldowns, not a guarantee of a medkit at every moment.

## 6. Useful resources and drops

O uses stored oxygen on Tidefall or coolant on Pyrax; B uses a stored energy cell; T uses a thermal compound. Cells/compounds cap at two and are not wasted when inappropriate; mineral reserves cap at nine. Existing mineral conversion, liners, floating crate and finite field remain. Biological enemies drop healing tissue/plating/minerals; machines drop circuit cells/alloy/minerals. The existing finite dynamic-loot pool, physical terrain/water interaction, exclusive pickup and 90-second expiry remain authoritative. There is no new unbounded material inventory.

## 7. Tides and geological long waves

The assumed 2×10²¹ kg satellite at 28,000 km drives the existing star/planet/moon forcing. The Tidefall astronomical sea boundary is about 5 ±14 m before storm surge, compared with the earlier ±7.5 m. The basin-response coefficient is an explicit 0.72 game reconstruction. The semidiurnal period is compressed to 480 game seconds. Roche/Hill screening passes for the chosen instantaneous configuration; long-term tidal migration/lifetime is NOT solved and this is NOT evidence of a real exomoon.

A separate server event warns at 210 s and releases at 240 s. Localized 6 m Gaussian uplift/subsidence around a seeded offshore point initializes a sea-surface disturbance in wet cells. Its actual volume change is recorded. The existing 65×65, 5 m conservative reduced local-inertial solver then propagates it with depth-dependent stable steps; no moving wall or globally assigned tsunami height is used. Tests verify locality, finite nonnegative depths, source-volume accounting, faster arrival in deeper water and exactly one release. This approximates initial sea-surface displacement, not dynamic rupture or a resolved moving seabed. It is one event per match, not a regional earthquake generator.

Player swimming now follows water-relative velocity, so input damping no longer erases most current transport. Existing physical buoyancy/current drag affects movable bodies. Two browsers displayed the same warning countdown and subsequent hazard state. The staged photograph proves the warning/scene integration; it is not a measurement of catastrophic wave height. Coastal amplification and dramatic inundation need further playtesting/calibration.

## 8. Terrain, water, sky and materials

Ground uses a baked mipmapped multiscale grain/fracture/mineral texture with triplanar projection, roughness variation and slope-masked bedding. A single instanced gravel batch adds partly buried small stones. Repeating sinusoidal contour-like cracks were removed. Water retains the established depth coloration, Fresnel/reflection, normal waves, shoreline foam and shared hydraulic surface; this round strengthens the underlying tide/current/event behavior rather than replacing it with disconnected water effects.

The sky now uses wavelength-dependent Rayleigh and Henyey–Greenstein Mie approximations, atmospheric column, aerosols, stellar spectrum, solar altitude and clouds. It is an affordable appearance model, not calibrated radiative transfer. The host disc uses stellar radius/orbital distance; the hypothetical moon now uses its physical angular diameter (~2.14°), without the previous sixfold enlargement. A correctly oriented Galactic-pole band is illustrative, not a measured sky photograph.

## 9. Real exoplanets and sources

Tidefall uses TRAPPIST-1 e; Pyrax uses 55 Cancri e. Bundled NASA Exoplanet Archive composite records retain the exact query, retrieval date, measured/derived fields and asymmetric mass/radius uncertainties. Scientific sources:

- [NASA Archive parameter definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
- [TRAPPIST-1 e](https://science.nasa.gov/exoplanet-catalog/trappist-1-e/)
- [55 Cancri e](https://science.nasa.gov/exoplanet-catalog/55-cancri-e/)
- [Webb atmospheric evidence for 55 Cancri e](https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/)
- [Hu et al. 2024](https://www.nature.com/articles/s41586-024-07432-x)

## 10. Measurements, models and speculation

TRAPPIST-1 e's bundled constraints include 0.692 Earth masses, 0.920 Earth radii, 6.101013-day period and 0.02925 AU orbit; 55 Cancri e has 7.99 Earth masses, 1.875 Earth radii, 0.7365474-day period and 0.01544 AU orbit. GM/R² derives 8.03 and 22.32 m/s² gravity, applied to locomotion and water. These are catalog constraints, not measurements of local surface terrain.

Synchronous spin, pole/site orientation, atmospheric columns, weather, terrain and neighboring-planet initial phases are modeled. Tidefall's temperate ocean, 1-bar air, moon and biology are hypothetical. Pyrax's stable cooled nightside survey region and extreme shielding are fictional engineering assumptions. Its atmospheric evidence does not establish the selected pressure or local weather. Unknowns are retained and disclosed in the star map and data notices. No native organism, ocean or satellite is presented as an observed discovery.

## 11. Catalog, atmosphere and identification

125 real HYG 4.1 records form the union of the brightest 100 reconstructed objects for each host. Positions subtract the observing host's 3D location; velocities propagate approximately J2000 to 2026 where available. Static displacement/magnitude calculations cache per world. The catalog retains HIP identifiers, coordinates, positions/velocities and missing-uncertainty limitations. HYG attribution and CC BY-SA 4.0 terms are in `src/data/README.md` and the JSON metadata; redistributed adapted data must retain these terms. `scripts/import-star-catalog.mjs` reproduces the subset.

A single GPU point batch varies magnitude, color, point spread, airmass extinction, daylight and cloud suppression. Faint decorative stars are never labeled. N enables scanner selection without falsely brightening faint naked-eye stars. A 1.25° optical / 2° scanner angular test selects one nearest object; terrain, rocks and cave geometry occlude selection. I opens a compact panel. Browser verification selected HIP 116771 / 17 Iota Piscium and opened its reconstructed 10.9-light-year distance panel. A browser check found and fixed panel stacking behind the canvas.

Nearby TRAPPIST-1 f / 55 Cnc b use catalog orbit/radius fields, assumed coplanar circular phase and gray Lambert brightness. The visible sphere uses angular size and directional illumination; unresolved size has a small display point-spread floor. These are approximate phases, not precision ephemerides or observed local brightness. The non-transiting 55 Cnc b radius may be an estimate. The map presents two separate star systems, useful hover names, scientific constraints, model assumptions and source links. Proper-motion/radial-velocity completeness and host epochs limit precision.

## 12. Flashlight and kinetic rifle

The suit light combines an approximately 82° full-angle smooth primary cone and 132° low-intensity fill, with inverse-square attenuation, separate 65/35 m useful ranges and real scene/material response. Primary/fill shadow maps are limited to 512/256; remote lights retain the cheaper existing treatment. Browser images show a broad gradual footprint rather than a painted circle. Multiple dynamic shadows remain a performance cost.

A camera-attached 3D rifle supplies a shared physical muzzle endpoint. Server validation casts the reticle to an intended point, checks eye-to-muzzle obstruction, then muzzle-to-target collision. Local tracers start at the actual rendered muzzle under prediction; remote pulses use the authoritative muzzle. Flash is at the barrel. Tests cover transform agreement across angles, 2/20/70 m targets and close wall obstruction. Native mouse firing/capture was not re-certified in Round 7; keyboard firing and the authoritative tests remain available.

## 13. Regional boundaries

Outer shared terrain forms escarpments instead of an exposed square edge. A stitched reduced-detail apron extends from ±160 m to ±1200 m with continuous boundary heights and geological silhouettes; existing offshore ocean continues beyond the solver. Tests check stitching and upward winding. HUD warnings identify inaccessible ridges/open ocean. This is a bounded arena: the original outer safety clamps remain, and a jet can still reach them above the ridge. Fully replacing that residual clamp with a fair physical/hazard transition is unfinished.

## 14. Multiplayer verification actually performed

Four network tests ran against local production-mode servers with independent WebSocket clients. Coverage includes room/readiness/reconnect authority, destination changes and matching astronomical time/species, shared physical death/loot and exclusive collection, last-survivor/same-tick outcomes, plus the new rapid H-use, 45→77 health, exactly one reserve consumed, medical generation/location replication, and matching tsunami event/water snapshots. The new replenishment test advances 130 seconds of authoritative simulation.

Two independent browser tabs also joined the same room, started a match, displayed matching tsunami countdowns, and received the Pyrax destination with surveyor/sentinel populations and 22.32 m/s² gravity. Visual fixtures use only the existing local stdin preview harness to position players/creatures and advance the environment; protection was enabled for photographs. These are staged inspections, not claims that a human survived an unmodified match. No per-star/per-vertex networking was added.

## 15. Measured performance

`npx tsx scripts/benchmark.ts` ran 720 ticks per case, discarding 120 warmup ticks and retaining 600 samples. `physicsMs` measures the whole server step including AI/water; AI is a subset, not an additional total.

| World / active creatures | Step median / p95 (ms) | AI median / p95 (ms) |
| --- | --- | --- |
| Tidefall / 0 | 0.421 / 1.735 | 0.002 / 0.009 |
| Tidefall / 3 | 0.655 / 1.923 | 0.183 / 0.538 |
| Pyrax / 0 | 0.489 / 1.908 | 0.002 / 0.010 |
| Pyrax / 3 | 0.697 / 1.883 | 0.170 / 0.439 |

Worst recorded step was 10.86 ms (Pyrax/3); these short encounter measurements do not certify late-game maximum load. Two concurrently open embedded-browser clients produced approximately 15–30 FPS on High depending on viewport/view and 43 FPS on Low in the recorded 1280×720 storm scene (23.3 ms frame, 29.0 ms p95, 96 calls / 158k triangles). These are live diagnostics, not controlled GPU comparisons. High performance is a remaining limitation. Bundled catalog calculations do not perform network requests during play. Build output is about 1.270 MB main JS (358 kB gzip) plus 4.337 MB Rapier/prediction chunk (1.671 MB gzip); Vite reports a chunk-size warning.

## 16. Checks, evidence and remaining defects

- Tidefall `npm test`: **91 passed, 0 failed**, including thirteen focused Round 7 tests and four network tests.
- Tidefall `npm run typecheck`: passed.
- Tidefall `npm run build`: passed, chunk-size warning retained.
- `npx tsx scripts/production-smoke.ts`: production health, HTML and two referenced assets passed; production WebSockets exercised by network tests.
- Resolve root `npm test`: **385 passed, 1 skipped** private-fixture test; no failures.
- Resolve root `npm run typecheck`: passed.
- Browser: new GPU shaders emitted no errors; visible shelter/light/terrain, Inspect panel, shared warning, destination transition and low graphics were inspected. The original port 4173 listener was found stopped, restarted with `npm run dev`, and health-checked. No native unrestricted Pointer Lock check ran in Round 7; the embedded host rejects it. Earlier user-confirmed mouse look is historical, not this round's certification.

Local screenshots are in `C:/Users/Kyler/.codex/visualizations/2026/10/27/01a17ca5-3a0b-7fc3-9d88-a4b268b141d6/`: `tidefall-round7-map.png`, `tidefall-round7-coast.png`, `tidefall-round7-sky-inspection.png`, `tidefall-round7-tsunami.png`, `tidefall-round7-low-performance.png`, and `tidefall-round7-pyrax.png`. Test/build/benchmark logs are local ignored artifacts. Public hosting, Docker execution, real touch devices, exhaustive shadow views, long-duration four-player stress and rigorous phase-rendering visual sweeps were not tested. CRYON, complete natural boundary replacement and cinematic tsunami amplification remain unfinished. Remote suit lamps still use the existing short-range glow; a replicated pitch-aligned remote beam is not implemented. The water solver is reduced local-inertial physics, not full Navier–Stokes/3D breaking waves.

## 17. Exact run/deploy commands

From PowerShell:

```powershell
Set-Location C:\Users\Kyler\Resolve
npm --prefix tidefall ci
npm run tidefall
# Open http://localhost:4173/ in Edge or Chrome.
```

`ci` is only needed on a fresh dependency install. For validation and production:

```powershell
Set-Location C:\Users\Kyler\Resolve\tidefall
npm test
npm run typecheck
npm run build
npx tsx scripts/production-smoke.ts
npm start
```

Keep the Node process alive. HTTP, `/health` and `/ws` share port 4173. Set `PORT` / `HOST` as needed; HOST defaults to dual-stack `::`. Use HTTPS with WebSocket upgrade forwarding on a persistent server. Rooms are single-process/in-memory; restart loses rooms. No live astronomy APIs are needed. Docker commands, supplied but not executed here:

```powershell
Set-Location C:\Users\Kyler\Resolve
docker build -t tidefall-round7 .\tidefall
docker run --rm --name tidefall-round7 -p 4173:4173 tidefall-round7
```

## 18. Three highest-value next improvements

1. Profile High graphics in native Edge/Chrome on target hardware; reduce shadow/terrain/lighting cost, split startup assets, and re-certify capture, continuous turning, Escape/Resume and close-range visible firing.
2. Playtest and calibrate the geological event against measured inundation/current maps over several seeds, while replacing the remaining jet-accessible safety clamp with a readable regional hazard/physical boundary.
3. Improve two-world creature assets/rigs, foot/attack silhouettes and four-player encounter/resource balance before adding CRYON. Add the ice world only with a separately documented physical scenario and genuinely different locomotion.
