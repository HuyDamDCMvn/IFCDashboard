import { createContext, useContext, useState, useCallback } from "react";

const SelectionContext = createContext(null);

export function SelectionProvider({ children }) {
  const [filterExpressIDs, setFilterExpressIDs] = useState(null);
  const [filterGlobalIds, setFilterGlobalIds] = useState(null);
  const [filterLabel, setFilterLabel] = useState("");
  const [filterKey, setFilterKey] = useState(null);
  const [selectedExpressID, setSelectedExpressID] = useState(null);
  const [isolationMode, setIsolationMode] = useState("xray");

  const applyFilter = useCallback((expressIDs, label, key, globalIds) => {
    setFilterExpressIDs(expressIDs);
    setFilterGlobalIds(globalIds || null);
    setFilterLabel(label);
    setFilterKey(key || label);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterExpressIDs(null);
    setFilterGlobalIds(null);
    setFilterLabel("");
    setFilterKey(null);
  }, []);

  const toggleFilter = useCallback(
    (expressIDs, label, key, globalIds) => {
      const k = key || label;
      if (filterKey === k) {
        clearFilter();
      } else {
        applyFilter(expressIDs, label, k, globalIds);
      }
    },
    [filterKey, applyFilter, clearFilter]
  );

  return (
    <SelectionContext.Provider
      value={{
        filterExpressIDs,
        filterGlobalIds,
        filterLabel,
        filterKey,
        selectedExpressID,
        isolationMode,
        applyFilter,
        clearFilter,
        toggleFilter,
        setSelectedExpressID,
        setIsolationMode,
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
