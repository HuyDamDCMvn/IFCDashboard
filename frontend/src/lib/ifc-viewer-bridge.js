/**
 * ifc-viewer-bridge.js — ThatOpen highlight / isolate wrapper.
 *
 * Peer dependency: @thatopen/components, @thatopen/components-front, three
 * Framework-agnostic — no React imports.
 */
import * as THREE from "three";

/**
 * Clear all highlight styles on the given Highlighter.
 * Removes both the built-in "select" style and any dynamic "filter_*" styles.
 *
 * @param {import("@thatopen/components-front").Highlighter} hl
 */
export async function clearAllHighlights(hl) {
  try { await hl.clear("select"); } catch {}
  const filterStyles = [];
  for (const [name] of hl.styles) {
    if (name.startsWith("filter_")) filterStyles.push(name);
  }
  for (const name of filterStyles) {
    try { await hl.clear(name); } catch {}
    try { hl.styles.delete(name); } catch {}
  }
}

/**
 * Reset the Hider so all elements are visible again.
 *
 * @param {import("@thatopen/components").Hider} hider
 */
export async function resetVisibility(hider) {
  try { await hider.set(true); } catch {}
}

/**
 * Isolate the given elements (hide everything else).
 *
 * @param {import("@thatopen/components").Hider} hider
 * @param {Record<string, Set<number>>} modelIdMap
 */
export async function applyIsolation(hider, modelIdMap) {
  await hider.isolate(modelIdMap);
}

/**
 * Apply per-class colour highlights using a globalId → hex color map.
 * Groups IDs by colour and creates a separate highlight style for each group.
 *
 * @param {import("@thatopen/components-front").Highlighter} hl
 * @param {import("@thatopen/components").FragmentsManager} fragments
 * @param {string[]} globalIds
 * @param {Record<string, string>} colorMap   { globalId → "#hex" }
 * @param {string} [fallbackColor="#ff6600"]
 */
export async function applyMultiColorHighlight(hl, fragments, globalIds, colorMap, fallbackColor = "#ff6600") {
  const colorGroups = {};
  globalIds.forEach((gid) => {
    const c = colorMap[gid] || fallbackColor;
    if (!colorGroups[c]) colorGroups[c] = [];
    colorGroups[c].push(gid);
  });

  let idx = 0;
  for (const [color, gids] of Object.entries(colorGroups)) {
    const styleName = `filter_${idx}`;
    hl.styles.set(styleName, {
      color: new THREE.Color(color),
      opacity: 1,
      transparent: false,
      renderedFaces: 0,
    });
    const groupMap = await fragments.guidsToModelIdMap(gids);
    if (groupMap && Object.keys(groupMap).length > 0) {
      await hl.highlightByID(styleName, groupMap, false, false);
    }
    idx++;
  }
}

/**
 * Apply a single-colour highlight to the given model-id map.
 *
 * @param {import("@thatopen/components-front").Highlighter} hl
 * @param {Record<string, Set<number>>} modelIdMap
 * @param {string} color           hex colour string
 * @param {boolean} [zoomToFit=true]
 * @param {boolean} [removePrevious=false]
 */
export async function applySingleColorHighlight(hl, modelIdMap, color, zoomToFit = true, removePrevious = false) {
  hl.styles.set("select", {
    color: new THREE.Color(color),
    opacity: 1,
    transparent: false,
    renderedFaces: 0,
  });
  await hl.highlightByID("select", modelIdMap, zoomToFit, removePrevious);
}
