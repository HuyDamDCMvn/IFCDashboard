import { useIdsBuilder } from "../../contexts/IdsBuilderContext";
import { IDS_PURPOSES, IDS_MILESTONES } from "../../lib/ids-constants";

export default function IdsInfoPanel() {
  const { idsDoc, updateInfo } = useIdsBuilder();
  const info = idsDoc.info;

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={sectionTitle}>IDS Information</div>

      <label style={labelStyle}>Title</label>
      <input
        value={info.title}
        onChange={e => updateInfo({ title: e.target.value })}
        style={inputStyle}
        placeholder="My IDS"
      />

      <label style={labelStyle}>Copyright</label>
      <input
        value={info.copyright || ""}
        onChange={e => updateInfo({ copyright: e.target.value })}
        style={inputStyle}
        placeholder="e.g. Example Company Pty Ltd"
      />

      <label style={labelStyle}>Version</label>
      <input
        value={info.version}
        onChange={e => updateInfo({ version: e.target.value })}
        style={inputStyle}
        placeholder="1.0"
      />

      <label style={labelStyle}>Author</label>
      <input
        value={info.author}
        onChange={e => updateInfo({ author: e.target.value })}
        style={inputStyle}
        placeholder="your@email.com"
      />

      <label style={labelStyle}>Description</label>
      <textarea
        value={info.description}
        onChange={e => updateInfo({ description: e.target.value })}
        style={{ ...inputStyle, minHeight: 48, resize: "vertical" }}
        placeholder="Optional description..."
        rows={2}
      />

      <label style={labelStyle}>Date</label>
      <input
        type="date"
        value={info.date}
        onChange={e => updateInfo({ date: e.target.value })}
        style={inputStyle}
      />

      <label style={labelStyle}>Purpose</label>
      <input
        value={info.purpose || ""}
        onChange={e => updateInfo({ purpose: e.target.value })}
        list="purpose-list"
        style={inputStyle}
        placeholder="e.g. quantity take-off, coordination"
      />
      <datalist id="purpose-list">
        {IDS_PURPOSES.map(p => <option key={p} value={p} />)}
      </datalist>

      <label style={labelStyle}>Milestone</label>
      <input
        value={info.milestone || ""}
        onChange={e => updateInfo({ milestone: e.target.value })}
        list="milestone-list"
        style={inputStyle}
        placeholder="e.g. Schematic Design, LOD 300"
      />
      <datalist id="milestone-list">
        {IDS_MILESTONES.map(m => <option key={m} value={m} />)}
      </datalist>
    </div>
  );
}

const sectionTitle = {
  fontSize: 11, fontWeight: 700, color: "#888",
  textTransform: "uppercase", letterSpacing: 0.5,
  marginBottom: 8,
};

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "#555", marginTop: 8, marginBottom: 3,
};

const inputStyle = {
  width: "100%", padding: "5px 8px",
  border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 12, color: "#333", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
