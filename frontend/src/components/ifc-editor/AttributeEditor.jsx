const EDITABLE_ATTRS = [
  { key: "Name", label: "Name" },
  { key: "Description", label: "Description" },
  { key: "ObjectType", label: "Object Type" },
  { key: "PredefinedType", label: "Predefined Type" },
];

export default function AttributeEditor({ element, edits, onChange, disabled }) {
  return (
    <div>
      <div style={sectionTitle}>Attributes</div>
      {EDITABLE_ATTRS.map(({ key, label }) => {
        const original = element[key] || "";
        const value = key in edits ? edits[key] : original;
        const isEdited = key in edits;
        return (
          <div key={key} style={rowStyle}>
            <label style={labelStyle}>{label}</label>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                disabled={disabled}
                placeholder={original || `Enter ${label.toLowerCase()}...`}
                style={{
                  ...inputStyle,
                  borderColor: isEdited ? "#f59e0b" : "#e5e7eb",
                  background: isEdited ? "#fffbeb" : disabled ? "#f9fafb" : "#fff",
                }}
              />
              {isEdited && (
                <span
                  onClick={() => onChange(key, original)}
                  style={undoStyle}
                  title={`Revert to "${original}"`}
                >
                  &#8630;
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const labelStyle = {
  width: 120,
  fontSize: 12,
  color: "#555",
  fontWeight: 500,
  flexShrink: 0,
};

const inputStyle = {
  width: "100%",
  padding: "6px 28px 6px 10px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box",
};

const undoStyle = {
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  cursor: "pointer",
  color: "#f59e0b",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
};
