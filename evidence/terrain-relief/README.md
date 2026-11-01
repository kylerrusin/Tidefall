# Isolated terrain pilot — not promoted

The player-facing correction is complete: pointer capture controls and the top-left inspection card are restored in the active game at http://localhost:4174/. That focused change is checkpoint `a1dfabaa`. The experimental terrain has **not** replaced that game.

The candidate is in `C:\Users\Kyler\Resolve\tmp\worktrees\tidefall-relief-pilot\tidefall`, branch `codex/tidefall-relief-pilot`. Its isolated pre-change camera/timing checkpoint is `ab2106a1` (`codex/tidefall-relief-prechange`). A separate candidate preview uses port 4176.

The pilot fixes the duplicate-surface contact structurally and passes its physical and performance tests. Its rendered forms remain too rounded and weakly expressed to satisfy the requested geological appearance confidently. Browser walking through the sites was not completed. **The visual and manual acceptance gates remain open; the pilot was neither expanded nor promoted.**

1. **Historical material selected.** Inspected `640c4fce^` (`22ca0f69`), Round 11, Round 12 and the current checkpoint. Reused the pre-Round-11 photographic albedo-luminance modulation and roughness channel, with the existing licensed textures and 2.4 m world scale. Omitted procedural grain, cavity darkening, bedding shading, fine bump and photographic normal perturbation. Existing vertex geological colours and geometry normals remain. Sediment receives a restrained photographic contribution; exposed rock receives the original luminance operation. This is a small terrain-only transplant, not a restoration of old gameplay or the full historical shader. The distant material and volcanic terrain keep their checkpoint appearance.

2. **Exact game source changed.** `src/terrain-relief.ts`, `src/model.ts`, `src/formations.ts`, `src/geological-surface.ts`, `src/materials.ts`, `src/landscape.tsx`, `src/FormationView.tsx`. QA additions are `src/terrain-qa.ts`, `src/TerrainQAPanel.tsx`, `scripts/terrain-relief-qa-pin.ts`, and the camera/evidence files here. Tests are `tests/terrain-relief.test.ts` plus the material-test title in `tests/geomorphology.test.ts`. Scientific inspection, water, networking, survival, creatures, spacecraft, atmosphere and facility-lighting source were not edited by the pilot.

3. **Relief function.** `rockReliefAt(x,z,seed)` in `src/terrain-relief.ts` returns actual metre-scale elevation. `terrainReliefAt` exposes the same compact support and local unit influence. The module has no imports and cannot recurse into terrain, ground, formations, materials or rendering.

4. **Two sites.** Existing formation 11 at **(-114, -37)** is the western carbonate ledge pilot (`TDF-LT-043`), approximately 39 × 39 m. Existing formation 6 at **(96, -60)** is the joint-controlled basalt flow pilot (`TDF-LT-034`), approximately 35 × 46 m. The west uses skewed shelves, a weathered shoulder and a cut; the east uses an unequal divided crest, shorter spur and intervening depression. They have different orientations and profiles. Sampled relief reaches 2.81 m; no new imported asset or instance was added. The baseline already contained only the original two imported rock-face instances, which remain.

5. **Heightfield integration.** `generatedTerrain()` adds the pure relief before its existing relaxation/cache step. Resistant pilot samples are protected from sediment relaxation. The resulting cached triangle heights feed the existing `terrain()`, `ground()`, `terrainMesh()`, world collider and support/placement consumers. The 129 × 129 grid is unchanged. Only 370 vertex elevations change; the 16,248 vertices outside the compact supports match the baseline hash exactly. Both apron meshes match their baseline hashes. `terrainApron()` and global distant generation were not edited.

6. **Material contact.** The geometric support envelope has a flat interior and a quintic outer falloff with vanishing boundary value and derivative. Its influence drives the existing geological attribute builder's unit colour, deposition, weathering and competence blend. The core exposes the appropriate bedrock; the edge returns continuously to the surrounding material field. There is no unrelated noise mask or new planet-wide geological classification.

7. **Old overlapping meshes.** The shared `formations()` plan omits only marine IDs 6 and 11. Rendering, collision construction and `formationSurface()` all consume that same plan. Other formations and all volcanic formation IDs remain. Removed overlay geometry totals **23,576 full-detail triangles**; the main terrain stays at **32,768 triangles**. Existing adjacent slabs and decorative rocks were deliberately retained.

8. **Captured images.** All PNGs are original browser captures. Camera positions, targets and FOV are frozen in `cameras.json`; seed 42, time 70, 1280 × 720 viewport. Unmarked captures use the scenario's actual low sun. `*-high-*` uses the pre-existing development-only high-sun diagnostic, identically before and after, to expose shape; no planetary sky or lighting source was changed. The QA panel was temporarily hidden by its own capture button for clean images; adjacent text snapshots retain the rendered camera and diagnostic metadata. These images are not retouched.

| Site and distance | Before | Candidate |
|---|---|---|
| Western, 5 m | ![Before west 5 m](before-W5.png) | ![Candidate west 5 m](after-W5.png) |
| Western, 20 m | ![Before west 20 m](before-W20.png) | ![Candidate west 20 m](after-W20.png) |
| Western, 50 m | ![Before west 50 m](before-W50.png) | ![Candidate west 50 m](after-W50.png) |
| Eastern, 5 m | ![Before east 5 m](before-E5.png) | ![Candidate east 5 m](after-E5.png) |
| Eastern, 20 m | ![Before east 20 m](before-E20.png) | ![Candidate east 20 m](after-E20.png) |
| Eastern, 50 m | ![Before east 50 m](before-E50.png) | ![Candidate east 50 m](after-E50.png) |
| Western contact | ![Before west contact](before-WC.png) | ![Candidate west contact](after-WC.png) |
| Eastern contact | ![Before east contact](before-EC.png) | ![Candidate east contact](after-EC.png) |

The two forms under the same controlled high-sun diagnostic:

| Western candidate | Eastern candidate |
|---|---|
| ![West high sun](after-high-W20.png) | ![East high sun](after-high-E20.png) |

9. **Measured cost.** Three separate warmed 300-frame W20 windows per build, identical pose/settings/scenario, one agent-controlled QA renderer and no concurrent test/build workload. Raw samples and the aggregate are saved here. Mean frame time changes from **19.91 to 17.25 ms**; pooled p95 changes from **26.70 to 22.10 ms** (900 frames each). The observed mean improves **13.36%**, meeting the specified 5% regression gate. The unchanged-background F control measures **19.38 → 19.40 ms** (300 frames each). W20's renderer counter changes from **392,814 → 342,078 triangles**, and **159 → 161 calls**; the counter includes visible passes and is distinct from the source triangle budget. The initial material-only prototype measured 20.43 ms over 300 frames. These are local development observations, not a general hardware benchmark or a stable 60 FPS claim.

10. **Collision verification.** The focused tests cast 336 downward terrain-filtered rays in the actual world and compare them with the displayed/shared heightfield. The actual game capsule controller traverses both former contacts over 670 fixed steps per site, then thrusts and lands within each pilot. These checks pass, as do the existing object-support and retained-rock regressions. They are automated physical tests. A native/browser walk and sustained jetpack input were **not** completed and are not claimed as verified.

11. **Checks.** Tidefall: **170/170 tests pass**, with all seven focused tests repeated after the final material adjustment; typecheck and production build pass. Root Resolve: **385 pass, one conditional source/OCR fixture test skips**, typecheck passes. The build retains the existing large-chunk advisory. No generated build, dependency installation or cache is committed.

12. **Remaining defects.** Contacts have no separate pilot overlay, but the modest heightfield profiles still read too much like rounded terrain, especially at 20–50 m. The eastern exposure is hard to judge under the scenario's very low sun. Existing boulders can dominate close views. The current grid cannot reproduce overhangs or submetre rock faces. This pilot does not establish a reference-quality geological appearance; its material and shape acceptance is therefore inconclusive.

13. **Preservation.** No pilot changes were merged/cherry-picked into the active project. The active `C:\Users\Kyler\Resolve\tidefall` remains at the HUD-restoration checkpoint with the previously improved volcanic lighting. The candidate uses its own source, build directory and port; its dependency directory is a junction to the existing installation.

14. **Decision.** Keep the two-site candidate available for review, retain all raw evidence and recovery checkpoints, and do not expand it to other formations or overwrite port 4174. Any next geometric refinement starts from this isolated worktree and the stated open gates.

Restored production HUD:

![Restored production pointer and inspection card](restored-hud.png)
