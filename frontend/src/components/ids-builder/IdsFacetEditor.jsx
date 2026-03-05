import { useCallback, useMemo } from "react";
import {
  IFC_ENTITIES, IFC_DATA_TYPES, IFC_ATTRIBUTES,
  COMMON_PSETS, CARDINALITIES, SPATIAL_ENTITIES, PARTOF_RELATIONS,
  FACET_TYPES,
} from "../../lib/ids-constants";
import IdsValueEditor from "./IdsValueEditor";

export default function IdsFacetEditor({ facet, section, onUpdate, onUpdateParams, onRemove, modelData }) {
  const facetMeta = FACET_TYPES.find(f => f.key === facet.type);
  const isApplicability = section === "applicability";

  const modelEntities = useMemo(() => {
    if (!modelData?.elements) return [];
    const set = new Set();
    modelData.elements.forEach(el => {
      if (el.type) set.add(el.type.toUpperCase());
      if (el.rawType) set.add(el.rawType.toUpperCase());
    });
    return [...set].sort();
  }, [modelData]);

  const modelPsets = useMemo(() => {
    if (!modelData?.elements) return {};
    const psets = {};
    modelData.elements.forEach(el => {
      Object.entries(el.propertySets || {}).forEach(([psetName, props]) => {
        if (!psets[psetName]) psets[psetName] = new Set();
        Object.keys(props).forEach(k => psets[psetName].add(k));
      });
    });
    const result = {};
    Object.entries(psets).forEach(([k, v]) => { result[k] = [...v].sort(); });
    return result;
  }, [modelData]);

  const modelMaterials = useMemo(() => {
    if (!modelData?.elements) return [];
    const set = new Set();
    modelData.elements.forEach(el => {
      (el.materials || []).forEach(m => set.add(m.split(" (")[0]));
    });
    return [...set].sort();
  }, [modelData]);

  const allEntities = useMemo(() => {
    const set = new Set([...IFC_ENTITIES, ...modelEntities]);
    return [...set].sort();
  }, [modelEntities]);

  const allPsetNames = useMemo(() => {
    const set = new Set([...Object.keys(COMMON_PSETS), ...Object.keys(modelPsets)]);
    return [...set].sort();
  }, [modelPsets]);

  const getPropNames = useCallback((psetName) => {
    const common = COMMON_PSETS[psetName] || [];
    const fromModel = modelPsets[psetName] || [];
    const set = new Set([...common, ...fromModel]);
    return [...set].sort();
  }, [modelPsets]);

  const modelPredefinedTypes = useMemo(() => {
    if (!modelData?.elements) return [];
    const set = new Set();
    modelData.elements.forEach(el => {
      if (el.predefinedType) set.add(el.predefinedType.toUpperCase());
    });
    return [...set].sort();
  }, [modelData]);

  const p = facet.params;
  const setP = onUpdateParams;

  const colorMap = {
    entity: "#4f46e5",
    attribute: "#0ea5e9",
    property: "#10b981",
    classification: "#f59e0b",
    material: "#ec4899",
    partOf: "#8b5cf6",
  };
  const color = colorMap[facet.type] || "#666";

  return (
    <div style={{
      padding: 12, borderRadius: 8,
      border: `1px solid ${color}30`,
      background: `${color}08`,
      marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 14, color, lineHeight: 1,
        }}>{facetMeta?.icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {facetMeta?.label || facet.type}
        </span>

        {!isApplicability && (
          <select
            value={facet.cardinality || "required"}
            onChange={e => onUpdate({ cardinality: e.target.value })}
            style={{
              marginLeft: "auto", padding: "2px 6px", borderRadius: 4,
              border: "1px solid #d1d5db", fontSize: 10, fontWeight: 600,
              color: facet.cardinality === "prohibited" ? "#ef4444" : "#333",
              background: "#fff", cursor: "pointer",
            }}
          >
            {CARDINALITIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        )}

        <button onClick={onRemove}
          style={{
            marginLeft: isApplicability ? "auto" : 0,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 16, color: "#ccc", padding: 0, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#ccc"; }}
          title="Remove facet"
        >
          &times;
        </button>
      </div>

      {/* ENTITY */}
      {facet.type === "entity" && (
        <div style={fieldsGrid}>
          <div>
            <label style={labelStyle}>IFC Class</label>
            <input
              value={p.name || ""}
              onChange={e => setP({ name: e.target.value.toUpperCase() })}
              list="entity-list"
              style={inputStyle}
              placeholder="IFCWALL"
            />
            <datalist id="entity-list">
              {allEntities.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>
          <div>
            <label style={labelStyle}>Predefined Type (optional)</label>
            <input
              value={p.predefinedType || ""}
              onChange={e => setP({ predefinedType: e.target.value.toUpperCase() })}
              list="predef-list"
              style={inputStyle}
              placeholder="e.g. PARTITIONING"
            />
            <datalist id="predef-list">
              {modelPredefinedTypes.map(pt => <option key={pt} value={pt} />)}
            </datalist>
          </div>
        </div>
      )}

      {/* ATTRIBUTE */}
      {facet.type === "attribute" && (
        <div>
          <div style={fieldsGrid}>
            <div>
              <label style={labelStyle}>Attribute Name</label>
              <select
                value={p.name || ""}
                onChange={e => setP({ name: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select...</option>
                {IFC_ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Value</label>
            <IdsValueEditor value={p.value} onChange={v => setP({ value: v })} />
          </div>
        </div>
      )}

      {/* PROPERTY */}
      {facet.type === "property" && (
        <div>
          <div style={fieldsGrid}>
            <div>
              <label style={labelStyle}>Property Set</label>
              <input
                value={p.propertySet || ""}
                onChange={e => setP({ propertySet: e.target.value })}
                list="pset-list"
                style={inputStyle}
                placeholder="Pset_WallCommon"
              />
              <datalist id="pset-list">
                {allPsetNames.map(ps => <option key={ps} value={ps} />)}
              </datalist>
            </div>
            <div>
              <label style={labelStyle}>Property Name</label>
              <input
                value={p.baseName || ""}
                onChange={e => setP({ baseName: e.target.value })}
                list="prop-list"
                style={inputStyle}
                placeholder="FireRating"
              />
              <datalist id="prop-list">
                {getPropNames(p.propertySet).map(pn => <option key={pn} value={pn} />)}
              </datalist>
            </div>
          </div>
          <div style={{ ...fieldsGrid, marginTop: 8 }}>
            <div>
              <label style={labelStyle}>Data Type (optional)</label>
              <select
                value={p.dataType || ""}
                onChange={e => setP({ dataType: e.target.value })}
                style={inputStyle}
              >
                <option value="">Any</option>
                {IFC_DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Value</label>
            <IdsValueEditor value={p.value} onChange={v => setP({ value: v })} />
          </div>
        </div>
      )}

      {/* CLASSIFICATION */}
      {facet.type === "classification" && (
        <div style={fieldsGrid}>
          <div>
            <label style={labelStyle}>System</label>
            <input
              value={p.system || ""}
              onChange={e => setP({ system: e.target.value })}
              style={inputStyle}
              placeholder="Uniclass 2015"
            />
          </div>
          <div>
            <label style={labelStyle}>Value</label>
            <IdsValueEditor value={p.value} onChange={v => setP({ value: v })} />
          </div>
        </div>
      )}

      {/* MATERIAL */}
      {facet.type === "material" && (
        <div>
          <label style={labelStyle}>Material Value</label>
          <input
            value={typeof p.value === "string" ? p.value : ""}
            onChange={e => setP({ value: e.target.value })}
            list="material-list"
            style={inputStyle}
            placeholder="Any material (leave empty) or specific name"
          />
          <datalist id="material-list">
            {modelMaterials.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
      )}

      {/* PARTOF */}
      {facet.type === "partOf" && (
        <div style={fieldsGrid}>
          <div>
            <label style={labelStyle}>Parent Entity</label>
            <select
              value={p.name || ""}
              onChange={e => setP({ name: e.target.value })}
              style={inputStyle}
            >
              {SPATIAL_ENTITIES.map(se => <option key={se} value={se}>{se}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Relation</label>
            <select
              value={p.relation || ""}
              onChange={e => setP({ relation: e.target.value })}
              style={inputStyle}
            >
              <option value="">Any</option>
              {PARTOF_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>Instructions (optional)</label>
        <input
          value={facet.instructions || ""}
          onChange={e => onUpdate({ instructions: e.target.value })}
          style={inputStyle}
          placeholder="Guidance for modelers..."
        />
      </div>
    </div>
  );
}

const fieldsGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: "#555", marginBottom: 2,
};

const inputStyle = {
  width: "100%", padding: "4px 8px",
  border: "1px solid #d1d5db", borderRadius: 5,
  fontSize: 11, color: "#333", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
