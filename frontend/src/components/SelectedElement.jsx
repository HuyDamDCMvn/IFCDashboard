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
        maxWidth: 340,
        maxHeight: 320,
        overflowY: "auto",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Selected Element
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#3949ab",
          marginTop: 4,
        }}
      >
        {element.type?.replace("Ifc", "") || "Unknown"}
      </div>

      {element.name && (
        <div style={{ fontSize: 13, color: "#333", marginTop: 2 }}>
          {element.name}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        <div>
          <span style={{ color: "#999" }}>Express ID:</span> {element.expressId}
        </div>
        {element.storey && (
          <div>
            <span style={{ color: "#999" }}>Storey:</span> {element.storey}
          </div>
        )}
        {element.materials?.length > 0 && (
          <div>
            <span style={{ color: "#999" }}>Materials:</span>{" "}
            {element.materials.join(", ")}
          </div>
        )}
      </div>

      {element.propertySets &&
        Object.keys(element.propertySets).length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              Properties
            </div>
            {Object.entries(element.propertySets)
              .slice(0, 2)
              .map(([psetName, props]) => (
                <div key={psetName} style={{ marginTop: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#3949ab",
                    }}
                  >
                    {psetName}
                  </div>
                  {Object.entries(props)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: "#555" }}>
                        {k}: {String(v)}
                      </div>
                    ))}
                </div>
              ))}
          </div>
        )}
    </div>
  );
}
