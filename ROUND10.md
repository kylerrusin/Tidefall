# Tidefall Round 10 — implementation and verification

Completed locally on 2026-10-30, extending Round 9 checkpoint `90917fcb3efc86341ee1d70bde0930bc8e1155a0`. This report distinguishes implemented behavior, measured evidence and remaining approximations. The original Node/WebSocket game remains the application; Resolve's estimating source was not part of this work.

## 1. Hub phasing

The rendered octagonal hub had a 3.6 m lower radius and a roof reaching 6.4 m, while its physics used a smaller 2.6 m cylinder with a 5.6 m height. Its struts and pads lacked corresponding collision. `hub.ts` now supplies the same hull, roof, panel, strut and pad meshes to rendering, server physics and prediction. Sixteen approach directions on both planetary seeds compare physical ray hits to the actual rendered mesh within 2 mm.

## 2. Unsupported structures and objects

Single center samples and coarse site grids missed sloped corners and newly exposed outcrops. Some placement code queried base terrain while the visible surface included additional geometry. `surface-query.ts` combines terrain triangles, procedural formations and detailed cliff meshes. Footprints, transformed boulder vertices, shelters, gravel, biological roots, water beds and shoreline clipping use that common exposed surface. Shelter floors account for all footing footprints. Facility piers extend to sampled ground, with girders and equipment pedestals above them. Boulder placement excludes facility footprints and entrance approaches.

The final Pyrax entrance was moved from the steep boundary to a basin site at (82, -90). A supported 18 m ramp replaces the former steep stair approach. Both render and collision apply its incline. An actual capsule-controller regression and a browser walk traversed it without jumping and cycled both airlock doors.

## 3. Disconnected anatomy

Animated torso groups moved during gait, charges and death while limb groups remained siblings under the stationary parent. Limbs now belong to the animated torso for the main predators and ecological mobile classes. Ecological gait uses actual motion speed. This repairs the hierarchy; it is not a full skeletal inverse-kinematics or universal foot-plant system.

## 4. Seating and takeoff glitches

Passengers previously mixed seat assignment, world-space character movement and the moving ship frame. A generic post-physics position copy could overwrite a cabin position; snapshots and camera transforms also used different flight times. A shared `CabinState` now owns constrained local movement and seat occupancy. Aboard characters bypass the competing world-position copy. Hull, passenger interpolation and camera use the same per-frame flight time. Camera ownership diagnostics expose overwrites and prediction corrections.

## 5. Geological meshes

Twelve original procedural formations cover eight archetypes: layered cliffs, jointed basalt, weathered bedrock, erosion ravines, regolith contacts, coastal ledges, fractured flows and talus aprons. Near, medium and far meshes use nested 64×80, 32×40 and 16×20 grids. Near meshes together remain below 140,000 triangles. Layered/coastal forms add closed bedding prisms and overhanging lips; embedded skirts connect into the parent terrain. Exact near-mesh support queries follow the same triangles used in physics.

Two high-visibility cliffs additionally use a separately sourced [Poly Haven Rock Face 01](https://polyhaven.com/a/rock_face_01) CC0 scan. Each full mesh has 11,106 vertices and 20,174 triangles; marine medium LODs have 5,085/4,580 triangles and far LODs 1,289/1,140. A reproducible packer retains positions and indices in 254,316 runtime bytes. Spatial bins accelerate vertical support queries. Original source files and license are in `assets-source/rock-face/`; this is not the restricted Sketchfab reference. Marine cliffs expose modeled bedrock units LT-046 and LT-034 rather than the surrounding thin regolith veneer.

Boulders now use an irregular directional convex sculpt whose visible geometry also defines collision, replacing the dodecahedron template. The landscape outside the detailed cliffs remains visibly stylized.

## 6. Materials

Fixed an sRGB-to-linear vertex-color mismatch that washed out terrain and mineral colors. Added licensed 1K albedo, normal, roughness and occlusion maps from [Poly Haven Rock Face](https://polyhaven.com/a/rock_face), totaling 2,598,477 compressed source bytes. Triplanar projection uses a 2.4 m material scale. Sample luminance preserves the modeled geological unit's hue. Existing original grain/fracture/height treatments remain, with reduced excessive bump amplitude and wetness-dependent roughness. Async texture loading retains a procedural fallback. License, source URLs and SHA-256 hashes are bundled beside the maps. [Poly Haven's license](https://polyhaven.com/license) is CC0.

## 7. Geological contacts

Formation geometry adds actual bedding edges, talus slopes and erosional channels. Shared support queries bury contact vertices into the exposed surface rather than allowing objects to hover above a base height map. The existing registry/facies and loose-cover relaxation still provide material transitions. These are authored reduced geological constructions, not a stratigraphic reconstruction of an observed exoplanet.

## 8. Distant terrain

Removed the opaque repeated mountain ring. The terrain apron now derives relief from coherent fault-aligned ridges and drainage structure continuous with the terrain model. Distant material shading still uses a broad tint; full per-unit lithological coloring does not extend across the entire far apron.

## 9. Water

The offshore shader formerly assumed a fixed 30 m depth next to the numerical coastal field. It now extends the sampled boundary bed continuously with a shallow seaward slope. Optical path depends continuously on depth and view angle, with per-channel attenuation, Fresnel response, foam, waves and haze. The water solver bed, contact and shoreline queries include exposed formations. The 5 m shallow-water grid is a height-envelope model: it cannot resolve flow underneath overhangs or sealed-room air pockets.

## 10. Clouds and atmosphere

A bounded six-sample 3D raymarch replaces the single-height cloud plane, integrating density through a 700–1,550 m layer with wind, weather banks, vertical/horizon fades and a directional density-shadow sample. Lightning is localized by viewing angle. These are volume-like rendering approximations, without a weather-fluid solver, temporal reprojection or full cloud shadow maps. Dry Pyrax retains its distinct atmosphere without water clouds.

## 11. Primary facility

The marine facility retains ten rooms, shared physical doors, transparent glazing, records, supplies and closed-room environmental protection. It now has 335 static parts, eleven glazed parts, additional piers, girders, equipment pedestals, framing and lighting. Fourteen door recipes include the two legacy shelter doors. Browser evidence records walking through its airlock and corridor. Architecture remains largely modular geometry; laboratory machines are records/equipment rather than simulated industrial processes.

## 12. Ship and extraction

Walk up the gangway and enter the cabin, then press E to register for extraction while standing. Approach a free seat and press E to sit; E unseats when flight permits. Local deck movement is 2.4 m/s with swept obstruction checks, shared boundaries and seat/console volumes. Seat ownership is exclusive. Boarding close automatically assigns restraints and prevents unseating until orbit; walking and reseating work again afterward. Pausing clears cabin movement. Extraction still protects/scorably retires boarded suits.

Browser input verified registration, sitting, unseating, prelaunch walking, launch lock, post-ascent walking and reseating. A 42.056-second normal-clock ascent recording was saved. The recording predates the final orbital polar-axis correction; newer orbital screenshots show the corrected ocean/cloud view. The axis correction stops the camera-facing hemisphere from always appearing as a polar ice cap. This is a cinematic planetary view, not full orbital dynamics. Cabin jumping and disembarking after committed rescue are not supported.

## 13. Pyrax installation and lava

Pyrax now has a distinct 36×44 m industrial platform, eight instrument/service bays, ten door recipes, observation glazing, an insulated service spine, equipment, conduits and supported foundations. The final site has 318 static parts and deck elevation 40.562 m. Its entrance ramp and airlock were traversed in the browser after relocation. Closed rooms provide modeled chassis protection. The scenario continues to represent fictional shielded remote machinery, not exposed human survival.

A server-authoritative 33×33, 1 m local lava sheet transports depth and thermal energy down the actual base terrain. Temperature and crystallized fraction control viscosity; radiative cooling and latent heat affect crusting. Source temperature is 1,500 K, solidus/liquidus 1,150/1,400 K, density 2,700 kg/m³. Quantized depth/temperature snapshots update at 4 Hz. The renderer uses those surface heights and temperatures, and hot contact damages unprotected chassis. Conservation, downhill transport, cooling and solid fraction have focused tests.

This remains a closed local depth-averaged approximation, without 3D magma dynamics, pressure chemistry, full body momentum coupling or a planetary magma ocean. Existing emissive terrain fractures, crystals and steam remain visually stylized around the vent. [NASA's Webb account](https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/) discusses a possible atmosphere; it does not establish the visible local terrain or this fictional facility.

## 14. Difficulty and naming

Predator vision reaches 49 m, chase speed 7.4 m/s, acceleration 11 m/s², commitment 3.2 s and memory 14 s. Successful melee deals 35 HP on a 1.35 s cooldown; projectiles travel at 17 m/s. Up to three attackers can commit together, and encounters recur sooner. Existing telegraphs, spawn grace, active/storage limits, rifle and creature HP are retained. Normal survival remains 30 minutes and judging preview four minutes. Ordinary sky UI now labels the hypothetical moon `TRAPPIST-1 e SIM-M01`; the scientific catalog retains its uncertainty explanation.

## 15. Performance evidence

`ROUND10-evidence.json`, generated at 17:11:15 UTC, contains the final fixed-tick benchmark. Two protected scripted suits completed 1,800.017 simulated seconds in 108,001 ticks, taking 452.37 seconds of wall time. Complete server step median was **3.8445 ms**, p95 **7.0663 ms**, maximum **36.2527 ms**. Heap after collection went from 30.80 to 27.88 MiB; RSS from 243.78 to 210.87 MiB. Bodies/colliders went from 40/711 to 77/748 with extraction geometry. Final counts: nine creature slots, seven active, 21 loose objects, 27 supplies. Water volume residual was 1.02e-9 m³. Final serialized snapshot was 110,211 bytes, about 1.10 MB/s per client at 10 Hz before transport compression/overhead.

The Round 9 historical server median/p95 were 1.219/3.083 ms. Added geometry and changed runtime contention increase this round's cost; this is not a controlled isolated speedup comparison. The 30-minute fixed-tick run is accelerated, not a fresh 30-minute wall-clock socket soak. Round 9's wall-clock soak is historical evidence only.

Development F3 now exposes frame distribution, physics, AI, draw calls, triangles, network encoding/bytes, disjoint-aware nonblocking GPU sky/water queries, texture count and estimated mapped texture storage. That estimate excludes render targets/shadows and is not a full VRAM profiler. The final embedded-browser storm view at 1280×720 showed **18 FPS**, frame 56.3 ms, p95 80.1 ms, 249 draw calls and 515k triangles on High. Low reduced calls to 122 and triangles to 247k, reaching **31 FPS**, frame 32.7 ms, p95 45.7 ms after warm-up. A later post-HMR Low screenshot showed 29 FPS, p95 54.0 ms, 133 calls/248k triangles, estimated mapped storage 24.42 MiB, sky GPU 4.78 ms, water 0.03 ms, physics 7.51 ms, AI 3.63 ms and network encode 3.96 ms. Tests/other local processes were active; camera pitch changed after HMR, so this is not a controlled hardware benchmark. One pre-HMR correction followed the deliberately teleported QA position; the final reset counters show zero corrections/overwrites. The diagnostic weather line was corrected to use preview duration after the earlier screenshots.

The final Pyrax vent screenshot showed 32 FPS, p95 38.0 ms, 127 calls/365k triangles, physics 2.22 ms, AI 0.80 ms and encode 2.66 ms. Its water GPU field retained a prior marine-preview query and must not be interpreted as Pyrax water cost. Screenshots are preserved in the [evidence gallery](evidence/round10/gallery.md). Earlier near-view readings of 44 FPS preceded the final scan/PBR assets and are not final-build performance claims. Stable High-preset desktop performance was not achieved on this embedded testing surface; native capture and sustained multi-client GPU testing remain outstanding.

The production build has a 1,699.54 kB main JS chunk (616.31 kB gzip) and a lazy 4,340.11 kB prediction/Rapier chunk (1,671.65 kB gzip). Its large-chunk warning remains. PBR source downloads add approximately 2.6 MB.

## 16. Multiplayer

The production-server socket tests verify two real WebSocket clients, shared snapshots, exclusive seat ownership, launch restraint refusal, orbital unseating and input-driven shared cabin movement. Existing combat, resource and reconnect tests remain. The server serializes each room snapshot once per broadcast and reuses it for clients, retaining backpressure bounds. Internet loss/latency and sustained multi-client rendering were not tested this round.

## 17. Validation

Final game checks: **135 tests passed, zero failed/skipped**, `npm run typecheck` passed, `npm run build` passed, and `npx tsx scripts/production-smoke.ts` passed health/HTML/two bundled assets. Nine tests were added over Round 9: eight focused unit/integration cases and one real-socket case. They cover actual hub mesh/collider correspondence, cliff support/LOD bounds, all formation archetypes, facility protection/doors/foundations, the final Pyrax entrance walk, lava conservation/cooling, cabin swept movement and repeated seat cycles/flight phases. Existing rock/support tests now reference the actual authoritative geometry without relaxing tolerances.

Root Resolve verification: **385 passed, one private-fixture skip, zero failed**; root `npm run typecheck` passed. Unrelated root working changes and generated files were left outside the Tidefall checkpoint.

## 18. Visual evidence and reference comparison

Actual browser screenshots and an ascent recording are in the [Round 10 gallery](evidence/round10/gallery.md). They use seed/time/position staging through the local-only QA server; protection and frozen clocks were used for inspection. Movement, doors and seats were exercised through UI input. Production has no QA command endpoint. The localhost production title screen was loaded successfully after restoring its server.

The referenced photographs were not present among accessible attachments/assets. No direct image or pixel comparison was performed, and no equivalence to reference photorealism is claimed. Against the written criteria, the strongest improvement is the detailed cliff mesh with shared physical relief. Broad terrain, modular rooms and the vent's stylized appearance remain visibly simpler. Earlier images and the ascent recording are explicitly dated relative to the later material-identity/orbital fixes.

## 19. Remaining limits

The specific limits above remain: stylized terrain outside the detailed cliffs, broad distant tint, approximate creature feet, reduced water/cloud/lava models, modular equipment, large bundles/snapshots and constrained cabin motion. Embedded-browser Pointer Lock is rejected; native continuous turning and Escape/Resume were not newly verified in this round. Historical user confirmation of working Edge mouse-look is not a new Round 10 test. Touch devices, public deployment, Docker execution and long-running multi-client GPU rendering are unverified. No benchmark or screenshot establishes full scientific or photographic realism.

## 20. Run and deploy

Development, from PowerShell:

```powershell
Set-Location C:\Users\Kyler\Resolve
npm --prefix tidefall ci # fresh installation only
npm run tidefall
```

Open http://localhost:4173 in native Edge/Chrome for Pointer Lock. Keep the process running. Root `npm run dev` runs Resolve instead.

Production and validation:

```powershell
Set-Location C:\Users\Kyler\Resolve\tidefall
npm test
npm run typecheck
npm run build
npx tsx scripts/production-smoke.ts
$env:PORT='4173'
$env:HOST='127.0.0.1'
npm start
```

Repeat the accelerated benchmark with `node --expose-gc --import tsx scripts/round10-benchmark.ts`. It overwrites `ROUND10-evidence.json`. Repack the CC0 mesh using `node scripts/pack-rock-asset.mjs`.

For a persistent host, serve the production Node process behind HTTPS with `/ws` upgrade forwarding, use an appropriate HOST binding, and preserve one process per in-memory room population. Docker commands (provided, not executed):

```powershell
Set-Location C:\Users\Kyler\Resolve
docker build -t tidefall-round10 .\tidefall
docker run --rm --name tidefall-round10 -p 4173:4173 tidefall-round10
```

No public deployment or push was performed. The final chat records the verified local checkpoint SHA and localhost readiness.
