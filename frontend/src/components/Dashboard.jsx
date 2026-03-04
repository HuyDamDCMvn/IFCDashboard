import { useCallback } from "react";
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
} from "recharts";
import StatCard from "./StatCard";
import ElementTable from "./ElementTable";
import { useSelection } from "../contexts/SelectionContext";

const COLORS = [
  "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#e11d48",
];

const ACTIVE_COLOR = "#ff6600";

export default function Dashboard({ data }) {
  const { filterKey, toggleFilter } = useSelection();

  const handleFilterClick = useCallback(
    (category, value) => {
      if (!data?.elements) return;

      const key = `${category}:${value}`;
      let matching;

      switch (category) {
        case "type":
          matching = data.elements.filter((el) => el.type === value);
          break;
        case "predefinedType": {
          const [exportAs, ...rest] = value.split(".");
          const pType = rest.join(".");
          matching = data.elements.filter(
            (el) => el.type === exportAs && el.predefinedType === pType
          );
          break;
        }
        case "storey":
          matching = data.elements.filter((el) => el.storey === value);
          break;
        case "material":
          matching = data.elements.filter((el) =>
            el.materials?.some((m) => m.startsWith(value))
          );
          break;
        default:
          return;
      }

      const expressIDs = matching.map((el) => el.expressId);
      const globalIds = matching.map((el) => el.id).filter(Boolean);
      const label = `${value.replace("Ifc", "")} (${expressIDs.length})`;
      toggleFilter(expressIDs, label, key, globalIds);
    },
    [data, toggleFilter]
  );

  if (!data) return null;

  const schema = data.schemaInfo || {};

  // Export As (IFC class) chart
  const chartData = Object.entries(data.summary)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: type.replace("Ifc", ""),
      fullName: type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  // PredefinedType breakdown chart
  const predefData = Object.entries(data.predefinedTypeSummary || {})
    .map(([label, count]) => {
      const [exportAs, ...rest] = label.split(".");
      const pType = rest.join(".");
      return {
        name: `${exportAs.replace("Ifc", "")}.${pType}`,
        fullLabel: label,
        exportAs,
        pType,
        value: count,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const materialData = Object.entries(data.materialSummary || {})
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const storeyData = Object.entries(data.storeyBreakdown || {}).map(
    ([storey, types]) => ({
      name: storey,
      total: Object.values(types).reduce((s, v) => s + v, 0),
      ...types,
    })
  );

  const uniqueTypes = [...new Set(chartData.map((d) => d.fullName))];
  const totalProps = data.elements.reduce(
    (acc, el) =>
      acc +
      Object.values(el.propertySets || {}).reduce(
        (s, ps) => s + Object.keys(ps).length,
        0
      ),
    0
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#1a1a2e",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {data.project.name || "IFC Project"}
          {data.project.schema && (
            <span style={schemaBadgeStyle}>{data.project.schema}</span>
          )}
          {schema.hasInfraTypes && (
            <span style={{ ...schemaBadgeStyle, background: "#dcfce7", color: "#166534" }}>
              Infrastructure
            </span>
          )}
        </h2>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          {data.project.description}
        </div>
      </div>

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <StatCard
          title="Total Elements"
          value={data.totalElements.toLocaleString()}
          icon={<span style={{ color: "#4f46e5" }}>&#9632;</span>}
          color="#4f46e5"
        />
        <StatCard
          title="Element Types"
          value={Object.keys(data.summary).length}
          icon={<span style={{ color: "#06b6d4" }}>&#9670;</span>}
          color="#06b6d4"
        />
        <StatCard
          title="Storeys"
          value={data.storeys?.length || 0}
          icon={<span style={{ color: "#10b981" }}>&#9650;</span>}
          color="#10b981"
        />
        <StatCard
          title="Properties"
          value={totalProps.toLocaleString()}
          icon={<span style={{ color: "#f59e0b" }}>&#9733;</span>}
          color="#f59e0b"
        />
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* Bar Chart - Element types */}
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            Element Count by Type
            <span style={chartHintStyle}>click to filter</span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => handleFilterClick("type", entry.fullName)}
              >
                {chartData.map((entry, i) => {
                  const isActive = filterKey === `type:${entry.fullName}`;
                  return (
                    <Cell
                      key={i}
                      fill={isActive ? ACTIVE_COLOR : COLORS[i % COLORS.length]}
                      stroke={isActive ? "#cc5200" : "transparent"}
                      strokeWidth={isActive ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Distribution */}
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            Element Distribution
            <span style={chartHintStyle}>click to filter</span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData.slice(0, 8)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
                cursor="pointer"
                onClick={(entry) => handleFilterClick("type", entry.fullName)}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: "#ccc" }}
              >
                {chartData.slice(0, 8).map((entry, i) => {
                  const isActive = filterKey === `type:${entry.fullName}`;
                  return (
                    <Cell
                      key={i}
                      fill={isActive ? ACTIVE_COLOR : COLORS[i % COLORS.length]}
                      stroke={isActive ? "#cc5200" : "transparent"}
                      strokeWidth={isActive ? 3 : 0}
                    />
                  );
                })}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PredefinedType Breakdown */}
      {predefData.length > 0 && (
        <div style={{ ...chartCardStyle, marginBottom: 28 }}>
          <h3 style={chartTitleStyle}>
            Export As + PredefinedType
            <span style={chartHintStyle}>click to filter</span>
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, predefData.length * 28 + 40)}>
            <BarChart
              data={predefData}
              layout="vertical"
              margin={{ left: 120, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name, props) => [
                  val,
                  `${props.payload.exportAs} → ${props.payload.pType}`,
                ]}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(entry) =>
                  handleFilterClick("predefinedType", entry.fullLabel)
                }
              >
                {predefData.map((entry, i) => {
                  const isActive =
                    filterKey === `predefinedType:${entry.fullLabel}`;
                  return (
                    <Cell
                      key={i}
                      fill={isActive ? ACTIVE_COLOR : COLORS[i % COLORS.length]}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Second Row: Material + Storey */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* Materials */}
        {materialData.length > 0 && (
          <div style={chartCardStyle}>
            <h3 style={chartTitleStyle}>
              Materials Used
              <span style={chartHintStyle}>click to filter</span>
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={materialData}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(entry) =>
                    handleFilterClick("material", entry.name)
                  }
                >
                  {materialData.map((entry, i) => {
                    const isActive =
                      filterKey === `material:${entry.name}`;
                    return (
                      <Cell
                        key={i}
                        fill={isActive ? ACTIVE_COLOR : "#8b5cf6"}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Storey Breakdown */}
        {storeyData.length > 0 && (
          <div style={chartCardStyle}>
            <h3 style={chartTitleStyle}>
              Elements by Storey
              <span style={chartHintStyle}>click to filter</span>
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={storeyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {uniqueTypes.slice(0, 6).map((type, i) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="a"
                    fill={COLORS[i % COLORS.length]}
                    name={type.replace("Ifc", "")}
                    cursor="pointer"
                    onClick={(entry) =>
                      handleFilterClick("storey", entry.name)
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Storey List */}
      {data.storeys?.length > 0 && (
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Building Storeys</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.storeys.map((s, i) => {
              const isActive = filterKey === `storey:${s.name}`;
              return (
                <div
                  key={i}
                  onClick={() => handleFilterClick("storey", s.name)}
                  style={{
                    background: isActive ? "#fff3e0" : "#f0f4ff",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    cursor: "pointer",
                    border: isActive
                      ? "2px solid #ff6600"
                      : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: isActive ? "#cc5200" : "#3949ab",
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ color: "#888", fontSize: 12 }}>
                    Elevation: {s.elevation}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Elements Table */}
      <div style={{ ...chartCardStyle, marginTop: 28 }}>
        <h3 style={chartTitleStyle}>All Elements</h3>
        <ElementTable elements={data.elements} />
      </div>
    </div>
  );
}

const chartCardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: "1px solid #f0f0f0",
};

const chartTitleStyle = {
  margin: "0 0 16px 0",
  fontSize: 15,
  fontWeight: 600,
  color: "#333",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const chartHintStyle = {
  fontSize: 11,
  fontWeight: 400,
  color: "#bbb",
  fontStyle: "italic",
};

const schemaBadgeStyle = {
  fontSize: 11,
  fontWeight: 600,
  background: "#eef2ff",
  color: "#4338ca",
  padding: "3px 10px",
  borderRadius: 20,
  letterSpacing: 0.5,
};

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #eee",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};
