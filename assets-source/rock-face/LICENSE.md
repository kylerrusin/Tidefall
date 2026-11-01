# Cliff geometry provenance and processing

Poly Haven **Rock Face 01**: https://polyhaven.com/a/rock_face_01

Author: Dario Barresi. License: CC0 1.0, https://polyhaven.com/license and https://creativecommons.org/publicdomain/zero/1.0/

Downloaded 2026-10-30 from https://api.polyhaven.com/files/rock_face_01. Source glTF: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/rock_face_01/rock_face_01_1k.gltf . Source binary: https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/rock_face_01/rock_face_01.bin . Binary SHA-256: 873eac0319333e92bc96ddeedf8ebf69dc3c68ff1dfe32d8c14ddc165cdb20ac.

The supplied optimized proxy has 11,106 vertices and 20,174 triangles. `node scripts/pack-rock-asset.mjs` extracts positions and indices, reducing runtime geometry from 476,436 to 254,316 raw bytes. Normals are recomputed; separate licensed triplanar maps provide material detail. Two hero placements share the same decoded source. Full mesh collision and a metre-cell triangle index supply exact vertical support. Distant rendering uses vertex clustering at 0.2 m and 0.45 m. No full-resolution million-triangle mesh or new authoring dependency is shipped.

This is a separately licensed CC0 source, not the prohibited Sketchfab reference. Its Earth scan geometry is used as a generic modeled rock shape; geological identity and planetary placement remain simulation assumptions.
