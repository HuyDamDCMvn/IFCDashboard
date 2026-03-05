import { useState, useCallback, useRef, useMemo } from "react";
import { IdsBuilderProvider, useIdsBuilder } from "../../contexts/IdsBuilderContext";
import { useSelection } from "../../contexts/SelectionContext";
import IdsInfoPanel from "./IdsInfoPanel";
import IdsSpecList from "./IdsSpecList";
import IdsSpecEditor from "./IdsSpecEditor";
import IdsXmlPreview from "./IdsXmlPreview";
import IdsTemplates from "./IdsTemplates";
import IdsValidationReport from "./IdsValidationReport";

export default function IdsBuilder({ onClose, modelData, modelsList }) {
  return (
    <IdsBuilderProvider>
      <IdsBuilderInner onClose={onClose} modelData={modelData} modelsList={modelsList} />
    </IdsBuilderProvider>
  );
}

function IdsBuilderInner({ onClose, modelData, modelsList }) {
  const {
    idsDoc, selectedSpec, previewXml, setPreviewXml,
    resetDocument, loadDocument,
    validationStatus, setValidationStatus,
    validationResults, setValidationResults,
  } = useIdsBuilder();

  const { applyFilter } = useSelection();

  const [showTemplates, setShowTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [validatedAt, setValidatedAt] = useState(null);
  const fileInputRef = useRef(null);

  const allFailedElements = useMemo(() => {
    if (!validationResults) return [];
    const elems = [];
    (validationResults.models || []).forEach(m => {
      (m.specifications || []).forEach(sp => {
        (sp.failedElements || []).forEach(el => {
          if (!elems.some(e => e.globalId && e.globalId === el.globalId)) {
            elems.push(el);
          }
        });
      });
    });
    return elems;
  }, [validationResults]);

  const handleNavTo = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(allFailedElements.length - 1, idx));
    setNavIndex(clamped);
    const el = allFailedElements[clamped];
    if (!el?.globalId) return;
    applyFilter(
      [el.expressId],
      `IDS: ${el.name || el.globalId}`,
      `ids_nav_${el.globalId}`,
      [el.globalId],
      "#ef4444",
    );
  }, [allFailedElements, applyFilter]);

  const handleExportIds = useCallback(async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/build-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idsDoc),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${idsDoc.info.title || "export"}.ids`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export IDS. Is the backend running?");
    }
    setExportLoading(false);
  }, [idsDoc]);

  const handlePreviewXml = useCallback(async () => {
    try {
      const res = await fetch("/api/build-ids?format=xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idsDoc),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setPreviewXml(text);
    } catch (err) {
      console.error("Preview error:", err);
      setPreviewXml(`<!-- Error generating preview -->\n<!-- ${err.message} -->`);
    }
  }, [idsDoc, setPreviewXml]);

  const handleValidate = useCallback(async () => {
    const ifcModels = (modelsList || []).filter(m => m.file);
    if (ifcModels.length === 0) {
      alert("No IFC models loaded. Load IFC files first, then validate.");
      return;
    }
    setValidationStatus("running");
    setValidationResults(null);
    setNavIndex(0);
    try {
      const allResults = [];
      for (const model of ifcModels) {
        const fd = new FormData();
        fd.append("ifc_file", model.file);
        fd.append("ids_json", JSON.stringify(idsDoc));
        const res = await fetch("/api/validate-ids", { method: "POST", body: fd });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Validation failed for ${model.fileName}: ${errText}`);
        }
        const result = await res.json();
        allResults.push(result);
      }

      const merged = {
        models: allResults,
        overall: allResults.every(r => r.overall),
        totalSpecs: allResults.reduce((s, r) => s + r.totalSpecs, 0),
        passedSpecs: allResults.reduce((s, r) => s + r.passedSpecs, 0),
        failedSpecs: allResults.reduce((s, r) => s + r.failedSpecs, 0),
      };
      setValidationResults(merged);
      setValidationStatus("done");
      setValidatedAt(new Date().toISOString());
    } catch (err) {
      console.error("Validation error:", err);
      alert(`Validation error: ${err.message}`);
      setValidationStatus("error");
    }
  }, [idsDoc, modelsList, setValidationResults, setValidationStatus]);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/parse-ids", {
          method: "POST",
          body: (() => { const fd = new FormData(); fd.append("file", file); return fd; })(),
        });
        if (!res.ok) throw new Error(await res.text());
        const doc = await res.json();
        loadDocument(doc);
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to parse IDS file. Is the backend running?");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, [loadDocument]);

  const handleMinimize = useCallback(() => setMinimized(true), []);
  const handleRestore = useCallback(() => setMinimized(false), []);

  // ─── Minimized floating bar ───
  if (minimized) {
    const currentEl = allFailedElements[navIndex];
    const hasNav = allFailedElements.length > 0;

    return (
      <div style={minimizedBarStyle}>
        <div style={logoBadge}>IDS</div>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>IDS Report</span>

        {validationResults && !validationResults.overall && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#fff",
            background: "#ef4444", padding: "2px 8px", borderRadius: 4,
          }}>
            {validationResults.failedSpecs} FAILED
          </span>
        )}

        {hasNav && (
          <div style={navSection}>
            <button onClick={() => handleNavTo(navIndex - 1)} disabled={navIndex <= 0}
              style={{ ...navBtn, opacity: navIndex <= 0 ? 0.3 : 1 }} title="Previous element">
              {"\u25C0"}
            </button>
            <span style={{ fontSize: 10, color: "#555", minWidth: 50, textAlign: "center", fontWeight: 600 }}>
              {navIndex + 1} / {allFailedElements.length}
            </span>
            <button onClick={() => handleNavTo(navIndex + 1)}
              disabled={navIndex >= allFailedElements.length - 1}
              style={{ ...navBtn, opacity: navIndex >= allFailedElements.length - 1 ? 0.3 : 1 }}
              title="Next element">
              {"\u25B6"}
            </button>
            {currentEl && (
              <span style={navElementInfo}>
                <span style={navClassChip}>{currentEl.type}</span>
                {currentEl.name || currentEl.globalId?.slice(0, 12) || ""}
              </span>
            )}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={handleRestore} style={minBarBtn} title="Restore IDS Builder">
            Restore
          </button>
          <button onClick={onClose} style={{ ...minBarBtn, color: "#ef4444" }} title="Close IDS Builder">
            Close
          </button>
        </div>
      </div>
    );
  }

  // ─── Full modal ───
  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={logoBadge}>IDS</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>IDS Builder</span>
            <span style={{ fontSize: 11, color: "#888" }}>Information Delivery Specification</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setShowTemplates(true)} style={toolbarBtn}>Templates</button>
            <label style={toolbarBtn}>
              Import .ids
              <input ref={fileInputRef} type="file" accept=".ids,.xml"
                onChange={handleImport} style={{ display: "none" }} />
            </label>
            <button onClick={handlePreviewXml} style={toolbarBtn}>Preview XML</button>
            <button onClick={handleExportIds} disabled={exportLoading}
              style={{ ...toolbarBtn, background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5" }}>
              {exportLoading ? "Exporting..." : "Download .ids"}
            </button>
            <button onClick={handleValidate} disabled={validationStatus === "running"}
              style={{ ...toolbarBtn, background: "#10b981", color: "#fff", border: "1px solid #10b981" }}>
              {validationStatus === "running" ? "Validating..." : "Validate"}
            </button>
            <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />
            {validationResults && (
              <button onClick={handleMinimize} style={toolbarBtn} title="Minimize to see 3D viewer">
                Minimize
              </button>
            )}
            <button onClick={resetDocument} style={{ ...toolbarBtn, color: "#ef4444" }}
              title="Clear all and start fresh">Reset</button>
            <button onClick={onClose} style={closeBtnStyle} title="Close IDS Builder">&times;</button>
          </div>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <div style={leftPanelStyle}>
            <IdsInfoPanel />
            <div style={{ flex: 1, overflow: "auto", borderTop: "1px solid #e5e7eb" }}>
              <IdsSpecList />
            </div>
          </div>

          <div style={rightPanelStyle}>
            {validationResults ? (
              <IdsValidationReport
                results={validationResults}
                onClose={() => setValidationResults(null)}
                onMinimize={handleMinimize}
                idsInfo={idsDoc.info}
                validatedAt={validatedAt}
              />
            ) : selectedSpec ? (
              <IdsSpecEditor modelData={modelData} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
                Select or create a specification to edit
              </div>
            )}
          </div>
        </div>

        {previewXml !== null && (
          <IdsXmlPreview xml={previewXml} onClose={() => setPreviewXml(null)} />
        )}
        {showTemplates && (
          <IdsTemplates onClose={() => setShowTemplates(false)} />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────

const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 500,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const containerStyle = {
  width: "92vw", height: "90vh",
  background: "#fff", borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 20px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
};

const logoBadge = {
  width: 36, height: 36, borderRadius: 8,
  background: "linear-gradient(135deg, #10b981, #06b6d4)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0,
};

const toolbarBtn = {
  padding: "6px 14px", borderRadius: 6,
  border: "1px solid #d1d5db", background: "#fff",
  color: "#333", fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s",
  display: "inline-flex", alignItems: "center", gap: 4,
};

const closeBtnStyle = {
  width: 32, height: 32, borderRadius: 8,
  border: "none", background: "#f3f4f6",
  color: "#666", fontSize: 20, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s",
};

const bodyStyle = { flex: 1, display: "flex", overflow: "hidden" };

const leftPanelStyle = {
  width: 280, flexShrink: 0, borderRight: "1px solid #e5e7eb",
  display: "flex", flexDirection: "column", background: "#fafbfc",
};

const rightPanelStyle = { flex: 1, overflow: "auto", background: "#f8f9fb" };

const minimizedBarStyle = {
  position: "fixed", bottom: 16, right: 16, zIndex: 500,
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 16px", background: "#fff", borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.18)", border: "1px solid #e5e7eb",
  maxWidth: "calc(100vw - 32px)",
};

const minBarBtn = {
  padding: "5px 12px", borderRadius: 6,
  border: "1px solid #d1d5db", background: "#fff",
  color: "#333", fontSize: 11, fontWeight: 600, cursor: "pointer",
};

const navSection = {
  display: "flex", alignItems: "center", gap: 4,
  borderLeft: "1px solid #e5e7eb", paddingLeft: 10, marginLeft: 2,
};

const navBtn = {
  width: 24, height: 24, borderRadius: 4,
  border: "1px solid #d1d5db", background: "#fff",
  color: "#333", fontSize: 10, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "opacity 0.15s",
};

const navElementInfo = {
  fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 4,
  maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const navClassChip = {
  fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
  background: "#e0e7ff", color: "#3730a3",
};
