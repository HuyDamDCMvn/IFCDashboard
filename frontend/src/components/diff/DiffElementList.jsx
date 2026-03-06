import { useState } from "react";
import { COLORS } from "../../lib/theme";

const DIFF_COLORS = {
  added: COLORS.green,
  deleted: COLORS.danger,
  changed: COLORS.amber,
  unchanged: "#94a3b8",
};

const PAGE_SIZE = 100;

export default function DiffElementList({ elements, status, expandedGuid, onToggle, totalCount }) {
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
          <span style={{ color: COLORS.amber, marginLeft: 8 }}>
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
        <button onClick={() => setPage((p) => p + 1)} style={loadMoreBtnStyle}>
          Load more ({elements.length - visible.length} remaining)
        </button>
      )}
    </div>
  );
}

function ElementRow({ el, status, expanded, onToggle }) {
  const hasChanges = el.changes && Object.keys(el.changes).length > 0;

  return (
    <div style={{ ...elementRowStyle, borderLeftColor: DIFF_COLORS[status] }}>
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
        {el.storey && <span style={{ fontSize: 10, color: "#94a3b8" }}>{el.storey}</span>}
        <span style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "monospace" }}>
          {el.globalId?.slice(0, 12)}...
        </span>
      </div>

      {expanded && hasChanges && <ChangeDetail changes={el.changes} />}
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
              <span style={{ color: COLORS.danger, textDecoration: "line-through" }}>{vals.old ?? "(null)"}</span>
              <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
              <span style={{ color: COLORS.green }}>{vals.new ?? "(null)"}</span>
            </div>
          ))}
        </div>
      )}

      {changes.placement && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Placement</div>
          <div style={{ color: COLORS.amber }}>Position / rotation changed</div>
        </div>
      )}

      {changes.geometry && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Geometry</div>
          <div style={{ color: COLORS.violet }}>3D shape representation changed</div>
        </div>
      )}

      {changes.container && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Container</div>
          <div style={changeRow}>
            <span style={{ color: COLORS.danger }}>{changes.container.old ?? "(none)"}</span>
            <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
            <span style={{ color: COLORS.green }}>{changes.container.new ?? "(none)"}</span>
          </div>
        </div>
      )}

      {changes.type && (
        <div style={{ marginBottom: 8 }}>
          <div style={changeSectionTitle}>Type Assignment</div>
          <div style={changeRow}>
            <span style={{ color: COLORS.danger }}>{changes.type.old?.name ?? "(none)"}</span>
            <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
            <span style={{ color: COLORS.green }}>{changes.type.new?.name ?? "(none)"}</span>
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
                  <span style={{ color: COLORS.danger }}>{String(vals.old ?? "(null)")}</span>
                  <span style={{ color: "#94a3b8", margin: "0 4px" }}>&rarr;</span>
                  <span style={{ color: COLORS.green }}>{String(vals.new ?? "(null)")}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const elementRowStyle = {
  padding: "10px 12px", marginBottom: 4, borderRadius: 8,
  borderLeft: "3px solid", background: "#fafafa",
};

const statusDot = (status) => ({
  width: 8, height: 8, borderRadius: "50%",
  background: DIFF_COLORS[status], flexShrink: 0,
});

const changeSectionTitle = {
  fontSize: 11, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
};

const changeRow = {
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 12, padding: "2px 0", flexWrap: "wrap",
};

const loadMoreBtnStyle = {
  width: "100%", padding: "10px 0", marginTop: 8,
  borderRadius: 8, border: "1px solid #e2e8f0",
  background: "#f8fafc", color: COLORS.primary,
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
