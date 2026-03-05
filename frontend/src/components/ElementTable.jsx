import { useState, useMemo, useCallback } from "react";
import { useSelection } from "../contexts/SelectionContext";
import { useIfcEdit } from "../contexts/IfcEditContext";

export default function ElementTable({ elements, multiModel = false }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modelFilterLocal, setModelFilterLocal] = useState("All");
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const pageSize = 50;

  const { selectedExpressID, selectedModelId, filterKey, toggleFilter } = useSelection();
  const { openElementEditor } = useIfcEdit();

  const types = useMemo(() => {
    const set = new Set(elements.map((e) => e.type));
    return ["All", ...Array.from(set).sort()];
  }, [elements]);

  const modelNames = useMemo(() => {
    if (!multiModel) return [];
    const set = new Map();
    for (const el of elements) {
      if (el._modelName && !set.has(el._modelId)) {
        set.set(el._modelId, el._modelName);
      }
    }
    return ["All", ...set.values()];
  }, [elements, multiModel]);

  const filtered = useMemo(() => {
    return elements.filter((el) => {
      const matchType = typeFilter === "All" || el.type === typeFilter;
      const matchModel = modelFilterLocal === "All" || el._modelName === modelFilterLocal;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        el.name.toLowerCase().includes(q) ||
        String(el.expressId).includes(search) ||
        el.type.toLowerCase().includes(q) ||
        (el.predefinedType || "").toLowerCase().includes(q) ||
        (el._modelName || "").toLowerCase().includes(q);
      return matchType && matchSearch && matchModel;
    });
  }, [elements, typeFilter, modelFilterLocal, search]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleLocate = useCallback(
    (el) => {
      const key = `element:${el._modelId || ""}:${el.expressId}`;
      const label = `${el.name || el.type.replace("Ifc", "")}`;
      const globalIds = el.id ? [el.id] : [];
      toggleFilter([el.expressId], label, key, globalIds);
    },
    [toggleFilter]
  );

  const handleEdit = useCallback(
    (el) => openElementEditor(el),
    [openElementEditor]
  );

  const colSpan = multiModel ? 8 : 7;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder={multiModel ? "Search by name, ID, type, model..." : "Search by name, ID, or type..."}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={inputStyle}
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          style={selectStyle}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "All" ? "All Types" : t.replace("Ifc", "")}
            </option>
          ))}
        </select>
        {multiModel && modelNames.length > 2 && (
          <select
            value={modelFilterLocal}
            onChange={(e) => { setModelFilterLocal(e.target.value); setPage(0); }}
            style={selectStyle}
          >
            {modelNames.map((n) => (
              <option key={n} value={n}>
                {n === "All" ? "All Models" : n}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
        Showing {paged.length} of {filtered.length} elements
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={thStyle}>Export As</th>
              <th style={thStyle}>Predefined</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Storey</th>
              {multiModel && <th style={thStyle}>Model</th>}
              <th style={thStyle}>Materials</th>
              <th style={thStyle}>Props</th>
              <th style={{ ...thStyle, width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((el, i) => {
              const rowKey = `${el._modelId || ""}:${el.expressId}`;
              return (
                <ElementRow
                  key={rowKey}
                  el={el}
                  multiModel={multiModel}
                  colSpan={colSpan}
                  isExpanded={expandedRow === rowKey}
                  isSelected={selectedExpressID === el.expressId && (!multiModel || selectedModelId === el._modelId)}
                  isFiltered={filterKey === `element:${el._modelId || ""}:${el.expressId}`}
                  onToggle={() => setExpandedRow(expandedRow === rowKey ? null : rowKey)}
                  onLocate={() => handleLocate(el)}
                  onEdit={() => handleEdit(el)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 8, marginTop: 16,
        }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={btnStyle}>
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={btnStyle}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ElementRow({ el, multiModel, colSpan, isExpanded, isSelected, isFiltered, onToggle, onLocate, onEdit }) {
  const propCount = Object.values(el.propertySets || {}).reduce(
    (acc, pset) => acc + Object.keys(pset).length, 0
  );

  const rowBg = isFiltered ? "#fff3e0"
    : isSelected ? "#e8f0fe"
    : isExpanded ? "#f0f4ff"
    : "transparent";

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: "pointer", borderBottom: "1px solid #f0f0f0",
          background: rowBg, transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isExpanded && !isSelected && !isFiltered)
            e.currentTarget.style.background = "#fafafa";
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
      >
        <td style={tdStyle}>
          <span style={typeBadgeStyle}>{el.type.replace("Ifc", "")}</span>
        </td>
        <td style={tdStyle}>
          {el.predefinedType ? (
            <span style={predefBadgeStyle}>{el.predefinedType}</span>
          ) : (
            <span style={{ color: "#ccc" }}>-</span>
          )}
        </td>
        <td style={tdStyle}>{el.name || "-"}</td>
        <td style={tdStyle}>{el.storey || "-"}</td>
        {multiModel && (
          <td style={tdStyle}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, color: "#555",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: el._modelColor || "#999", flexShrink: 0,
              }} />
              {(el._modelName || "").replace(/\.ifc$/i, "")}
            </span>
          </td>
        )}
        <td style={tdStyle}>{el.materials?.join(", ") || "-"}</td>
        <td style={tdStyle}>{propCount}</td>
        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
          <button
            title="Locate in 3D viewer"
            onClick={(e) => { e.stopPropagation(); onLocate(); }}
            style={{
              background: isFiltered ? "#ff6600" : "#e8eaf6",
              color: isFiltered ? "#fff" : "#3949ab",
              border: "none", borderRadius: 6, padding: "4px 8px",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              transition: "all 0.15s",
              marginRight: 4,
            }}
          >
            3D
          </button>
          <button
            title="Edit element data"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={editRowBtnStyle}
          >
            &#9998;
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colSpan} style={{ padding: "12px 16px", background: "#f8f9ff" }}>
            <div style={{ fontSize: 12, color: "#555" }}>
              <strong>GlobalId:</strong> {el.id}
              {" | "}
              <strong>ExpressID:</strong> {el.expressId}
              {multiModel && el._modelName && (
                <>
                  {" | "}
                  <strong>Model:</strong> {el._modelName}
                </>
              )}
              {el.description && (
                <>
                  <br />
                  <strong>Description:</strong> {el.description}
                </>
              )}
            </div>
            {Object.entries(el.propertySets || {}).map(([psetName, props]) => (
              <div key={psetName} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#3949ab", marginBottom: 4 }}>
                  {psetName}
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "2px 16px", fontSize: 12,
                }}>
                  {Object.entries(props).map(([k, v]) => (
                    <div key={k}>
                      <span style={{ color: "#888" }}>{k}:</span>{" "}
                      <span style={{ color: "#333" }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

const inputStyle = {
  flex: 1, minWidth: 200, padding: "8px 14px",
  borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none",
};

const selectStyle = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd",
  fontSize: 14, background: "#fff", cursor: "pointer",
};

const thStyle = {
  padding: "10px 12px", fontWeight: 600, fontSize: 12, color: "#555",
  borderBottom: "2px solid #e8e8e8", textTransform: "uppercase", letterSpacing: "0.5px",
};

const tdStyle = { padding: "10px 12px" };

const typeBadgeStyle = {
  background: "#e8eaf6", color: "#3949ab",
  padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500,
};

const predefBadgeStyle = {
  background: "#fef3c7", color: "#92400e",
  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
};

const btnStyle = {
  padding: "6px 16px", borderRadius: 6, border: "1px solid #ddd",
  background: "#fff", cursor: "pointer", fontSize: 13,
};

const editRowBtnStyle = {
  background: "#eef2ff",
  color: "#4f46e5",
  border: "none",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  transition: "all 0.15s",
};
