import { useState, useCallback } from "react";
import { useIdsBuilder } from "../../contexts/IdsBuilderContext";
import { IFC_VERSIONS, FACET_TYPES } from "../../lib/ids-constants";
import IdsFacetEditor from "./IdsFacetEditor";

const SPEC_CARDINALITIES = [
  { minOccurs: 1, maxOccurs: "unbounded", label: "Required", desc: "At least one matching element must exist", color: "#10b981" },
  { minOccurs: 0, maxOccurs: "unbounded", label: "Optional", desc: "Matching elements are optional, but if present must pass", color: "#f59e0b" },
  { minOccurs: 0, maxOccurs: 0, label: "Prohibited", desc: "No matching elements may exist", color: "#ef4444" },
];

export default function IdsSpecEditor({ modelData }) {
  const {
    selectedSpec, selectedSpecId,
    updateSpecification, addFacet, updateFacet, updateFacetParams, removeFacet,
  } = useIdsBuilder();

  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const [reqPickerOpen, setReqPickerOpen] = useState(false);

  const spec = selectedSpec;
  if (!spec) return null;

  const handleAddFacet = useCallback((section, facetType) => {
    addFacet(selectedSpecId, section, facetType);
    if (section === "applicability") setAppPickerOpen(false);
    else setReqPickerOpen(false);
  }, [addFacet, selectedSpecId]);

  const toggleVersion = useCallback((ver) => {
    const current = spec.ifcVersion || [];
    const next = current.includes(ver)
      ? current.filter(v => v !== ver)
      : [...current, ver];
    if (next.length > 0) updateSpecification(selectedSpecId, { ifcVersion: next });
  }, [spec.ifcVersion, updateSpecification, selectedSpecId]);

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      {/* Spec Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Specification Name</label>
            <input
              value={spec.name}
              onChange={e => updateSpecification(selectedSpecId, { name: e.target.value })}
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600, padding: "8px 12px" }}
              placeholder="e.g. Walls must have FireRating"
            />
          </div>
          <div style={{ width: 140, flexShrink: 0 }}>
            <label style={labelStyle}>Identifier</label>
            <input
              value={spec.identifier || ""}
              onChange={e => updateSpecification(selectedSpecId, { identifier: e.target.value })}
              style={{ ...inputStyle, fontSize: 13, padding: "8px 12px" }}
              placeholder="e.g. SP01"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={spec.description || ""}
              onChange={e => updateSpecification(selectedSpecId, { description: e.target.value })}
              style={{ ...inputStyle, minHeight: 40, resize: "vertical" }}
              placeholder="What does this specification check?"
              rows={2}
            />
          </div>
          <div>
            <label style={labelStyle}>IFC Versions</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {IFC_VERSIONS.map(v => (
                <button
                  key={v}
                  onClick={() => toggleVersion(v)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                    border: (spec.ifcVersion || []).includes(v) ? "1.5px solid #4f46e5" : "1.5px solid #d1d5db",
                    background: (spec.ifcVersion || []).includes(v) ? "#eef2ff" : "#fff",
                    color: (spec.ifcVersion || []).includes(v) ? "#4f46e5" : "#888",
                    cursor: "pointer",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Instructions (optional)</label>
            <input
              value={spec.instructions || ""}
              onChange={e => updateSpecification(selectedSpecId, { instructions: e.target.value })}
              style={inputStyle}
              placeholder="General instructions for this specification..."
            />
          </div>
          <div style={{ width: 220, flexShrink: 0 }}>
            <label style={labelStyle}>Specification Applicability</label>
            <div style={{ display: "flex", gap: 4 }}>
              {SPEC_CARDINALITIES.map(sc => {
                const isActive = (spec.minOccurs ?? 1) === sc.minOccurs
                  && (spec.maxOccurs ?? "unbounded") === sc.maxOccurs;
                return (
                  <button
                    key={sc.label}
                    onClick={() => updateSpecification(selectedSpecId, {
                      minOccurs: sc.minOccurs, maxOccurs: sc.maxOccurs,
                    })}
                    title={sc.desc}
                    style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                      border: isActive ? `1.5px solid ${sc.color}` : "1.5px solid #d1d5db",
                      background: isActive ? `${sc.color}15` : "#fff",
                      color: isActive ? sc.color : "#888",
                      cursor: "pointer",
                    }}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* APPLICABILITY */}
      <SectionHeader
        title="Applicability"
        subtitle="Which elements does this specification apply to?"
        color="#4f46e5"
        count={spec.applicability?.length || 0}
      />

      {(spec.applicability || []).map(facet => (
        <IdsFacetEditor
          key={facet.id}
          facet={facet}
          section="applicability"
          modelData={modelData}
          onUpdate={patch => updateFacet(selectedSpecId, "applicability", facet.id, patch)}
          onUpdateParams={patch => updateFacetParams(selectedSpecId, "applicability", facet.id, patch)}
          onRemove={() => removeFacet(selectedSpecId, "applicability", facet.id)}
        />
      ))}

      <div style={{ position: "relative", marginBottom: 24 }}>
        <button
          onClick={() => setAppPickerOpen(!appPickerOpen)}
          style={addFacetBtn}
        >
          + Add Applicability Filter
        </button>
        {appPickerOpen && (
          <FacetPicker
            onSelect={type => handleAddFacet("applicability", type)}
            onClose={() => setAppPickerOpen(false)}
          />
        )}
      </div>

      {/* REQUIREMENTS */}
      <SectionHeader
        title="Requirements"
        subtitle="What information must matching elements have?"
        color="#10b981"
        count={spec.requirements?.length || 0}
      />

      {(spec.requirements || []).length === 0 && (
        <div style={{
          padding: 20, textAlign: "center", color: "#aaa",
          border: "2px dashed #e5e7eb", borderRadius: 8, marginBottom: 12,
          fontSize: 13,
        }}>
          No requirements yet. Add a requirement to define what information elements must have.
        </div>
      )}

      {(spec.requirements || []).map(facet => (
        <IdsFacetEditor
          key={facet.id}
          facet={facet}
          section="requirements"
          modelData={modelData}
          onUpdate={patch => updateFacet(selectedSpecId, "requirements", facet.id, patch)}
          onUpdateParams={patch => updateFacetParams(selectedSpecId, "requirements", facet.id, patch)}
          onRemove={() => removeFacet(selectedSpecId, "requirements", facet.id)}
        />
      ))}

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setReqPickerOpen(!reqPickerOpen)}
          style={{ ...addFacetBtn, borderColor: "#10b981", color: "#10b981" }}
        >
          + Add Requirement
        </button>
        {reqPickerOpen && (
          <FacetPicker
            onSelect={type => handleAddFacet("requirements", type)}
            onClose={() => setReqPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, color, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 12, paddingBottom: 8,
      borderBottom: `2px solid ${color}30`,
    }}>
      <span style={{
        width: 4, height: 20, borderRadius: 2,
        background: color,
      }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color }}>
          {title}
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 600,
            background: `${color}15`, color, padding: "2px 8px",
            borderRadius: 10,
          }}>
            {count}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#888" }}>{subtitle}</div>
      </div>
    </div>
  );
}

function FacetPicker({ onSelect, onClose }) {
  return (
    <>
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
      }} onClick={onClose} />
      <div style={{
        position: "absolute", top: "100%", left: 0, marginTop: 4,
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 51,
        padding: "6px 0", minWidth: 260,
      }}>
        {FACET_TYPES.map(ft => (
          <button
            key={ft.key}
            onClick={() => onSelect(ft.key)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", width: "100%",
              border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13,
              textAlign: "left", transition: "background 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{ft.icon}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{ft.label}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{ft.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "#555", marginBottom: 3,
};

const inputStyle = {
  width: "100%", padding: "5px 10px",
  border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, color: "#333", background: "#fff",
  outline: "none", boxSizing: "border-box",
};

const addFacetBtn = {
  padding: "6px 16px", borderRadius: 6,
  border: "1.5px dashed #4f46e5", background: "transparent",
  color: "#4f46e5", fontSize: 12, fontWeight: 600,
  cursor: "pointer",
};
