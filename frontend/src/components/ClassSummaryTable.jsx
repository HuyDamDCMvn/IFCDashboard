import { COLORS } from "../lib/theme";

export default function ClassSummaryTable({
  chartData, classColorMap, filterKey, filteredElements, handleFilterClick,
}) {
  return (
    <div style={{ padding: "0 12px 12px", height: "100%", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.border}`, textAlign: "left" }}>
            <th style={thStyle}></th>
            <th style={thStyle}>IFC Class</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
            <th style={{ ...thStyle, textAlign: "right" }}>%</th>
            <th style={{ ...thStyle, width: "30%" }}></th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((entry) => {
            const isActive = filterKey === `type:${entry.fullName}`;
            const pct = filteredElements.length > 0
              ? (entry.value / filteredElements.length) * 100
              : 0;
            const color = classColorMap[entry.fullName] || "#999";
            return (
              <tr
                key={entry.fullName}
                onClick={() => handleFilterClick("type", entry.fullName)}
                style={{
                  cursor: "pointer",
                  background: isActive ? "#fff3e0" : "transparent",
                  borderBottom: `1px solid ${COLORS.borderLight}`,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = COLORS.bgSubtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? "#fff3e0" : "transparent";
                }}
              >
                <td style={{ padding: "6px 4px" }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: color,
                    border: isActive ? `2px solid ${COLORS.active}` : "none",
                  }} />
                </td>
                <td style={{
                  padding: "6px 4px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? COLORS.activeDark : "#333",
                }}>
                  {entry.name}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>
                  {entry.value.toLocaleString()}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right", color: COLORS.textMuted }}>
                  {pct.toFixed(1)}%
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{
                    height: 6, borderRadius: 3, background: COLORS.borderLight,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${pct}%`, background: color,
                      transition: "width 0.3s",
                    }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: "8px 4px", fontWeight: 600, color: COLORS.textLight, fontSize: 12,
};
