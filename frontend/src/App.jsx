import { useState, useCallback } from "react";
import axios from "axios";
import IfcViewer from "./components/IfcViewer";
import Dashboard from "./components/Dashboard";
import SelectedElement from "./components/SelectedElement";

const API_URL = "http://localhost:8000";

function App() {
  const [ifcFile, setIfcFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedElement, setSelectedElement] = useState(null);
  const [activeTab, setActiveTab] = useState("viewer");

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

  const handleElementSelect = useCallback((userData) => {
    setSelectedElement(userData);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      {/* Top Bar */}
      <header
        style={{
          height: 56,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          flexShrink: 0,
          zIndex: 200,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
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
            }}
          >
            IFC
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
            IFC Dashboard
          </span>
        </div>

        <label
          style={{
            marginLeft: 24,
            padding: "6px 16px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.2)",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
          }
        >
          {fileName || "Open IFC File"}
          <input
            type="file"
            accept=".ifc"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>

        {fileName && (
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {fileName}
          </span>
        )}

        {/* Tab Buttons */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["viewer", "dashboard"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 20px",
                borderRadius: 8,
                border: "none",
                background:
                  activeTab === tab
                    ? "rgba(255,255,255,0.2)"
                    : "transparent",
                color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
            >
              {tab === "viewer" ? "3D Viewer" : "Dashboard"}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {!ifcFile ? (
          <EmptyState onFileSelect={handleFileUpload} />
        ) : activeTab === "viewer" ? (
          <div style={{ flex: 1, position: "relative" }}>
            <IfcViewer
              ifcFile={ifcFile}
              onElementSelect={handleElementSelect}
            />
            <SelectedElement element={selectedElement} />
          </div>
        ) : (
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
              <div
                style={{
                  margin: 24,
                  padding: 16,
                  background: "#fef2f2",
                  borderRadius: 8,
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}
            <Dashboard data={dashboardData} />
          </div>
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
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
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
          Upload an IFC file to view the 3D model and explore building data with
          interactive charts and tables.
        </p>
        <label
          style={{
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
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "translateY(0)")
          }
        >
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

export default App;
