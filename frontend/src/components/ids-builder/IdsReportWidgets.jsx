/**
 * Small reusable widgets extracted from IdsValidationReport.
 */

import { COLORS } from "../../lib/theme";

export function DonutChart({ passed, failed, size = 64 }) {
  const total = passed + failed;
  if (total === 0) return null;
  const pct = total > 0 ? passed / total : 0;
  const r = 20;
  const C = 2 * Math.PI * r;
  const arc = pct * C;

  return (
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="25" cy="25" r={r} fill="none" stroke="#fee2e2" strokeWidth="5" />
      {arc > 0 && (
        <circle cx="25" cy="25" r={r} fill="none" stroke={COLORS.emerald} strokeWidth="5"
          strokeDasharray={`${arc} ${C - arc}`} strokeLinecap="round"
          transform="rotate(-90 25 25)" />
      )}
      <text x="25" y="25" textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="800" fill={pct >= 0.5 ? "#166534" : "#991b1b"}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export function ComplianceBar({ passed, total }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100, flexShrink: 0 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: COLORS.border, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${pct}%`,
          background: pct === 100 ? COLORS.emerald : pct >= 50 ? COLORS.amber : COLORS.danger,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 28, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

export function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      flex: 1, padding: "12px 16px", borderRadius: 10,
      background: `${color}10`, border: `1px solid ${color}25`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function downloadCsv(headers, rows, filename) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
