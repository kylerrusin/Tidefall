# Round 13 — geological exploration and sampling

The existing Tidefall project now has connected underground survey networks on both worlds, organic detached rock geometry, restrained additional surface grain, and server-owned geological extraction integrated into the original field kit.

## Recovery and delivery

The pre-round game is preserved at commit `104b74bb` on `codex/tidefall-pre-round13`. Work is isolated on `codex/tidefall-round13` before fast-forward integration. The active game directory is `C:/Users/Kyler/Resolve/tidefall`; production uses port 4174. No unrelated Resolve work is included.

## Implemented behavior

- Tidefall's small decorative placements drop from 156 to 87 and instanced fragments from 492 to 316 for seed 42: 648 → 403 combined, a 37.8% reduction. Exposure, talus classification and separation govern distribution. Major geological bodies remain intact. The volcanic map has no blanket density reduction.
- Detached rocks use the existing fractured geological construction with shared low-polygon geometry. Rendering, static triangle collision, material inspection and sampling use the same shape and transform. The lab reference specimens also use the shared shape. Legitimate projectile, celestial and query spheres remain.
- Existing two-channel ground material gets a small bounded increase in albedo grain and sediment detail. Palette, normal-map strength, established morphology, sky and astronomy are retained.
- Undertide Survey and Cinder Archive each have approximately 110 m of connected passage, three chambers, a descending entrance and two branches. A small grid-aligned opening connects the existing terrain to a cached static cave shell. Floors, ceiling and fractured walls share physical geometry. The volcanic mineral branch adds local marked contact heat.
- Work lamps, cables, power units, instruments, survey records and sample containers give each cave a scientific expedition history. Only three nearby real work lights illuminate relevant sectors; the other fixtures use emissive materials. X reads nearby catalog-backed survey equipment. Green arrows point toward the surface.
- V toggles combat/sampling while the rifle is equipped. The original authoritative camera/muzzle ray and obstruction checks validate sampling. Range is 10 m; sediment/ordinary/hard material requires 1/2/3 pulses at 4/6/9 energy per pulse. Cadence is 0.55 seconds. Equipment, people, creatures, sky and submerged material do not yield solid samples.
- Each local fracture patch yields at most three samples. Progress and remaining material are shared server records, bounded to 512 patches; only 64 visible fracture patches are transmitted/rendered. Surface-oriented spall relief, material chips and family-specific impact sound distinguish extraction from ordinary combat. The completing player owns the sample.
- E and Tab toggle the original field kit. X operates contextual interactions; F/G/C/1–3/Escape retain their functions. Prompts, help and touch interactions are updated. Samples stack in 20 distinct slots (99 per material), with catalog identity, mass, modeled composition, origin and discard controls. Ordinary survival supplies remain intact.

## Material lookup defect found and repaired during browser QA

A real horizontal wall shot incorrectly produced sediment even though the ray hit the wall. Rapier 0.21 returned a triangle-local feature value (0/1), which the new face-range code had incorrectly treated as a whole-mesh triangle number. The final implementation resolves the actual struck triangle through a lazy, bounded spatial lookup against the collider's source mesh, retaining exact material ranges for vertical and overlapping exposures. Legacy XZ-only support queries remain compatible. New tests fire real rays and extraction pulses at wall, floor, mineral and alteration exposures on both planets; all eight cases preserve the correct catalog identity and cave origin.

## Rendering stability

The reported location was facility lamps/laboratory equipment. Before/after fixed and slow-turn canvas clips and flashlight-off clips are saved, alongside shadows-off, emission-off and diffuse-only captures. Fixture emission power and flashlight power/range are unchanged. Luminous architecture no longer casts/receives its own shadow and uses rough, nonmetallic response. The suit lamp's adaptive exposure retains its original brightening speed and has a slower release so a single range-ray discontinuity does not cause an abrupt dim pulse. A focused test confirms this response is never weaker than the previous response for identical targets.

The sampled stationary view was stable before and after; the exact intermittent artifact reported by the user was not consistently reproduced. These are targeted mitigations with reviewed captures, not proof that every remaining hardware-dependent shimmer has been eliminated. No global dimming was used.

## Browser and regression verification

Real keyboard movement descended more than 11 m underground on both worlds, reached illuminated main chambers, collected material, opened/closed the existing inventory, and returned to the surface. Tidefall's final inventory contained TDF-LT-043 carbonate mudstone (0.18 kg) and TDF-SD-014 sediment (0.12 kg); the volcanic inventory contained TDF-LT-035 basaltic flow margin (0.18 kg). E, Tab and X survey interactions were verified. Recordings use the WebGL canvas; HUD/inventory proof is in separate screenshots and text snapshots.

These local QA survival rooms use the ordinary character controller and authoritative gameplay. They stage the player at the entrance (or a documented interior continuation after test-tab closure) and protect health, oxygen and temperature. They do not teleport the character through the recorded route. All branches and the return route also pass actual Rapier capsule traversal tests for both worlds. This round does not claim a new unattended 30-minute multiplayer soak.

- Tidefall: **194 tests passed**, zero failures/skips; typecheck and production build passed.
- Resolve: **385 passed, 1 conditional fixture skip**, zero failures; root typecheck passed. No Resolve source changes are included.
- Real two-socket tests cover sample ownership, ignored forged material/quantity, synchronized inventories, equipment selection and reconnect persistence. A fresh scene restores the authoritative equipment slot once, avoiding a rifle UI/server mismatch after reconnect. Shared-patch tests prevent duplication of the last finite sample. Other tests retain mission timing, extraction, seats, water, facilities, creatures, prediction and pointer state behavior.
- Existing production build warning: large JavaScript chunks. No startup errors are accepted for delivery.

## Matched outdoor performance

One active test rendering view, seeds 42 / −43, fixed t70 weather and camera, High graphics, antialiasing and shadows enabled. CSS viewport 1280×720; actual render target **1600×900** at DPR 1.25. Each result contains 300 rendered frame intervals, with raw samples and profile data retained.

| View | Mean before → after | p95 before → after | Mean change | Draws before → after | Visible triangles before → after |
|---|---|---|---|---|---|
| Tidefall W20 | 34.51 → 35.60 ms | 42.4 → 43.9 ms | +3.16% | 264 → 242 | 284,926 → 156,306 |
| Volcanic V06 | 39.46 → 41.37 ms | 48.1 → 49.0 ms | +4.84% | 171 → 170 | 252,456 → 129,584 |

Both short samples meet the approximately 5% mean regression target. This is a local embedded-browser measurement, with normal timing noise, not a universal hardware guarantee. High graphics remains expensive in enclosed, light-filled views; lower-resolution cave runs showed roughly 27–35 ms per frame, while the larger High capture runs were substantially slower (about 50–60 ms while recording). A separate non-recording Low-preset volcanic chamber sample at 1280×720 measured 42.49 ms mean and 54.4 ms p95 (300 frames, 211 draws, 109,165 visible triangles). This is a remaining enclosed-scene performance limitation on this embedded renderer; smooth High-preset cave play on this machine is not claimed.

## Explicit limits

- The embedded browser blocks native Pointer Lock. This round verifies real keyboard traversal and F extraction; unlimited captured mouse-look, native left-click extraction, Escape capture release and Resume recapture require a full-browser manual pass. The user had confirmed mouse-look working in an earlier round; that confirmation is not presented as a new Round 13 native-input test.
- Excavation is bounded, surface-attached physical-looking spall/fracture relief over the retained solid collider. It does not create navigable tunnels, deform the whole heightfield or support arbitrary voxel digging.
- Geological compositions are catalog reference assemblages, not measured chemical assays. Inventory is match-owned in memory and survives ordinary reconnect/scene movement, not server restart or a new match.
- Caves use a cached local footprint/shell, not a general subterranean voxel or 3D groundwater solver. The established surface hydraulic model remains unchanged; no independent cave-fluid simulation or free-floating interior water sheets are added.
- The gallery records representative main routes, sampling, exit and lighting cases. Both branches are covered by physical traversal tests; a continuous video of every branch and every control is not claimed.

[Open the screenshots and recordings](evidence/round13/index.html). [Raw performance and profiles](evidence/round13/performance.json).
