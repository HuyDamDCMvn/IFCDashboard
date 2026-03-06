import { useState, useCallback } from "react";
import { useIfcDiff } from "../contexts/IfcDiffContext";
import DiffSummaryView from "./diff/DiffSummaryView";
import DiffElementList from "./diff/DiffElementList";
import { COLORS } from "../lib/theme";
import { modalOverlay } from "../lib/shared-styles";

const DIFF_COLORS = {
  added: COLORS.green,
  deleted: COLORS.danger,
  changed: COLORS.amber,
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
    try { await runDiff(oldFile, newFile); } catch {}
  }, [oldFile, newFile, runDiff]);

  const handleClose = useCallback(() => {
    clearDiff();
    onClose?.();
  }, [clearDiff, onClose]);

  const isSchemaMismatch = diffError && diffResult?.error === "schema_mismatch";
  const hasResult = diffResult && diffResult.summary;

  return (
    <div style={modalOverlay}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconStyle}>DIFF</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>
              IFC Model Comparison
            </span>
          </div>
          <button onClick={handleClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* File Upload */}
        {!hasResult && (
          <div style={{ padding: 24 }}>
            <div style={uploadRowStyle}>
              <FileDropZone label="Old Model (Base)" file={oldFile} onFile={setOldFile} color="#6366f1" />
              <div style={arrowStyle}>&#8594;</div>
              <FileDropZone label="New Model (Updated)" file={newFile} onFile={setNewFile} color={COLORS.cyan} />
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
              style={{ ...runBtnStyle, opacity: (!oldFile || !newFile || diffLoading) ? 0.5 : 1 }}
            >
              {diffLoading ? "Comparing..." : "Compare Files"}
            </button>
          </div>
        )}

        {/* Results */}
        {hasResult && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {diffResult.schemaCheck?.warning && (
              <div style={warningBarStyle}>{diffResult.schemaCheck.warning}</div>
            )}

            <div style={fileInfoBarStyle}>
              <FileInfoBadge label="Old" name={diffResult.oldFile.name}
                schema={diffResult.oldFile.schema} count={diffResult.oldFile.totalProducts} color="#6366f1" />
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>vs</span>
              <FileInfoBadge label="New" name={diffResult.newFile.name}
                schema={diffResult.newFile.schema} count={diffResult.newFile.totalProducts} color={COLORS.cyan} />
              <button onClick={clearDiff} style={resetBtnStyle}>New Comparison</button>
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

            <div style={tabBarStyle}>
              {["summary", "added", "deleted", "changed"].map((t) => {
                const count = t === "summary" ? null : diffResult.summary[`${t}Count`];
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      ...tabBtnStyle,
                      borderBottom: activeTab === t ? `2px solid ${DIFF_COLORS[t] || COLORS.primary}` : "2px solid transparent",
                      color: activeTab === t ? (DIFF_COLORS[t] || COLORS.primary) : "#64748b",
                      fontWeight: activeTab === t ? 700 : 500,
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {count != null && (
                      <span style={{ ...countBadgeStyle, background: DIFF_COLORS[t] || "#e2e8f0", color: "#fff" }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
              {diffResult.truncated && (
                <div style={truncationWarningStyle}>
                  Results capped at {diffResult.maxResults} elements per category for performance.
                  Summary counts reflect the full comparison.
                </div>
              )}
              {activeTab === "summary" && <DiffSummaryView result={diffResult} />}
              {activeTab === "added" && (
                <DiffElementList elements={diffResult.added} status="added"
                  expandedGuid={expandedGuid} onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.addedCount} />
              )}
              {activeTab === "deleted" && (
                <DiffElementList elements={diffResult.deleted} status="deleted"
                  expandedGuid={expandedGuid} onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.deletedCount} />
              )}
              {activeTab === "changed" && (
                <DiffElementList elements={diffResult.changed} status="changed"
                  expandedGuid={expandedGuid} onToggle={setExpandedGuid}
                  totalCount={diffResult.summary.changedCount} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FileDropZone({ label, file, onFile, color }) {
  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  return (
    <label style={{ ...dropZoneStyle, borderColor: file ? color : "#d1d5db", background: file ? `${color}08` : "#fafafa" }}>
      <input type="file" accept=".ifc" onChange={handleChange} style={{ display: "none" }} />
      <div style={{ fontSize: 24, color: file ? color : "#d1d5db" }}>{file ? "\u2713" : "\u21E7"}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: file ? color : "#94a3b8" }}>{label}</div>
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
      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: color, padding: "1px 6px", borderRadius: 4 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{name}</span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>{schema} &middot; {count} elements</span>
    </div>
  );
}

/* ── Styles ── */

const panelStyle = {
  width: "90vw", maxWidth: 1100, height: "88vh",
  background: COLORS.bg, borderRadius: 16,
  boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`,
};

const iconStyle = {
  width: 36, height: 36, borderRadius: 8,
  background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.danger})`,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontWeight: 800, fontSize: 11,
};

const closeBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: "none",
  background: "#f1f5f9", color: "#64748b", fontSize: 20,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const uploadRowStyle = { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 };
const arrowStyle = { fontSize: 24, color: "#94a3b8", fontWeight: 700, flexShrink: 0 };

const dropZoneStyle = {
  flex: 1, padding: 24, borderRadius: 12,
  border: "2px dashed", cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: 6, transition: "all 0.2s", minHeight: 120,
};

const runBtnStyle = {
  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
  background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.danger})`,
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s",
};

const schemaMismatchStyle = {
  padding: 16, borderRadius: 10, marginBottom: 16,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
};

const errorStyle = {
  padding: 12, borderRadius: 8, marginBottom: 16,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13,
};

const warningBarStyle = {
  padding: "8px 24px", background: "#fffbeb", borderBottom: "1px solid #fde68a",
  fontSize: 12, color: "#92400e",
};

const fileInfoBarStyle = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "12px 24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap",
};

const resetBtnStyle = {
  marginLeft: "auto", padding: "4px 14px", borderRadius: 6,
  border: `1px solid ${COLORS.border}`, background: COLORS.bg,
  color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const tabBarStyle = { display: "flex", borderBottom: `1px solid ${COLORS.border}`, padding: "0 24px" };

const tabBtnStyle = {
  padding: "10px 16px", background: "none", border: "none",
  fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
  transition: "all 0.15s",
};

const countBadgeStyle = {
  fontSize: 10, fontWeight: 700, padding: "1px 7px",
  borderRadius: 10, minWidth: 20, textAlign: "center",
};

const truncationWarningStyle = {
  padding: "8px 16px", borderRadius: 8, marginBottom: 12,
  background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12,
};
