import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { PALETTE } from "../lib/theme";

const ModelRegistryContext = createContext(null);

let _nextOrder = 0;

export function ModelRegistryProvider({ children }) {
  const [models, setModels] = useState(new Map());
  const [focusedModelId, setFocusedModelId] = useState(null);

  const focusModel = useCallback((id) => {
    setFocusedModelId((prev) => (prev === id ? null : id));
  }, []);

  const addModel = useCallback((id, fileName, file, dashboardData) => {
    setModels((prev) => {
      const next = new Map(prev);
      const order = _nextOrder++;
      next.set(id, {
        id,
        fileName,
        file,
        discipline: guessDiscipline(fileName),
        color: PALETTE[order % PALETTE.length],
        visible: true,
        dashboardData,
        loadedIn3D: false,
        order,
      });
      return next;
    });
  }, []);

  const removeModel = useCallback((id) => {
    setModels((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setFocusedModelId((prev) => (prev === id ? null : prev));
  }, []);

  const toggleModelVisibility = useCallback((id) => {
    setModels((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, visible: !entry.visible });
      return next;
    });
  }, []);

  const setModelLoaded = useCallback((id, loaded = true) => {
    setModels((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, loadedIn3D: loaded });
      return next;
    });
  }, []);

  const setModelDiscipline = useCallback((id, discipline) => {
    setModels((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, discipline });
      return next;
    });
  }, []);

  const setModelColor = useCallback((id, color) => {
    setModels((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, color });
      return next;
    });
  }, []);

  const visibleModels = useMemo(() => {
    const arr = [];
    for (const [, entry] of models) {
      if (entry.visible) arr.push(entry);
    }
    return arr.sort((a, b) => a.order - b.order);
  }, [models]);

  const allModelsList = useMemo(() => {
    const arr = [...models.values()];
    return arr.sort((a, b) => a.order - b.order);
  }, [models]);

  const mergedData = useMemo(
    () => mergeModelData(visibleModels),
    [visibleModels]
  );

  return (
    <ModelRegistryContext.Provider
      value={{
        models,
        allModelsList,
        visibleModels,
        mergedData,
        focusedModelId,
        addModel,
        removeModel,
        toggleModelVisibility,
        setModelLoaded,
        setModelDiscipline,
        setModelColor,
        focusModel,
      }}
    >
      {children}
    </ModelRegistryContext.Provider>
  );
}

export function useModelRegistry() {
  const ctx = useContext(ModelRegistryContext);
  if (!ctx) throw new Error("useModelRegistry must be used within ModelRegistryProvider");
  return ctx;
}

function guessDiscipline(fileName) {
  const lower = (fileName || "").toLowerCase();
  if (/arch|arc|kien.?truc/i.test(lower)) return "Architecture";
  if (/str|struct|ket.?cau/i.test(lower)) return "Structure";
  if (/mep|hvac|plumb|elec|co.?dien/i.test(lower)) return "MEP";
  if (/infra|road|bridge|ha.?tang/i.test(lower)) return "Infrastructure";
  if (/site/i.test(lower)) return "Site";
  return "General";
}

function mergeModelData(visibleModels) {
  if (visibleModels.length === 0) return null;

  const mergedElements = [];
  const mergedSummary = {};
  const mergedStoreys = [];
  const seenStoreys = new Map();
  const projects = [];
  const schemas = [];

  for (const entry of visibleModels) {
    const d = entry.dashboardData;
    if (!d) continue;

    for (const el of d.elements || []) {
      mergedElements.push({
        ...el,
        _modelId: entry.id,
        _modelName: entry.fileName,
        _modelColor: entry.color,
      });
    }

    for (const [type, count] of Object.entries(d.summary || {})) {
      mergedSummary[type] = (mergedSummary[type] || 0) + count;
    }

    for (const s of d.storeys || []) {
      const key = `${s.name}__${s.elevation}`;
      if (!seenStoreys.has(key)) {
        seenStoreys.set(key, s);
      }
    }

    if (d.project) projects.push({ ...d.project, _modelId: entry.id, _modelName: entry.fileName });
    if (d.schemaInfo) schemas.push({ ...d.schemaInfo, _modelId: entry.id });
  }

  mergedStoreys.push(...seenStoreys.values());
  mergedStoreys.sort((a, b) => a.elevation - b.elevation);

  return {
    elements: mergedElements,
    summary: mergedSummary,
    storeys: mergedStoreys,
    projects,
    schemas,
    project: projects[0] || { name: "", description: "", schema: "" },
    schemaInfo: schemas[0] || {},
    modelCount: visibleModels.length,
  };
}
