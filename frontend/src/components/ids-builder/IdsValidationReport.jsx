import { useState } from "react";

export default function IdsValidationReport({ results, onClose }) {
  const [expandedSpec, setExpandedSpec] = useState(null);

  if (!results) return null;

  const { models = [], overall, totalSpecs, passedSpecs, failedSpecs } = results;

  return (
    <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: overall ? "#dcfce7" : "#fee2e2",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            {overall ? "\u2713" : "\u2717"}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: overall ? "#166534" : "#991b1b" }}>
              {overall ? "All Specifications Passed" : "Validation Failed"}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {passedSpecs}/{totalSpecs} specifications passed across {models.length} model{models.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={backBtnStyle}>
          Back to Editor
        </button>
      </div>

      {/* Summary bar */}
      <div style={summaryBarStyle}>
        <SummaryCard label="Total Specs" value={totalSpecs} color="#4f46e5" />
        <SummaryCard label="Passed" value={passedSpecs} color="#10b981" />
        <SummaryCard label="Failed" value={failedSpecs} color="#ef4444" />
        <SummaryCard label="Models" value={models.length} color="#6366f1" />
      </div>

      {/* Per-model results */}
      {models.map((model, mi) => (
        <div key={mi} style={{ marginBottom: 24 }}>
          <div style={modelHeaderStyle}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#fff",
              background: model.overall ? "#10b981" : "#ef4444",
              padding: "2px 8px", borderRadius: 4,
            }}>
              {model.overall ? "PASS" : "FAIL"}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
              {model.fileName || `Model ${mi + 1}`}
            </span>
            <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
              {model.passedSpecs}/{model.totalSpecs} passed
            </span>
          </div>

          {(model.specifications || []).map((spec, si) => {
            const specKey = `${mi}-${si}`;
            const isExpanded = expandedSpec === specKey;
            const hasFailed = spec.failed > 0;
            const statusColor = spec.status ? "#10b981" : "#ef4444";

            return (
              <div key={si} style={{
                border: `1px solid ${statusColor}30`,
                borderRadius: 8, marginBottom: 6,
                overflow: "hidden",
              }}>
                {/* Spec row */}
                <div
                  onClick={() => setExpandedSpec(isExpanded ? null : specKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", cursor: "pointer",
                    background: spec.status ? "#f0fdf4" : "#fef2f2",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: statusColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {spec.status ? "\u2713" : "\u2717"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
                      {spec.name || "Untitled Specification"}
                    </div>
                    {spec.description && (
                      <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
                        {spec.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span style={statBadge("#10b981")}>{spec.passed} passed</span>
                    {hasFailed && <span style={statBadge("#ef4444")}>{spec.failed} failed</span>}
                    <span style={{ fontSize: 11, color: "#888" }}>/ {spec.total} total</span>
                    <span style={{ fontSize: 14, color: "#aaa", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                      {"\u25B6"}
                    </span>
                  </div>
                </div>

                {/* Expanded: failed elements */}
                {isExpanded && hasFailed && (
                  <div style={{ padding: "0 14px 12px", background: "#fff" }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#ef4444",
                      padding: "8px 0 6px", borderBottom: "1px solid #fee2e2",
                    }}>
                      Failed Elements ({spec.failedElements?.length || 0})
                    </div>
                    <div style={{ maxHeight: 300, overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#fef2f2" }}>
                            <th style={thStyle}>Express ID</th>
                            <th style={thStyle}>Global ID</th>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(spec.failedElements || []).map((el, ei) => (
                            <tr key={ei} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={tdStyle}>{el.expressId ?? "-"}</td>
                              <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10 }}>
                                {el.globalId || "-"}
                              </td>
                              <td style={tdStyle}>{el.name || "-"}</td>
                              <td style={tdStyle}>{el.type || "-"}</td>
                              <td style={{ ...tdStyle, color: "#991b1b", maxWidth: 300 }}>
                                {(el.reasons || []).join("; ") || "Requirement not met"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Expanded: all passed */}
                {isExpanded && !hasFailed && (
                  <div style={{ padding: "12px 14px", background: "#fff", color: "#166534", fontSize: 12 }}>
                    All {spec.total} applicable elements passed this specification.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      flex: 1, padding: "12px 16px", borderRadius: 10,
      background: `${color}10`, border: `1px solid ${color}25`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#666", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

const statBadge = (color) => ({
  fontSize: 10, fontWeight: 700,
  padding: "2px 8px", borderRadius: 8,
  background: `${color}15`, color,
});

const backBtnStyle = {
  padding: "8px 18px", borderRadius: 8,
  border: "1px solid #d1d5db", background: "#fff",
  color: "#333", fontSize: 12, fontWeight: 600,
  cursor: "pointer",
};

const summaryBarStyle = {
  display: "flex", gap: 12, marginBottom: 20,
};

const modelHeaderStyle = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 0", marginBottom: 8,
  borderBottom: "2px solid #e5e7eb",
};

const thStyle = {
  padding: "6px 8px", textAlign: "left",
  fontWeight: 700, color: "#555",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "5px 8px", color: "#333",
};
