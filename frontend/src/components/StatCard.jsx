export default function StatCard({ title, value, subtitle, icon, color = "#4f46e5" }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: color + "15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.1 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}
