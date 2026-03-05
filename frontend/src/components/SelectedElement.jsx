import { useState } from "react";

export default function SelectedElement({ element }) {
  const [collapsed, setCollapsed] = useState({});

  if (!element) return null;

  const togglePset = (name) => {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const psets = element.propertySets || {};
  const psetEntries = Object.entries(psets);

  return (
    <div style={panelStyle}>
      {/* Close hint */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
          Element Properties
        </span>
      </div>

      {/* ID Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#555" }}>
          <span style={{ color: "#999" }}>GlobalId:</span>{" "}
          <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{element.id}</span>
          {" | "}
          <span style={{ color: "#999" }}>ExpressID:</span>{" "}
          <span style={{ fontWeight: 600 }}>{element.expressId}</span>
          {element._modelName && (
            <>
              {" | "}
              <span style={{ color: "#999" }}>Model:</span>{" "}
              <span style={{
                fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                {element._modelColor && (
                  <span style={{
                    display: "inline-block", width: 8, height: 8,
                    borderRadius: 2, background: element._modelColor,
                  }} />
                )}
                {element._modelName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Type + Name */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        paddingBottom: 8, borderBottom: "1px solid #eee",
      }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: "#3949ab",
        }}>
          {element.type?.replace("Ifc", "") || "Unknown"}
        </div>
        {element.predefinedType && (
          <span style={{
            fontSize: 11, fontWeight: 600, background: "#eef2ff",
            color: "#4338ca", padding: "2px 8px", borderRadius: 10,
          }}>
            {element.predefinedType}
          </span>
        )}
      </div>

      {element.name && (
        <div style={{ fontSize: 13, color: "#333", marginBottom: 2 }}>
          <span style={{ color: "#999", fontSize: 11 }}>Name:</span> {element.name}
        </div>
      )}
      {element.description && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
          <span style={{ color: "#999", fontSize: 11 }}>Description:</span> {element.description}
        </div>
      )}
      {element.storey && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
          <span style={{ color: "#999", fontSize: 11 }}>Storey:</span> {element.storey}
        </div>
      )}
      {element.materials?.length > 0 && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
          <span style={{ color: "#999", fontSize: 11 }}>Materials:</span>{" "}
          {element.materials.join(", ")}
        </div>
      )}

      {/* Property Sets */}
      {psetEntries.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {psetEntries.map(([psetName, props]) => {
            const propEntries = Object.entries(props);
            const isCollapsed = collapsed[psetName];
            return (
              <div key={psetName} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => togglePset(psetName)}
                  style={psetHeaderStyle}
                >
                  <span style={{
                    display: "inline-block", transition: "transform 0.15s",
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    fontSize: 10, marginRight: 4,
                  }}>▾</span>
                  <span style={{ fontWeight: 600, color: "#3949ab" }}>{psetName}</span>
                  <span style={{ color: "#bbb", fontSize: 10, marginLeft: 6 }}>
                    ({propEntries.length})
                  </span>
                </div>
                {!isCollapsed && (
                  <div style={propsGridStyle}>
                    {propEntries.map(([k, v]) => (
                      <div key={k} style={propRowStyle}>
                        <span style={{ color: "#555", fontWeight: 500 }}>{k}:</span>{" "}
                        <span style={{ color: "#222" }}>{formatValue(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatValue(v) {
  if (v === null || v === undefined || v === "") return <span style={{ color: "#ccc" }}>_</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  return String(v);
}

const panelStyle = {
  position: "absolute",
  bottom: 16,
  left: 16,
  right: 16,
  background: "rgba(255, 255, 255, 0.97)",
  borderRadius: 12,
  padding: "14px 18px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  zIndex: 50,
  maxHeight: "55vh",
  overflowY: "auto",
  backdropFilter: "blur(12px)",
  fontSize: 12,
  border: "1px solid rgba(0,0,0,0.06)",
};

const psetHeaderStyle = {
  cursor: "pointer",
  padding: "5px 0",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 12,
  userSelect: "none",
  display: "flex",
  alignItems: "center",
};

const propsGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1px 24px",
  padding: "4px 0 6px 14px",
};

const propRowStyle = {
  fontSize: 11,
  lineHeight: 1.7,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
