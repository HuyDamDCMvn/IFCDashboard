import { COLORS } from "../lib/theme";
import { dropdownMenu, pillButton, countBadge, resetButton } from "../lib/shared-styles";

export default function DashboardToolbar({
  isMultiModel,
  modelFilter, setModelFilter, modelDropdownOpen, setModelDropdownOpen,
  visibleModels, toggleModelFilter,
  classFilter, setClassFilter, classDropdownOpen, setClassDropdownOpen,
  allClasses, classColorMap, effectiveSummary, toggleClass,
  barThickness, setBarThickness,
  filteredElements, totalElementsAll,
  savedLayout, handleResetLayout,
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "0 16px 12px",
      flexWrap: "wrap",
    }}>
      {isMultiModel && (
        <div data-model-filter style={{ position: "relative" }}>
          <button
            onClick={() => setModelDropdownOpen(v => !v)}
            style={pillButton(modelFilter.size > 0, "#f0fdf4", "#10b981")}
          >
            <span style={{ fontSize: 15 }}>&#9724;</span>
            Model Filter
            {modelFilter.size > 0 && (
              <span style={countBadge("#10b981")}>{modelFilter.size}</span>
            )}
          </button>
          {modelDropdownOpen && (
            <div style={dropdownMenu}>
              <div style={dropdownHeader}>
                <span>{modelFilter.size}/{visibleModels.length} selected</span>
                <button onClick={() => setModelFilter(new Set())} style={clearBtn("#10b981")}>
                  Clear all
                </button>
              </div>
              {visibleModels.map(entry => (
                <label key={entry.id} style={dropdownRow(modelFilter.has(entry.id), "#f0fdf4")}>
                  <input
                    type="checkbox"
                    checked={modelFilter.has(entry.id)}
                    onChange={() => toggleModelFilter(entry.id)}
                    style={{ accentColor: "#10b981" }}
                  />
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: entry.color,
                  }} />
                  <span style={{ fontWeight: modelFilter.has(entry.id) ? 600 : 400 }}>
                    {entry.fileName}
                  </span>
                  <span style={{ marginLeft: "auto", color: "#aaa", fontSize: 11 }}>
                    {entry.discipline}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div data-class-filter style={{ position: "relative" }}>
        <button
          onClick={() => setClassDropdownOpen(v => !v)}
          style={pillButton(classFilter.size > 0)}
        >
          <span style={{ fontSize: 15 }}>&#9783;</span>
          IFC Class Filter
          {classFilter.size > 0 && (
            <span style={countBadge(COLORS.primary)}>{classFilter.size}</span>
          )}
        </button>
        {classDropdownOpen && (
          <div style={dropdownMenu}>
            <div style={dropdownHeader}>
              <span>{classFilter.size}/{allClasses.length} selected</span>
              <button onClick={() => setClassFilter(new Set())} style={clearBtn(COLORS.primary)}>
                Clear all
              </button>
            </div>
            {allClasses.map(cls => (
              <label key={cls} style={dropdownRow(classFilter.has(cls), "#f5f3ff")}>
                <input
                  type="checkbox"
                  checked={classFilter.has(cls)}
                  onChange={() => toggleClass(cls)}
                  style={{ accentColor: COLORS.primary }}
                />
                <span style={{
                  width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                  background: classColorMap[cls],
                }} />
                <span style={{ fontWeight: classFilter.has(cls) ? 600 : 400 }}>
                  {cls.replace("Ifc", "")}
                </span>
                <span style={{ marginLeft: "auto", color: "#aaa", fontSize: 11 }}>
                  {effectiveSummary[cls]}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 12, color: COLORS.textLight, whiteSpace: "nowrap" }}>Bar size:</label>
        <input
          type="range" min={8} max={60} value={barThickness}
          onChange={(e) => setBarThickness(Number(e.target.value))}
          style={{ width: 100, accentColor: COLORS.primary }}
        />
        <span style={{ fontSize: 11, color: COLORS.textMuted, minWidth: 24 }}>{barThickness}px</span>
      </div>

      {(classFilter.size > 0 || modelFilter.size > 0) && (
        <div style={{ fontSize: 12, color: COLORS.primary, fontWeight: 500 }}>
          Showing {filteredElements.length.toLocaleString()} / {totalElementsAll.toLocaleString()} elements
        </div>
      )}

      {savedLayout && (
        <button onClick={handleResetLayout} style={resetButton} title="Reset panel layout to default">
          Reset Layout
        </button>
      )}
    </div>
  );
}

const dropdownHeader = {
  display: "flex", justifyContent: "space-between", padding: "4px 12px 8px",
  borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#888",
};

const clearBtn = (color) => ({
  background: "none", border: "none", color,
  cursor: "pointer", fontSize: 12, fontWeight: 600,
});

const dropdownRow = (active, activeBg) => ({
  display: "flex", alignItems: "center", gap: 8,
  padding: "5px 12px", cursor: "pointer", fontSize: 13,
  background: active ? activeBg : "transparent",
});
