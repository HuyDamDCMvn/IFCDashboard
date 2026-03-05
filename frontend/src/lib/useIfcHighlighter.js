/**
 * useIfcHighlighter.js — React hook wrapping ifc-viewer-bridge.
 *
 * Listens to filter state changes and applies highlight / isolation
 * to a ThatOpen viewer via the bridge functions.
 * Supports multiple models loaded simultaneously.
 *
 * When no filter is active, applies default "color by type" highlighting
 * so that 3D view colors match the Dashboard chart colors.
 */
import { useEffect } from "react";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import {
  clearAllHighlights,
  resetVisibility,
  applyIsolation,
  applyMultiColorHighlight,
  applySingleColorHighlight,
} from "./ifc-viewer-bridge";

/**
 * @param {Object|null} components       OBC.Components instance
 * @param {boolean}     ready            Whether the viewer is initialised
 * @param {Map}         modelsMap        Map<modelId, model3D> — all loaded models
 * @param {Object}      filterState      { filterGlobalIds, isolationMode, filterColor, filterColorMap }
 * @param {number}      [refreshKey=0]   Increment to force re-application (e.g. after visibility toggle)
 * @param {Object|null} defaultColorInfo { globalIds: string[], colorMap: Record<string,string> }
 */
export function useIfcHighlighter(components, ready, modelsMap, filterState, refreshKey = 0, defaultColorInfo = null) {
  const { filterGlobalIds, isolationMode, filterColor, filterColorMap } = filterState;

  useEffect(() => {
    if (!ready || !components || !modelsMap || modelsMap.size === 0) return;

    (async () => {
      const fragments = components.get(OBC.FragmentsManager);
      const hider = components.get(OBC.Hider);
      const hl = components.get(OBCF.Highlighter);

      await clearAllHighlights(hl);
      await resetVisibility(hider);

      if (!filterGlobalIds?.length) {
        if (defaultColorInfo?.globalIds?.length) {
          await applyMultiColorHighlight(
            hl, fragments,
            defaultColorInfo.globalIds,
            defaultColorInfo.colorMap,
          );
        }
        return;
      }

      try {
        const allMap = await fragments.guidsToModelIdMap(filterGlobalIds);
        if (!allMap || Object.keys(allMap).length === 0) {
          console.warn("guidsToModelIdMap returned empty — GUID format mismatch?");
          return;
        }

        if (isolationMode === "isolate" || isolationMode === "xray") {
          await applyIsolation(hider, allMap);
        }

        if (isolationMode !== "isolate") {
          const hasColorMap = filterColorMap && Object.keys(filterColorMap).length > 0;

          if (hasColorMap) {
            await applyMultiColorHighlight(hl, fragments, filterGlobalIds, filterColorMap, filterColor || "#ff6600");
          } else {
            await applySingleColorHighlight(hl, allMap, filterColor || "#ff6600", true, isolationMode === "highlight");
          }
        }
      } catch (err) {
        console.error("Filter error:", err);
      }
    })();
  }, [filterGlobalIds, isolationMode, filterColor, filterColorMap, ready, components, modelsMap, refreshKey, defaultColorInfo]);
}
