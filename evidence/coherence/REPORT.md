# TIDEFALL — final coherence and gameplay repair

Baseline: `ca81ca72`. Recovery branch: `codex/tidefall-pre-coherence`. Candidate branch: `codex/tidefall-coherence`. This round keeps the existing terrain generator, landform library, hydraulic solver, collision engine, and planetary atmosphere. No new terrain system, meshes, atlases, or dependencies were introduced.

Actual browser evidence: [comparison gallery](gallery.html), [extraction milestone playback](extraction.html), [frame samples](frame-times.json). The request refers to three screenshots, but this attachment contained text only. Exact screenshot locations and the original detached cyan polygon could not be matched. Saved repository cameras provide reproducible comparisons instead.

## 1. Exact source files changed

Production rendering/materials: `src/GeologicalTerrain.tsx`, `src/geological-surface.ts`, `src/regional-palette.ts` (new), `src/materials.ts`, `src/geological-substrate.ts`, `src/scene.tsx`, `src/world.ts`, `src/surface-query.ts`, `src/inspection.tsx`, `src/shadow-anchor.ts` (new).

Water/sky: `src/OceanSurface.tsx`, `src/visual-water.ts` (new), `src/hydraulic-surface.ts`, `src/shoreline.ts`, `src/ocean-continuation.ts`, `src/waves.ts`, `src/landscape.tsx`.

Extraction and modes: `src/mission.ts`, `src/client.ts`, `src/main.tsx`, `src/cabin.ts`, `src/extraction.ts`, `src/ExtractionShip.tsx`, `src/simulation.ts`, `src/survival.ts`, `src/OrbitalView.tsx`.

Development diagnostics only: `src/CameraRig.tsx`, `src/terrain-qa.ts`, `src/TerrainQAPanel.tsx`, `src/TerrainQAProbe.tsx`, `tests/preview.ts`.

Tests: `tests/coherence.test.ts` (new), `tests/emergency-terrain.test.ts`, `tests/round10.test.ts`, `tests/round9.test.ts`, `tests/round9-network.test.ts`. Test changes update deliberately changed hero placement, shader, seat, and timeline contracts; asset preservation checks remain.

## 2. Terrain-color root causes

Catalog lithology and sediment colors had very different lightness. Exposed rock, weathered rock, sediment cover, static rocks, and substrate fragments used these colors through separate rendering paths. The photograph multiplier also allowed approximately 0.55–1.55 contrast, multiplying the disagreement. C06's pale polygonal land patches remain with both water meshes disabled; those specific patches are material colors, not water.

A shared renderer palette derives the coastal base from the existing weathered regolith (70%) and sandstone (30%). Broad spatial noise, bounded lightness differences, small source-hue offsets, cover, wetness, roughness, and texture retain variation. Volcanic colors derive from the existing volcanic units. Geological identifiers and physical properties are unchanged. C06/C12 show the arbitrary light islands and near-black unit band removed; the geometry and discrete rock silhouettes remain. Lighting and moisture still produce legitimate larger brightness changes.

## 3. Material fidelity

Existing maps and filtering remain. Albedo detail is normalized around the measured existing-map mean and bounded to 0.90–1.10. Photographic normal strength is 0.06 instead of 0.32; bump relief, cavity darkening, pits, veins, and photographic AO are reduced. Roughness and moderate low-frequency texture remain. C12 includes a nearby boulder against ground; B5 records removal of the showcase itself. No wood photographic material exists in this source, so a matching wood screenshot or wood-specific fix cannot be claimed. Ship glass/hull roughness was moderated without deleting lights or texture assets.

## 4. Removed showcase placements

Removed the two original `FormationView` hero placements around `(28,-85)` and `(73,-43)` from the scene, their world colliders, and their support-query contributions. Normal global geological substrate and ordinary rocks remain. `hero-outcrop.ts`, `FormationView.tsx`, source rock assets, and their asset checks remain available. No replacement showcase object was added.

## 5. Formation contacts

Rigid base fitting previously considered only the finest shape. Other LOD basal vertices could protrude or leave a contact gap. Placement now samples all three existing LOD bases against the same terrain, choosing one shared embedded rigid contact. Shapes, footprints, topology, anchor distribution, and heightfield are retained. Automated contact checks cover every structural body in both test worlds across all three LODs. This corrects the identified LOD support problem; it does not establish that every formation in the unavailable screenshots has been matched.

## 6. Detached-water investigation

Development controls independently display `ocean-surface`, `offshore-boundary`, both, or neither. Baseline C06 isolation establishes that its pale inland polygons are terrain material patches. The exact reported cyan sheet was not conclusively reproduced and its original offending mesh is **unverified**.

An actual latent invalid-water path was found: dry-neighbor free-surface extension could yield a positive clipped water triangle without any real wet hydraulic support. Both renderers now use cached wet-node support; extrapolated elevation alone cannot create a wet patch at the numerical boundary. Offshore construction also rejects nonfinite and zero-area triangles. Existing clipping and hydraulic free-surface reconstruction remain. The synthetic dry-neighbor regression test fails without the support guard and preserves a genuine isolated wet node/pool. This is evidence for the guarded defect, not proof that it caused the absent screenshot.

## 7. Water stability

`VisualWater` reuses allocated surface/flow buffers and interpolates successive valid wet snapshots over a bounded 50–150 ms interval. Newly wet cells use valid target values; drying cells are removed immediately. Dry sentinels never blend into a water elevation. Geometry uploads occur only when presentation values change, capped at 30 Hz. Mutable reconstruction caches are explicitly invalidated. Server hydraulic state remains authoritative.

Wave phase previously multiplied changing local-depth dispersion by absolute match time. A centimetric depth update could therefore cause a large phase jump late in a match. CPU/contact and GLSL now share fixed reference-depth carrier frequencies; local depth still controls shoaling amplitude. Tests cover times 70, 1800, and 2020. Live tide and tsunami propagation at seed 42 were inspected, including separate near/offshore meshes during inundation, with no browser errors or detached sheet at C06. Full solver and hydraulic regression tests pass. This is a short live inspection, not an exhaustive terrain/water survey.

## 8. Moon/cloud occlusion

The moon was drawn separately after clouds were already baked into the sky. It now samples the same cloud noise, optical-depth integration, wind, observer ray, cloud cover, continuous clock, sunlight, and daylight. Atmospheric transmission and in-scatter precede cloud compositing. A second mismatch was identified during visual QA: moon-only tone mapping differed from sky output and left a visible disc against cloud radiance. Their output conversions now agree. Actual clear/thin/thick captures at t212 show the lower disc fading into the bank; t200→212 shows celestial motion into that bank. Orbital motion, angular size, designation, and volcanic atmosphere are retained.

## 9. Explicit modes and timelines

| Mode | Announce | Approach | Land/open | Close | Launch | Stable flight | Orbit | Results |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Normal | 25:00 | 28:00 | 30:00 | 33:00 | 33:08 | 33:18 | 33:45 | 34:00 |
| Preview | 2:40 | 3:00 | 3:10 | 3:40 | 3:45 | 3:50 | 3:55 | 4:00 |

New connections default to Normal Survival. A stale `?mode=preview` URL does not silently choose Preview. The explicit home button selects Preview in memory, and the lobby clearly labels it. Actual browser checks verified the normal label and explicit preview lobby; server timeline tests verify the authoritative schedules. Existing-room mode remains authoritative.

## 10. Three-minute boarding

Normal boarding is `[1800,1980)` seconds: a real 180-second window. The ship is landed at 1800; missed-extraction elimination occurs at close, not before. Tests check beginning, middle, and end of the window. The accelerated normal demonstration uses real authoritative milestone values; it does not shorten Normal mode or pretend to be a 30-minute manual playthrough.

## 11. Hatch behavior

A shared `hatchPose()` rotates the visible hatch and collider around the lintel instead of lifting a detached slab above the doorway. It is open while boarding, visibly closes over the preparation interval, and is sealed before thrust. A doorway overlap check brings a boarding player safely inside before phase closure. Tests verify the hinge attachment on both schedules, closed collider placement, and missed-extraction timing. Exterior images show open/closing/sealed states at 33:00, 33:02, and 33:08.

## 12. Seating and cabin movement

Walking is allowed before launch, restrained during initial launch acceleration, and allowed from the explicit stable-flight milestone before orbit. Existing ship-local movement/collision remain. In room F5940, real held keyboard input moved the player about 3.44 m in the cabin before seating. At 33:18, the actual Leave seat action and keyboard input demonstrated standing/walking before the 33:45 orbital milestone. Existing repeated-seat, cabin collision, and networking tests pass. Native unlimited mouse capture was not retested in the in-app browser, which blocks Pointer Lock; the earlier user-confirmed Edge mouse-look remains the available native evidence.

## 13. Orbital conclusion

The existing cinematic trajectory and orbital scene are retained. The orbital shader's missing cloud-noise sampler is now supplied. Actual window captures show ascent, a curved planetary horizon, dark sky, and stars. Orbit begins at 33:45; results wait until 34:00, providing 15 seconds of orbital presentation and free cabin movement. The milestone playback contains landing through final results. It is an honest sequence of recorded stills, not a continuous video. The accelerated exterior demonstration skipped environmental time, so its background water is not a water benchmark.

## 14. Bright-object flicker

No stationary flicker reproduced at the fixed Pyrax laboratory fixture: all eight baseline frames share one SHA-256, and all eight candidate frames share one SHA-256. Shadow/emission/specular/transparency/light-pose isolation captures are included. A roughly 14-second slow camera sweep shows no obvious fixture flicker in the saved sequence. Sparse stills cannot prove absence of rapid temporal flicker.

Source inspection identified directional shadows rounded in world X/Z rather than their rotated light-space texel plane, which permits movement across shadow texels during camera/player motion. `shadowAnchor()` now quantizes in the light plane; a pure invariant test verifies parallel translation independent of sun direction. No brightness reduction, light deletion, or volcanic atmospheric change was used to assert a cure. The root cause of the user's exact original flicker remains **unconfirmed**.

## 15. Before/after evidence

Open [gallery.html](gallery.html) for C06, C12, B5, V06, W20, water isolation, lunar cases, and fixture images. Every selected image has associated DOM/fixture metadata where available. The gallery uses actual rendered captures, not generated mockups. [extraction.html](extraction.html) plays the normal extraction milestones and labels the clock jumps and recording limits.

## 16. Frame-time comparisons

1280×720, High quality, 300 warmed frame intervals per saved sample, same seed/time/camera, both water meshes enabled, scenario sun/clouds, diagnostic 0. One game test viewport rendered at a time; user tabs were untouched. These are development-browser measurements on a shared workstation, not isolated GPU benchmarks.

| Scene | Baseline mean/p95 ms | Candidate mean/p95 ms | Mean change |
|---|---:|---:|---:|
| Coastal W20, seed 42, t70 (repeated pair) | 29.82 / 47.10 | 27.30 / 42.80 | −8.5% |
| Volcanic V06, seed −43, t70 (final warmed sample) | 29.08 / 34.60 | 29.82 / 38.90 | +2.5% |

Initial earlier baselines were 20.88/26.70 ms and 27.23/29.70 ms; an initial candidate coastal sample was 37.55/45.40 ms. Repeating the baseline under the current load exposed substantial workstation variability. All samples, including slower exploratory samples, are retained. Volcanic p95 remains 4.3 ms higher in the final comparison, so no universal speed-up is claimed. Geometry decreases by roughly 40k triangles in V06 due to hero removal, and no textures are added. Development-only isolation material settings now update on mode changes instead of every frame.

## 17. Automated and browser checks

- Tidefall complete suite: **180 passed, 0 failed**. Includes multiplayer WebSocket regression checks.
- Focused final repair suite: **9 passed, 0 failed** after final renderer/diagnostic edits.
- Tidefall typecheck and production build: passed. Existing large-bundle warning remains; no new dependency or asset atlas.
- Resolve root suite: **385 passed, 1 conditional-fixture skip, 0 failed**; root typecheck passed. Unrelated Resolve files were not included.
- Browser: rendered material comparisons, water isolation, live tide/tsunami, lunar cases, fixture isolation/sweep, explicit Preview selection, normal extraction milestones, seating and actual keyboard cabin movement. Production two-client smoke verification is recorded alongside the final promotion evidence.

## 18. Remaining defects and limits

The exact screenshot water polygon, screenshot formation contacts, and original bright-object flicker cannot be certified fixed without their source images/locations. No photographic wood exists to compare. Fixed-camera terrain quality remains the existing moderate geometric style; this round does not redesign its silhouettes. Water/lighting inspections are short samples, not exhaustive planetary coverage. The volcanic timing tail is modestly higher and should be monitored. Continuous high-frame-rate flicker video, a continuous extraction video, and native Pointer Lock are not provided by this verification. The retained checkpoints allow recovery without discarding unrelated work.
