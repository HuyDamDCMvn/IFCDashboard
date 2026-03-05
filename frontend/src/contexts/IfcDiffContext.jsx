import { createContext, useContext, useState, useCallback } from "react";
import { diffIfcFiles } from "../lib/ifc-diff-api";

const IfcDiffContext = createContext(null);

export function IfcDiffProvider({ children }) {
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const [diffFiles, setDiffFiles] = useState({ old: null, new: null });

  const runDiff = useCallback(async (oldFile, newFile, filterTypes = "") => {
    setDiffError("");
    setDiffLoading(true);
    setDiffResult(null);
    setDiffFiles({ old: oldFile, new: newFile });
    try {
      const result = await diffIfcFiles(oldFile, newFile, filterTypes);
      setDiffResult(result);
      return result;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Diff failed";
      setDiffError(msg);
      if (err.response?.data) setDiffResult(err.response.data);
      throw err;
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const clearDiff = useCallback(() => {
    setDiffResult(null);
    setDiffError("");
    setDiffFiles({ old: null, new: null });
  }, []);

  return (
    <IfcDiffContext.Provider
      value={{ diffResult, diffLoading, diffError, diffFiles, runDiff, clearDiff }}
    >
      {children}
    </IfcDiffContext.Provider>
  );
}

export function useIfcDiff() {
  const ctx = useContext(IfcDiffContext);
  if (!ctx) throw new Error("useIfcDiff must be used within IfcDiffProvider");
  return ctx;
}
