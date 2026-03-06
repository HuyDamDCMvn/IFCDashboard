import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { COLORS } from "../../lib/theme";

const DIFF_COLORS = {
  added: COLORS.green,
  deleted: COLORS.danger,
  changed: COLORS.amber,
  unchanged: "#94a3b8",
};

export default function DiffSummaryView({ result }) {
  const { summary, changeTypeSummary, typeSummary } = result;

  const pieData = [
    { name: "Added", value: summary.addedCount, color: DIFF_COLORS.added },
    { name: "Deleted", value: summary.deletedCount, color: DIFF_COLORS.deleted },
    { name: "Changed", value: summary.changedCount, color: DIFF_COLORS.changed },
    { name: "Unchanged", value: summary.unchangedCount, color: DIFF_COLORS.unchanged },
  ].filter((d) => d.value > 0);

  const total = summary.addedCount + summary.deletedCount + summary.changedCount + summary.unchangedCount;

  const barData = useMemo(() => {
    const types = new Set([
      ...Object.keys(typeSummary.added || {}),
      ...Object.keys(typeSummary.deleted || {}),
      ...Object.keys(typeSummary.changed || {}),
    ]);
    return [...types].map((t) => ({
      type: t.replace("Ifc", ""),
      Added: typeSummary.added?.[t] || 0,
      Deleted: typeSummary.deleted?.[t] || 0,
      Changed: typeSummary.changed?.[t] || 0,
    })).sort((a, b) => (b.Added + b.Deleted + b.Changed) - (a.Added + a.Deleted + a.Changed));
  }, [typeSummary]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Added", value: summary.addedCount, color: DIFF_COLORS.added, bg: "#f0fdf4" },
          { label: "Deleted", value: summary.deletedCount, color: DIFF_COLORS.deleted, bg: "#fef2f2" },
          { label: "Changed", value: summary.changedCount, color: DIFF_COLORS.changed, bg: "#fffbeb" },
          { label: "Unchanged", value: summary.unchangedCount, color: DIFF_COLORS.unchanged, bg: "#f8fafc" },
        ].map((s) => (
          <div key={s.label} style={{ ...statCardStyle, background: s.bg, borderColor: `${s.color}33` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={chartCard}>
          <h4 style={chartTitle}>Overview</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                   dataKey="value" paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
            Total: {total} elements compared
          </div>
        </div>

        {barData.length > 0 && (
          <div style={chartCard}>
            <h4 style={chartTitle}>Changes by Type</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="type" width={60} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Added" fill={DIFF_COLORS.added} stackId="a" />
                <Bar dataKey="Deleted" fill={DIFF_COLORS.deleted} stackId="a" />
                <Bar dataKey="Changed" fill={DIFF_COLORS.changed} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {Object.keys(changeTypeSummary || {}).length > 0 && (
        <div style={{ ...chartCard, marginTop: 16 }}>
          <h4 style={chartTitle}>Change Categories</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {Object.entries(changeTypeSummary).map(([key, count]) => (
              <span key={key} style={changeCategoryBadge}>
                {key}: <b>{count}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const statCardStyle = {
  padding: 16, borderRadius: 10, border: "1px solid", textAlign: "center",
};
const chartCard = {
  background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e2e8f0",
};
const chartTitle = {
  fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 8px",
};
const changeCategoryBadge = {
  fontSize: 12, padding: "4px 10px", borderRadius: 6,
  background: "#f1f5f9", color: "#475569",
};
