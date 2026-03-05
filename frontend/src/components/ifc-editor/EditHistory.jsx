import { useIfcEdit } from "../../contexts/IfcEditContext";

export default function EditHistory() {
  const { history, isSessionOpen, sessionFileName } = useIfcEdit();

  if (!isSessionOpen || history.length === 0) return null;

  const recentItems = history.slice(-8).reverse();

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={dotStyle} />
        <span style={{ fontWeight: 600, fontSize: 12, color: "#1a1a2e" }}>
          Edit Session
        </span>
        <span style={{ color: "#888", fontSize: 11, marginLeft: 4 }}>
          {sessionFileName}
        </span>
        <span style={countBadge}>{history.length} change{history.length !== 1 ? "s" : ""}</span>
      </div>
      <div style={listStyle}>
        {recentItems.map((item, i) => (
          <div key={i} style={itemStyle}>
            <span style={{ color: "#3949ab", fontWeight: 500, fontSize: 11 }}>
              {Object.keys(item.applied || {}).join(", ")}
            </span>
            <span style={{ color: "#888", fontSize: 11, marginLeft: 4 }}>
              on {item.globalId?.slice(0, 12)}...
            </span>
          </div>
        ))}
        {history.length > 8 && (
          <div style={{ fontSize: 10, color: "#bbb", padding: "2px 0" }}>
            +{history.length - 8} earlier changes
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: 10,
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  border: "1px solid #e5e7eb",
  padding: "8px 12px",
  maxWidth: 320,
  fontSize: 12,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 4,
};

const dotStyle = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#10b981",
  flexShrink: 0,
};

const countBadge = {
  marginLeft: "auto",
  background: "#eef2ff",
  color: "#4f46e5",
  padding: "1px 8px",
  borderRadius: 8,
  fontSize: 10,
  fontWeight: 600,
};

const listStyle = {
  maxHeight: 140,
  overflowY: "auto",
};

const itemStyle = {
  padding: "3px 0",
  borderBottom: "1px solid #f8f8f8",
  display: "flex",
  alignItems: "center",
};
