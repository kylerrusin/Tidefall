# Round 11 — terrain propagation, blending and rendering cleanup

Continues checkpoint `22ca0f69edbeb2e6e069c6170b2c367f971d16f4` in the existing game. The user confirmed that the brief's “Kepler 22” cloud request applies to the existing Tidefall/TRAPPIST-1 e ocean world. No new planet or gameplay system was added.

## Diagnosis

The renderer does not use a terrain splat map, texture-index array or asynchronous chunk material assignment. All terrain already called the geological shader. The uneven result came from several independent masks and material paths:

1. `materials.ts` derived a loose-sediment mask from the interpolated categorical treatment number. Treatment 5 (`grains`) disabled photographic normal/roughness detail completely and reduced photographic albedo to 10%. Basaltic regolith shares that treatment with loose beach sand. On the sampled marine map, 1,168 of 3,132 vertices fell into this suppressed category, including all 281 basaltic-regolith samples.
2. The geological registry selects units/facies with hard bed/elevation/patch thresholds. Their discrete palette and facies tints were fed directly into terrain vertices. Interpolating a categorical treatment number could also pass through a third treatment between two unrelated endpoints.
3. Terrain vertices received an independent random brightness multiplier by vertex index, producing triangle-scale mottling unrelated to terrain processes.
4. Procedural outcrop meshes used a single unit tint right to the embedded skirt. That left polygon-shaped color patches even where the mesh geometry joined the ground correctly.
5. The background apron used one uniform tint, separate from the main terrain's geological attributes.

The PBR files, loading readiness and 2.4 m world-space triplanar projection were already connected correctly. Those assets are retained. The new treatment fixes the deployment and blending of them.

## Terrain and contacts

`geological-fields.ts` now provides a continuous appearance alongside the existing discrete geological identity and physical properties. Slope exposure, weathered shoulders and deposition determine rock/sediment cover. Broad, correlated variation and subdued bedding provide tonal structure. The random per-vertex brightness multiplier is removed.

Terrain passes explicit rock-exposure and bedding weights to the shader; it no longer recovers them from interpolated catalog IDs. Exposed ground receives stronger photographic normal detail, while flat depositional areas keep grain and cover. The detailed cliff assets and their source textures remain in place. Fine artificial lamina contrast was reduced to avoid conspicuous striping.

Procedural outcrop shading fades into parent terrain at the embedded contact, then increases exposed-rock treatment above it. The final fault inspection exposed and verified this repair. The far apron receives the same color/material attributes, retaining broad tonal structure and atmospheric fog.

Terrain height generation, apron vertex/index data, outcrop positions, collision meshes and playable boundaries were not redesigned. Tests compare the two terrain and two apron buffers against recorded SHA-256 hashes; all four match. Geological unit IDs, physical friction/density and source inspection contracts remain authoritative.

## Plants

The existing 260-organism budget is distributed among 33 favorable habitat clusters, with variation in radius, height, size and dominant growth form. Cavern and hydrothermal microhabitats retain their specialized forms. All ten existing growth templates occur on seed 42; Pyrax still has no native vegetation.

252 of 260 organisms have another organism within 4 m; mean nearest-neighbor distance is 1.82 m. Leaf-relative tissue coordinates add subtle grain, midribs and veins. Vertex tint varies from root to tip, and wind displacement now vanishes at each root instead of moving the entire organism sideways. These remain stylized procedural organisms, not scanned vegetation.

## Clouds and Pyrax preservation

The ocean-world cloud layer now has spatially variable base and top heights, a thicker vertical envelope, density erosion, softer edges and approximate light penetration/self-shadowing. Eight bounded samples integrate the volume. A 64×64, 16 KiB noise texture packs adjacent Y slices into R/G channels, reconstructing 3D value noise with one bilinear fetch per evaluation instead of eight arithmetic hashes. Its smallest world-space repetition period is about 35 km, beyond the inspected local scene.

This is a reduced volume renderer. Cloud undersides can still look soft or sheet-like from some angles, and neither full cloud shadow maps nor a weather-fluid simulation is implemented. The screenshot comparison is evidence of the changed rendering, not proof of photographic equivalence.

The Pyrax atmospheric composition, optical column, aerosol, stellar tint, weather and fog controls are unchanged. Its zero condensate-cloud coverage bypasses the changed cloud renderer. The terrain material cleanup applies there; the requested atmospheric mood is retained.

## Water

The old offshore rectangle covered only z≥160, beyond the south edge of the numerical square. The other three edges had no exterior water mesh. This was a concrete mesh-coverage defect; the supplied missing-water screenshot itself was not accessible, so an exact reproduction of that particular image was unavailable.

The existing water shader now continues around all four edges over the existing terrain apron. Its inner ring has 512 vertices matching the numerical shoreline perimeter. Mean elevation and optical depth use the same reconstructed free surface and bed at the join, then transition to the offshore boundary level. Wet/dry clipping follows the apron triangles. Conservative culling bounds cover the full animated surface. Synthetic flat-bed tests check coverage at 48 points around all four edges, and another test checks every inner-boundary height and depth against the near water mesh.

The straight sine/cosine ripple-normal and diagonal foam stripes are replaced by subdued, aperiodic noise. Opacity fades at shallow contact depth. Shared physical wave components and numerical hydrodynamics are retained. Exterior water is a visual continuation, not an extension of the playable fluid simulation. Wet shoreline darkening, coarse distant bathymetry and the reduced height-envelope model remain visible limitations.

## Facility lighting

There are no baked lightmaps or reflection probes in this facility pipeline. Two unshadowed 18 m point lights emitted through compartment walls and produced bright ceiling/specular patches. They were replaced by downward, short-range lights at visible ceiling fixtures. Their cone footprints stay within rooms or the corridor. Opaque metal is rougher and less metallic; existing display/light parts are visibly emissive. The suit lamp has a weaker indoor response while preserving its outdoor behavior and close-surface protection.

The paired corridor images show the former unsupported ceiling highlight replaced by light pools under visible fixtures. These lights use bounded direct illumination rather than full interior light transport; all equipment does not cast a separate dynamic shadow. Doors, glazing, protection and navigation remain on the existing shared facility contract.

## Evidence and performance

[The gallery](evidence/round11/gallery.md) contains actual browser screenshots of the shelf, volcanic highland, fault, plants, shoreline/water boundary, facility, clouds and Pyrax. Baseline screenshots were captured using the Round 10 production client; after screenshots use the Round 11 client, with matched seed/time/position fixtures where stated. Dynamic bodies, animation phases, UI prompts and small keyboard-controlled look angles can differ. The detailed relief reference image was not present in the accessible attachment; no direct photographic comparison is claimed.

[ROUND11-evidence.json](ROUND11-evidence.json) records the repeatable audit:

| Check | Observed result |
| --- | --- |
| Marine substantial rock eligibility | 2,582 / 3,132 samples (82.4%) |
| Marine steep samples with >95% rock exposure | 558 / 558 |
| Basaltic-regolith samples retaining substantial rock detail | 281 / 281 |
| Pyrax substantial rock eligibility | 3,132 / 3,132 |
| Synthetic 2.5 cm height sweep across 139 catalog/facies switches | Maximum appearance-component jump 0.00007445 |
| Plants | 260 organisms, 33 clusters, ten growth forms |
| Ocean continuation at the initial tide | 2,036 rendered triangles |
| Continuation CPU update, 80 local samples | Median 1.368 ms, p95 5.399 ms, max 31.750 ms |

Coverage weights measure material eligibility, not visual realism. CPU timings were collected on a shared machine and are not a whole-frame benchmark. The allocation reduction removes per-triangle temporary arrays from the common fully wet path.

The first arithmetic-noise cloud revision showed a sky GPU query of 17.18 ms in the upward storm view. Cached-noise samples then showed 5.33–6.94 ms in a similar view, with slightly different pitch and noise realization. The saved High screenshot showed 26 FPS, frame 37.8 ms, p95 45.3 ms, about 410k triangles and 24.43 MiB estimated mapped texture storage. Low reached 30 FPS, frame 33.0 ms, p95 41.4 ms, 206k triangles and sky GPU 4.54 ms. These are embedded-browser samples under local process contention, not a controlled speedup claim or a stable desktop frame-rate guarantee. Native GPU testing remains outstanding.

## Validation and handoff

The full game suite passed **142 tests**; seven focused Round 11 cases also passed after the final water/cloud optimization. Game typecheck, production build and health/HTML/assets smoke checks passed. The root Resolve suite passed **385 tests with one private-fixture skip**, and root typecheck passed. The large production-chunk warning remains. Final command logs are local ignored artifacts; the audit, report and curated screenshots are included in the checkpoint.

The local QA server stages seed/time/position and protects/freezes suits for visual inspection. Browser UI input exercises looking, settings and interactions. There is no production QA endpoint. Existing multiplayer tests cover real sockets and cabin state; no new long wall-clock soak, native Pointer Lock test, Internet deployment or Docker execution was performed this round.

Run from the repository root with `npm run tidefall`, or from `tidefall` with `npm run build` followed by `npm start`. Open http://localhost:4173 in Edge/Chrome for native mouse capture. `node --import tsx scripts/round11-audit.ts` regenerates the audit. The exact production/container commands and hosting limits remain in [README](README.md) and [Round 10's run instructions](ROUND10.md#20-run-and-deploy). No public deployment or push was performed.
