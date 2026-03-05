import { useIdsBuilder } from "../../contexts/IdsBuilderContext";

export default function IdsSpecList() {
  const {
    idsDoc,
    selectedSpecId,
    setSelectedSpecId,
    addSpecification,
    removeSpecification,
    duplicateSpecification,
  } = useIdsBuilder();

  const specs = idsDoc.specifications;

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 12px 8px",
      }}>
        <span style={sectionTitle}>Specifications ({specs.length})</span>
        <button onClick={addSpecification} style={addBtn}>+ Add</button>
      </div>

      {specs.map((spec, idx) => {
        const isSelected = spec.id === selectedSpecId;
        const reqCount = spec.requirements?.length || 0;
        const appCount = spec.applicability?.length || 0;

        return (
          <div
            key={spec.id}
            onClick={() => setSelectedSpecId(spec.id)}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              background: isSelected ? "#eef2ff" : "transparent",
              borderLeft: isSelected ? "3px solid #4f46e5" : "3px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#999",
                minWidth: 18,
              }}>
                {spec.identifier || `${idx + 1}.`}
              </span>
              <span style={{
                flex: 1, fontSize: 12, fontWeight: isSelected ? 600 : 400,
                color: isSelected ? "#4f46e5" : "#333",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {spec.name || "Untitled"}
              </span>

              <button
                onClick={(e) => { e.stopPropagation(); duplicateSpecification(spec.id); }}
                title="Duplicate"
                style={iconBtn}
              >
                &#x2398;
              </button>
              {specs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeSpecification(spec.id); }}
                  title="Remove"
                  style={{ ...iconBtn, color: "#ef4444" }}
                >
                  &times;
                </button>
              )}
            </div>

            <div style={{
              display: "flex", gap: 8, marginTop: 3, paddingLeft: 18,
            }}>
              <span style={badge}>
                {appCount} {appCount === 1 ? "filter" : "filters"}
              </span>
              <span style={{ ...badge, background: reqCount > 0 ? "#dcfce7" : "#fef3c7", color: reqCount > 0 ? "#166534" : "#92400e" }}>
                {reqCount} {reqCount === 1 ? "requirement" : "requirements"}
              </span>
            </div>

            {spec.description && (
              <div style={{
                fontSize: 10, color: "#888", marginTop: 2, paddingLeft: 18,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {spec.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const sectionTitle = {
  fontSize: 11, fontWeight: 700, color: "#888",
  textTransform: "uppercase", letterSpacing: 0.5,
};

const addBtn = {
  padding: "3px 10px", borderRadius: 6,
  border: "1px solid #c7d2fe", background: "#eef2ff",
  color: "#4f46e5", fontSize: 11, fontWeight: 600,
  cursor: "pointer",
};

const iconBtn = {
  background: "none", border: "none",
  cursor: "pointer", fontSize: 14, color: "#aaa",
  padding: "0 2px", lineHeight: 1,
};

const badge = {
  fontSize: 9, fontWeight: 600,
  padding: "1px 6px", borderRadius: 8,
  background: "#eef2ff", color: "#4338ca",
};
