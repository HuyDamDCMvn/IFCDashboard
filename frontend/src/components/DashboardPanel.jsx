export default function DashboardPanel({ title, hint, collapsed, onToggleCollapse, children }) {
  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      border: "1px solid #f0f0f0",
    }}>
      <div
        className="panel-drag-handle"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: collapsed ? "none" : "1px solid #f0f0f0",
          background: "#fafbfc",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#bbb", fontSize: 14, cursor: "grab", lineHeight: 1 }}>⠿</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#333" }}>{title}</span>
          {hint && <span style={{ fontSize: 11, fontWeight: 400, color: "#bbb", fontStyle: "italic" }}>{hint}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "#999",
            padding: "2px 6px",
            borderRadius: 4,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
          }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span style={{
            display: "inline-block",
            transition: "transform 0.2s",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}>▾</span>
        </button>
      </div>
      {!collapsed && (
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
