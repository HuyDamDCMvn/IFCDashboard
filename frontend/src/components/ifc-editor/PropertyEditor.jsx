import { useState, useCallback, useEffect, useRef } from "react";
import { useIfcEdit } from "../../contexts/IfcEditContext";
import AttributeEditor from "./AttributeEditor";

export default function PropertyEditor() {
  const { editingElement, closeEditor, saveEdits, busy, error, isSessionOpen } = useIfcEdit();
  const [psetEdits, setPsetEdits] = useState({});
  const [attrEdits, setAttrEdits] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const prevGlobalIdRef = useRef(null);

  const element = editingElement;

  useEffect(() => {
    if (element && element.globalId !== prevGlobalIdRef.current) {
      setPsetEdits({});
      setAttrEdits({});
      setSaveStatus(null);
      prevGlobalIdRef.current = element.globalId;
    }
  }, [element]);

  if (!element) return null;

  const psets = element.propertySets || {};
  const psetEntries = Object.entries(psets);

  const hasPendingChanges = Object.keys(attrEdits).length > 0 || Object.keys(psetEdits).length > 0;

  const handleAttrChange = useCallback((attr, value) => {
    setAttrEdits((prev) => {
      const original = element[attr] || "";
      if (value === original) {
        const next = { ...prev };
        delete next[attr];
        return next;
      }
      return { ...prev, [attr]: value };
    });
  }, [element]);

  const handlePropChange = useCallback((psetName, propName, value) => {
    setPsetEdits((prev) => {
      const pset = { ...(prev[psetName] || {}) };
      const original = String(element.propertySets?.[psetName]?.[propName] ?? "");
      if (value === original) {
        delete pset[propName];
        if (Object.keys(pset).length === 0) {
          const next = { ...prev };
          delete next[psetName];
          return next;
        }
        return { ...prev, [psetName]: pset };
      }
      pset[propName] = value;
      return { ...prev, [psetName]: pset };
    });
  }, [element]);

  const handleSave = useCallback(async () => {
    if (!hasPendingChanges) return;
    setSaveStatus(null);

    const changes = { ...attrEdits };
    if (Object.keys(psetEdits).length > 0) {
      changes.psetEdits = psetEdits;
    }

    const result = await saveEdits(element.globalId, changes);
    if (result?.status === "ok") {
      setSaveStatus("ok");
      setAttrEdits({});
      setPsetEdits({});
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus("error");
    }
  }, [hasPendingChanges, attrEdits, psetEdits, element, saveEdits]);

  const handleClose = useCallback(() => {
    setAttrEdits({});
    setPsetEdits({});
    setSaveStatus(null);
    closeEditor();
  }, [closeEditor]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={iconStyle}>&#9998;</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
              Edit Element
            </span>
            {!isSessionOpen && (
              <span style={warningBadge}>No session — read-only preview</span>
            )}
          </div>
          <button onClick={handleClose} style={closeBtnStyle} title="Close editor">
            &times;
          </button>
        </div>

        {/* Element identity */}
        <div style={identityStyle}>
          <span style={typeBadge}>{(element.type || "").replace("Ifc", "")}</span>
          {element.PredefinedType && (
            <span style={predefBadge}>{element.PredefinedType}</span>
          )}
          <span style={{ color: "#888", fontSize: 11, fontFamily: "monospace" }}>
            {element.globalId}
          </span>
          {element._modelName && (
            <span style={{ color: "#888", fontSize: 11 }}>
              &middot; {element._modelName}
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div style={bodyStyle}>
          {/* Direct attributes */}
          <AttributeEditor
            element={element}
            edits={attrEdits}
            onChange={handleAttrChange}
            disabled={!isSessionOpen}
          />

          {/* Property Sets */}
          {psetEntries.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionTitle}>Property Sets</div>
              {psetEntries.map(([psetName, props]) => (
                <PsetEditor
                  key={psetName}
                  psetName={psetName}
                  props={props}
                  edits={psetEdits[psetName] || {}}
                  onChange={handlePropChange}
                  disabled={!isSessionOpen}
                />
              ))}
            </div>
          )}

          {/* Materials (read-only) */}
          {element.materials?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionTitle}>Materials</div>
              <div style={{ padding: "6px 0", fontSize: 12, color: "#555" }}>
                {element.materials.join(", ")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {error && <div style={errorStyle}>{error}</div>}
          {saveStatus === "ok" && (
            <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>
              &#10003; Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>
              Save failed
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={handleClose} style={cancelBtnStyle}>
            Cancel
          </button>
          {isSessionOpen && (
            <button
              onClick={handleSave}
              disabled={!hasPendingChanges || busy}
              style={{
                ...saveBtnStyle,
                opacity: !hasPendingChanges || busy ? 0.5 : 1,
              }}
            >
              {busy ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PsetEditor({ psetName, props, edits, onChange, disabled }) {
  const [collapsed, setCollapsed] = useState(false);
  const propEntries = Object.entries(props);
  const editCount = Object.keys(edits).length;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={psetHeaderStyle}
      >
        <span style={{
          display: "inline-block", transition: "transform 0.15s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          fontSize: 10, marginRight: 4,
        }}>&#9662;</span>
        <span style={{ fontWeight: 600, color: "#3949ab" }}>{psetName}</span>
        <span style={{ color: "#bbb", fontSize: 10, marginLeft: 6 }}>
          ({propEntries.length})
        </span>
        {editCount > 0 && (
          <span style={editCountBadge}>{editCount} changed</span>
        )}
      </div>
      {!collapsed && (
        <div style={{ padding: "4px 0 8px 12px" }}>
          {propEntries.map(([propName, value]) => {
            const currentValue = propName in edits ? edits[propName] : String(value);
            const isEdited = propName in edits;
            return (
              <div key={propName} style={propRowStyle}>
                <label style={propLabelStyle}>{propName}</label>
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => onChange(psetName, propName, e.target.value)}
                  disabled={disabled}
                  style={{
                    ...propInputStyle,
                    borderColor: isEdited ? "#f59e0b" : "#e5e7eb",
                    background: isEdited ? "#fffbeb" : disabled ? "#f9fafb" : "#fff",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(4px)",
};

const panelStyle = {
  width: 560,
  maxWidth: "95vw",
  maxHeight: "90vh",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px 12px",
  borderBottom: "1px solid #f0f0f0",
  flexShrink: 0,
};

const iconStyle = {
  fontSize: 18,
  color: "#4f46e5",
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  fontSize: 22,
  color: "#999",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: 6,
  lineHeight: 1,
};

const identityStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderBottom: "1px solid #f0f0f0",
  flexShrink: 0,
  flexWrap: "wrap",
};

const typeBadge = {
  background: "#e8eaf6",
  color: "#3949ab",
  padding: "2px 10px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
};

const predefBadge = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
};

const warningBadge = {
  background: "#fef3c7",
  color: "#b45309",
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
};

const bodyStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 20px 16px",
};

const sectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
};

const psetHeaderStyle = {
  cursor: "pointer",
  padding: "6px 0",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 12,
  userSelect: "none",
  display: "flex",
  alignItems: "center",
};

const editCountBadge = {
  marginLeft: "auto",
  fontSize: 10,
  fontWeight: 600,
  color: "#f59e0b",
  background: "#fffbeb",
  padding: "1px 6px",
  borderRadius: 8,
};

const propRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
};

const propLabelStyle = {
  width: 160,
  fontSize: 12,
  color: "#555",
  fontWeight: 500,
  flexShrink: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const propInputStyle = {
  flex: 1,
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontSize: 12,
  outline: "none",
  transition: "border-color 0.15s, background 0.15s",
};

const footerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 20px",
  borderTop: "1px solid #f0f0f0",
  flexShrink: 0,
};

const errorStyle = {
  fontSize: 12,
  color: "#ef4444",
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const cancelBtnStyle = {
  padding: "7px 16px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#555",
  fontSize: 13,
  cursor: "pointer",
};

const saveBtnStyle = {
  padding: "7px 20px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s",
};
