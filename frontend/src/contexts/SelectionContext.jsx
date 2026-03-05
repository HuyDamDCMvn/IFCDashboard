import { createContext, useContext, useState, useCallback, useRef } from "react";

const SelectionContext = createContext(null);

export function SelectionProvider({ children }) {
  const [filterExpressIDs, setFilterExpressIDs] = useState(null);
  const [filterGlobalIds, setFilterGlobalIds] = useState(null);
  const [filterLabel, setFilterLabel] = useState("");
  const [filterKey, setFilterKey] = useState(null);
  const [filterColor, setFilterColor] = useState(null);
  const [filterColorMap, setFilterColorMap] = useState(null);
  const [filterModelIds, setFilterModelIds] = useState(null);
  const [selectedExpressID, setSelectedExpressID] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [isolationMode, setIsolationMode] = useState("xray");
  const [classColorMap, setClassColorMapState] = useState({});
  const colorMapRef = useRef({});

  const setClassColorMap = useCallback((map) => {
    const json = JSON.stringify(map);
    if (json !== JSON.stringify(colorMapRef.current)) {
      colorMapRef.current = map;
      setClassColorMapState(map);
    }
  }, []);

  const applyFilter = useCallback((expressIDs, label, key, globalIds, color, colorMap, modelIds) => {
    setFilterExpressIDs(expressIDs);
    setFilterGlobalIds(globalIds || null);
    setFilterLabel(label);
    setFilterKey(key || label);
    setFilterColor(color || null);
    setFilterColorMap(colorMap || null);
    setFilterModelIds(modelIds || null);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterExpressIDs(null);
    setFilterGlobalIds(null);
    setFilterLabel("");
    setFilterKey(null);
    setFilterColor(null);
    setFilterColorMap(null);
    setFilterModelIds(null);
  }, []);

  const toggleFilter = useCallback(
    (expressIDs, label, key, globalIds, color, colorMap, modelIds) => {
      const k = key || label;
      if (filterKey === k) {
        clearFilter();
      } else {
        applyFilter(expressIDs, label, k, globalIds, color, colorMap, modelIds);
      }
    },
    [filterKey, applyFilter, clearFilter]
  );

  const setSelected = useCallback((expressId, modelId) => {
    setSelectedExpressID(expressId);
    setSelectedModelId(modelId || null);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        filterExpressIDs,
        filterGlobalIds,
        filterLabel,
        filterKey,
        filterColor,
        filterColorMap,
        filterModelIds,
        selectedExpressID,
        selectedModelId,
        isolationMode,
        classColorMap,
        applyFilter,
        clearFilter,
        toggleFilter,
        setSelectedExpressID: setSelected,
        setIsolationMode,
        setClassColorMap,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
