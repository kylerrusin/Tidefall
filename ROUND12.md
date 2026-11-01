# Round 12 — terrain material reconstruction

Round 12 repairs material projection and coverage while retaining the existing terrain, collision and mountain silhouettes. The release evidence is in [the gallery](evidence/round12/gallery.md), with exact poses in [cameras.json](evidence/round12/cameras.json) and a reproducible [material audit](evidence/round12/material-audit.json).

## Checkpoint and scope

The starting commit is `640c4fce2456d34b5711a640ea82899f776907a9`, preserved on `codex/tidefall-round12-baseline`. Work is on `codex/tidefall-round12`. Only Tidefall source, tests, QA scripts and evidence belong to this checkpoint. Existing unrelated Resolve/generated-file changes are excluded.

No terrain vertex/index generator, collision shape, locomotion, combat, creature, facility, extraction or multiplayer protocol was replaced. Vegetation, water dynamics, cloud generation and the Pyrax atmospheric model retain their prior implementations. The ocean changes are development-only coverage/wireframe diagnostics. Controlled solar directions apply only to the development QA scene.

## Source and history audit

| Responsibility | Existing implementation |
| --- | --- |
| Terrain and physical classification | `src/model.ts`: `terrain`, `generatedTerrain`, `geology`, `exposedGeology` |
| Near and distant meshes | `src/geometry.ts`: `terrainMesh`, `terrainApron` |
| Terrain rendering | `src/landscape.tsx`: `Terrain`, `TerrainContinuation` |
| Shared material and projection | `src/materials.ts`: `geologicalMaterial` |
| Catalog and surface fields | `src/geological-catalog.ts`: `geologicalIdentity`; `src/geological-fields.ts`: `geologicalField` |
| Formation contacts and LODs | `src/formations.ts`, `src/FormationView.tsx` |
| Existing detailed rock | `src/hero-outcrop.ts`: `heroOutcrops`, `simplifyOutcrop`; `src/pbr-rock.ts` |
| Grain, fractures and bump source | `src/geological-texture.ts`: `geologicalTexture` |
| Visible-surface inspection | `src/inspection.tsx`: `InspectionProbe`, `inspectionFor` |

The Round 11 diff promoted the full near-terrain shader onto the apron and increased blended-terrain photographic-normal strength from .32 to .52. It also replaced catalog surface colors with an averaged basalt/carbonate/mixed-rock/soil palette. These were material changes; the geometry hashes already matched Round 10.

## Root causes and diagnostic gate

At fixed view F, seed 42, preview time 70, the Round 11 long parallel highlights disappeared with **photographic normals disabled**. They remained with **height bump disabled**, or with **AO and shadows disabled**. Neutral unlit, projection coordinates, weights, wireframe and depth were also captured before distribution changes. There is no vertex displacement in this material: the displacement-off diagnostic is explicitly a no-op.

The old photographic-normal reconstruction in `geologicalMaterial` blended axis-oriented normals directly. A flat normal map produced an axis-weighted replacement normal instead of the geometric normal. The axis frames also had inconsistent handedness. Derivative face normals and the increased strength made the defect prominent on the long apron triangles. Separately, cavity alpha was sampled only on XZ, stretching that channel on vertical faces.

The isolated high-quality source was traced to `survey-outcrop-0`, unit `TDF-LT-046`, through `HeroOutcrop` → `geologicalMaterial` → `rockPbr`. The recorded center hit is face 10323, distance 10.31 m at view B. Its high-detail mesh contains 20,174 triangles. The other imported outcrop uses `TDF-LT-034`. Their detailed geometry contributes substantially to their appearance; copying the material cannot add those geometric folds to a coarse heightfield.

The original albedo, normal, roughness and occlusion JPEGs remain under `public/materials/rock-face/`. Albedo uses sRGB decoding; the other channels are linear data; repeat is 2.4 world metres and anisotropy is 4. No new texture asset was substituted. The existing RGBA geological atlas supplies grain/fractures and bump relief; there is no imported photographic height map. The old loose-cover mask attenuated the photographic albedo contribution and removed its normals/roughness on loose classifications, while the hard-rock outcrop received the full treatment. This and the geometry difference explain why copying a generic noise layer did not reproduce the good surface.

The same existing sampler was tested on exposed flow A, fault face E and carbonate contact C at near and medium views **before** the coverage reconstruction. Those six `reuse-*` captures are retained.

Homogeneity came from the averaged palette, a broad scalar rock/soil blend and nearly universal rock eligibility. The reconstruction keeps parent bedrock and cover separate. One first attempt to use every fine catalog switch as an interpolated parent-unit color produced new vertical ribbons across long distant triangles. That attempt was rejected; `rejected-unit-interpolation-G.png` records it. The accepted parent field uses coherent provinces and broad flow units instead.

## Accepted implementation

`src/triplanar.ts` defines the world-space projection and its CPU checks. All photographic channels use the same signed X/Y/Z coordinates, 2.4 m repeat and normalized `abs(normal)^4` weights. Right-handed frames contribute perturbations around the geometric normal; a flat map preserves that normal for positive and negative faces. The atlas channels use the same repaired orientation. Photographic-normal strength is calibrated to the original outcrop's .32. Fine normal, cavity and bedding effects fade from 80–240 m instead of becoming unresolved distant lines.

`src/terrain-material.ts` and `src/geological-fields.ts` define the common bedrock/cover contract:

- Parent units follow the existing basalt/carbonate provinces, strike-aligned broad flows, the fault and vent alteration zones, and basin substrate. The 32-entry sample/physical catalog remains authoritative for physical samples; it is not used as a fine repeating distant color pattern.
- Deposition uses the existing sediment/regolith fields, low coast and the terrain generator's existing meandering basin channel. Weathering and competence retain catalog resistance/strength and fracture input. Dry weak Pyrax regolith retains granular cover.
- Coverage uses the actual geometric slope angle. Very steep slopes clear loose cover regardless of competence. A bounded microheight bias affects only the local cover transition.
- Exposed rock, weathered rock and sediment weights normalize to one. Only adjacent states participate in a transition. Exposed rock retains the original photographic channels; weathered rock has localized granular pockets; sediment has its own cover color, grain scale, roughness and smaller bump. This avoids averaging all three textures everywhere.

`src/geological-surface.ts` supplies the same attributes to near terrain, apron, all formation LODs and the imported outcrop LODs. Positions and indices are untouched. Formation skirts inherit the terrain field; competent exposed interiors use their source unit. Weak weathered formations retain cover over their parent bedrock instead of becoming fully bare rock. Geological identity and deposition input do not depend on the selected LOD normal.

The apron uses a distinct material program which skips fine-normal work when the distance fade finishes. It retains the same world coordinates, parent/cover fields and atmospheric fog. It adds no high-frequency mountain displacement or replacement silhouette.

`renderedGeologicalSurface` barycentrically samples the actual hit triangle's attributes. `InspectionProbe` reports its dominant parent unit and macro rock/weathered/sediment fractions, including formation contacts and active LOD. It explicitly describes macro cover; per-pixel grain is below the inspector's resolution.

## Visual verification

The baseline and accepted views use identical stored eye/target/FOV values, seed 42, time 70 and scenario lighting. A–G cover exposed flow, original outcrop, carbonate contact, moderate shore, steep fault and two mountain overviews. H/I are additional underwater views at this tide. W is an added weathered-upland check; K is an added overhead field check. W/K have no pretended Round 11 comparison.

B5/B25/B100 show the same outcrop at nominal horizontal offsets of 5/25/100 m. The actual slant center-ray distances are printed in the images; B25's center ray intersects the foreground weathered formation while the original outcrop remains visible above it. These are not claimed to be three unobstructed hits on one identical triangle.

The original rock, steep fault and distant ridge were also inspected at controlled solar elevations 12° and 55°, azimuth .7 rad. The high-sun ridge capture demonstrates that removal of the new ribbons is not achieved by hiding them in shadow.

Development diagnostics show actual shader/mesh data: bedrock-unit color, cover, slope angle, deposition, exposed/weathered/sediment weights, signed projection coordinates, triplanar weights, active LOD, wireframe and depth. K's mask captures explicitly hide water through the visible QA checkbox. The water coverage and wireframe views at D show the actual wet triangles and continuous ocean boundary; no hydrodynamic repair was needed this round.

Two independent browser clients joined `R12QA` alongside the fixture participant. Client IDs in the evidence are different. Both show seed 42/time 70 and agree at E on `TDF-AL-009`, rock/weathered/sediment `1/0/0`, LOD 0, face 18743, normal `(0.904,0.411,0.118)` and distance 16.26 m. Both had zero captured console errors. This is a local two-render-client comparison, supplemented by actual socket gameplay regression tests.

## Tests, build and performance

- Final Tidefall `npm test`: **154 passed**. This includes projection normalization, signed normal frames, flat-map identity, physical repeat scale, state normalization/dominance, steep loose-cover clearing, deterministic/coherent parent fields, real shared near/apron boundary attributes, real nested formation LOD attributes, visible-triangle inspector agreement, weak weathered formation cover and shader contracts. Existing locomotion, collision, survival, combat, extraction and real multiplayer tests also pass.
- Tidefall `npm run typecheck` and production `npm run build`: pass. The existing large-chunk warning remains; current entry is approximately 1.71 MB and prediction chunk 4.34 MB before gzip.
- Root Resolve `npm test`: **385 passed, one skipped**. The skipped test requires a private real raster Foundation Schedule fixture. Root `npm run typecheck`: pass.
- Geometry SHA-256 tests preserve the exact near/apron vertex and index bytes on seeds 42 and -43. All four hashes are in the audit.
- The audit records actual parent-unit counts and macro state dominance. Marine near terrain contains 11 parent units; counts describe vertex samples, not an area-weighted geological survey.
- No new textures were added. The mapped-texture estimate remains 24.43 MiB. Near terrain plus apron material-attribute storage grows by 709,668 CPU bytes (about .68 MiB); this is not a claimed GPU-memory measurement.
- Single-browser captures around the final fixed views showed roughly 19–22 FPS and p95 frame times around 52–69 ms on the shared embedded-browser environment. Two rendering clients and concurrent tests lowered those rates. Sky/water GPU queries are displayed per capture; terrain has no separate GPU timer. There is no controlled whole-frame Round 11/12 benchmark, and no speedup or stable native frame-rate claim.

The old Round 11 test demanding near-identical colors across every categorical catalog switch was deliberately replaced with within-unit continuity and physical cover assertions. Silhouette hashes and unrelated regression tests were retained.

## Reproduction and limits

Run `npx tsx scripts/round12-material-audit.ts` from `tidefall` to regenerate the deterministic audit and verify the frozen camera manifest. For browser QA, run `tests/preview.ts` on port 4175 with `TIDEFALL_QA_COMMAND_FILE=round12-fixture.json`, create the local `R12QA` preview room through that file, then run `scripts/round12-qa-pin.ts`. Open `http://localhost:4175/?terrainQA=F` and join R12QA. The pin participant starts the room and stages time 70. QA fixtures have no production HTTP endpoint.

The attachment contained text only; the referenced original comparison photograph was not available. The traced existing detailed outcrop is verified, but exact correspondence to an unavailable image cannot be proven. Background geometry remains coarse by request, and its large facets remain visible. Material fields are modeled geological proxies, not a full erosion/transport solver. Finite texture repetition remains possible at close range. No new native Pointer Lock/Escape/Resume test, WAN test, long wall-clock survival soak, public deployment or Docker execution is claimed. The earlier user confirmation that native mouse-look worked remains separate from this round's checks.

The screenshots support a targeted projection/coverage repair and visible material distinctions. They do not establish photorealism or completion of every possible environmental fidelity improvement.
