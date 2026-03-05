import { useIdsBuilder } from "../../contexts/IdsBuilderContext";

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
