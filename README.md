# TIDEFALL — Survive the Planet

First-person multiplayer survival in two scientifically informed exoplanet scenarios. **Explore → prepare → survive → outlast.** This extends the existing Tidefall terrain, Rapier, numerical water and WebSocket game. Resolve remains a separate application in the same repository.

## Run

Node **22.12+**, PowerShell:

```powershell
Set-Location C:\Users\Kyler\Resolve
npm --prefix tidefall ci
npm run tidefall
```

Dependencies are installed in this workspace; `ci` is needed only for a fresh install. Open [localhost:4173](http://localhost:4173/) in Edge or Chrome and keep the command running. The embedded preview rejects Pointer Lock; keyboard movement and arrow-key looking remain available there. Full native capture, continuous turning and Escape/Resume require a native-browser check. The game reports capture failures explicitly.

One watched process serves HTTP, `/health`, `/ws` and `/vite-hmr`. Root `npm run dev` starts Resolve; `npm run tidefall` starts this game. PORT defaults to 4173 and HOST to dual-stack `::`; use HOST=127.0.0.1 for local-only binding. Client edits reload; server changes reset in-memory rooms. A per-tab token reconnects to a surviving room. Localhost on another person's computer is not this server.

## Play

Create Game, share its five-character code, and ready up. The host selects Tidefall or Pyrax through the star map. Two to four players compete; solo practice is also available. Everyone starts apart with equal equipment. Late arrivals spectate. Last surviving player wins; same-tick deaths tie. Normal survival has a **30-minute surface phase plus 3-minute boarding window**: rescue lands at 30:00, boarding closes at 33:00, launch begins at 33:08, and results appear at 34:00. Extracted suits rank by remaining health, with equal health tied. The title-screen preview button or `?mode=preview` creates a **four-minute** demonstration: landing 3:10, boarding closes 3:40, launch 3:45, results 4:00. Joining preserves the host's mode. Death is permanent for that round. Disconnected suits remain vulnerable, with a 20-second reconnect grace before signal-loss elimination.

**Tidefall / TRAPPIST-1 e:** hypothetical temperate ocean terminator, coastal predators and an explicitly hypothetical moon. Derived gravity is 8.03 m/s². The astronomical boundary tide is about 5 ±14 m before storm surge, with a compressed 480-second cycle. Normal mode warns of offshore seismic activity at 13:15 and releases the long wave at 13:30; preview warns at 1:15 and releases at 1:30. Seek higher routes. The numerical basin governs flooding and currents. Sealed research compartments reduce modeled environmental exposure; they are not simulated hydraulic air pockets or guaranteed flood protection.

**Pyrax / 55 Cancri e:** fictional shielded robotic nightside expedition, modeled solid basalt crust, extreme heat and damaged survey machines. Derived gravity is 22.32 m/s². Use coolant rather than oxygen canisters. This is not exposed human exploration or a claim of native volcanic wildlife. There is no liquid-water ocean in this scenario.

The star map separates catalog constraints, modeled conditions and speculation. Source records, uncertainties and data licenses are bundled in `src/data/`. No native life, ocean or moon is established by those astronomical records. CRYON is not included in this release.

## Controls

| Action | Desktop |
| --- | --- |
| Move / sprint | WASD / Shift |
| Look | Click viewport for relative mouse capture; arrow keys are an accessibility alternative |
| Jump / jet thrust | Space / hold in air |
| Swim down / rise | Hold C / release C; Space assists ascent |
| Pick up / claim shelter bay | X within reach |
| Operate doors, read stations, board rescue, sit/unseat | X within reach; enter the rescue cabin first. Approach a free seat to sit; unseat when flight permits. |
| Carry or release a portable geological sample | G, or the corresponding Tab action |
| Equip | 1–3 or wheel: rifle, oxygen/coolant, artificial field |
| Use equipped item | Left click while captured; F keyboard alternative |
| Medical / oxygen or coolant / energy cell / thermal compound | H / O / B / T |
| Field reverse / recall | Q / R |
| Kit, samples, suit status and chart | E or Tab |
| Rifle combat / geological sampling | V toggles; left click or F sends a pulse |
| Scientific inspection / optional faint-star scanner | Look at a target and dwell; N toggles scanner. Discoveries appear in Tab. |
| Release mouse / settings | Escape; Resume requests capture through its click |
| Development diagnostics / collision overlay | F3 / F4 |
| Development visibility bounds / unculled comparison / off | F6 |

Focus/visibility loss clears input and releases capture. Settings expose sensitivity, Y inversion, audio and low graphics. Touch controls exist, but physical-device testing is outstanding.

Medical treatment restores 32 HP, never consumes at full health and has a server cooldown. Medical/energy/thermal reserves cap at two; minerals at nine. O restores 65 oxygen on Tidefall or reduces internal chassis temperature on Pyrax. B recharges suit/rifle energy. T regulates temperature for 60 seconds. Three minerals can also recharge energy. Portable supplies and loose loot collect on approach with exclusive server ownership and solid-occlusion checks. X operates stationary nodes, liners, shelters and the floating crate. The server rotates bounded replenishing medical supplies across valid dry, clear sites. Tab also exposes direct drop actions. Creature drops are physical, shared exclusively, useful and expire after 90 seconds.

Cold progresses through warnings, severe exposure and sustained critical hypothermia; ordinary exposure takes minutes. Immersion and wind increase heat loss. Liners, activity, shelter and thermal supplies affect recovery. Environmental damage does not stack multiple unexplained thermal/drowning drains. Predators are the immediate danger: substantial successful attacks generally eliminate an unprepared suit in three to five hits. Coastal stalkers pursue and spit; armored Reef Burrowers charge. Pyrax surveyors hover and fire ion projectiles; sentinels use tracked charges and rear reactor vulnerabilities. Attacks remain telegraphed and server validated.

The kinetic rifle has 85 m range, 18 damage, 0.32-second cadence and 8 energy cost. Its visible muzzle and authoritative two-stage aim share transforms and obstruction checks. Pulses transfer capped mass-dependent impulses. The finite artificial field is speculative equipment, not natural gravity.

## Implementation and limits

Server/client share 60 Hz locomotion, terrain and structural collision geometry. Prediction/replay uses input acknowledgements; remote bodies interpolate snapshots. Shared sampled footings support shelters. The 65×65 / 5 m reduced local-inertial water grid handles connected wetting/drying, tsunami propagation, buoyancy and current drag. Its free surface is reconstructed consistently for server/client contact, and clipped against the 2.5 m terrain triangles for shoreline rendering. Cached loose-cover relaxation and blended geological properties replace sharp material bands. It is not full 3D breaking-wave physics. The visual mountain apron extends beyond the playable region; safety clamps remain reachable by jet above the natural ridges.

A shared versioned scenario couples composition/pressure to density/clouds, irradiation to climate/productivity, and inundation/geochemistry to slow moisture, salinity, microbial and habitat fields. These are reduced speculative models, not discovered conditions.

125 HYG catalog stars are translated from Earth to each observing host, approximately propagated to 2026, then rotated into the modeled planetary horizon. Atmospheric extinction/daylight suppress naked-eye visibility. Scanner selection does not brighten hidden stars. Nearby planet phases use assumed circular orbital phases, not precision ephemerides. Tidefall's moon passes instantaneous Roche/Hill screening, but long-term tidal migration is not solved. Adapted catalog data is CC BY-SA 4.0 with attribution in `src/data/README.md`.

The shared 32-unit geological registry has seven facies, ten stationary growth grammars and six marine mobile classes. Round 10 adds twelve structural formations across eight archetypes, two detailed CC0 cliff meshes with three visual LODs, photographic PBR rock maps and shared exposed-surface placement. Mesh source/license files are in `assets-source/rock-face`; texture provenance is in `public/materials/rock-face`. `node scripts/pack-rock-asset.mjs` reproduces the packed cliff data.

Round 11 propagates those materials through continuous slope/cover blends on the main terrain, procedural outcrop contacts and the unchanged background apron. Habitat clusters replace uniformly scattered plants, with leaf-relative tissue detail and anchored wind motion. The ocean renderer now continues over all four simulation edges with matching boundary height/depth; foam and ripple shading avoid the previous straight texture stripes. Ocean-world clouds have a thicker variable volume with cached 3D noise, while Pyrax's dry atmospheric controls are retained. Facility lights now belong to visible fixtures with bounded downward illumination. See [ROUND11.md](ROUND11.md) and its [before/after gallery](evidence/round11/gallery.md) for evidence and limits.

Tidefall has a ten-room research facility; Pyrax has a distinct eight-bay raised industrial installation at (82, -90), reached by its south ramp. Enter the south airlock, use X to cycle both doors, then explore the corridor and laboratory records. Closed room doors provide modeled environmental protection. Pyrax retains its robotic expedition, local temperature-dependent lava sheet and no native vegetation.

Walk up the rescue gangway and into the cabin, then press X to register for extraction. Walk to a free seat and press X to sit; X unseats when permitted. Cabin walking works before launch and from the stable-flight milestone at 33:18 in normal survival. Initial launch acceleration temporarily restrains passengers. Rescue registration commits the suit to extraction; cabin jumping/disembarking are not supported.

High graphics uses sun plus local light shadows and can be expensive in the embedded browser. Low disables shadows/reduces pixels. Development F3 includes frame, physics, AI, network, GPU sky/water and estimated mapped-texture diagnostics. Round 11's observed upward-storm sample reached 26 FPS on High and 30 FPS on Low; these are local embedded-browser samples, not desktop performance guarantees. Round 10's accelerated 30-minute simulation and Round 9's four-socket real-time soak remain historical evidence. Native capture and sustained multi-client GPU profiling remain outstanding. See [ROUND11.md](ROUND11.md) for current measurements and limitations.

## Validate and deploy

```powershell
Set-Location C:\Users\Kyler\Resolve\tidefall
npm test
npm run typecheck
npm run build
npx tsx scripts/production-smoke.ts
npm start
```

Production serves `dist/` and persistent `/ws` on one origin. Use a persistent Node/container host with HTTPS and WebSocket upgrade forwarding. Rooms are single-process/in-memory. Docker support remains available:

```powershell
Set-Location C:\Users\Kyler\Resolve
docker build -t tidefall-round10 .\tidefall
docker run --rm --name tidefall-round10 -p 4173:4173 tidefall-round10
```

Public deployment and Docker execution were not performed. [ROUND11.md](ROUND11.md), [ROUND11-evidence.json](ROUND11-evidence.json) and the [current gallery](evidence/round11/gallery.md) document terrain propagation and rendering cleanup. `node --import tsx scripts/round11-audit.ts` repeats the current audit. [ROUND10.md](ROUND10.md), its [benchmark](ROUND10-evidence.json) and [ascent gallery](evidence/round10/gallery.md) document the earlier physical/cabin work. `node --expose-gc --import tsx scripts/round10-benchmark.ts` repeats the accelerated fixed-tick benchmark; `node --expose-gc --import tsx scripts/round9-soak.ts` repeats the ordinary 30-minute four-socket run. Earlier round reports are historical and may describe superseded mechanics.

## Geological exploration

Both worlds have a marked survey entrance near (−93, −123), a descending access cut and about 110 m of connected passage, with a principal chamber and two branches. Green markers lead back to the surface. Work lamps, cables and sealed survey equipment remain from an earlier expedition. X reads nearby survey records. The volcanic mineral branch has marked hot-rock contact exposure. The existing outdoor atmosphere and hydraulic solver remain authoritative.

Use V with the rifle equipped to toggle Combat and Geological Sampling. Target exposed geology within 10 m, then left click (F also uses the current equipment). Sediment takes one pulse, ordinary rock two, and hard rock three. Sampling consumes rifle energy; each local fracture patch yields at most three samples. Equipment, people, creatures, water and sky cannot become mineral samples.

E opens or closes the existing field kit; Tab remains a secondary shortcut. Its Samples section stacks catalog materials, retains modeled composition and origin, and supports 20 distinct materials with discard controls. Survival consumables remain separate. Samples and depletion are server-owned and survive ordinary reconnects and entering caves/facilities. Generic terrain uses a bounded visible spall patch, not navigable digging or a deformed heightfield.

Round 13 verification, measurements and explicit limits are in [ROUND13.md](ROUND13.md), with [screenshots and recordings](evidence/round13/index.html).
