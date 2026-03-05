/**
 * useIfcFilter.js — React hook for IFC element filtering & summarisation.
 *
 * Wraps ifc-filter-core functions with React memoisation.
 * Supports merged multi-model data.
 */
import { useMemo, useCallback } from "react";
import {
  buildClassColorMap,
  filterElements,
  filterByModels,
  resolveFilterColor,
  buildFilterColorMap,
  summarizeByType,
  summarizeByPredefined,
  summarizeByStorey,
  countTotalProperties,
  ACTIVE_COLOR,
} from "./ifc-filter-core";

/**
 * @param {Array}  allElements       Full element array (merged across models)
 * @param {Object} summary           { "IfcWall": 12, … }
 * @param {Array}  storeys           [{ name, elevation }, …]
 * @param {Set}    classFilter        Currently selected IFC classes (empty = all)
 * @param {Set}    modelFilter        Currently selected model IDs (empty = all)
 * @param {Object} selectionActions  { toggleFilter } from SelectionContext
 * @param {string|null} filterKey    Current active filterKey from SelectionContext
 * @returns {Object}
 */
export function useIfcFilter(allElements, summary, storeys, classFilter, modelFilter, selectionActions, filterKey) {
  const { toggleFilter } = selectionActions;

  const modelFilteredElements = useMemo(
    () => filterByModels(allElements || [], modelFilter),
    [allElements, modelFilter]
  );

  const effectiveSummary = useMemo(() => {
    if (!modelFilter || modelFilter.size === 0) return summary || {};
    const s = {};
    modelFilteredElements.forEach((el) => {
      s[el.type] = (s[el.type] || 0) + 1;
    });
    return s;
  }, [modelFilteredElements, modelFilter, summary]);

  const allClasses = useMemo(() =>
    Object.entries(effectiveSummary)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t),
    [effectiveSummary]
  );

  const classColorMap = useMemo(
    () => buildClassColorMap(allClasses),
    [allClasses]
  );

  const filteredElements = useMemo(
    () => classFilter.size > 0
      ? modelFilteredElements.filter((el) => classFilter.has(el.type))
      : modelFilteredElements,
    [modelFilteredElements, classFilter]
  );

  const chartData = useMemo(
    () => summarizeByType(filteredElements),
    [filteredElements]
  );

  const predefData = useMemo(
    () => summarizeByPredefined(filteredElements),
    [filteredElements]
  );

  const storeyData = useMemo(
    () => summarizeByStorey(filteredElements, storeys),
    [filteredElements, storeys]
  );

  const totalProps = useMemo(
    () => countTotalProperties(filteredElements),
    [filteredElements]
  );

  const uniqueTypes = useMemo(
    () => [...new Set(chartData.map((d) => d.fullName))],
    [chartData]
  );

  const handleFilterClick = useCallback(
    (category, value) => {
      if (!filteredElements.length) return;

      const matching = filterElements(filteredElements, category, value);
      if (!matching.length) return;

      const key = `${category}:${value}`;
      const expressIDs = matching.map((el) => el.expressId);
      const globalIds = matching.map((el) => el.id).filter(Boolean);
      const label = `${value.replace("Ifc", "")} (${expressIDs.length})`;
      const color = resolveFilterColor(category, value, classColorMap) || ACTIVE_COLOR;
      const colorMap = buildFilterColorMap(matching, classColorMap);

      toggleFilter(expressIDs, label, key, globalIds, color, colorMap);
    },
    [filteredElements, toggleFilter, classColorMap]
  );

  return {
    allClasses,
    classColorMap,
    effectiveSummary,
    filteredElements,
    modelFilteredElements,
    chartData,
    predefData,
    storeyData,
    totalProps,
    uniqueTypes,
    handleFilterClick,
    filterKey,
  };
}
