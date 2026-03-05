import { useIfcEdit } from "../../contexts/IfcEditContext";

export default function ExportButton() {
  const { isSessionOpen, isDirty, busy, exportIfc, endSession, history } = useIfcEdit();

  if (!isSessionOpen) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {isDirty && (
        <button
          onClick={exportIfc}
          disabled={busy}
          style={exportBtnStyle}
          title="Download the edited IFC file"
        >
          {busy ? "Exporting..." : `Export IFC (${history.length})`}
        </button>
      )}
      <button
        onClick={endSession}
        style={closeBtnStyle}
        title="Close edit session"
      >
        &times;
      </button>
    </div>
  );
}

const exportBtnStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(6,182,212,0.3))",
  color: "#6ee7b7",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const closeBtnStyle = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "transparent",
  color: "rgba(255,255,255,0.6)",
  fontSize: 16,
  cursor: "pointer",
  lineHeight: 1,
};
