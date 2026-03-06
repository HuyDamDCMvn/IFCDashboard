/**
 * ifc-filter-core.js — Pure JS, minimal dependencies.
 *
 * Provides color mapping, element filtering, color-map building,
 * and data summarisation utilities for IFC element datasets.
 */

import { PALETTE, ACTIVE_COLOR } from "./theme";

export { PALETTE, ACTIVE_COLOR };

/**
 * Build a deterministic color map from a list of IFC class names.
 * Pass classes sorted by count (descending) so that the most common
 * classes receive the most visually distinct palette entries.
 *
 * @param {string[]} sortedClasses
 * @returns {Record<string, string>}  { "IfcWall": "#4f46e5", … }
 */
export function buildClassColorMap(sortedClasses) {
  const map = {};
  sortedClasses.forEach((cls, i) => {
    map[cls] = PALETTE[i % PALETTE.length];
  });
  return map;
}

// ─── Element Filtering ───────────────────────────────────────────

/**
 * Filter IFC elements by category and value.
 *
 * @param {Array} elements     Array of IFC element objects
 * @param {string} category    "type" | "predefinedType" | "storey"
 * @param {string} value       The filter value (e.g. "IfcWall", "Level 1")
 * @returns {Array}            Matching elements
 */
export function filterElements(elements, category, value) {
  switch (category) {
    case "type":
      return elements.filter((el) => el.type === value);
    case "predefinedType": {
      const [exportAs, ...rest] = value.split(".");
      const pType = rest.join(".");
      return elements.filter(
        (el) => el.type === exportAs && el.predefinedType === pType
      );
    }
    case "storey":
      return elements.filter((el) => el.storey === value);
    default:
      return [];
  }
}

/**
 * Resolve the dominant color for a filter action.
 * For "type" / "predefinedType" filters → the class color.
 * For "storey" → null (multi-class, use colorMap instead).
 *
 * @param {string} category
 * @param {string} value
 * @param {Record<string, string>} classColorMap
 * @returns {string|null}
 */
export function resolveFilterColor(category, value, classColorMap) {
  switch (category) {
    case "type":
      return classColorMap[value] || null;
    case "predefinedType": {
      const exportAs = value.split(".")[0];
      return classColorMap[exportAs] || null;
    }
    default:
      return null;
  }
}

/**
 * Build a per-element color map: { globalId → hex }.
 * Used by the 3D viewer to color each element by its IFC class.
 *
 * @param {Array} matchingElements
 * @param {Record<string, string>} classColorMap
 * @returns {Record<string, string>}
 */
export function buildFilterColorMap(matchingElements, classColorMap) {
  const map = {};
  matchingElements.forEach((el) => {
    if (el.id) map[el.id] = classColorMap[el.type] || "#999";
  });
  return map;
}

// ─── Data Summarisation ──────────────────────────────────────────

/**
 * Summarise elements by IFC type for bar / pie charts.
 *
 * @param {Array} elements
 * @returns {{ name: string, fullName: string, value: number }[]}
 */
export function summarizeByType(elements) {
  const counts = {};
  elements.forEach((el) => {
    counts[el.type] = (counts[el.type] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => ({
      name: type.replace("Ifc", ""),
      fullName: type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Summarise elements by PredefinedType.
 *
 * @param {Array} elements
 * @param {number} [limit=15]
 * @returns {Array}
 */
export function summarizeByPredefined(elements, limit = 15) {
  const counts = {};
  elements.forEach((el) => {
    if (el.predefinedType) {
      const key = `${el.type}.${el.predefinedType}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  return Object.entries(counts)
    .map(([label, count]) => {
      const [exportAs, ...rest] = label.split(".");
      const pType = rest.join(".");
      return {
        name: `${exportAs.replace("Ifc", "")}.${pType}`,
        fullLabel: label,
        exportAs,
        pType,
        value: count,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * Summarise elements by building storey, sorted by elevation.
 *
 * @param {Array}  elements
 * @param {Array}  storeys   [{ name, elevation }, …]
 * @returns {Array}
 */
export function summarizeByStorey(elements, storeys) {
  const elevationMap = {};
  (storeys || []).forEach((s) => {
    elevationMap[s.name] = s.elevation;
  });

  const breakdown = {};
  elements.forEach((el) => {
    const sName = el.storey || "Unassigned";
    if (!breakdown[sName]) breakdown[sName] = {};
    breakdown[sName][el.type] = (breakdown[sName][el.type] || 0) + 1;
  });

  return Object.entries(breakdown)
    .map(([storey, types]) => ({
      name: storey,
      elevation: elevationMap[storey] ?? -Infinity,
      total: Object.values(types).reduce((s, v) => s + v, 0),
      ...types,
    }))
    .sort((a, b) => a.elevation - b.elevation);
}

/**
 * Count total properties across all elements.
 *
 * @param {Array} elements
 * @returns {number}
 */
export function countTotalProperties(elements) {
  return elements.reduce(
    (acc, el) =>
      acc +
      Object.values(el.propertySets || {}).reduce(
        (s, ps) => s + Object.keys(ps).length,
        0
      ),
    0
  );
}

// ─── Multi-Model Helpers ─────────────────────────────────────────

/**
 * Filter elements by source model IDs.
 *
 * @param {Array} elements          Merged elements with _modelId
 * @param {Set<string>} modelIds    Set of model IDs to include (empty = all)
 * @returns {Array}
 */
export function filterByModels(elements, modelIds) {
  if (!modelIds || modelIds.size === 0) return elements;
  return elements.filter((el) => modelIds.has(el._modelId));
}

/**
 * Get unique model names from a merged element set.
 *
 * @param {Array} elements
 * @returns {{ id: string, name: string, color: string }[]}
 */
export function getModelSources(elements) {
  const seen = new Map();
  for (const el of elements) {
    if (el._modelId && !seen.has(el._modelId)) {
      seen.set(el._modelId, { id: el._modelId, name: el._modelName, color: el._modelColor });
    }
  }
  return [...seen.values()];
}
