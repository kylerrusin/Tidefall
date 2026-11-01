import fs from 'node:fs';import crypto from 'node:crypto';
const gltf=JSON.parse(fs.readFileSync('assets-source/rock-face/source.gltf','utf8')),data=fs.readFileSync('assets-source/rock-face/source.bin');
const get=(index)=>{const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];return data.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+(a.byteOffset??0)+a.count*(a.type==='VEC3'?3:1)*(a.componentType===5126?4:2));};
const positions=get(0),indices=get(3);fs.writeFileSync('src/data/rock-face-packed.ts',`/** CC0 Poly Haven rock_face_01 geometry; regenerate with scripts/pack-rock-asset.mjs. */\nexport const rockPositions='${positions.toString('base64')}';\nexport const rockIndices='${indices.toString('base64')}';\n`);
console.log(JSON.stringify({vertices:gltf.accessors[0].count,triangles:gltf.accessors[3].count/3,sourceBytes:data.length,runtimeBytes:positions.length+indices.length,sha256:crypto.createHash('sha256').update(data).digest('hex')}));
