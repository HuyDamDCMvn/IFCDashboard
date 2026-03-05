/**
 * ifc-diff-api.js — API layer for IFC diff endpoint.
 */
import axios from "axios";

const BASE = "";

/**
 * Compare two IFC files. Returns diff results or throws on error.
 * @param {File} oldFile
 * @param {File} newFile
 * @param {string} [filterTypes] — comma-separated IFC types to filter
 * @returns {Promise<object>} Diff results
 */
export async function diffIfcFiles(oldFile, newFile, filterTypes = "") {
  const form = new FormData();
  form.append("old_file", oldFile);
  form.append("new_file", newFile);
  if (filterTypes) form.append("filter_types", filterTypes);

  const { data } = await axios.post(`${BASE}/api/diff-ifc`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
