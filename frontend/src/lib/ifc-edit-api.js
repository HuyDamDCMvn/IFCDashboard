/**
 * ifc-edit-api.js — API layer for IFC edit session endpoints.
 *
 * All functions return promises. Errors are thrown with descriptive messages.
 */
import axios from "axios";

const BASE = "";

/**
 * Open an edit session by uploading the original IFC file.
 * @param {File} file
 * @returns {Promise<{sessionId: string, schema: string, fileName: string}>}
 */
export async function openEditSession(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(`${BASE}/api/edit-session/open`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Apply edits to the IFC model in an open session.
 * @param {string} sessionId
 * @param {Array<{globalId: string, Name?: string, Description?: string, PredefinedType?: string, psetEdits?: Record<string, Record<string, any>>}>} edits
 * @returns {Promise<{results: Array, totalHistory: number}>}
 */
export async function applyEdits(sessionId, edits) {
  const { data } = await axios.post(
    `${BASE}/api/edit-session/${sessionId}/edit`,
    { edits },
  );
  return data;
}

/**
 * Fetch the current (possibly edited) data for a single element.
 * @param {string} sessionId
 * @param {string} globalId
 */
export async function getElementData(sessionId, globalId) {
  const { data } = await axios.get(
    `${BASE}/api/edit-session/${sessionId}/element/${globalId}`,
  );
  return data;
}

/**
 * Fetch the full edit history for a session.
 * @param {string} sessionId
 */
export async function getEditHistory(sessionId) {
  const { data } = await axios.get(
    `${BASE}/api/edit-session/${sessionId}/history`,
  );
  return data;
}

/**
 * Export the edited IFC as a downloadable blob.
 * @param {string} sessionId
 * @param {string} [fileName]
 */
export async function exportEditedIfc(sessionId, fileName) {
  const response = await axios.get(
    `${BASE}/api/edit-session/${sessionId}/export`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "model_edited.ifc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Close the edit session and free server memory.
 * @param {string} sessionId
 */
export async function closeEditSession(sessionId) {
  await axios.delete(`${BASE}/api/edit-session/${sessionId}`);
}
