import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
  Legend, CartesianGrid, LabelList,
} from "recharts";
import StatCard from "./StatCard";
import ElementTable from "./ElementTable";
import DashboardPanel from "./DashboardPanel";
import DashboardToolbar from "./DashboardToolbar";
import ClassSummaryTable from "./ClassSummaryTable";
import { useSelection } from "../contexts/SelectionContext";
import { useModelRegistry } from "../contexts/ModelRegistryContext";
import { ACTIVE_COLOR } from "../lib/ifc-filter-core";
import { useIfcFilter } from "../lib/useIfcFilter";
import { COLORS } from "../lib/theme";
import { badge, tooltipBox } from "../lib/shared-styles";

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
      {data && <DashboardInner data={data} containerWidth={containerWidth} />}
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

const schemaBadge = badge();
const infraBadge = badge("#dcfce7", "#166534");

function DashboardInner({ data, containerWidth }) {
  const { filterKey, toggleFilter, setClassColorMap } = useSelection();
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
    savePrefs({ layout: savedLayout, collapsed: [...collapsedPanels], barThickness });
  }, [savedLayout, collapsedPanels, barThickness]);

  const {
    allClasses, classColorMap, effectiveSummary, filteredElements,
    chartData, predefData, storeyData, totalProps, uniqueTypes,
    handleFilterClick,
  } = useIfcFilter(
    data.elements, data.summary, data.storeys,
    classFilter, modelFilter, { toggleFilter }, filterKey,
  );

  useEffect(() => { setClassColorMap(classColorMap); }, [classColorMap, setClassColorMap]);

  const toggleClass = useCallback((cls) => {
    setClassFilter(prev => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });
  }, []);

  const toggleModelFilter = useCallback((id) => {
    setModelFilter(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
  const hasPredef = predefData.length > 0;
  const hasStoreys = storeyData.length > 0;
  const effectiveStoreyList = storeyData.filter(s => s.elevation !== -Infinity);
  const isMultiModel = (data.modelCount || 0) > 1;

  const predefChartPx = Math.max(predefData.length * (barThickness + 12) + 40, 120);
  const storeyChartPx = Math.max(storeyData.length * (barThickness + 12) + 60, 120);
  const classTableContentPx = chartData.length * 28 + 48;

  const dynHeights = {
    stats: 5, barChart: 13, pieChart: 13,
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
      next.has(key) ? next.delete(key) : next.add(key);
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
              margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              Federation View
              <span style={schemaBadge}>{data.modelCount} models</span>
            </h2>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(data.projects || []).map((p, i) => (
                <span key={i}>
                  <span style={{ color: "#555", fontWeight: 500 }}>{p._modelName}</span>
                  {p.schema && <span style={{ ...schemaBadge, fontSize: 10, marginLeft: 6 }}>{p.schema}</span>}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {data.project?.name || "IFC Project"}
              {data.project?.schema && <span style={schemaBadge}>{data.project.schema}</span>}
              {schema.hasInfraTypes && <span style={infraBadge}>Infrastructure</span>}
            </h2>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
              {data.project?.description}
            </div>
          </>
        )}
      </div>

      <DashboardToolbar
        isMultiModel={isMultiModel}
        modelFilter={modelFilter} setModelFilter={setModelFilter}
        modelDropdownOpen={modelDropdownOpen} setModelDropdownOpen={setModelDropdownOpen}
        visibleModels={visibleModels} toggleModelFilter={toggleModelFilter}
        classFilter={classFilter} setClassFilter={setClassFilter}
        classDropdownOpen={classDropdownOpen} setClassDropdownOpen={setClassDropdownOpen}
        allClasses={allClasses} classColorMap={classColorMap}
        effectiveSummary={effectiveSummary} toggleClass={toggleClass}
        barThickness={barThickness} setBarThickness={setBarThickness}
        filteredElements={filteredElements} totalElementsAll={totalElementsAll}
        savedLayout={savedLayout} handleResetLayout={handleResetLayout}
      />

      <GridLayout
        layout={displayLayout}
        onDragStop={handleUserLayoutChange}
        onResizeStop={handleUserLayoutChange}
        cols={12} rowHeight={ROW_H}
        width={Math.max(containerWidth, 300)}
        margin={[16, 16]} containerPadding={[16, 0]}
        draggableHandle=".panel-drag-handle"
        compactType="vertical"
      >
        <div key="stats">
          <DashboardPanel title="Overview" collapsed={collapsedPanels.has("stats")} onToggleCollapse={() => toggleCollapse("stats")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, padding: 12 }}>
              <StatCard title="Total Elements" value={filteredElements.length.toLocaleString()} icon={<span style={{ color: COLORS.primary }}>&#9632;</span>} color={COLORS.primary} />
              <StatCard title="Element Types" value={Object.keys(effectiveSummary).length} icon={<span style={{ color: COLORS.cyan }}>&#9670;</span>} color={COLORS.cyan} />
              <StatCard title="Storeys" value={effectiveStoreyList.length} icon={<span style={{ color: COLORS.emerald }}>&#9650;</span>} color={COLORS.emerald} />
              <StatCard title="Properties" value={totalProps.toLocaleString()} icon={<span style={{ color: COLORS.amber }}>&#9733;</span>} color={COLORS.amber} />
              {isMultiModel && <StatCard title="Models" value={data.modelCount} icon={<span style={{ color: COLORS.violet }}>&#9830;</span>} color={COLORS.violet} />}
            </div>
          </DashboardPanel>
        </div>

        <div key="barChart">
          <DashboardPanel title="Element Count by Type" hint="click to filter" collapsed={collapsedPanels.has("barChart")} onToggleCollapse={() => toggleCollapse("barChart")}>
            <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -10, bottom: 10, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} interval={0}
                    tickFormatter={(v) => v.length > 14 ? v.slice(0, 12) + "…" : v} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipBox} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" barSize={barThickness}
                    onClick={(entry) => handleFilterClick("type", entry.fullName)}>
                    <LabelList dataKey="value" position="top" fontSize={10} fontWeight={600} fill="#333" />
                    {chartData.map((entry, i) => {
                      const isActive = filterKey === `type:${entry.fullName}`;
                      return <Cell key={i} fill={isActive ? ACTIVE_COLOR : classColorMap[entry.fullName] || "#999"}
                        stroke={isActive ? COLORS.activeDark : "transparent"} strokeWidth={isActive ? 2 : 0} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>
        </div>

        <div key="pieChart">
          <DashboardPanel title="Element Distribution" hint="click to filter" collapsed={collapsedPanels.has("pieChart")} onToggleCollapse={() => toggleCollapse("pieChart")}>
            <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData.slice(0, 8)} dataKey="value" nameKey="name"
                    cx="50%" cy="45%" outerRadius="35%" innerRadius="18%"
                    paddingAngle={2} cursor="pointer"
                    onClick={(entry) => handleFilterClick("type", entry.fullName)}
                    label={renderPieLabel} labelLine={{ stroke: "#bbb", strokeWidth: 1 }}>
                    {chartData.slice(0, 8).map((entry, i) => {
                      const isActive = filterKey === `type:${entry.fullName}`;
                      return <Cell key={i} fill={isActive ? ACTIVE_COLOR : classColorMap[entry.fullName] || "#999"}
                        stroke={isActive ? COLORS.activeDark : "transparent"} strokeWidth={isActive ? 3 : 0} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val.toLocaleString(), name]} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardPanel>
        </div>

        {hasPredef && (
          <div key="predefined">
            <DashboardPanel title="Export As + PredefinedType" hint="click to filter" collapsed={collapsedPanels.has("predefined")} onToggleCollapse={() => toggleCollapse("predefined")}>
              <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px", overflow: "auto" }}>
                <ResponsiveContainer width="100%" height={Math.max(predefData.length * (barThickness + 12) + 40, 120)}>
                  <BarChart data={predefData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130}
                      tickFormatter={(v) => v.length > 18 ? v.slice(0, 16) + "…" : v} />
                    <Tooltip contentStyle={tooltipBox}
                      formatter={(val, _name, props) => [val.toLocaleString(), `${props.payload.exportAs} → ${props.payload.pType}`]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer" barSize={barThickness}
                      onClick={(entry) => handleFilterClick("predefinedType", entry.fullLabel)}>
                      <LabelList dataKey="value" position="right" fontSize={10} fontWeight={600} fill="#333" />
                      {predefData.map((entry, i) => {
                        const isActive = filterKey === `predefinedType:${entry.fullLabel}`;
                        return <Cell key={i} fill={isActive ? ACTIVE_COLOR : classColorMap[entry.exportAs] || "#999"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardPanel>
          </div>
        )}

        <div key="classTable">
          <DashboardPanel title="Element Summary by IFC Class" hint="click to filter" collapsed={collapsedPanels.has("classTable")} onToggleCollapse={() => toggleCollapse("classTable")}>
            <ClassSummaryTable
              chartData={chartData} classColorMap={classColorMap}
              filterKey={filterKey} filteredElements={filteredElements}
              handleFilterClick={handleFilterClick}
            />
          </DashboardPanel>
        </div>

        {hasStoreys && (
          <div key="storeys">
            <DashboardPanel title="Elements by Storey" hint="click to filter" collapsed={collapsedPanels.has("storeys")} onToggleCollapse={() => toggleCollapse("storeys")}>
              <div style={{ width: "100%", height: "100%", padding: "4px 8px 8px", overflow: "auto" }}>
                <ResponsiveContainer width="100%" height={storeyChartPx}>
                  <BarChart data={[...storeyData].reverse()} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} interval={0}
                      tickFormatter={(v) => v.length > 16 ? v.slice(0, 14) + "…" : v} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    {uniqueTypes.slice(0, 8).map((type, i) => {
                      const isLast = i === Math.min(uniqueTypes.length, 8) - 1;
                      return (
                        <Bar key={type} dataKey={type} stackId="a" fill={classColorMap[type] || "#999"}
                          name={type.replace("Ifc", "")} cursor="pointer" barSize={barThickness}
                          onClick={(entry) => handleFilterClick("storey", entry.name)}>
                          {isLast && (
                            <LabelList
                              valueAccessor={(entry) => {
                                const total = uniqueTypes.slice(0, 8).reduce((sum, t) => sum + (entry[t] || 0), 0);
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

        <div key="table">
          <DashboardPanel title="All Elements" collapsed={collapsedPanels.has("table")} onToggleCollapse={() => toggleCollapse("table")}>
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

  l.push({ i: "classTable", x: 0, y, w: hasStoreys ? 6 : 12, h: h.classTable, minW: 3, minH: 4 });
  if (hasStoreys) {
    l.push({ i: "storeys", x: 6, y, w: 6, h: h.storeys, minW: 3, minH: 4 });
  }
  y += Math.max(h.classTable, hasStoreys ? h.storeys : 0);

  l.push({ i: "table", x: 0, y, w: 12, h: h.table, minW: 4, minH: 4 });
  return l;
}
