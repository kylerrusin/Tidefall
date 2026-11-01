# Source-verified emergency terrain repair

Starting checkpoint: `7b9454dcefa34a0a1c7204ee66603041644bcebb`, retained on `codex/tidefall-emergency-baseline`. Repair branch: `codex/tidefall-emergency-repair`.

This is a two-site geometry extension and an apron-only material correction. The near-terrain shader algorithms, terrain/apron vertex and index bytes, original two imported meshes, clouds, water, facilities, spacecraft, astronomy and atmosphere implementations are preserved. No new asset was downloaded.

## 1. Functions and files changed

| File | Function/change |
| --- | --- |
| `src/geological-surface.ts` | `applyGeologicalSurface`: explicit `apron` option; require computed normals and derive apron classification slope from them. Default near/formation behavior is retained. |
| `src/landscape.tsx` | `TerrainContinuation`: enables `apron:true`. No other landscape component changes. |
| `src/materials.ts` | `geologicalMaterial`: distant-only macro appearance, coarse roughness and a distinct apron cache key. The existing 80–240 m fine-detail fade is retained. |
| `src/hero-outcrop.ts` | `detailPlans` and `build`: two authored marine placements; support from the existing ground/formation surface; conform the basal band and retain rigid detailed relief above it. `heroOutcrops` returns those additions through its existing cache. |
| `src/FormationView.tsx` | `FormationView`: enumerates the existing outcrop registry instead of hard-coding IDs 0/1. `HeroOutcrop` tags added samples for development-only profiling. Existing LOD thresholds remain 65/140 m. |
| `src/terrain-qa.ts` | `terrainCameras`: uses the already-recorded Round 12 pose manifest so new support geometry cannot move comparison cameras. Adds a development visibility flag. |
| `src/TerrainQAPanel.tsx`, `src/TerrainQAProbe.tsx` | Development-only added-outcrop visibility control and frame-sample reset, used for a geometry-cost comparison. |
| `tests/emergency-terrain.test.ts` | Seven focused regressions, including unchanged near shaders/original meshes, actual apron slope, embedded bases, LOD budgets, world collider/support agreement and capsule-clear perimeters. |
| `scripts/emergency-terrain-audit.ts` | Reproducible geometry hashes, slope mismatch counts, new locations and per-LOD triangle counts. |

`formationMesh`, `ground`, `createStaticWorld`, `heroHeight`, `solidHeight`, collision rules and locomotion were inspected and not rewritten. Existing world/prediction collision loops already enumerate `heroOutcrops`; the new full meshes therefore enter the same collision and support path as the originals.

## 2. Distant material mismatch

The former apron attribute builder called `geology(x,z,seed).slope`. Its `ground` samples clamp outside the playable square, whereas the rendered apron extends to 1,200 m and adds mountain relief. It was classifying one surface using another surface's gradient.

Apron-only slope now uses `hypot(nx,nz) / max(1e-5,abs(ny))` after `computeVertexNormals()`. The default classification path remains unchanged. The [audit](evidence/emergency/audit.json) finds a slope difference greater than .01 at 2,528 of 2,560 tested outer vertices for seed 42, and 2,538 for seed -43. In the marine scene only two deposition inputs change by more than .001; on Pyrax 819 change. This explains why the isolated marine correction is visually subtle. It is not a substitute for physical geometry.

## 3. Background baseline and streaks

Round 10 used one apron tint with the older geological shader. Round 11 moved the full material onto it. Round 12 repaired normal reconstruction and introduced broad parent fields. Older screenshots do not provide matched F/G evidence of a cleaner result, and the older shader contains the known normal reconstruction defect. The clean repaired Round 12 F/G rendering was therefore retained as the comparison baseline instead of restoring that defect.

The isolated slope correction was rebuilt and inspected at F/G before adding geometry. No visual regression was found. Stage D then replaces unresolved apron detail with broad parent/cover-field color and averaged existing-map response as `geoDetail` fades. The coefficients come from sampled linear albedo luminance .07219, AO .97020 and roughness .83472 of the existing textures. No new periodic noise, kilometer-scale fine normals, displacement or mountain regeneration was introduced. Near geometric surfaces retain their prior shaders; regression hashes match the baseline after whitespace normalization.

The matched F/G images show no new narrow vertical texture streaks. Broad facets and material gradients remain on the coarse distant geometry, including in stronger light. This is not a claim that all banding has disappeared.

## 4–5. New physical relief and locations

The CC0 Poly Haven Rock Face 01 source is reused as physical triangle geometry, not as an extra texture layer. Its existing full mesh has 20,174 triangles. Two additional placements are retained only on the marine world:

| Outcrop | X, Z (metres) | Unit | Scale / yaw | Full / medium / far triangles |
| --- | --- | --- | --- | --- |
| 2, exposed flow region A | 96, -64 | TDF-LT-037, lapilli tuff | 1.5 / 3.1 rad | 20,174 / 3,979 / 990 |
| 3, carbonate contact region C | -110, -31 | TDF-LT-044, carbonate grainstone | 1.2 / 1.65 rad | 20,174 / 2,755 / 636 |

The lower one-metre band conforms to the actual host ground/procedural formation; the lowest vertices are embedded 15 cm. Above that band, the licensed relief stays rigid apart from its placement transform. The same resulting full mesh supplies rendering, collision and triangle support queries. Automated rays agree within 3 mm and a capsule has a continuous clear perimeter at 7 m radius around each added collider. These bounded checks do not claim that every approach through the existing surrounding terrain is walkable.

The first edge-on orientations were rejected. The carbonate sample was also reduced and moved onto a more even host patch, away from existing boulders. Final views A/C show new folds, ledges and silhouettes outside the original two outcrops; B provides the original comparison. The [gallery](evidence/emergency/gallery.md) includes matched before/after images and stronger-light checks. The new samples are not uniformly scattered. No further propagation was attempted beyond these two authored locations because of the measured rendering cost.

## 6. Seams and bands

Near and far material fields still interpolate on different mesh densities. Broad distant facets/gradients and some join contrast remain. Foreground photographic/atlas repetition and regular fracture patterns are visible, particularly at grazing angles. The two new exposures improve selected rock geometry; they do not make the 2.5 m base grid or distant radial mesh reference-quality geometry. The source rock shape is recognizable when reused. Existing stylized props, boulders and creatures remain outside this repair's scope.

## 7. Frame-time and triangle cost

At fixed camera A, seed 42, time 70, scenario lighting, two 300-frame development samples were taken with only the added render groups hidden/visible. This is a render-only geometry-cost comparison on the repaired material system, not a historical whole-game benchmark. No regression suite was running during the recorded samples.

| Metric | Added samples hidden | Added samples visible |
| --- | --- | --- |
| FPS | 20.7 | 19.3 |
| Approximate mean frame time from displayed FPS | 48.3 ms | 51.8 ms |
| p95 frame time | 55.4 ms | 58.5 ms |
| Reported triangles, including render passes | 449,056 | 530,388 |
| Draw calls | 123 | 128 |
| Texture count / mapped estimate | 14 / 24.43 MiB | 14 / 24.43 MiB |

The source geometry increase is 40,348 full-detail triangles, distinct from the larger multipass counter delta. The observed mean cost was approximately 3.5 ms and p95 cost 3.1 ms. These are shared-machine embedded-browser samples; they are not a native frame-rate guarantee or an overall rendering speedup claim. Original and new LOD counts, unchanged terrain/apron hashes and original-outcrop hashes are recorded in the audit.

## 8. Validation and delivery

- Full Tidefall `npm test`: **161 passed**, including the seven new focused tests and existing collision, survival and multiplayer checks.
- Tidefall typecheck and production build: **passed**. The existing large-chunk warning remains.
- Root Resolve `npm test`: **385 passed, one private-fixture skip**; root typecheck passed.
- Baseline A/B/C/E/F/G and final comparisons use exactly the same stored eye/target/FOV, seed 42, preview time 70 and scenario sun. Supplemental stronger-light captures use the existing QA high-sun control and are labeled separately.
- The near shader-code hashes and original two mesh hashes match the baseline. Terrain/apron topology hashes are unchanged on both planets. No atmosphere, cloud, water, facility or spacecraft implementation was modified.
- Browser checks captured no console errors. Native Pointer Lock, WAN performance and a long real-time survival soak were not retested.

The updated production build runs at **http://localhost:4174/** so its server and client load the same new collision geometry. An active game room on port 4173 was left running. Use 4174 for the updated build; the existing 4173 process needs a later restart to load the new server module.

## 9. Remaining visual defects

The broad terrain remains coarse, with long distant triangles, visible faceting/gradients and some repeated foreground texture patterns. Material seams are reduced locally by embedded support, not eliminated globally. Detailed relief is proven at two additional sites, not across the entire landscape. G is dark under scenario lighting; its high-sun image is included so darkness is not the only basis for judging the background. No photorealism or complete global terrain repair is claimed.
