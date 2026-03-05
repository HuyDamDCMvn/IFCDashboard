import { useState, useCallback } from "react";
import { RESTRICTION_TYPES, XS_BASE_TYPES } from "../../lib/ids-constants";

export default function IdsValueEditor({ value, onChange, suggestions, placeholder }) {
  const isRestriction = value && typeof value === "object" && value.type;
  const [mode, setMode] = useState(isRestriction ? "restriction" : (value ? "exact" : "any"));

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    if (newMode === "any") onChange("");
    else if (newMode === "exact") onChange(typeof value === "string" ? value : "");
    else if (newMode === "restriction") {
      onChange({ type: "enumeration", base: "xs:string", values: [""] });
    }
  }, [onChange, value]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {[
          { key: "any", label: "Any" },
          { key: "exact", label: "Exact" },
          { key: "restriction", label: "Restriction" },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => handleModeChange(m.key)}
            style={{
              padding: "2px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              border: mode === m.key ? "1px solid #4f46e5" : "1px solid #d1d5db",
              background: mode === m.key ? "#eef2ff" : "#fff",
              color: mode === m.key ? "#4f46e5" : "#666",
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "exact" && (
        <div>
          <input
            value={typeof value === "string" ? value : ""}
            onChange={e => onChange(e.target.value)}
            style={inputStyle}
            placeholder={placeholder || "Exact value..."}
            list={suggestions?.length ? "val-suggestions" : undefined}
          />
          {suggestions?.length > 0 && (
            <datalist id="val-suggestions">
              {suggestions.map((s, i) => <option key={i} value={s} />)}
            </datalist>
          )}
        </div>
      )}

      {mode === "restriction" && isRestriction && (
        <RestrictionEditor restriction={value} onChange={onChange} />
      )}
    </div>
  );
}

function RestrictionEditor({ restriction, onChange }) {
  const updateField = useCallback((field, val) => {
    onChange({ ...restriction, [field]: val });
  }, [restriction, onChange]);

  return (
    <div style={{ padding: 8, background: "#f8f9fb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
        <label style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>Type:</label>
        <select
          value={restriction.type}
          onChange={e => {
            const t = e.target.value;
            const base = { type: t, base: restriction.base || "xs:string" };
            if (t === "enumeration") onChange({ ...base, values: restriction.values || [""] });
            else if (t === "pattern") onChange({ ...base, pattern: restriction.pattern || "" });
            else if (t === "bounds") onChange({ ...base, minInclusive: "", maxInclusive: "", minExclusive: "", maxExclusive: "" });
            else if (t === "length") onChange({ ...base, length: "", minLength: "", maxLength: "" });
          }}
          style={selectStyle}
        >
          {RESTRICTION_TYPES.map(rt => (
            <option key={rt.key} value={rt.key}>{rt.label}</option>
          ))}
        </select>

        <label style={{ fontSize: 10, color: "#555", fontWeight: 600, marginLeft: 8 }}>Base:</label>
        <select
          value={restriction.base || "xs:string"}
          onChange={e => updateField("base", e.target.value)}
          style={selectStyle}
        >
          {XS_BASE_TYPES.map(bt => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </div>

      {restriction.type === "enumeration" && (
        <EnumerationEditor
          values={restriction.values || []}
          onChange={vals => updateField("values", vals)}
        />
      )}

      {restriction.type === "pattern" && (
        <div>
          <label style={miniLabel}>Regex Pattern:</label>
          <input
            value={restriction.pattern || ""}
            onChange={e => updateField("pattern", e.target.value)}
            style={inputStyle}
            placeholder="e.g. REI\\d+"
          />
        </div>
      )}

      {restriction.type === "bounds" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Min Inclusive (>=):</label>
              <input
                value={restriction.minInclusive ?? ""}
                onChange={e => updateField("minInclusive", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Min >="
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Max Inclusive ({"<="}):</label>
              <input
                value={restriction.maxInclusive ?? ""}
                onChange={e => updateField("maxInclusive", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Max <="
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Min Exclusive ({">"}): </label>
              <input
                value={restriction.minExclusive ?? ""}
                onChange={e => updateField("minExclusive", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Min >"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Max Exclusive ({"<"}):</label>
              <input
                value={restriction.maxExclusive ?? ""}
                onChange={e => updateField("maxExclusive", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Max <"
              />
            </div>
          </div>
        </div>
      )}

      {restriction.type === "length" && (
        <div>
          <div style={{ marginBottom: 6 }}>
            <label style={miniLabel}>Exact Length:</label>
            <input
              value={restriction.length ?? ""}
              onChange={e => updateField("length", e.target.value)}
              style={inputStyle}
              type="number"
              placeholder="Exact number of characters"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Min Length:</label>
              <input
                value={restriction.minLength ?? ""}
                onChange={e => updateField("minLength", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Min"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={miniLabel}>Max Length:</label>
              <input
                value={restriction.maxLength ?? ""}
                onChange={e => updateField("maxLength", e.target.value)}
                style={inputStyle}
                type="number"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnumerationEditor({ values, onChange }) {
  const addValue = useCallback(() => {
    onChange([...values, ""]);
  }, [values, onChange]);

  const removeValue = useCallback((idx) => {
    onChange(values.filter((_, i) => i !== idx));
  }, [values, onChange]);

  const updateValue = useCallback((idx, val) => {
    onChange(values.map((v, i) => i === idx ? val : v));
  }, [values, onChange]);

  return (
    <div>
      <label style={miniLabel}>Allowed Values:</label>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
          <input
            value={v}
            onChange={e => updateValue(i, e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            placeholder={`Value ${i + 1}`}
          />
          {values.length > 1 && (
            <button onClick={() => removeValue(i)}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>
              &times;
            </button>
          )}
        </div>
      ))}
      <button onClick={addValue} style={{
        fontSize: 10, color: "#4f46e5", background: "none", border: "none",
        cursor: "pointer", fontWeight: 600, marginTop: 2,
      }}>
        + Add Value
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "4px 8px",
  border: "1px solid #d1d5db", borderRadius: 5,
  fontSize: 11, color: "#333", background: "#fff",
  outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  padding: "2px 6px", borderRadius: 4,
  border: "1px solid #d1d5db", fontSize: 10,
  color: "#333", background: "#fff", cursor: "pointer",
};

const miniLabel = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: "#555", marginBottom: 2, marginTop: 4,
};
