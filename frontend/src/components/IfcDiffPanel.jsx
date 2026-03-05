import { useState, useCallback, useMemo } from "react";
import { useIfcDiff } from "../contexts/IfcDiffContext";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = {
  added: "#22c55e",
  deleted: "#ef4444",
  changed: "#f59e0b",
  unchanged: "#94a3b8",
};

export default function IfcDiffPanel({ onClose }) {
  const { diffResult, diffLoading, diffError, runDiff, clearDiff } = useIfcDiff();
  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedGuid, setExpandedGuid] = useState(null);

  const handleRun = useCallback(async () => {
    if (!oldFile || !newFile) return;
    try {
      await runDiff(oldFile, newFile);
    } catch {}
  }, [oldFile, newFile, runDiff]);

  const handleClose = useCallback(() => {
    clearDiff();
    onClose?.();
  }, [clearDiff, onClose]);

  const isSchemaMismatch = diffError && diffResult?.error === "schema_mismatch";
  const hasResult = diffResult && diffResult.summary;

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconStyle}>DIFF</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>
              IFC Model Comparison
            </span>
          </div>
          <button onClick={handleClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* File Upload */}
        {!hasResult && (
          <div style={{ padding: 24 }}>
            <div style={uploadRowStyle}>
              <FileDropZone
                label="Old Model (Base)"
                file={oldFile}
                onFile={setOldFile}
                color="#6366f1"
              />
              <div style={arrowStyle}>&#8594;</div>
              <FileDropZone
                label="New Model (Updated)"
                file={newFile}
                onFile={setNewFile}
                color="#06b6d4"
              />
            </div>

            {isSchemaMismatch && (
              <div style={schemaMismatchStyle}>
                <strong>Schema Mismatch</strong>
                <p style={{ margin: "6px 0 0" }}>{diffResult.message}</p>
                <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 13 }}>
                  <span>Old: <b>{diffResult.oldFile?.schemaId}</b></span>
                  <span>New: <b>{diffResult.newFile?.schemaId}</b></span>
                </div>
              </div>
            )}

            {diffError && !isSchemaMismatch && (
              <div style={errorStyle}>{diffError}</div>
            )}

            <button
              onClick={handleRun}
              disabled={!oldFile || !newFile || diffLoading}
              style={{
                ...runBtnStyle,
                opacity: (!oldFile || !newFile || diffLoading) ? 0.5 : 1,
              }}
            >
              {diffLoading ? "Comparing..." : "Compare Files"}
            </button>
          </div>
        )}

        {/* Results */}
        {hasResult && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Schema warning */}
            {diffResult.schemaCheck?.warning && (
              <div style={warningBarStyle}>
                {diffResult.schemaCheck.warning}
              </div>
            )}

            {/* File info bar */}
            <div style={fileInfoBarStyle}>
              <FileInfoBadge
                label="Old" name={diffResult.oldFile.name}
                schema={diffResult.oldFile.schema}
                count={diffResult.oldFile.totalProducts}
                color="#6366f1"
              />
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>vs</span>
              <FileInfoBadge
                label="New" name={diffResult.newFile.name}
                schema={diffResult.newFile.schema}
                count={diffResult.newFile.totalProducts}
                color="#06b6d4"
              />
              <button onClick={() => { clearDiff(); }} style={resetBtnStyle}>
                New Comparison
              </button>
              {diffResult.timing && (
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
                  {diffResult.timing.elapsed_s}s ({diffResult.timing.mode})
                </span>
              )}
            </div>
            {diffResult.noiseExcluded > 0 && (
              <div style={{ ...warningBarStyle, background: "#f0f9ff", borderColor: "#bae6fd", color: "#0369a1" }}>
                {diffResult.noiseExcluded.toLocaleString()} noise elements excluded (ports, openings)
              </div>
            )}

            {/* Tabs */}
            <div style={tabBarStyle}>
              {["summary", "added", "deleted", "changed"].map((t) => {
                const count = t === "summary" ? null : diffResult.summary[`${t}Count`];
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      ...tabBtnStyle,
                      borderBottom: activeTab === t ? `2px solid ${COLORS[t] || "#4f46e5"}` : "2px solid transparent",
                      color: activeTab === t ? (COLORS[t] || "#4f46e5") : "#64748b",
                      fontWeight: activeTab === t ? 700 : 500,
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {count != null && (
                      <span style={{
                        ...countBadge,
                        background: COLORS[t] || "#e2e8f0",
                        color: "#fff",
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
              {diffResult.truncated && (
                <div style={truncationWarningStyle}>
                  Results capped at {diffResult.maxResults} elements per category for performance.
                  Summary counts reflect the full comparison.
                </div>
              )}
              {activeTab === "summary" && (
                <SummaryView result={diffResult} />
              )}
              {activeTab === "added" && (
                <ElementList
                  elements={diffResult.added}
                  status="added"
                  expandedGuid={expandedGuid}
                  onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.addedCount}
                />
              )}
              {activeTab === "deleted" && (
                <ElementList
                  elements={diffResult.deleted}
                  status="deleted"
                  expandedGuid={expandedGuid}
                  onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.deletedCount}
                />
              )}
              {activeTab === "changed" && (
                <ElementList
                  elements={diffResult.changed}
                  status="changed"
                  expandedGuid={expandedGuid}
                  onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.changedCount}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ── Sub-components ── */

function FileDropZone({ label, file, onFile, color }) {
  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <label style={{
      ...dropZoneStyle,
      borderColor: file ? color : "#d1d5db",
      background: file ? `${color}08` : "#fafafa",
    }}>
      <input type="file" accept=".ifc" onChange={handleChange} style={{ display: "none" }} />
      <div style={{ fontSize: 24, color: file ? color : "#d1d5db" }}>
        {file ? "\u2713" : "\u21E7"}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: file ? color : "#94a3b8" }}>
        {label}
      </div>
      {file && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, wordBreak: "break-all" }}>
          {file.name} ({(file.size / 1024).toFixed(0)} KB)
        </div>
      )}
    </label>
  );
}

function FileInfoBadge({ label, name, schema, count, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: "#fff", background: color,
        padding: "1px 6px", borderRadius: 4,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
        {name}
      </span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>
        {schema} &middot; {count} elements
      </span>
    </div>
  );
}

function SummaryView({ result }) {
  const { summary, changeTypeSummary, typeSummary } = result;

  const pieData = [
    { name: "Added", value: summary.addedCount, color: COLORS.added },
    { name: "Deleted", value: summary.deletedCount, color: COLORS.deleted },
    { name: "Changed", value: summary.changedCount, color: COLORS.changed },
    { name: "Unchanged", value: summary.unchangedCount, color: COLORS.unchanged },
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
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Added", value: summary.addedCount, color: COLORS.added, bg: "#f0fdf4" },
          { label: "Deleted", value: summary.deletedCount, color: COLORS.deleted, bg: "#fef2f2" },
          { label: "Changed", value: summary.changedCount, color: COLORS.changed, bg: "#fffbeb" },
          { label: "Unchanged", value: summary.unchangedCount, color: COLORS.unchanged, bg: "#f8fafc" },
        ].map((s) => (
          <div key={s.label} style={{ ...statCardStyle, background: s.bg, borderColor: `${s.color}33` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Pie */}
        <div style={chartCard}>
          <h4 style={chartTitle}>Overview</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                   dataKey="value" paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
            Total: {total} elements compared
          </div>
        </div>

        {/* Bar */}
        {barData.length > 0 && (
          <div style={chartCard}>
            <h4 style={chartTitle}>Changes by Type</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="type" width={60} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Added" fill={COLORS.added} stackId="a" />
                <Bar dataKey="Deleted" fill={COLORS.deleted} stackId="a" />
                <Bar dataKey="Changed" fill={COLORS.changed} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Change type breakdown */}
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

const PAGE_SIZE = 100;

function ElementList({ elements, status, expandedGuid, onToggle, totalCount }) {
  const [page, setPage] = useState(1);

  if (!elements || elements.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
        No {status} elements
      </div>
    );
  }

  const visible = elements.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < elements.length;
  const displayTotal = totalCount != null && totalCount > elements.length ? totalCount : elements.length;

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        Showing {visible.length} of {displayTotal} element{displayTotal !== 1 ? "s" : ""}
        {totalCount != null && totalCount > elements.length && (
          <span style={{ color: "#f59e0b", marginLeft: 8 }}>
            (list capped at {elements.length} for performance)
          </span>
        )}
      </div>
      {visible.map((el) => (
        <ElementRow
          key={el.globalId}
          el={el}
          status={status}
          expanded={expandedGuid === el.globalId}
          onToggle={() => onToggle(expandedGuid === el.globalId ? null : el.globalId)}
        />
      ))}
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          style={loadMoreBtnStyle}
        >
          Load more ({elements.length - visible.length} remaining)
        </button>
      )}
    </div>
  );
}

function ElementRow({ el, status, expanded, onToggle }) {
  const hasChanges = el.changes && Object.keys(el.changes).length > 0;

  return (
    <div style={{
      ...elementRowStyle,
      borderLeftColor: COLORS[status],
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: hasChanges ? "pointer" : "default" }}
        onClick={hasChanges ? onToggle : undefined}
      >
        {hasChanges && (
          <span style={{ fontSize: 10, color: "#94a3b8", userSelect: "none" }}>
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
        <span style={statusDot(status)} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
          {el.type?.replace("Ifc", "")}
        </span>
        <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
          {el.name || "(unnamed)"}
        </span>
        {el.storey && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{el.storey}</span>
        )}
        <span style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "monospace" }}>
          {el.globalId?.slice(0, 12)}...
        </span>
      </div>

      {expanded && hasChanges && (
        <ChangeDetail changes={el.changes} />
      )}
    </div>
  );
}

function ChangeDetail({ changes }) {
  return (
    <div style={{ marginTop: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 12 }}>
      {changes.attributes && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Attribute Changes</div>
          {Object.entries(changes.attributes).map(([attr, vals]) => (
            <div key={attr} style={changeRow}>
              <span style={{ fontWeight: 600, color: "#475569", width: 120, flexShrink: 0 }}>{attr}</span>
              <span style={{ color: "#ef4444", textDecoration: "line-through" }}>{vals.old ?? "(null)"}</span>
              <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
              <span style={{ color: "#22c55e" }}>{vals.new ?? "(null)"}</span>
            </div>
          ))}
        </div>
      )}

      {changes.placement && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Placement</div>
          <div style={{ color: "#f59e0b" }}>Position / rotation changed</div>
        </div>
      )}

      {changes.geometry && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Geometry</div>
          <div style={{ color: "#a855f7" }}>3D shape representation changed</div>
        </div>
      )}

      {changes.container && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Container</div>
          <div style={changeRow}>
            <span style={{ color: "#ef4444" }}>{changes.container.old ?? "(none)"}</span>
            <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
            <span style={{ color: "#22c55e" }}>{changes.container.new ?? "(none)"}</span>
          </div>
        </div>
      )}

      {changes.type && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Type Assignment</div>
          <div style={changeRow}>
            <span style={{ color: "#ef4444" }}>{changes.type.old?.name ?? "(none)"}</span>
            <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
            <span style={{ color: "#22c55e" }}>{changes.type.new?.name ?? "(none)"}</span>
          </div>
        </div>
      )}

      {changes.properties && (
        <div>
          <div style={changeSectionTitle}>Property Changes</div>
          {Object.entries(changes.properties).map(([pset, info]) => (
            <div key={pset} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600, color: "#475569", fontSize: 11 }}>
                {pset}
                {info._status && (
                  <span style={{
                    fontSize: 10, marginLeft: 6, padding: "1px 6px", borderRadius: 3,
                    background: info._status === "added" ? "#dcfce7" : info._status === "deleted" ? "#fee2e2" : "#fef3c7",
                    color: info._status === "added" ? "#166534" : info._status === "deleted" ? "#991b1b" : "#92400e",
                  }}>
                    {info._status}
                  </span>
                )}
              </div>
              {info.properties && Object.entries(info.properties).map(([prop, vals]) => (
                <div key={prop} style={{ ...changeRow, paddingLeft: 12 }}>
                  <span style={{ color: "#64748b", width: 140, flexShrink: 0 }}>{prop}</span>
                  <span style={{ color: "#ef4444" }}>{String(vals.old ?? "(null)")}</span>
                  <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
                  <span style={{ color: "#22c55e" }}>{String(vals.new ?? "(null)")}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Styles ── */

const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 500,
  background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const panelStyle = {
  width: "90vw", maxWidth: 1100, height: "88vh",
  background: "#fff", borderRadius: 16,
  boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 24px", borderBottom: "1px solid #e2e8f0",
};

const iconStyle = {
  width: 36, height: 36, borderRadius: 8,
  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontWeight: 800, fontSize: 11,
};

const closeBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: "none",
  background: "#f1f5f9", color: "#64748b", fontSize: 20,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const uploadRowStyle = {
  display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
};

const arrowStyle = {
  fontSize: 24, color: "#94a3b8", fontWeight: 700, flexShrink: 0,
};

const dropZoneStyle = {
  flex: 1, padding: 24, borderRadius: 12,
  border: "2px dashed", cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: 6, transition: "all 0.2s",
  minHeight: 120,
};

const runBtnStyle = {
  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  transition: "opacity 0.2s",
};

const schemaMismatchStyle = {
  padding: 16, borderRadius: 10, marginBottom: 16,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
};

const errorStyle = {
  padding: 12, borderRadius: 8, marginBottom: 16,
  background: "#fef2f2", border: "1px solid #fecaca",
  color: "#dc2626", fontSize: 13,
};

const warningBarStyle = {
  padding: "8px 24px", background: "#fffbeb", borderBottom: "1px solid #fde68a",
  fontSize: 12, color: "#92400e",
};

const fileInfoBarStyle = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "12px 24px", borderBottom: "1px solid #e2e8f0",
  flexWrap: "wrap",
};

const resetBtnStyle = {
  marginLeft: "auto", padding: "4px 14px", borderRadius: 6,
  border: "1px solid #e2e8f0", background: "#fff",
  color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const tabBarStyle = {
  display: "flex", borderBottom: "1px solid #e2e8f0",
  padding: "0 24px",
};

const tabBtnStyle = {
  padding: "10px 16px", background: "none", border: "none",
  fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
  transition: "all 0.15s",
};

const countBadge = {
  fontSize: 10, fontWeight: 700, padding: "1px 7px",
  borderRadius: 10, minWidth: 20, textAlign: "center",
};

const statCardStyle = {
  padding: 16, borderRadius: 10, border: "1px solid",
  textAlign: "center",
};

const chartCard = {
  background: "#fff", borderRadius: 10, padding: 16,
  border: "1px solid #e2e8f0",
};

const chartTitle = {
  fontSize: 13, fontWeight: 700, color: "#334155",
  margin: "0 0 8px",
};

const changeCategoryBadge = {
  fontSize: 12, padding: "4px 10px", borderRadius: 6,
  background: "#f1f5f9", color: "#475569",
};

const elementRowStyle = {
  padding: "10px 12px", marginBottom: 4, borderRadius: 8,
  borderLeft: "3px solid", background: "#fafafa",
};

const statusDot = (status) => ({
  width: 8, height: 8, borderRadius: "50%",
  background: COLORS[status], flexShrink: 0,
});

const changeSectionTitle = {
  fontSize: 11, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: 0.5,
  marginBottom: 4,
};

const changeRow = {
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 12, padding: "2px 0", flexWrap: "wrap",
};

const truncationWarningStyle = {
  padding: "8px 16px", borderRadius: 8, marginBottom: 12,
  background: "#fffbeb", border: "1px solid #fde68a",
  color: "#92400e", fontSize: 12,
};

const loadMoreBtnStyle = {
  width: "100%", padding: "10px 0", marginTop: 8,
  borderRadius: 8, border: "1px solid #e2e8f0",
  background: "#f8fafc", color: "#4f46e5",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
