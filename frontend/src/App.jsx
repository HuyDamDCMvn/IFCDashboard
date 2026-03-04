import { useState, useCallback, useMemo } from "react";
import axios from "axios";
import IfcViewer from "./components/IfcViewer";
import Dashboard from "./components/Dashboard";
import SelectedElement from "./components/SelectedElement";
import {
  SelectionProvider,
  useSelection,
} from "./contexts/SelectionContext";

const API_URL = "http://localhost:8000";

function App() {
  return (
    <SelectionProvider>
      <AppContent />
    </SelectionProvider>
  );
}

const ISOLATION_MODES = [
  { key: "highlight", label: "Highlight", desc: "Highlight matching, keep others" },
  { key: "isolate", label: "Isolate", desc: "Hide non-matching elements" },
  { key: "xray", label: "X-Ray", desc: "Transparent non-matching elements" },
];

const VIEW_MODES = [
  { key: "split", label: "Split" },
  { key: "viewer", label: "3D" },
  { key: "dashboard", label: "Data" },
];

function AppContent() {
  const [ifcFile, setIfcFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("split");

  const {
    selectedExpressID,
    filterExpressIDs,
    filterLabel,
    isolationMode,
    setIsolationMode,
    clearFilter,
  } = useSelection();

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIfcFile(file);
    setFileName(file.name);
    setError("");
    setLoading(true);
    setDashboardData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/api/parse-ifc`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error("Parse error:", err);
      setError(
        "Failed to parse IFC. Make sure the backend is running on port 8000."
      );
    }
    setLoading(false);
  }, []);

  const selectedElementInfo = useMemo(() => {
    if (selectedExpressID == null || !dashboardData) return null;
    return (
      dashboardData.elements.find(
        (el) => el.expressId === selectedExpressID
      ) || null
    );
  }, [selectedExpressID, dashboardData]);

  const isFilterActive = filterExpressIDs && filterExpressIDs.length > 0;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header style={headerStyle}>
        {/* Left: Logo + File */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={logoStyle}>IFC</div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
            IFC Dashboard
          </span>
        </div>

        <label style={fileButtonStyle}>
          {fileName || "Open IFC File"}
          <input
            type="file"
            accept=".ifc"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>

        {/* Center: View Mode */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          {VIEW_MODES.map((vm) => (
            <button
              key={vm.key}
              onClick={() => setViewMode(vm.key)}
              style={{
                ...viewModeBtn,
                background:
                  viewMode === vm.key
                    ? "rgba(255,255,255,0.2)"
                    : "transparent",
                color:
                  viewMode === vm.key ? "#fff" : "rgba(255,255,255,0.6)",
              }}
            >
              {vm.label}
            </button>
          ))}
        </div>

        {/* Right: Isolation Mode */}
        <div
          style={{
            display: "flex",
            gap: 2,
            marginLeft: 12,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 2,
          }}
        >
          {ISOLATION_MODES.map((im) => (
            <button
              key={im.key}
              title={im.desc}
              onClick={() => setIsolationMode(im.key)}
              style={{
                ...isolationModeBtn,
                background:
                  isolationMode === im.key
                    ? modeColor(im.key)
                    : "transparent",
                color:
                  isolationMode === im.key
                    ? "#fff"
                    : "rgba(255,255,255,0.6)",
              }}
            >
              {im.label}
            </button>
          ))}
        </div>
      </header>

      {/* Filter Bar */}
      {isFilterActive && (
        <div style={filterBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={filterIconStyle}>&#9670;</span>
            <span style={{ fontWeight: 600, color: "#cc5200" }}>
              Filtering:
            </span>
            <span style={{ color: "#333" }}>
              {filterLabel}
            </span>
            <span style={{ color: "#999" }}>
              ({filterExpressIDs.length}{" "}
              {filterExpressIDs.length === 1 ? "element" : "elements"})
            </span>
          </div>
          <button onClick={clearFilter} style={clearFilterBtn}>
            Clear Filter &times;
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {!ifcFile ? (
          <EmptyState onFileSelect={handleFileUpload} />
        ) : (
          <>
            {/* Viewer Panel */}
            {viewMode !== "dashboard" && (
              <div
                style={{
                  width: viewMode === "viewer" ? "100%" : "50%",
                  position: "relative",
                  borderRight:
                    viewMode === "split"
                      ? "1px solid #e5e7eb"
                      : "none",
                  flexShrink: 0,
                }}
              >
                <IfcViewer ifcFile={ifcFile} dashboardData={dashboardData} />
                <SelectedElement element={selectedElementInfo} />
              </div>
            )}

            {/* Dashboard Panel */}
            {viewMode !== "viewer" && (
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  background: "#f8f9fb",
                }}
              >
                {loading && (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div className="spinner" />
                    <p style={{ color: "#888", marginTop: 16 }}>
                      Parsing IFC data from server...
                    </p>
                  </div>
                )}
                {error && (
                  <div style={errorStyle}>{error}</div>
                )}
                <Dashboard data={dashboardData} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onFileSelect }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fb",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ ...logoStyle, width: 80, height: 80, borderRadius: 20, fontSize: 28, margin: "0 auto 24px" }}>
          IFC
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1a1a2e",
            margin: "0 0 8px",
          }}
        >
          IFC Dashboard
        </h2>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 24px" }}>
          Upload an IFC file to view the 3D model and explore building data
          with interactive charts. Click any chart element to isolate it in 3D.
        </p>
        <label style={uploadBtnStyle}>
          Open IFC File
          <input
            type="file"
            accept=".ifc"
            onChange={onFileSelect}
            style={{ display: "none" }}
          />
        </label>
      </div>
    </div>
  );
}

function modeColor(mode) {
  switch (mode) {
    case "highlight":
      return "rgba(255, 140, 0, 0.7)";
    case "isolate":
      return "rgba(79, 70, 229, 0.7)";
    case "xray":
      return "rgba(139, 92, 246, 0.7)";
    default:
      return "rgba(255,255,255,0.2)";
  }
}

// --- Styles ---

const headerStyle = {
  height: 56,
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  display: "flex",
  alignItems: "center",
  padding: "0 20px",
  gap: 12,
  flexShrink: 0,
  zIndex: 200,
};

const logoStyle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
};

const fileButtonStyle = {
  marginLeft: 8,
  padding: "6px 16px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.2)",
  transition: "background 0.2s",
};

const viewModeBtn = {
  padding: "5px 14px",
  borderRadius: 6,
  border: "none",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
};

const isolationModeBtn = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
};

const filterBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 20px",
  background: "#fff8f0",
  borderBottom: "1px solid #ffe0b2",
  fontSize: 13,
  flexShrink: 0,
};

const filterIconStyle = {
  color: "#ff6600",
  fontSize: 14,
};

const clearFilterBtn = {
  padding: "4px 14px",
  borderRadius: 6,
  border: "1px solid #ffcc80",
  background: "#fff",
  color: "#cc5200",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
};

const errorStyle = {
  margin: 24,
  padding: 16,
  background: "#fef2f2",
  borderRadius: 8,
  color: "#dc2626",
  border: "1px solid #fecaca",
};

const uploadBtnStyle = {
  display: "inline-block",
  padding: "12px 32px",
  borderRadius: 10,
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
  transition: "transform 0.2s",
};

export default App;
