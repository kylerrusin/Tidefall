# Global geological substrate — verified candidate

Both playable worlds now use the same hybrid terrain architecture across all 64 chunks per world. This replaces the two-site pilot and the old separate formation/outcrop grids. The original two imported reference rocks remain intact.

## Implementation

- `src/domain/substrate.ts` owns the substrate records and six shape families. `src/domain/world-sites.ts` centralizes existing authored sites and fluid bounds without moving them.
- `substrate-field.ts` evaluates geology on one seeded world lattice. Geological unit, exposure, weathering and strike control morphology, dimensions and density. It supplies continuous medium-scale shoulders, ledges, cuts and solidified-flow relief to the authoritative terrain grid before its existing loose-cover relaxation.
- `geological-shapes.ts` creates six original families: rounded lobed bedrock, stratified exposures, fractured prisms, eroded towers, projecting shelves and volcanic plates. Each has six geometric variants and three cheaper LODs. Ordinary bodies are hundreds of triangles, rather than copies of the 20,174-triangle reference asset.
- `geological-substrate.ts` samples each footprint and every basal vertex, embeds the body into a local support plane, batches owned bodies by chunk and removes wholly buried triangles from visible batches. Collision retains the closed structural meshes. Small debris is instanced and intentionally noncollidable to avoid ankle-height snags.
- `GeologicalTerrain.tsx` renders 64 independently culled chunk groups with cached near/mid/far meshes and hysteresis. Every LOD preserves the full fine boundary samples. Bodies crossing a border remain whole under one deterministic owner. Compatible fragments use GPU instance batches; instance bounds update only after camera movement. No terrain mesh generation occurs during movement.
- `formations.ts` is an adapter onto the shared substrate, including exact triangle support queries. `world.ts` consumes the same prepared records for static collision. Rendering keeps per-body geological IDs and contact weights in the existing material/inspection attributes.
- The existing regional landforms continue beyond the playable square. The apron shares the actual edge height but continues the regional slope, preventing small new rock shoulders from becoming exaggerated distant walls.
- The restrained historical terrain material retains albedo and roughness texture channels and broad geological colors. No new fine grain, cavity or procedural bump layers were added. Clay mode replaces the actual material on the actual meshes.

## Full-map coverage

| World / seed | Chunks processed | Principal bodies | Instanced fragments |
| --- | ---: | ---: | ---: |
| Coastal / 42 | 64/64 (100%) | 310 | 492 |
| Volcanic / -43 | 64/64 (100%) | 323 | 579 |
| Coastal / 47 | 64/64 (100%) | 309 | 502 |
| Volcanic / -48 | 64/64 (100%) | 330 | 593 |

Processing is not the exposed-rock percentage. The `coverage-*.json` files record every chunk's classification, protected fraction, sampled exposed-rock and visible-volume fractions, relief range, body/fragment counts, families, bounds and all three LOD triangle counts. These fractions are coarse 5 m samples, not exact area measurements. Broad landforms and sediment flats remain continuous terrain.

One chunk on seed 42 and four on seed -43 have no owned principal bodies. These are 75–89% inside authored clearance envelopes. Spawn access, facility footprints/ramps, extraction sites, shelters, cave/vent sites, reference rocks and the active lava bed have local protected margins. Adjacent owned bodies may cross into a chunk without being counted as owned there.

## Actual screenshots

Open [the comparison gallery](index.html) for **12 geographically distributed before/after pairs per planet**. `cameras.json` freezes eye, target, FOV, seed and time independently of the new geometry. Views cover spawn, fluid boundary, flats, moderate and steep slopes, outcrop, valley, ridge, facility, distant landforms, and randomized interior/outer regions.

Scenario-light clay images are included for C06/C11 and V06/V11. Additional `after-highsun-*-clay.png` views expose the geometry under a development-only controlled sun. The active planetary lighting is unchanged. `seed47-*` and `seed-48-*` images verify alternate seeds on both worlds. Screenshots and matching DOM metadata are original captures, not generated illustrations.

At the frozen tide, some coastal flat/valley views are submerged. Water-visible images retain that occlusion and do not independently establish the quality of underwater contacts. Volcanic scenario-light captures are dark; the controlled-light clay views are the clearer geometry evidence.

The attachment describes five references, but supplied no image files. This implementation follows those written morphology descriptions; no claim of direct image matching is made.

## Performance

Same 1280×720 in-app browser, fixed W20/V06 cameras, seed 42/-43, time 70, original scenario light and water, development client. Each result averages three separate 300-frame requestAnimationFrame windows after warm-up. The other agent WebGL tab was blank and tests/builds were stopped. This is a local frame-time measurement, not a hardware-independent FPS guarantee.

| Fixed view | Before mean / p95 | After mean / p95 | Mean change |
| --- | ---: | ---: | ---: |
| Coast W20 | 17.82 / 25.27 ms | 19.07 / 24.07 ms | +7.0% |
| Volcanic V06 | 30.64 / 33.57 ms | 23.89 / 27.07 ms | -22.0% |

The historical 17.25 ms pilot figure is a useful reference. The measured baseline in this session was 17.82 ms at W20. The coastal mean is modestly slower with global geometry; its p95 improved. Volcanic mean and p95 improved after replacing the old formation grids.

After W20: **239 draws, 279,955 rendered triangles**, 492 geological fragment instances, active chunk LOD counts 9/19/36. After V06: **166 draws, 295,488 triangles**, 579 instances, LOD counts 11/20/33. These draw/triangle counts include the whole visible game scene. Every principal body remains represented at distance; far LOD removes secondary detail rather than entire major formations.

Measured render-geometry buffers: coast **25.07 MiB**, volcanic **14.10 MiB**, plus fragment buffers/capacity **0.68/0.80 MiB** and cached raw body buffers **2.33/2.48 MiB**. Reported browser used JS heap was approximately **245.54/241.93 MiB**; that is whole-page browser telemetry, not isolated substrate memory. It does not measure total process, WASM or GPU allocation. Estimated mapped texture storage stayed **24.43/23.93 MB**. Raw values are in `after-*-memory.json`.

One-time browser construction of the cached render buffers measured **1001/964 ms**. A separate cold Node audit measured complete prepared-body generation at **1050/1133 ms**, or **1354/1550 ms** including coverage and all-LOD audit queries. These are loading costs, not per-frame or chunk-crossing costs. See `performance.json`, raw frame arrays, and performance DOM snapshots for reproducible measurements.

## Collision and gameplay checks

`traversal.json` records real Rapier capsule traversal beside shelf, stratified, volcanic and fractured contacts: four routes of 12.6–13.1 m, minimum capsule-center ground clearance 0.976 m or greater, followed by jetpack ascent and grounded landing. Tests use the game's actual capsule controller, gravity and thrust.

The independent local WebSocket replays `WALKC` and `WALKV` also drove the unchanged authoritative input protocol. An actual first-person spectator browser followed the moving players; before/walk/ascent/final screenshots and raw server snapshots are included. `replay-summary.json` records displacement, ascent and grounded landing. These are automated network replays, not native held-key tests. Replay protection, frozen astronomical time and disabled creatures make inspection reproducible. The replay diagnostic snapshot gives an additional moving-camera scene sample; it is not a full-survival-load benchmark.

Preservation hashes in `preservation.json` show identical lava-bed data, both original reference-rock meshes, spawn height, both facility layouts excluding adaptive foundation legs, and normalized source for atmosphere, cloud shader, facility lights, climate, main UI, controls and camera. Volcanic foundation legs adapt to their changed surrounding ground. Initial loose equipment now uses the canonical solid support query so it cannot spawn inside a new rock volume. Plants, pickups and authored supports retain their existing shared support paths.

## Checks and limits

- Tidefall: **171/171 tests passed**, typecheck passed, production build passed. Logs are included. Existing Vite large-bundle advisory remains.
- Resolve root: **385 passed, 1 skipped**, typecheck passed. The skip is the conditional real raster Foundation Schedule fixture test; no Resolve source changes were made.
- Tests cover manifold edges/outward winding, six geometric variants, cheaper LODs, four-seed coverage, mixed-LOD seam equality, embedded bases, active-fluid exclusion, preserved lava bed, matching ray/collision support and unit IDs, equipment support, capsule traversal, and existing gameplay/network/extraction behavior.
- Native Edge pointer capture, continuous turning, Escape and Resume were not rerun in this terrain task. The user's earlier confirmation that mouse-look works remains the available native-input evidence. Control and pointer code are preserved.
- After promotion, the production server on port 4174 passed its health check and the actual browser flow through create, ready, start, introduction, live HUD, menu and leave. No browser rendering errors were reported. `production-gameplay.png/.txt` records the live game. The in-app browser still reports its existing Pointer Lock restriction; native Edge input was not independently retested.
- The shapes are economical procedural geometry. They do not reproduce photographic detail, geological fracture simulation, or a dynamic voxel planet. Some existing loose props and authored large structures remain distinct game objects.

## Recovery and reproduction

The original active HUD-restored state is commit `a1dfabaa`. The complete frozen pilot/camera baseline is `40f18512` on `codex/tidefall-global-baseline`. The global implementation is on `codex/tidefall-global-substrate`; history retains both checkpoints.

Run `npm test`, `npm run typecheck`, and `npm run build` in `tidefall`. Run `npx tsx scripts/substrate-audit.ts <baseline-tidefall-directory>` for coverage/preservation comparisons, and `npx tsx scripts/substrate-traversal.ts` for the four controller routes. The optional `tests/preview.ts` and substrate pin/replay scripts operate only on a local QA server at port 4177; they are not imported into production. Production uses `npm start` with `PORT=4174`.
