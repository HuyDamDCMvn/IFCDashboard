import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import StatCard from "./StatCard";
import ElementTable from "./ElementTable";
import DashboardPanel from "./DashboardPanel";
import { useSelection } from "../contexts/SelectionContext";
import { useModelRegistry } from "../contexts/ModelRegistryContext";
import { ACTIVE_COLOR } from "../lib/ifc-filter-core";
import { useIfcFilter } from "../lib/useIfcFilter";

const COLLAPSED_H = 2;
const ROW_H = 30;
const MARGIN_Y = 16;
const GRID_UNIT = ROW_H + MARGIN_Y;
const PANEL_OVERHEAD = 45;
const STORAGE_KEY = "ifc-dashboard-prefs";

function contentPxToGridH(contentPx, minH = 3) {
  const totalPx = contentPx + PANEL_OVERHEAD;
  return Math.max(minH, Math.ceil((totalPx + MARGIN_Y) / GRID_UNIT));
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export default function Dashboard({ data }) {
  const { width: containerWidth, containerRef, measureWidth } = useContainerWidth({ initialWidth: 800 });

  useEffect(() => {
    if (data) measureWidth();
  }, [data, measureWidth]);

  return (
    <div ref={containerRef} style={{ minHeight: 1 }}>
      {data && (
        <DashboardInner data={data} containerWidth={containerWidth} />
      )}
    </div>
  );
}

const RADIAN = Math.PI / 180;
function renderPieLabel({ cx, cy, midAngle, outerRadius, name, value, percent }) {
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  const displayName = name.length > 12 ? name.slice(0, 10) + "…" : name;
  return (
    <text x={x} y={y} fill="#444" fontSize={10} fontWeight={500}
      textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {`${displayName} (${value.toLocaleString()})`}
    </text>
  );
}

function DashboardInner({ data, containerWidth }) {
  const { filterKey, toggleFilter } = useSelection();
  const { allModelsList, visibleModels, focusedModelId } = useModelRegistry();

  const stored = useMemo(() => loadPrefs(), []);

  const [collapsedPanels, setCollapsedPanels] = useState(() => {
    if (stored?.collapsed) return new Set(stored.collapsed);
    return new Set();
  });
  const collapsedRef = useRef(collapsedPanels);
  collapsedRef.current = collapsedPanels;

  const [savedLayout, setSavedLayout] = useState(() => stored?.layout || null);
  const [classFilter, setClassFilter] = useState(new Set());
  const [modelFilter, setModelFilter] = useState(new Set());
  const [barThickness, setBarThickness] = useState(() => stored?.barThickness ?? 20);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    savePrefs({
      layout: savedLayout,
      collapsed: [...collapsedPanels],
      barThickness,
    });
  }, [savedLayout, collapsedPanels, barThickness]);

  const {
    allClasses,
    classColorMap,
    effectiveSummary,
    filteredElements,
    chartData,
    predefData,
    storeyData,
    totalProps,
    uniqueTypes,
    handleFilterClick,
  } = useIfcFilter(
    data.elements,
    data.summary,
    data.storeys,
    classFilter,
    modelFilter,
    { toggleFilter },
    filterKey
  );

  const toggleClass = useCallback((cls) => {
    setClassFilter(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls); else next.add(cls);
      return next;
    });
  }, []);

  const toggleModelFilter = useCallback((id) => {
    setModelFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const modelIdKey = allModelsList.map(m => m.id).sort().join(",");
  useEffect(() => {
    setClassFilter(new Set());
    setModelFilter(new Set());
  }, [modelIdKey]);

  const visibleIdSet = useMemo(() => new Set(visibleModels.map(m => m.id)), [visibleModels]);
  useEffect(() => {
    setModelFilter(prev => {
      if (prev.size === 0) return prev;
      const pruned = new Set([...prev].filter(id => visibleIdSet.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [visibleIdSet]);

  useEffect(() => {
    if (focusedModelId && visibleIdSet.has(focusedModelId)) {
      setModelFilter(new Set([focusedModelId]));
    } else if (focusedModelId === null) {
      setModelFilter(new Set());
    }
  }, [focusedModelId, visibleIdSet]);

  useEffect(() => {
    if (!classDropdownOpen && !modelDropdownOpen) return;
    const close = (e) => {
      if (!e.target.closest("[data-class-filter]")) setClassDropdownOpen(false);
      if (!e.target.closest("[data-model-filter]")) setModelDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [classDropdownOpen, modelDropdownOpen]);

  const schema = data.schemaInfo || {};

  const filteredSummary = {};
  filteredElements.forEach(el => {
    filteredSummary[el.type] = (filteredSummary[el.type] || 0) + 1;
  });

  const hasPredef = predefData.length > 0;
  const hasStoreys = storeyData.length > 0;
  const effectiveStoreyList = storeyData.filter(s => s.elevation !== -Infinity);
  const isMultiModel = (data.modelCount || 0) > 1;

  const predefChartPx = Math.max(predefData.length * (barThickness + 12) + 40, 120);
  const storeyChartPx = Math.max(storeyData.length * (barThickness + 12) + 60, 120);
  const classTableContentPx = chartData.length * 28 + 48;

  const dynHeights = {
    stats: 5,
    barChart: 13,
    pieChart: 13,
    predefined: contentPxToGridH(predefChartPx),
    classTable: Math.min(18, contentPxToGridH(classTableContentPx)),
    storeys: contentPxToGridH(storeyChartPx),
    table: 15,
  };

  const defaultLayout = buildDefaultLayout(dynHeights, hasPredef, hasStoreys);
  const currentLayout = savedLayout || defaultLayout;

  const displayLayout = currentLayout
    .filter(item => {
      if (item.i === "predefined" && !hasPredef) return false;
      if (item.i === "storeys" && !hasStoreys) return false;
      return true;
    })
    .map(item => ({
      ...item,
      h: collapsedPanels.has(item.i) ? COLLAPSED_H : item.h,
      isResizable: !collapsedPanels.has(item.i),
    }));

  const toggleCollapse = useCallback((key) => {
    setCollapsedPanels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleUserLayoutChange = useCallback((layout) => {
    setSavedLayout(
      layout.map(item => {
        if (collapsedRef.current.has(item.i)) {
          return { ...item, h: dynHeights[item.i] || item.h };
        }
        return item;
      })
    );
  }, [dynHeights]);

  const handleResetLayout = useCallback(() => {
    setSavedLayout(null);
    setCollapsedPanels(new Set());
    setBarThickness(20);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const totalElementsAll = data.elements?.length || 0;

  return (
    <div style={{ paddingTop: 24 }}>
      {/* Project Header */}
      <div style={{ marginBottom: 16, padding: "0 16px" }}>
        {isMultiModel ? (
          <>
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              Federation View
              <span style={schemaBadgeStyle}>
                {data.modelCount} models
              </span>
            </h2>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(data.projects || []).map((p, i) => (
                <span key={i}>
                  <span style={{ color: "#555", fontWeight: 500 }}>{p._modelName}</span>
                  {p.schema && <span style={{ ...schemaBadgeStyle, fontSize: 10, marginLeft: 6 }}>{p.schema}</span>}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {data.project?.name || "IFC Project"}
              {data.project?.schema && (
                <span style={schemaBadgeStyle}>{data.project.schema}</span>
              )}
              {schema.hasInfraTypes && (
                <span style={{ ...schemaBadgeStyle, background: "#dcfce7", color: "#166534" }}>
                  Infrastructure
                </span>
              )}
            </h2>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
              {data.project?.description}
            </div>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "0 16px 12px",
        flexWrap: "wrap",
      }}>
        {/* Model Filter (only in multi-model) */}
        {isMultiModel && (
          <div data-model-filter style={{ position: "relative" }}>
            <button
              onClick={() => setModelDropdownOpen(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", fontSize: 13, fontWeight: 500,
                background: modelFilter.size > 0 ? "#f0fdf4" : "#fff",
                border: modelFilter.size > 0 ? "1.5px solid #10b981" : "1.5px solid #d1d5db",
                borderRadius: 8, cursor: "pointer", color: "#1a1a2e",
              }}
            >
              <span style={{ fontSize: 15 }}>&#9724;</span>
              Model Filter
              {modelFilter.size > 0 && (
                <span style={{
                  background: "#10b981", color: "#fff", borderRadius: 10,
                  padding: "1px 7px", fontSize: 11, fontWeight: 700,
                }}>{modelFilter.size}</span>
              )}
            </button>
            {modelDropdownOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 4,
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
                maxHeight: 320, overflowY: "auto", minWidth: 260, padding: "6px 0",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 12px 8px",
                  borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#888",
                }}>
                  <span>{modelFilter.size}/{visibleModels.length} selected</span>
                  <button
                    onClick={() => setModelFilter(new Set())}
                    style={{
                      background: "none", border: "none", color: "#10b981",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                    }}
                  >Clear all</button>
                </div>
                {visibleModels.map(entry => (
                  <label
                    key={entry.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 12px", cursor: "pointer", fontSize: 13,
                      background: modelFilter.has(entry.id) ? "#f0fdf4" : "transparent",
                    }}
                  >
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

        {/* IFC Class Filter */}
        <div data-class-filter style={{ position: "relative" }}>
          <button
            onClick={() => setClassDropdownOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 13, fontWeight: 500,
              background: classFilter.size > 0 ? "#eef2ff" : "#fff",
              border: classFilter.size > 0 ? "1.5px solid #4f46e5" : "1.5px solid #d1d5db",
              borderRadius: 8, cursor: "pointer", color: "#1a1a2e",
            }}
          >
            <span style={{ fontSize: 15 }}>&#9783;</span>
            IFC Class Filter
            {classFilter.size > 0 && (
              <span style={{
                background: "#4f46e5", color: "#fff", borderRadius: 10,
                padding: "1px 7px", fontSize: 11, fontWeight: 700,
              }}>{classFilter.size}</span>
            )}
          </button>
          {classDropdownOpen && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 4,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
              maxHeight: 320, overflowY: "auto", minWidth: 260, padding: "6px 0",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", padding: "4px 12px 8px",
                borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#888",
              }}>
                <span>{classFilter.size}/{allClasses.length} selected</span>
                <button
                  onClick={() => setClassFilter(new Set())}
                  style={{
                    background: "none", border: "none", color: "#4f46e5",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >Clear all</button>
              </div>
              {allClasses.map(cls => (
                <label
                  key={cls}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 12px", cursor: "pointer", fontSize: 13,
                    background: classFilter.has(cls) ? "#f5f3ff" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={classFilter.has(cls)}
                    onChange={() => toggleClass(cls)}
                    style={{ accentColor: "#4f46e5" }}
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
          <label style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>Bar size:</label>
          <input
            type="range" min={8} max={60} value={barThickness}
            onChange={(e) => setBarThickness(Number(e.target.value))}
            style={{ width: 100, accentColor: "#4f46e5" }}
          />
          <span style={{ fontSize: 11, color: "#888", minWidth: 24 }}>{barThickness}px</span>
        </div>

        {(classFilter.size > 0 || modelFilter.size > 0) && (
          <div style={{ fontSize: 12, color: "#4f46e5", fontWeight: 500 }}>
            Showing {filteredElements.length.toLocaleString()} / {totalElementsAll.toLocaleString()} elements
          </div>
        )}

        {savedLayout && (
          <button onClick={handleResetLayout} style={resetBtnStyle} title="Reset panel layout to default">
            Reset Layout
          </button>
        )}
      </div>

      <GridLayout
        layout={displayLayout}
        onDragStop={handleUserLayoutChange}
        onResizeStop={handleUserLayoutChange}
        cols={12}
        rowHeight={ROW_H}
        width={Math.max(containerWidth, 300)}
        margin={[16, 16]}
        containerPadding={[16, 0]}
        draggableHandle=".panel-drag-handle"
        compactType="vertical"
      >
        {/* Stats */}
        <div key="stats">
          <DashboardPanel
            title="Overview"
            collapsed={collapsedPanels.has("stats")}
            onToggleCollapse={() => toggleCollapse("stats")}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12, padding: 12,
            }}>
              <StatCard title="Total Elements" value={filteredElements.length.toLocaleString()}
                icon={<span style={{ color: "#4f46e5" }}>&#9632;</span>} color="#4f46e5" />
              <StatCard title="Element Types" value={Object.keys(filteredSummary).length}
                icon={<span style={{ color: "#06b6d4" }}>&#9670;</span>} color="#06b6d4" />
              <StatCard title="Storeys" value={effectiveStoreyList.length}
                icon={<span style={{ color: "#10b981" }}>&#9650;</span>} color="#10b981" />
              <StatCard title="Properties" value={totalProps.toLocaleString()}
                icon={<span style={{ color: "#f59e0b" }}>&#9733;</span>} color="#f59e0b" />
              {isMultiModel && (
                <StatCard title="Models" value={data.modelCount}
                  icon={<span style={{ color: "#8b5cf6" }}>&#9830;</span>} color="#8b5cf6" />
              )}
            </div>
          </DashboardPanel>
        </div>

        {/* Bar Chart */}
        <div key="barChart">
          <DashboardPanel
            title="Element Count by Type"
            hint="click to filter"
            collapsed={collapsedPanels.has("barChart")}
            onToggleCollapse={() => toggleCollapse("barChart")}
          >
            <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -10, bottom: 10, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45}
                    textAnchor="end" height={80} interval={0}
                    tickFormatter={(v) => v.length > 14 ? v.slice(0, 12) + "…" : v} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer"
                    barSize={barThickness}
                    onClick={(entry) => handleFilterClick("type", entry.fullName)}>
                    <LabelList dataKey="value" position="top" fontSize={10} fontWeight={600} fill="#333" />
                    {chartData.map((entry, i) => {
                      const isActive = filterKey === `type:${entry.fullName}`;
                      return (
                        <Cell key={i}
                          fill={isActive ? ACTIVE_COLOR : classColorMap[entry.fullName] || "#999"}
                          stroke={isActive ? "#cc5200" : "transparent"}
                          strokeWidth={isActive ? 2 : 0} />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>
        </div>

        {/* Pie Chart */}
        <div key="pieChart">
          <DashboardPanel
            title="Element Distribution"
            hint="click to filter"
            collapsed={collapsedPanels.has("pieChart")}
            onToggleCollapse={() => toggleCollapse("pieChart")}
          >
            <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData.slice(0, 8)} dataKey="value" nameKey="name"
                    cx="50%" cy="45%" outerRadius="35%" innerRadius="18%"
                    paddingAngle={2} cursor="pointer"
                    onClick={(entry) => handleFilterClick("type", entry.fullName)}
                    label={renderPieLabel}
                    labelLine={{ stroke: "#bbb", strokeWidth: 1 }}>
                    {chartData.slice(0, 8).map((entry, i) => {
                      const isActive = filterKey === `type:${entry.fullName}`;
                      return (
                        <Cell key={i}
                          fill={isActive ? ACTIVE_COLOR : classColorMap[entry.fullName] || "#999"}
                          stroke={isActive ? "#cc5200" : "transparent"}
                          strokeWidth={isActive ? 3 : 0} />
                      );
                    })}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val.toLocaleString(), name]} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center"
                    iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>
        </div>

        {/* PredefinedType */}
        {hasPredef && (
          <div key="predefined">
            <DashboardPanel
              title="Export As + PredefinedType"
              hint="click to filter"
              collapsed={collapsedPanels.has("predefined")}
              onToggleCollapse={() => toggleCollapse("predefined")}
            >
              <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px", overflow: "auto" }}>
                <ResponsiveContainer width="100%" height={Math.max(predefData.length * (barThickness + 12) + 40, 120)}>
                  <BarChart data={predefData} layout="vertical"
                    margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }}
                      width={130}
                      tickFormatter={(v) => v.length > 18 ? v.slice(0, 16) + "…" : v} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(val, _name, props) => [
                        val.toLocaleString(),
                        `${props.payload.exportAs} → ${props.payload.pType}`,
                      ]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer"
                      barSize={barThickness}
                      onClick={(entry) => handleFilterClick("predefinedType", entry.fullLabel)}>
                      <LabelList dataKey="value" position="right" fontSize={10} fontWeight={600} fill="#333" />
                      {predefData.map((entry, i) => {
                        const isActive = filterKey === `predefinedType:${entry.fullLabel}`;
                        return (
                          <Cell key={i}
                            fill={isActive ? ACTIVE_COLOR : classColorMap[entry.exportAs] || "#999"} />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardPanel>
          </div>
        )}

        {/* IFC Class Summary Table */}
        <div key="classTable">
          <DashboardPanel
            title="Element Summary by IFC Class"
            hint="click to filter"
            collapsed={collapsedPanels.has("classTable")}
            onToggleCollapse={() => toggleCollapse("classTable")}
          >
            <div style={{ padding: "0 12px 12px", height: "100%", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
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
                          borderBottom: "1px solid #f0f0f0",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "#f8f9fb";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isActive ? "#fff3e0" : "transparent";
                        }}
                      >
                        <td style={{ padding: "6px 4px" }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: 3,
                            background: color,
                            border: isActive ? "2px solid #ff6600" : "none",
                          }} />
                        </td>
                        <td style={{
                          padding: "6px 4px",
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "#cc5200" : "#333",
                        }}>
                          {entry.name}
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>
                          {entry.value.toLocaleString()}
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: "#888" }}>
                          {pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{
                            height: 6, borderRadius: 3, background: "#f0f0f0",
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
          </DashboardPanel>
        </div>

        {/* Storeys Chart */}
        {hasStoreys && (
          <div key="storeys">
            <DashboardPanel
              title="Elements by Storey"
              hint="click to filter"
              collapsed={collapsedPanels.has("storeys")}
              onToggleCollapse={() => toggleCollapse("storeys")}
            >
              <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px", overflow: "auto" }}>
                <ResponsiveContainer width="100%" height={storeyChartPx}>
                  <BarChart data={[...storeyData].reverse()} layout="vertical"
                    margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }}
                      width={120} interval={0}
                      tickFormatter={(v) => v.length > 16 ? v.slice(0, 14) + "…" : v} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    {uniqueTypes.slice(0, 8).map((type, i) => {
                      const isLast = i === Math.min(uniqueTypes.length, 8) - 1;
                      return (
                        <Bar key={type} dataKey={type} stackId="a"
                          fill={classColorMap[type] || "#999"}
                          name={type.replace("Ifc", "")}
                          cursor="pointer" barSize={barThickness}
                          onClick={(entry) => handleFilterClick("storey", entry.name)}>
                          {isLast && (
                            <LabelList
                              valueAccessor={(entry) => {
                                const total = uniqueTypes.slice(0, 8).reduce(
                                  (sum, t) => sum + (entry[t] || 0), 0
                                );
                                return total || "";
                              }}
                              position="right" fontSize={10} fontWeight={600} fill="#333" />
                          )}
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardPanel>
          </div>
        )}

        {/* Table */}
        <div key="table">
          <DashboardPanel
            title="All Elements"
            collapsed={collapsedPanels.has("table")}
            onToggleCollapse={() => toggleCollapse("table")}
          >
            <div style={{ padding: "0 12px 12px", height: "100%", overflow: "auto" }}>
              <ElementTable elements={filteredElements} multiModel={isMultiModel} />
            </div>
          </DashboardPanel>
        </div>
      </GridLayout>
    </div>
  );
}

function buildDefaultLayout(h, hasPredef, hasStoreys) {
  const l = [];
  let y = 0;

  l.push({ i: "stats", x: 0, y, w: 12, h: h.stats, minW: 4, minH: 2 });
  y += h.stats;

  l.push({ i: "barChart", x: 0, y, w: 6, h: h.barChart, minW: 3, minH: 4 });
  l.push({ i: "pieChart", x: 6, y, w: 6, h: h.pieChart, minW: 3, minH: 4 });
  y += h.barChart;

  if (hasPredef) {
    l.push({ i: "predefined", x: 0, y, w: 12, h: h.predefined, minW: 4, minH: 4 });
    y += h.predefined;
  }

  l.push({
    i: "classTable", x: 0, y,
    w: hasStoreys ? 6 : 12,
    h: h.classTable, minW: 3, minH: 4,
  });
  if (hasStoreys) {
    l.push({
      i: "storeys", x: 6, y,
      w: 6, h: h.storeys, minW: 3, minH: 4,
    });
  }
  y += Math.max(h.classTable, hasStoreys ? h.storeys : 0);

  l.push({ i: "table", x: 0, y, w: 12, h: h.table, minW: 4, minH: 4 });
  return l;
}

const schemaBadgeStyle = {
  fontSize: 11, fontWeight: 600, background: "#eef2ff",
  color: "#4338ca", padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5,
};

const tooltipStyle = {
  borderRadius: 8, border: "1px solid #eee",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const thStyle = {
  padding: "8px 4px", fontWeight: 600, color: "#666", fontSize: 12,
};

const resetBtnStyle = {
  padding: "5px 12px", borderRadius: 6,
  border: "1px solid #d1d5db", background: "#fff",
  color: "#666", fontSize: 12, fontWeight: 500,
  cursor: "pointer", transition: "all 0.15s",
};
