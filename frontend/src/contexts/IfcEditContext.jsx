import { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import {
  openEditSession,
  applyEdits,
  getElementData,
  exportEditedIfc,
  closeEditSession,
} from "../lib/ifc-edit-api";

const IfcEditContext = createContext(null);

export function IfcEditProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionFileName, setSessionFileName] = useState("");
  const [sessionSchema, setSessionSchema] = useState("");
  const [history, setHistory] = useState([]);
  const [editingElement, setEditingElement] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editingElementRef = useRef(null);
  editingElementRef.current = editingElement;

  const isDirty = history.length > 0;
  const isSessionOpen = !!sessionId;

  const startSession = useCallback(async (file) => {
    setBusy(true);
    setError("");
    try {
      if (sessionId) {
        try { await closeEditSession(sessionId); } catch {}
      }
      const res = await openEditSession(file);
      setSessionId(res.sessionId);
      setSessionFileName(res.fileName);
      setSessionSchema(res.schema);
      setHistory([]);
      return res;
    } catch (e) {
      const msg = typeof e.response?.data === "string" ? e.response.data : e.message;
      setError(msg || "Failed to open edit session");
      throw e;
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  const openElementEditor = useCallback(async (element) => {
    if (!sessionId) {
      setEditingElement({
        globalId: element.id,
        expressId: element.expressId,
        type: element.type || element.rawType,
        Name: element.name || "",
        Description: element.description || "",
        ObjectType: "",
        PredefinedType: element.predefinedType || "",
        propertySets: element.propertySets || {},
        materials: element.materials || [],
        spatial: { storey: element.storey || "" },
        _modelId: element._modelId,
        _modelName: element._modelName,
      });
      return;
    }

    setBusy(true);
    try {
      const data = await getElementData(sessionId, element.id);
      setEditingElement({
        ...data,
        _modelId: element._modelId,
        _modelName: element._modelName,
      });
    } catch {
      setEditingElement({
        globalId: element.id,
        expressId: element.expressId,
        type: element.type || element.rawType,
        Name: element.name || "",
        Description: element.description || "",
        ObjectType: "",
        PredefinedType: element.predefinedType || "",
        propertySets: element.propertySets || {},
        materials: element.materials || [],
        spatial: { storey: element.storey || "" },
        _modelId: element._modelId,
        _modelName: element._modelName,
      });
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  const closeEditor = useCallback(() => {
    setEditingElement(null);
  }, []);

  const saveEdits = useCallback(async (globalId, changes) => {
    if (!sessionId) {
      setError("No edit session open. Upload the IFC file first.");
      return null;
    }

    setBusy(true);
    setError("");
    try {
      const res = await applyEdits(sessionId, [{ globalId, ...changes }]);
      const result = res.results?.[0];

      if (result?.status === "ok") {
        setHistory((prev) => [
          ...prev,
          {
            globalId,
            applied: result.applied,
            timestamp: Date.now(),
          },
        ]);

        if (editingElementRef.current?.globalId === globalId) {
          const refreshed = await getElementData(sessionId, globalId);
          setEditingElement((prev) => ({
            ...prev,
            ...refreshed,
            _modelId: prev?._modelId,
            _modelName: prev?._modelName,
          }));
        }
      }
      return result;
    } catch (e) {
      const msg = typeof e.response?.data === "string" ? e.response.data : e.message;
      setError(msg || "Failed to save edits");
      return null;
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  const exportIfc = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const baseName = sessionFileName?.replace(/\.ifc$/i, "") || "model";
      await exportEditedIfc(sessionId, `${baseName}_edited.ifc`);
    } catch (e) {
      setError(e.message || "Export failed");
    } finally {
      setBusy(false);
    }
  }, [sessionId, sessionFileName]);

  const endSession = useCallback(async () => {
    if (sessionId) {
      try { await closeEditSession(sessionId); } catch {}
    }
    setSessionId(null);
    setSessionFileName("");
    setSessionSchema("");
    setHistory([]);
    setEditingElement(null);
    setError("");
  }, [sessionId]);

  const value = useMemo(() => ({
    sessionId,
    sessionFileName,
    sessionSchema,
    history,
    editingElement,
    busy,
    error,
    isDirty,
    isSessionOpen,
    startSession,
    openElementEditor,
    closeEditor,
    saveEdits,
    exportIfc,
    endSession,
    setError,
  }), [
    sessionId, sessionFileName, sessionSchema, history,
    editingElement, busy, error, isDirty, isSessionOpen,
    startSession, openElementEditor, closeEditor,
    saveEdits, exportIfc, endSession,
  ]);

  return (
    <IfcEditContext.Provider value={value}>
      {children}
    </IfcEditContext.Provider>
  );
}

export function useIfcEdit() {
  const ctx = useContext(IfcEditContext);
  if (!ctx) throw new Error("useIfcEdit must be used within IfcEditProvider");
  return ctx;
}
