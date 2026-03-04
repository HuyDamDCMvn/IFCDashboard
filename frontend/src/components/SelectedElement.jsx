export default function SelectedElement({ element }) {
  if (!element) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        background: "rgba(255,255,255,0.95)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        zIndex: 50,
        maxWidth: 320,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
        Selected Element
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#3949ab", marginTop: 4 }}>
        {element.typeName?.replace("Ifc", "") || "Unknown"}
      </div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        Express ID: {element.expressID}
      </div>
    </div>
  );
}
