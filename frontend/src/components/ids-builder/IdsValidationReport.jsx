import { useState, useMemo, useCallback } from "react";
import { useSelection } from "../../contexts/SelectionContext";

export default function IdsValidationReport({ results, onClose, onMinimize, idsInfo, validatedAt }) {
  const [expandedSpecs, setExpandedSpecs] = useState(new Set());
  const [searchText, setSearchText] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewMode, setViewMode] = useState("spec");
  const [selectedGids, setSelectedGids] = useState(new Set());
  const [copiedGuid, setCopiedGuid] = useState(null);

  const { applyFilter, clearFilter } = useSelection();

  const models = results?.models || [];
  const overall = results?.overall ?? true;
  const totalSpecs = results?.totalSpecs || 0;
  const passedSpecs = results?.passedSpecs || 0;
  const failedSpecs = results?.failedSpecs || 0;

  const totalFailedElements = useMemo(() =>
    models.reduce((sum, m) =>
      sum + (m.specifications || []).reduce((s, sp) => s + (sp.failedElements?.length || 0), 0), 0
    ), [models]);

  const allFailedElements = useMemo(() => {
    const elems = [];
    models.forEach(m => {
      (m.specifications || []).forEach(sp => {
        (sp.failedElements || []).forEach(el => {
          if (!elems.some(e => e.globalId && e.globalId === el.globalId)) {
            elems.push(el);
          }
        });
      });
    });
    return elems;
  }, [models]);

  const uniqueLevels = useMemo(() => {
    const set = new Set();
    allFailedElements.forEach(el => { if (el.level) set.add(el.level); });
    return [...set].sort();
  }, [allFailedElements]);

  const uniqueClasses = useMemo(() => {
    const set = new Set();
    allFailedElements.forEach(el => { if (el.type) set.add(el.type); });
    return [...set].sort();
  }, [allFailedElements]);

  const groupedByLevel = useMemo(() => {
    const groups = {};
    allFailedElements.forEach(el => {
      const key = el.level || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allFailedElements]);

  const filterElements = useCallback((elements) => {
    if (!elements) return [];
    return elements.filter(el => {
      if (filterLevel && el.level !== filterLevel) return false;
      if (filterClass && el.type !== filterClass) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const haystack = [
          el.globalId, el.name, el.type, el.predefinedType, el.level,
          ...(el.reasons || []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [searchText, filterLevel, filterClass]);

  const sortElements = useCallback((elements) => {
    if (!sortColumn || !elements) return elements;
    return [...elements].sort((a, b) => {
      let va, vb;
      switch (sortColumn) {
        case "guid": va = a.globalId || ""; vb = b.globalId || ""; break;
        case "type": va = a.type || ""; vb = b.type || ""; break;
        case "predefinedType": va = a.predefinedType || ""; vb = b.predefinedType || ""; break;
        case "level": va = a.level || ""; vb = b.level || ""; break;
        case "reasons": va = (a.reasons || []).join("; "); vb = (b.reasons || []).join("; "); break;
        default: return 0;
      }
      const cmp = va.localeCompare(vb);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [sortColumn, sortDirection]);

  const handleSort = useCallback((col) => {
    if (col === sortColumn) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const toggleSpec = useCallback((specKey) => {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specKey)) next.delete(specKey);
      else next.add(specKey);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allKeys = [];
    models.forEach((m, mi) => {
      (m.specifications || []).forEach((_, si) => allKeys.push(`${mi}-${si}`));
    });
    groupedByLevel.forEach(([level]) => allKeys.push(`level_${level}`));
    setExpandedSpecs(new Set(allKeys));
  }, [models, groupedByLevel]);

  const collapseAll = useCallback(() => setExpandedSpecs(new Set()), []);

  const handleZoomToElement = useCallback((el) => {
    if (!el.globalId) return;
    applyFilter([el.expressId], `IDS: ${el.name || el.globalId}`, `ids_zoom_${el.globalId}`, [el.globalId], "#ef4444");
    if (onMinimize) onMinimize();
  }, [applyFilter, onMinimize]);

  const handleHighlightAll = useCallback((elements) => {
    const filtered = filterElements(elements);
    const gids = filtered.map(e => e.globalId).filter(Boolean);
    const eids = filtered.map(e => e.expressId).filter(Boolean);
    if (gids.length === 0) return;
    applyFilter(eids, `IDS Failed (${gids.length})`, "ids_all", gids, "#ef4444");
    if (onMinimize) onMinimize();
  }, [applyFilter, filterElements, onMinimize]);

  const handleClearHighlight = useCallback(() => clearFilter(), [clearFilter]);

  const handleCopyGuid = useCallback((guid, e) => {
    if (e) e.stopPropagation();
    if (!guid) return;
    navigator.clipboard.writeText(guid).then(() => {
      setCopiedGuid(guid);
      setTimeout(() => setCopiedGuid(null), 1500);
    });
  }, []);

  const handleExportCsv = useCallback((elements, fileName) => {
    const filtered = filterElements(elements);
    if (!filtered.length) return;
    const headers = ["#", "GUID", "IFC Class", "Predefined Type", "Level", "Name", "Missing Information"];
    const rows = filtered.map((el, i) => [
      i + 1, el.globalId || "", el.type || "", el.predefinedType || "",
      el.level || "", el.name || "", (el.reasons || []).join("; "),
    ]);
    downloadCsv(headers, rows, `IDS_Report_${fileName || "export"}.csv`);
  }, [filterElements]);

  const handleExportAllCsv = useCallback(() => {
    const allElements = [];
    models.forEach(m => {
      (m.specifications || []).forEach(sp => {
        filterElements(sp.failedElements).forEach(el => {
          allElements.push({ ...el, _spec: sp.name || "Untitled", _model: m.fileName || "Unknown" });
        });
      });
    });
    if (!allElements.length) return;
    const headers = ["#", "Model", "Specification", "GUID", "IFC Class", "Predefined Type", "Level", "Name", "Missing Information"];
    const rows = allElements.map((el, i) => [
      i + 1, el._model, el._spec, el.globalId || "", el.type || "",
      el.predefinedType || "", el.level || "", el.name || "", (el.reasons || []).join("; "),
    ]);
    downloadCsv(headers, rows, `IDS_Report_All_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [models, filterElements]);

  const toggleSelectElement = useCallback((gid) => {
    if (!gid) return;
    setSelectedGids(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((elements) => {
    const gids = elements.map(e => e.globalId).filter(Boolean);
    setSelectedGids(prev => {
      const allSelected = gids.length > 0 && gids.every(g => prev.has(g));
      const next = new Set(prev);
      if (allSelected) gids.forEach(g => next.delete(g)); else gids.forEach(g => next.add(g));
      return next;
    });
  }, []);

  const handleBatchHighlight = useCallback(() => {
    const selected = allFailedElements.filter(e => selectedGids.has(e.globalId));
    const gids = selected.map(e => e.globalId).filter(Boolean);
    const eids = selected.map(e => e.expressId).filter(Boolean);
    if (gids.length === 0) return;
    applyFilter(eids, `IDS Selected (${gids.length})`, "ids_batch", gids, "#ef4444");
    if (onMinimize) onMinimize();
  }, [allFailedElements, selectedGids, applyFilter, onMinimize]);

  const handleBatchIssue = useCallback(() => {
    alert(`Batch issue creation for ${selectedGids.size} element${selectedGids.size > 1 ? "s" : ""} — coming soon`);
  }, [selectedGids]);

  if (!results) return null;

  // --- Render helpers ---

  const renderSortTh = (col, label, extraStyle = {}) => (
    <th
      key={col}
      style={{ ...thStyle, ...extraStyle, cursor: "pointer", userSelect: "none" }}
      onClick={() => handleSort(col)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {label}
        {sortColumn === col ? (
          <span style={{ fontSize: 8 }}>{sortDirection === "asc" ? "\u25B2" : "\u25BC"}</span>
        ) : (
          <span style={{ fontSize: 8, opacity: 0.25 }}>{"\u2195"}</span>
        )}
      </span>
    </th>
  );

  const renderElementsTable = (elements, keyPrefix) => {
    const filtered = filterElements(elements);
    const sorted = sortElements(filtered);
    const allGids = sorted.map(e => e.globalId).filter(Boolean);
    const allChecked = allGids.length > 0 && allGids.every(g => selectedGids.has(g));
    const someChecked = allGids.some(g => selectedGids.has(g));

    return (
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#fef2f2", position: "sticky", top: 0, zIndex: 1 }}>
              <th style={{ ...thStyle, width: 28, textAlign: "center" }}>
                <input type="checkbox" checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={() => toggleSelectAll(sorted)}
                  style={{ cursor: "pointer" }} />
              </th>
              <th style={{ ...thStyle, width: 32 }}>#</th>
              {renderSortTh("guid", "GUID")}
              {renderSortTh("type", "IFC Class")}
              {renderSortTh("predefinedType", "Predefined Type")}
              {renderSortTh("level", "Level")}
              {renderSortTh("reasons", "Missing Information", { minWidth: 140 })}
              <th style={{ ...thStyle, width: 130, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((el, ei) => {
              const rowKey = `${keyPrefix}-${ei}`;
              const isHovered = hoveredRow === rowKey;
              const isSelected = selectedGids.has(el.globalId);
              return (
                <tr
                  key={ei}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: isSelected ? "#ede9fe" : isHovered ? "#fef9c3" : "transparent",
                    transition: "background 0.12s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredRow(rowKey)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => handleZoomToElement(el)}
                >
                  <td style={{ ...tdStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => toggleSelectElement(el.globalId)}
                      style={{ cursor: "pointer" }} />
                  </td>
                  <td style={{ ...tdStyle, color: "#aaa", textAlign: "center" }}>{ei + 1}</td>
                  <td
                    style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10, position: "relative" }}
                    onClick={(e) => handleCopyGuid(el.globalId, e)}
                    title="Click to copy GUID"
                  >
                    {el.globalId || "-"}
                    {copiedGuid === el.globalId && <span style={copiedBadgeStyle}>Copied!</span>}
                  </td>
                  <td style={tdStyle}><span style={classBadge}>{el.type || "-"}</span></td>
                  <td style={tdStyle}>
                    {el.predefinedType
                      ? <span style={predefBadge}>{el.predefinedType}</span>
                      : <span style={{ color: "#ccc" }}>-</span>}
                  </td>
                  <td style={tdStyle}>
                    {el.level
                      ? <span style={levelBadge}>{el.level}</span>
                      : <span style={{ color: "#ccc" }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, color: "#991b1b", maxWidth: 300 }}>
                    {(el.reasons || []).map((r, ri) => (
                      <div key={ri} style={{ marginBottom: ri < el.reasons.length - 1 ? 2 : 0 }}>
                        {r || "Requirement not met"}
                      </div>
                    ))}
                    {(!el.reasons || el.reasons.length === 0) && "Requirement not met"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                      <button onClick={() => handleZoomToElement(el)} style={zoomBtn} title="Zoom to element">Zoom</button>
                      <button onClick={() => alert("Issue creation — coming soon")} style={issueBtn} title="Create issue">Issue</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#aaa", fontSize: 12 }}>
                No elements match the current filters
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // --- Main JSX ---
  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      {/* Metadata bar */}
      {(idsInfo || validatedAt) && (
        <div style={metadataBarStyle}>
          {idsInfo?.title && <span style={metaChip}>IDS: <strong>{idsInfo.title}</strong></span>}
          {idsInfo?.version && <span style={metaChip}>v{idsInfo.version}</span>}
          {idsInfo?.author && <span style={metaChip}>Author: {idsInfo.author}</span>}
          {validatedAt && (
            <span style={{ ...metaChip, marginLeft: "auto" }}>
              Validated: {new Date(validatedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Header with donut */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DonutChart passed={passedSpecs} failed={failedSpecs} size={56} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: overall ? "#166534" : "#991b1b" }}>
              {overall ? "All Specifications Passed" : "Validation Failed"}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {passedSpecs}/{totalSpecs} specifications passed across {models.length} model{models.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleExportAllCsv} style={actionBtnStyle} title="Export all failed elements">Export All CSV</button>
          <button onClick={handleClearHighlight} style={actionBtnStyle} title="Clear 3D highlights">Clear Highlight</button>
          <button onClick={onClose} style={backBtnStyle}>Back to Editor</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={summaryBarStyle}>
        <SummaryCard label="Total Specs" value={totalSpecs} color="#4f46e5" />
        <SummaryCard label="Passed" value={passedSpecs} color="#10b981" />
        <SummaryCard label="Failed" value={failedSpecs} color="#ef4444" />
        <SummaryCard label="Failed Elements" value={totalFailedElements} color="#f59e0b" />
        <SummaryCard label="Models" value={models.length} color="#6366f1" />
      </div>

      {/* View toggle + Expand/Collapse */}
      <div style={toolbarRowStyle}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setViewMode("spec")}
            style={{ ...viewToggleBtn, ...(viewMode === "spec" ? viewToggleActive : {}) }}>
            By Specification
          </button>
          <button onClick={() => setViewMode("level")}
            style={{ ...viewToggleBtn, ...(viewMode === "level" ? viewToggleActive : {}) }}>
            By Level
          </button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={expandAll} style={smallActionBtn}>Expand All</button>
          <button onClick={collapseAll} style={smallActionBtn}>Collapse All</button>
        </div>
      </div>

      {/* Filter bar */}
      {totalFailedElements > 0 && (
        <div style={filterBarStyle}>
          <input type="text" placeholder="Search GUID, name, class, level..."
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={searchInputStyle} />
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={filterSelectStyle}>
            <option value="">All Levels</option>
            {uniqueLevels.map(lv => <option key={lv} value={lv}>{lv}</option>)}
          </select>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={filterSelectStyle}>
            <option value="">All Classes</option>
            {uniqueClasses.map(cl => <option key={cl} value={cl}>{cl}</option>)}
          </select>
          {(searchText || filterLevel || filterClass) && (
            <button onClick={() => { setSearchText(""); setFilterLevel(""); setFilterClass(""); }}
              style={{ ...smallActionBtn, color: "#ef4444", borderColor: "#fca5a5" }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Batch action bar */}
      {selectedGids.size > 0 && (
        <div style={batchBarStyle}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>
            {selectedGids.size} element{selectedGids.size > 1 ? "s" : ""} selected
          </span>
          <button onClick={handleBatchHighlight}
            style={{ ...smallActionBtn, background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }}>
            Highlight Selected
          </button>
          <button onClick={handleBatchIssue}
            style={{ ...smallActionBtn, background: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b" }}>
            Create Issues
          </button>
          <button onClick={() => setSelectedGids(new Set())} style={smallActionBtn}>Clear Selection</button>
        </div>
      )}

      {/* ========== SPEC VIEW ========== */}
      {viewMode === "spec" && models.map((model, mi) => (
        <div key={mi} style={{ marginBottom: 24 }}>
          <div style={modelHeaderStyle}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#fff",
              background: model.overall ? "#10b981" : "#ef4444",
              padding: "2px 8px", borderRadius: 4,
            }}>
              {model.overall ? "PASS" : "FAIL"}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
              {model.fileName || `Model ${mi + 1}`}
            </span>
            <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
              {model.passedSpecs}/{model.totalSpecs} passed
            </span>
          </div>

          {(model.specifications || []).map((spec, si) => {
            const specKey = `${mi}-${si}`;
            const isExpanded = expandedSpecs.has(specKey);
            const hasFailed = spec.failed > 0;
            const isOptional = spec.usage === "optional";
            const statusColor = spec.status ? "#10b981" : "#ef4444";

            return (
              <div key={si} style={{
                border: `1px solid ${statusColor}30`, borderRadius: 8,
                marginBottom: 6, overflow: "hidden",
              }}>
                <div onClick={() => toggleSpec(specKey)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  background: spec.status ? "#f0fdf4" : "#fef2f2",
                  transition: "background 0.15s",
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: statusColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {spec.status ? "\u2713" : "\u2717"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6 }}>
                      {spec.name || "Untitled Specification"}
                      {isOptional && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: "#d97706",
                          background: "#fef3c7", padding: "1px 6px", borderRadius: 4,
                        }}>OPTIONAL</span>
                      )}
                    </div>
                    {spec.description && (
                      <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{spec.description}</div>
                    )}
                  </div>
                  <ComplianceBar passed={spec.passed} total={spec.total} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span style={statBadge("#10b981")}>{spec.passed} passed</span>
                    {hasFailed && <span style={statBadge("#ef4444")}>{spec.failed} failed</span>}
                    <span style={{ fontSize: 11, color: "#888" }}>/ {spec.total}</span>
                    <span style={{ fontSize: 14, color: "#aaa", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                      {"\u25B6"}
                    </span>
                  </div>
                </div>

                {isExpanded && hasFailed && (
                  <div style={{ padding: "0 14px 12px", background: "#fff" }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 0 6px", borderBottom: "1px solid #fee2e2",
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
                        Failed Elements ({filterElements(spec.failedElements).length}
                        {filterElements(spec.failedElements).length !== (spec.failedElements?.length || 0)
                          ? ` / ${spec.failedElements.length}` : ""})
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); handleHighlightAll(spec.failedElements); }}
                          style={smallActionBtn} title="Highlight all in 3D">Highlight All</button>
                        <button onClick={e => { e.stopPropagation(); handleExportCsv(spec.failedElements, spec.name); }}
                          style={smallActionBtn} title="Export to CSV">Export CSV</button>
                      </div>
                    </div>
                    {renderElementsTable(spec.failedElements, specKey)}
                  </div>
                )}

                {isExpanded && !hasFailed && spec.total > 0 && (
                  <div style={{ padding: "12px 14px", background: "#fff", color: "#166534", fontSize: 12 }}>
                    All {spec.total} applicable elements passed this specification.
                  </div>
                )}
                {isExpanded && spec.total === 0 && (
                  <div style={{ padding: "12px 14px", background: "#fff", color: "#888", fontSize: 12 }}>
                    No applicable elements found for this specification.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ========== LEVEL VIEW ========== */}
      {viewMode === "level" && groupedByLevel.map(([level, elements]) => {
        const levelKey = `level_${level}`;
        const isExpanded = expandedSpecs.has(levelKey);
        const filteredCount = filterElements(elements).length;

        return (
          <div key={level} style={{
            border: "1px solid #d1fae530", borderRadius: 8,
            marginBottom: 6, overflow: "hidden",
          }}>
            <div onClick={() => toggleSpec(levelKey)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", cursor: "pointer",
              background: "#f8fafb", transition: "background 0.15s",
            }}>
              <span style={levelBadgeLg}>{level}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{level}</span>
              </div>
              <span style={statBadge("#ef4444")}>{filteredCount} failed element{filteredCount !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 14, color: "#aaa", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                {"\u25B6"}
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: "0 14px 12px", background: "#fff" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0 6px", borderBottom: "1px solid #e5e7eb",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>
                    Elements ({filteredCount})
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); handleHighlightAll(elements); }}
                      style={smallActionBtn}>Highlight All</button>
                    <button onClick={e => { e.stopPropagation(); handleExportCsv(elements, level); }}
                      style={smallActionBtn}>Export CSV</button>
                  </div>
                </div>
                {renderElementsTable(elements, levelKey)}
              </div>
            )}
          </div>
        );
      })}

      {viewMode === "level" && groupedByLevel.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 13 }}>
          No failed elements to display
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function DonutChart({ passed, failed, size = 64 }) {
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
        <circle cx="25" cy="25" r={r} fill="none" stroke="#10b981" strokeWidth="5"
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

function ComplianceBar({ passed, total }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100, flexShrink: 0 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${pct}%`,
          background: pct === 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 28, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      flex: 1, padding: "12px 16px", borderRadius: 10,
      background: `${color}10`, border: `1px solid ${color}25`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#666", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function downloadCsv(headers, rows, filename) {
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

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────

const statBadge = (color) => ({
  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
  background: `${color}15`, color,
});

const backBtnStyle = {
  padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db",
  background: "#fff", color: "#333", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const actionBtnStyle = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db",
  background: "#fff", color: "#555", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const summaryBarStyle = { display: "flex", gap: 12, marginBottom: 16 };

const modelHeaderStyle = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 0", marginBottom: 8, borderBottom: "2px solid #e5e7eb",
};

const thStyle = {
  padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#555",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = { padding: "5px 8px", color: "#333" };

const filterBarStyle = {
  display: "flex", gap: 8, alignItems: "center", marginBottom: 12,
  padding: "8px 12px", background: "#f8f9fb", borderRadius: 8, border: "1px solid #e5e7eb",
};

const searchInputStyle = {
  flex: 1, padding: "6px 10px", borderRadius: 6,
  border: "1px solid #d1d5db", fontSize: 12, outline: "none", minWidth: 180,
};

const filterSelectStyle = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 12, background: "#fff", cursor: "pointer",
};

const smallActionBtn = {
  padding: "3px 10px", borderRadius: 5, border: "1px solid #d1d5db",
  background: "#fff", color: "#555", fontSize: 10, fontWeight: 600, cursor: "pointer",
};

const classBadge = {
  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
  background: "#e0e7ff", color: "#3730a3",
};

const predefBadge = {
  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
  background: "#fef3c7", color: "#92400e",
};

const levelBadge = {
  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
  background: "#d1fae5", color: "#065f46",
};

const levelBadgeLg = {
  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
  background: "#d1fae5", color: "#065f46",
};

const zoomBtn = {
  padding: "3px 8px", borderRadius: 5, border: "1px solid #93c5fd",
  background: "#eff6ff", color: "#1d4ed8", fontSize: 10, fontWeight: 700, cursor: "pointer",
};

const issueBtn = {
  padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5",
  background: "#fef2f2", color: "#991b1b", fontSize: 10, fontWeight: 700, cursor: "pointer",
};

const toolbarRowStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
};

const viewToggleBtn = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db",
  background: "#fff", color: "#555", fontSize: 11, fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s",
};

const viewToggleActive = { background: "#4f46e5", color: "#fff", borderColor: "#4f46e5" };

const metadataBarStyle = {
  display: "flex", gap: 8, alignItems: "center", marginBottom: 12,
  padding: "6px 12px", background: "#f0f9ff", borderRadius: 8,
  border: "1px solid #bae6fd", flexWrap: "wrap",
};

const metaChip = {
  fontSize: 11, color: "#0369a1", padding: "2px 8px", borderRadius: 4, background: "#e0f2fe",
};

const batchBarStyle = {
  display: "flex", gap: 8, alignItems: "center", marginBottom: 12,
  padding: "8px 12px", background: "#ede9fe", borderRadius: 8, border: "1px solid #c4b5fd",
};

const copiedBadgeStyle = {
  position: "absolute", top: -2, right: -4,
  fontSize: 9, fontWeight: 700, color: "#fff",
  background: "#10b981", padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
};
