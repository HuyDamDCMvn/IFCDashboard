import * as WebIFC from "web-ifc";
import * as THREE from "three";

const CATEGORY_COLORS = {
  IFCWALL: 0xc8c8c8,
  IFCWALLSTANDARDCASE: 0xc8c8c8,
  IFCSLAB: 0xb0b0b0,
  IFCCOLUMN: 0xa0d0a0,
  IFCBEAM: 0xa0a0d0,
  IFCDOOR: 0x8b6914,
  IFCWINDOW: 0x88ccee,
  IFCSTAIR: 0xd0c0a0,
  IFCSTAIRFLIGHT: 0xd0c0a0,
  IFCROOF: 0xcc6666,
  IFCRAILING: 0x999999,
  IFCCURTAINWALL: 0x66aacc,
  IFCPLATE: 0x909090,
  IFCMEMBER: 0x8888cc,
  IFCFOOTING: 0x808080,
  IFCFURNISHINGELEMENT: 0xd4a574,
  IFCFLOWSEGMENT: 0x66cc66,
  IFCFLOWTERMINAL: 0x66cc66,
  IFCFLOWFITTING: 0x66cc66,
  IFCSPACE: 0xeeeeee,
  IFCBUILDINGELEMENTPROXY: 0xaaaaaa,
};

const DEFAULT_COLOR = 0xcccccc;

export async function loadIfcModel(fileBuffer) {
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath("/");
  await ifcApi.Init();

  const data = new Uint8Array(fileBuffer);
  const modelID = ifcApi.OpenModel(data);

  const group = new THREE.Group();
  const meshDataByType = {};

  const allTypes = ifcApi.GetAllTypesOfModel(modelID);

  for (const typeObj of allTypes) {
    const typeName = typeObj.typeName;
    const typeID = typeObj.typeID;
    const lines = ifcApi.GetLineIDsWithType(modelID, typeID);

    for (let i = 0; i < lines.size(); i++) {
      const expressID = lines.get(i);

      try {
        const flatMesh = ifcApi.GetFlatMesh(modelID, expressID);
        const placedGeometries = flatMesh.geometries;

        for (let j = 0; j < placedGeometries.size(); j++) {
          const placed = placedGeometries.get(j);
          const geometry = ifcApi.GetGeometry(modelID, placed.geometryExpressID);

          const verts = ifcApi.GetVertexArray(
            geometry.GetVertexData(),
            geometry.GetVertexDataSize()
          );
          const indices = ifcApi.GetIndexArray(
            geometry.GetIndexData(),
            geometry.GetIndexDataSize()
          );

          if (verts.length === 0 || indices.length === 0) continue;

          const bufferGeometry = new THREE.BufferGeometry();

          const posFloats = new Float32Array(verts.length / 2);
          const normFloats = new Float32Array(verts.length / 2);

          for (let k = 0; k < verts.length; k += 6) {
            const idx = k / 2;
            posFloats[idx] = verts[k];
            posFloats[idx + 1] = verts[k + 1];
            posFloats[idx + 2] = verts[k + 2];
            normFloats[idx] = verts[k + 3];
            normFloats[idx + 1] = verts[k + 4];
            normFloats[idx + 2] = verts[k + 5];
          }

          bufferGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(posFloats, 3)
          );
          bufferGeometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normFloats, 3)
          );
          bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

          const colorHex =
            CATEGORY_COLORS[typeName?.toUpperCase()] || DEFAULT_COLOR;
          const material = new THREE.MeshPhongMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: placed.color.w < 1,
            opacity: placed.color.w,
          });

          const mesh = new THREE.Mesh(bufferGeometry, material);

          const matrix = new THREE.Matrix4();
          matrix.fromArray(placed.flatTransformation);
          mesh.applyMatrix4(matrix);

          mesh.userData = { expressID, typeName };
          group.add(mesh);

          if (!meshDataByType[typeName]) meshDataByType[typeName] = 0;
          meshDataByType[typeName]++;

          geometry.delete();
        }
      } catch {
        // Some elements don't have geometry
      }
    }
  }

  ifcApi.CloseModel(modelID);

  return { group, meshDataByType };
}
