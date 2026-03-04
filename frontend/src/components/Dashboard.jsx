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
  Treemap,
} from "recharts";
import StatCard from "./StatCard";
import ElementTable from "./ElementTable";

const COLORS = [
  "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#e11d48",
];

export default function Dashboard({ data }) {
  if (!data) return null;

  const chartData = Object.entries(data.summary)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: type.replace("Ifc", ""),
      fullName: type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

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
          }}
        >
          {data.project.name || "IFC Project"}
        </h2>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          {data.project.description}
          {data.project.schema && (
            <span style={{ marginLeft: 12, color: "#aaa" }}>
              Schema: {data.project.schema}
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
        {/* Bar Chart */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: "1px solid #f0f0f0",
          }}
        >
          <h3 style={chartTitleStyle}>Element Count by Type</h3>
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
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #eee",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: "1px solid #f0f0f0",
          }}
        >
          <h3 style={chartTitleStyle}>Element Distribution</h3>
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
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: "#ccc" }}
              >
                {chartData.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

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
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid #f0f0f0",
            }}
          >
            <h3 style={chartTitleStyle}>Materials Used</h3>
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
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Storey Breakdown */}
        {storeyData.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid #f0f0f0",
            }}
          >
            <h3 style={chartTitleStyle}>Elements by Storey</h3>
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
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Storey List */}
      {data.storeys?.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: "1px solid #f0f0f0",
            marginBottom: 28,
          }}
        >
          <h3 style={chartTitleStyle}>Building Storeys</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.storeys.map((s, i) => (
              <div
                key={i}
                style={{
                  background: "#f0f4ff",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: "#3949ab" }}>
                  {s.name}
                </div>
                <div style={{ color: "#888", fontSize: 12 }}>
                  Elevation: {s.elevation}m
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Elements Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #f0f0f0",
        }}
      >
        <h3 style={chartTitleStyle}>All Elements</h3>
        <ElementTable elements={data.elements} />
      </div>
    </div>
  );
}

const chartTitleStyle = {
  margin: "0 0 16px 0",
  fontSize: 15,
  fontWeight: 600,
  color: "#333",
};
