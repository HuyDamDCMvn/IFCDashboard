import { useCallback } from "react";
import { useModelRegistry } from "../contexts/ModelRegistryContext";

const DISCIPLINES = [
  "General", "Architecture", "Structure", "MEP",
  "Infrastructure", "Site", "Landscape", "Interior",
];

export default function ModelManager({ onAddFiles }) {
  const {
    allModelsList,
    removeModel,
    toggleModelVisibility,
    setModelDiscipline,
    focusModel,
    focusedModelId,
  } = useModelRegistry();

  const handleFileInput = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onAddFiles) onAddFiles(files);
    e.target.value = "";
  }, [onAddFiles]);

  if (allModelsList.length === 0) return null;

  const totalElements = allModelsList.reduce(
    (sum, m) => sum + (m.dashboardData?.totalElements || m.dashboardData?.elements?.length || 0), 0
  );

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>
          Models ({allModelsList.length})
        </span>
        <label style={addBtnStyle}>
          + Add
          <input
            type="file"
            accept=".ifc"
            multiple
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={{ fontSize: 11, color: "#888", padding: "0 12px 8px" }}>
        {totalElements.toLocaleString()} elements total
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {allModelsList.map((entry) => (
          <ModelRow
            key={entry.id}
            entry={entry}
            focused={focusedModelId === entry.id}
            onToggleVisibility={() => toggleModelVisibility(entry.id)}
            onRemove={() => removeModel(entry.id)}
            onSetDiscipline={(d) => setModelDiscipline(entry.id, d)}
            onFocus={() => focusModel(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ModelRow({ entry, focused, onToggleVisibility, onRemove, onSetDiscipline, onFocus }) {
  const elCount = entry.dashboardData?.elements?.length || 0;

  return (
    <div style={{
      padding: "8px 12px",
      borderBottom: "1px solid #f0f0f0",
      opacity: entry.visible ? 1 : 0.5,
      background: focused ? "#eef2ff" : "transparent",
      transition: "opacity 0.2s, background 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Visibility toggle */}
        <button
          onClick={onToggleVisibility}
          title={entry.visible ? "Hide model" : "Show model"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 16, padding: 0, lineHeight: 1,
            color: entry.visible ? entry.color : "#ccc",
          }}
        >
          {entry.visible ? "\u25C9" : "\u25CB"}
        </button>

        {/* Color dot */}
        <span style={{
          width: 10, height: 10, borderRadius: 3,
          background: entry.color, flexShrink: 0,
        }} />

        {/* File name — clickable to focus Dashboard */}
        <span
          onClick={onFocus}
          style={{
            flex: 1, fontSize: 12, fontWeight: 600,
            color: focused ? "#4f46e5" : "#333",
            overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
            cursor: "pointer",
            textDecoration: focused ? "underline" : "none",
            transition: "color 0.15s",
          }}
          title={`${entry.fileName} — click to filter Dashboard`}
        >
          {entry.fileName.replace(/\.ifc$/i, "")}
        </span>

        {/* Loading indicator */}
        {!entry.loadedIn3D && (
          <span style={{
            fontSize: 10, color: "#f59e0b", fontWeight: 600,
          }}>loading...</span>
        )}

        {/* Remove */}
        <button
          onClick={onRemove}
          title="Remove model"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: "#ccc", padding: "0 2px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; }}
        >
          &#x2715;
        </button>
      </div>

      {/* Details row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginTop: 4, paddingLeft: 26,
      }}>
        <select
          value={entry.discipline}
          onChange={(e) => onSetDiscipline(e.target.value)}
          style={{
            fontSize: 10, padding: "1px 4px", borderRadius: 4,
            border: "1px solid #e5e7eb", background: "#f8f9fb",
            color: "#555", cursor: "pointer",
          }}
        >
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <span style={{ fontSize: 10, color: "#aaa" }}>
          {elCount.toLocaleString()} elements
        </span>
        {entry.dashboardData?.project?.schema && (
          <span style={{
            fontSize: 9, fontWeight: 600, background: "#eef2ff",
            color: "#4338ca", padding: "1px 6px", borderRadius: 8,
          }}>
            {entry.dashboardData.project.schema}
          </span>
        )}
      </div>
    </div>
  );
}

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "#fff",
  borderRight: "1px solid #e5e7eb",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 12px 8px",
  borderBottom: "1px solid #f0f0f0",
};

const addBtnStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "#4f46e5",
  cursor: "pointer",
  padding: "3px 10px",
  borderRadius: 6,
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  transition: "background 0.15s",
};
