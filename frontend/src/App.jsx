import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import axios from "axios";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import IfcViewer from "./components/IfcViewer";
import Dashboard from "./components/Dashboard";
import SelectedElement from "./components/SelectedElement";
import ModelManager from "./components/ModelManager";
import { SelectionProvider, useSelection } from "./contexts/SelectionContext";
import { ModelRegistryProvider, useModelRegistry } from "./contexts/ModelRegistryContext";
import { IfcEditProvider, useIfcEdit } from "./contexts/IfcEditContext";
import PropertyEditor from "./components/ifc-editor/PropertyEditor";
import EditHistory from "./components/ifc-editor/EditHistory";
import ExportButton from "./components/ifc-editor/ExportButton";

const IdsBuilder = lazy(() => import("./components/ids-builder/IdsBuilder"));

const API_URL = "";

function App() {
  return (
    <SelectionProvider>
      <ModelRegistryProvider>
        <IfcEditProvider>
          <AppContent />
        </IfcEditProvider>
      </ModelRegistryProvider>
    </SelectionProvider>
  );
}

const ISOLATION_MODES = [
  { key: "highlight", label: "Highlight", desc: "Highlight matching, keep others" },
  { key: "isolate", label: "Isolate", desc: "Hide non-matching elements" },
  { key: "xray", label: "X-Ray", desc: "Transparent non-matching elements" },
];

function AppContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewerCollapsed, setViewerCollapsed] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [idsBuilderOpen, setIdsBuilderOpen] = useState(false);

  const viewerPanelRef = usePanelRef();
  const dashboardPanelRef = usePanelRef();

  const {
    selectedExpressID,
    selectedModelId,
    filterExpressIDs,
    filterLabel,
    isolationMode,
    setIsolationMode,
    clearFilter,
  } = useSelection();

  const { allModelsList, mergedData, addModel, models } = useModelRegistry();
  const { isSessionOpen, startSession, editingElement } = useIfcEdit();

  const hasModels = allModelsList.length > 0;

  const handleAddFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    setError("");
    setLoading(true);

    const uploads = files.map(async (file) => {
      const modelId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model_id", modelId);

      try {
        const res = await axios.post(`${API_URL}/api/parse-ifc`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        addModel(res.data.modelId || modelId, file.name, file, res.data);
      } catch (err) {
        console.error(`Parse error for ${file.name}:`, err);
        setError((prev) =>
          prev ? `${prev}\nFailed: ${file.name}` : `Failed to parse ${file.name}. Is the backend running?`
        );
      }
    });

    await Promise.all(uploads);
    setLoading(false);
  }, [addModel]);

  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleAddFiles(files);
  }, [handleAddFiles]);

  const selectedElementInfo = useMemo(() => {
    if (selectedExpressID == null || !mergedData) return null;
    return mergedData.elements.find(
      (el) => el.expressId === selectedExpressID && (!selectedModelId || el._modelId === selectedModelId)
    ) || null;
  }, [selectedExpressID, selectedModelId, mergedData]);

  const isFilterActive = filterExpressIDs && filterExpressIDs.length > 0;

  const toggleViewer = useCallback(() => {
    const panel = viewerPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [viewerPanelRef]);

  const toggleDashboard = useCallback(() => {
    const panel = dashboardPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [dashboardPanelRef]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
    }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={logoStyle}>IFC</div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
            IFC Dashboard
          </span>
          {allModelsList.length > 1 && (
            <span style={{
              fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.15)",
              color: "#a5b4fc", padding: "2px 8px", borderRadius: 10,
            }}>
              Federation ({allModelsList.length} models)
            </span>
          )}
        </div>

        <label style={fileButtonStyle}>
          {hasModels ? "+ Add IFC" : "Open IFC Files"}
          <input
            type="file"
            accept=".ifc"
            multiple
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>

        <button
          onClick={() => setIdsBuilderOpen(true)}
          style={idsButtonStyle}
          title="Open IDS Builder — create and manage Information Delivery Specifications"
        >
          IDS Builder
        </button>

        {/* Edit Mode toggle */}
        {hasModels && !isSessionOpen && (
          <EditModeButton models={models} startSession={startSession} />
        )}
        {isSessionOpen && <ExportButton />}

        {/* Panel toggle controls */}
        {hasModels && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={toggleViewer}
              style={{
                ...panelToggleBtn,
                background: viewerCollapsed ? "transparent" : "rgba(255,255,255,0.18)",
                color: viewerCollapsed ? "rgba(255,255,255,0.4)" : "#fff",
              }}
              title={viewerCollapsed ? "Show 3D Viewer" : "Hide 3D Viewer"}
            >
              3D View
            </button>
            <button
              onClick={toggleDashboard}
              style={{
                ...panelToggleBtn,
                background: dashboardCollapsed ? "transparent" : "rgba(255,255,255,0.18)",
                color: dashboardCollapsed ? "rgba(255,255,255,0.4)" : "#fff",
              }}
              title={dashboardCollapsed ? "Show Dashboard" : "Hide Dashboard"}
            >
              Dashboard
            </button>
          </div>
        )}

        {/* Isolation Mode */}
        <div style={{
          display: "flex", gap: 2,
          marginLeft: hasModels ? 12 : "auto",
          background: "rgba(255,255,255,0.08)",
          borderRadius: 8, padding: 2,
        }}>
          {ISOLATION_MODES.map((im) => (
            <button
              key={im.key}
              title={im.desc}
              onClick={() => setIsolationMode(im.key)}
              style={{
                ...isolationModeBtn,
                background: isolationMode === im.key ? modeColor(im.key) : "transparent",
                color: isolationMode === im.key ? "#fff" : "rgba(255,255,255,0.6)",
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
            <span style={{ fontWeight: 600, color: "#cc5200" }}>Filtering:</span>
            <span style={{ color: "#333" }}>{filterLabel}</span>
            <span style={{ color: "#999" }}>
              ({filterExpressIDs.length} {filterExpressIDs.length === 1 ? "element" : "elements"})
            </span>
          </div>
          <button onClick={clearFilter} style={clearFilterBtn}>
            Clear Filter &times;
          </button>
        </div>
      )}

      {/* IDS Builder Modal */}
      {idsBuilderOpen && (
        <Suspense fallback={null}>
          <IdsBuilder
            onClose={() => setIdsBuilderOpen(false)}
            modelData={mergedData}
            modelsList={allModelsList}
          />
        </Suspense>
      )}

      {/* Property Editor Modal */}
      {editingElement && <PropertyEditor />}

      {/* Main Content */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        {!hasModels ? (
          <EmptyState onFileSelect={handleFileUpload} loading={loading} error={error} />
        ) : (
          <div style={{ display: "flex", height: "100%" }}>
            {/* Model Manager Sidebar */}
            {allModelsList.length > 0 && (
              <div style={{ width: 240, flexShrink: 0, overflow: "hidden" }}>
                <ModelManager onAddFiles={handleAddFiles} />
              </div>
            )}

            {/* Main panels */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <Group orientation="horizontal" style={{ height: "100%" }}>
                <Panel
                  id="viewer"
                  panelRef={viewerPanelRef}
                  defaultSize="50%"
                  minSize="15%"
                  collapsible
                  collapsedSize="0%"
                  onResize={(size) => setViewerCollapsed(size.asPercentage < 1)}
                >
                  <div style={{ height: "100%", position: "relative" }}>
                    <IfcViewer />
                    <SelectedElement element={selectedElementInfo} />
                    {isSessionOpen && (
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 40 }}>
                        <EditHistory />
                      </div>
                    )}
                  </div>
                </Panel>

                <Separator className="resize-handle-outer" />

                <Panel
                  id="dashboard"
                  panelRef={dashboardPanelRef}
                  defaultSize="50%"
                  minSize="15%"
                  collapsible
                  collapsedSize="0%"
                  onResize={(size) => setDashboardCollapsed(size.asPercentage < 1)}
                >
                  <div style={{ height: "100%", overflow: "auto", background: "#f8f9fb" }}>
                    {loading && (
                      <div style={{ padding: 40, textAlign: "center" }}>
                        <div className="spinner" />
                        <p style={{ color: "#888", marginTop: 16 }}>
                          Parsing IFC data from server...
                        </p>
                      </div>
                    )}
                    {error && <div style={errorStyle}>{error}</div>}
                    <Dashboard data={mergedData} />
                  </div>
                </Panel>
              </Group>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onFileSelect, loading, error }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center",
      justifyContent: "center", background: "#f8f9fb", height: "100%",
    }}>
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{ ...logoStyle, width: 80, height: 80, borderRadius: 20, fontSize: 28, margin: "0 auto 24px" }}>
          IFC
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px" }}>
          IFC Dashboard
        </h2>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 8px" }}>
          Upload one or more IFC files to view 3D models and explore building data
          with interactive charts. Load multiple files to federate models from
          different disciplines.
        </p>
        <p style={{ color: "#aaa", fontSize: 12, margin: "0 0 24px" }}>
          Supports IFC2x3, IFC4, and IFC4x3. Select multiple files at once.
        </p>

        {loading ? (
          <div style={{ padding: 20 }}>
            <div className="spinner" />
            <p style={{ color: "#888", marginTop: 12, fontSize: 13 }}>Parsing IFC files...</p>
          </div>
        ) : (
          <label style={uploadBtnStyle}>
            Open IFC Files
            <input
              type="file"
              accept=".ifc"
              multiple
              onChange={onFileSelect}
              style={{ display: "none" }}
            />
          </label>
        )}

        {error && <div style={{ ...errorStyle, marginTop: 20 }}>{error}</div>}
      </div>
    </div>
  );
}

function EditModeButton({ models, startSession }) {
  const [starting, setStarting] = useState(false);

  const handleClick = useCallback(async () => {
    const entries = [...models.values()];
    if (entries.length === 0) return;

    // Use the first model's file to start the session
    const entry = entries[0];
    if (!entry.file) return;

    setStarting(true);
    try {
      await startSession(entry.file);
    } catch {}
    setStarting(false);
  }, [models, startSession]);

  return (
    <button
      onClick={handleClick}
      disabled={starting}
      style={editModeButtonStyle}
      title="Start an edit session — modify element data and export updated IFC"
    >
      {starting ? "Starting..." : "Edit Mode"}
    </button>
  );
}

function modeColor(mode) {
  switch (mode) {
    case "highlight": return "rgba(255, 140, 0, 0.7)";
    case "isolate": return "rgba(79, 70, 229, 0.7)";
    case "xray": return "rgba(139, 92, 246, 0.7)";
    default: return "rgba(255,255,255,0.2)";
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
  width: 32, height: 32, borderRadius: 8,
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontWeight: 800, fontSize: 14,
};

const fileButtonStyle = {
  marginLeft: 8, padding: "6px 16px", borderRadius: 8,
  background: "rgba(255,255,255,0.12)", color: "#fff",
  fontSize: 13, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.2)",
  transition: "background 0.2s",
};

const idsButtonStyle = {
  padding: "6px 16px", borderRadius: 8,
  background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))",
  color: "#6ee7b7", fontSize: 13, fontWeight: 600,
  cursor: "pointer",
  border: "1px solid rgba(16,185,129,0.4)",
  transition: "all 0.2s",
};

const panelToggleBtn = {
  padding: "5px 14px", borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
  transition: "all 0.15s",
};

const isolationModeBtn = {
  padding: "5px 12px", borderRadius: 6, border: "none",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
  transition: "all 0.15s",
};

const filterBarStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 20px", background: "#fff8f0",
  borderBottom: "1px solid #ffe0b2", fontSize: 13, flexShrink: 0,
};

const filterIconStyle = { color: "#ff6600", fontSize: 14 };

const clearFilterBtn = {
  padding: "4px 14px", borderRadius: 6,
  border: "1px solid #ffcc80", background: "#fff",
  color: "#cc5200", fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s",
};

const errorStyle = {
  margin: 24, padding: 16, background: "#fef2f2",
  borderRadius: 8, color: "#dc2626", border: "1px solid #fecaca",
  whiteSpace: "pre-line",
};

const editModeButtonStyle = {
  padding: "6px 16px",
  borderRadius: 8,
  background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.2))",
  color: "#fbbf24",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid rgba(245,158,11,0.4)",
  transition: "all 0.2s",
};

const uploadBtnStyle = {
  display: "inline-block", padding: "12px 32px", borderRadius: 10,
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
  transition: "transform 0.2s",
};

export default App;
