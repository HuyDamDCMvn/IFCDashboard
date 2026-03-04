import { useState, useMemo } from "react";

export default function ElementTable({ elements }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const pageSize = 50;

  const types = useMemo(() => {
    const set = new Set(elements.map((e) => e.type));
    return ["All", ...Array.from(set).sort()];
  }, [elements]);

  const filtered = useMemo(() => {
    return elements.filter((el) => {
      const matchType = typeFilter === "All" || el.type === typeFilter;
      const matchSearch =
        !search ||
        el.name.toLowerCase().includes(search.toLowerCase()) ||
        el.id.toLowerCase().includes(search.toLowerCase()) ||
        el.type.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [elements, typeFilter, search]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name, ID, or type..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
            outline: "none",
          }}
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {types.map((t) => (
            <option key={t} value={t}>{t === "All" ? "All Types" : t.replace("Ifc", "")}</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
        Showing {paged.length} of {filtered.length} elements
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Storey</th>
              <th style={thStyle}>Materials</th>
              <th style={thStyle}>Props</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((el, i) => (
              <ElementRow
                key={el.id + i}
                el={el}
                isExpanded={expandedRow === el.id}
                onToggle={() =>
                  setExpandedRow(expandedRow === el.id ? null : el.id)
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={btnStyle}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            style={btnStyle}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ElementRow({ el, isExpanded, onToggle }) {
  const propCount = Object.values(el.propertySets || {}).reduce(
    (acc, pset) => acc + Object.keys(pset).length,
    0
  );

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: "pointer",
          borderBottom: "1px solid #f0f0f0",
          background: isExpanded ? "#f0f4ff" : "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) e.currentTarget.style.background = "#fafafa";
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) e.currentTarget.style.background = "transparent";
        }}
      >
        <td style={tdStyle}>
          <span
            style={{
              background: "#e8eaf6",
              color: "#3949ab",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {el.type.replace("Ifc", "")}
          </span>
        </td>
        <td style={tdStyle}>{el.name || "-"}</td>
        <td style={tdStyle}>{el.storey || "-"}</td>
        <td style={tdStyle}>{el.materials?.join(", ") || "-"}</td>
        <td style={tdStyle}>{propCount}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} style={{ padding: "12px 16px", background: "#f8f9ff" }}>
            <div style={{ fontSize: 12, color: "#555" }}>
              <strong>GlobalId:</strong> {el.id}
              {el.description && (
                <>
                  <br />
                  <strong>Description:</strong> {el.description}
                </>
              )}
            </div>
            {Object.entries(el.propertySets || {}).map(([psetName, props]) => (
              <div key={psetName} style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: "#3949ab",
                    marginBottom: 4,
                  }}
                >
                  {psetName}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "2px 16px",
                    fontSize: 12,
                  }}
                >
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

const thStyle = {
  padding: "10px 12px",
  fontWeight: 600,
  fontSize: 12,
  color: "#555",
  borderBottom: "2px solid #e8e8e8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "10px 12px",
};

const btnStyle = {
  padding: "6px 16px",
  borderRadius: 6,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
