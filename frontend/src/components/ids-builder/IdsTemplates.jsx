import { useCallback } from "react";
import { useIdsBuilder } from "../../contexts/IdsBuilderContext";
import { newUUID, createEmptySpec } from "../../lib/ids-constants";

const TEMPLATES = [
  {
    name: "DIN 276 — MEP Cost Code",
    description: "MEP elements must have Kostengruppe DIN 276 (dritte Ebene) value",
    build: () => ({
      info: {
        title: "DIN 276 Cost Code — MEP",
        copyright: "",
        version: "1.0", author: "", description: "All MEP (distribution) elements must have a DIN 276 level-3 cost group code in MRE_allge property set.",
        date: new Date().toISOString().slice(0, 10),
        purpose: "cost estimation",
        milestone: "",
      },
      specifications: [{
        id: newUUID(), name: "MEP — DIN 276 code required",
        identifier: "DIN276-MEP-01",
        description: "Every IfcDistributionElement must have a non-empty Kostengruppe DIN 276 (dritte Ebene) property",
        ifcVersion: ["IFC4"], instructions: "Provide the DIN 276 level-3 cost group code, e.g. 411.10",
        minOccurs: 1, maxOccurs: "unbounded",
        applicability: [
          { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCDISTRIBUTIONELEMENT", predefinedType: "" } },
        ], requirements: [
          { id: newUUID(), type: "property", cardinality: "required", instructions: "Enter DIN 276 cost code (e.g. 411.10)", params: { propertySet: "MRE_allge", baseName: "Kostengruppe DIN 276 (dritte Ebene)", dataType: "IFCLABEL", value: "", uri: "" } },
        ],
      }],
    }),
  },
  {
    name: "Basic QA — Names Required",
    description: "All building elements must have a Name attribute",
    build: () => ({
      info: {
        title: "Basic QA — Names Required",
        copyright: "", version: "1.0", author: "", description: "Ensures all building elements have a Name.",
        date: new Date().toISOString().slice(0, 10), purpose: "coordination", milestone: "",
      },
      specifications: [{
        id: newUUID(), name: "All elements must have a Name",
        identifier: "QA-NAME-01",
        description: "Every IfcBuildingElement should have a non-empty Name attribute",
        ifcVersion: ["IFC4"], instructions: "",
        minOccurs: 1, maxOccurs: "unbounded",
        applicability: [
          { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCBUILDINGELEMENT", predefinedType: "" } },
        ], requirements: [
          { id: newUUID(), type: "attribute", cardinality: "required", instructions: "Provide a descriptive Name", params: { name: "Name", value: "" } },
        ],
      }],
    }),
  },
  {
    name: "Fire Safety — Fire Rating",
    description: "Walls and doors must have FireRating property",
    build: () => ({
      info: {
        title: "Fire Safety Requirements",
        version: "1.0", author: "", description: "Checks fire safety properties on walls and doors.",
        date: new Date().toISOString().slice(0, 10),
      },
      specifications: [
        {
          id: newUUID(), name: "Walls must have FireRating",
          description: "", ifcVersion: ["IFC4"], instructions: "", applicability: [
            { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCWALL", predefinedType: "" } },
          ], requirements: [
            { id: newUUID(), type: "property", cardinality: "required", instructions: "Provide fire resistance rating", params: { propertySet: "Pset_WallCommon", baseName: "FireRating", dataType: "IFCLABEL", value: "", uri: "" } },
          ],
        },
        {
          id: newUUID(), name: "Doors must have FireRating",
          description: "", ifcVersion: ["IFC4"], instructions: "", applicability: [
            { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCDOOR", predefinedType: "" } },
          ], requirements: [
            { id: newUUID(), type: "property", cardinality: "required", instructions: "Provide fire resistance rating", params: { propertySet: "Pset_DoorCommon", baseName: "FireRating", dataType: "IFCLABEL", value: "", uri: "" } },
          ],
        },
      ],
    }),
  },
  {
    name: "Classification Required",
    description: "All building elements must have a classification reference",
    build: () => ({
      info: {
        title: "Classification Required",
        version: "1.0", author: "", description: "Ensures classification data is assigned.",
        date: new Date().toISOString().slice(0, 10),
      },
      specifications: [{
        id: newUUID(), name: "Elements must be classified",
        description: "All building elements should have at least one classification reference",
        ifcVersion: ["IFC4"], instructions: "", applicability: [
          { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCBUILDINGELEMENT", predefinedType: "" } },
        ], requirements: [
          { id: newUUID(), type: "classification", cardinality: "required", instructions: "Assign a classification code", params: { system: "", value: "", uri: "" } },
        ],
      }],
    }),
  },
  {
    name: "Material Required",
    description: "Walls, slabs, and columns must have material assignment",
    build: () => ({
      info: {
        title: "Material Assignment Required",
        version: "1.0", author: "", description: "Key structural elements must have materials.",
        date: new Date().toISOString().slice(0, 10),
      },
      specifications: [
        ...(["IFCWALL", "IFCSLAB", "IFCCOLUMN"]).map(entity => ({
          id: newUUID(), name: `${entity.replace("IFC", "")}s must have material`,
          description: "", ifcVersion: ["IFC4"], instructions: "", applicability: [
            { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: entity, predefinedType: "" } },
          ], requirements: [
            { id: newUUID(), type: "material", cardinality: "required", instructions: "Assign material", params: { value: "", uri: "" } },
          ],
        })),
      ],
    }),
  },
  {
    name: "Spatial Structure",
    description: "Elements must be contained in a building storey",
    build: () => ({
      info: {
        title: "Spatial Structure Required",
        version: "1.0", author: "", description: "All elements must be assigned to a storey.",
        date: new Date().toISOString().slice(0, 10),
      },
      specifications: [{
        id: newUUID(), name: "Elements must be in a storey",
        description: "All building elements should be contained in an IfcBuildingStorey",
        ifcVersion: ["IFC4"], instructions: "", applicability: [
          { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: "IFCBUILDINGELEMENT", predefinedType: "" } },
        ], requirements: [
          { id: newUUID(), type: "partOf", cardinality: "required", instructions: "Place element in a storey", params: { name: "IFCBUILDINGSTOREY", predefinedType: "", relation: "IFCRELCONTAINEDINSPATIALSTRUCTURE" } },
        ],
      }],
    }),
  },
  {
    name: "LoadBearing Property",
    description: "Walls, columns, beams must declare load-bearing status",
    build: () => ({
      info: {
        title: "Load Bearing Required",
        version: "1.0", author: "", description: "Structural elements must declare if they are load-bearing.",
        date: new Date().toISOString().slice(0, 10),
      },
      specifications: [
        ...([
          { entity: "IFCWALL", pset: "Pset_WallCommon" },
          { entity: "IFCCOLUMN", pset: "Pset_ColumnCommon" },
          { entity: "IFCBEAM", pset: "Pset_BeamCommon" },
        ]).map(({ entity, pset }) => ({
          id: newUUID(), name: `${entity.replace("IFC", "")} — LoadBearing required`,
          description: "", ifcVersion: ["IFC4"], instructions: "", applicability: [
            { id: newUUID(), type: "entity", cardinality: "required", instructions: "", params: { name: entity, predefinedType: "" } },
          ], requirements: [
            { id: newUUID(), type: "property", cardinality: "required", instructions: "", params: { propertySet: pset, baseName: "LoadBearing", dataType: "IFCBOOLEAN", value: "", uri: "" } },
          ],
        })),
      ],
    }),
  },
];

export default function IdsTemplates({ onClose }) {
  const { loadDocument } = useIdsBuilder();

  const handleSelect = useCallback((template) => {
    const doc = template.build();
    loadDocument(doc);
    onClose();
  }, [loadDocument, onClose]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>IDS Templates</span>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>
        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px" }}>
            Select a template to start with. This will replace your current IDS document.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => handleSelect(t)}
                style={cardStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#4f46e5"; e.currentTarget.style.background = "#f8f9ff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fff"; }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 4 }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 600,
  background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalStyle = {
  width: 640, maxHeight: "70vh",
  background: "#fff", borderRadius: 12,
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid #e5e7eb",
};

const closeBtnStyle = {
  background: "none", border: "none",
  fontSize: 20, color: "#666", cursor: "pointer",
};

const cardStyle = {
  padding: 16, borderRadius: 10,
  border: "1.5px solid #e5e7eb", background: "#fff",
  cursor: "pointer", textAlign: "left",
  transition: "all 0.15s",
};
