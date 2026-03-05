/**
 * IFC Dashboard Library — Public API
 *
 * Pure JS (framework-agnostic):
 *   PALETTE, ACTIVE_COLOR, buildClassColorMap,
 *   filterElements, resolveFilterColor, buildFilterColorMap,
 *   summarizeByType, summarizeByPredefined, summarizeByStorey,
 *   countTotalProperties
 *
 * ThatOpen bridge (framework-agnostic, peer dep: @thatopen + three):
 *   clearAllHighlights, resetVisibility, applyIsolation,
 *   applyMultiColorHighlight, applySingleColorHighlight
 *
 * React hooks:
 *   useIfcFilter, useIfcHighlighter
 */

export {
  PALETTE,
  ACTIVE_COLOR,
  buildClassColorMap,
  filterElements,
  resolveFilterColor,
  buildFilterColorMap,
  summarizeByType,
  summarizeByPredefined,
  summarizeByStorey,
  countTotalProperties,
  filterByModels,
  getModelSources,
} from "./ifc-filter-core";

export {
  clearAllHighlights,
  resetVisibility,
  applyIsolation,
  applyMultiColorHighlight,
  applySingleColorHighlight,
} from "./ifc-viewer-bridge";

export { useIfcFilter } from "./useIfcFilter";
export { useIfcHighlighter } from "./useIfcHighlighter";

export {
  openEditSession,
  applyEdits,
  getElementData,
  getEditHistory,
  exportEditedIfc,
  closeEditSession,
} from "./ifc-edit-api";
