export default function IdsXmlPreview({ xml, onClose }) {
  const handleCopy = () => {
    navigator.clipboard?.writeText(xml).then(() => {
      alert("XML copied to clipboard!");
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>IDS XML Preview</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleCopy} style={btnStyle}>Copy</button>
            <button onClick={onClose} style={{
              ...btnStyle, background: "none", border: "none",
              fontSize: 18, padding: "0 4px", color: "#666",
            }}>
              &times;
            </button>
          </div>
        </div>
        <pre style={preStyle}>{xml}</pre>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 600,
  background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalStyle = {
  width: "80vw", maxHeight: "80vh",
  background: "#1e1e2e", borderRadius: 12,
  boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", background: "#2d2d3f",
  borderBottom: "1px solid #3d3d4f",
};

const btnStyle = {
  padding: "4px 12px", borderRadius: 6,
  border: "1px solid #4f46e5", background: "#4f46e5",
  color: "#fff", fontSize: 11, fontWeight: 600,
  cursor: "pointer",
};

const preStyle = {
  flex: 1, overflow: "auto",
  padding: 16, margin: 0,
  fontSize: 12, lineHeight: 1.6,
  fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  color: "#d4d4e0",
  whiteSpace: "pre-wrap", wordBreak: "break-all",
};
