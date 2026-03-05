import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import { useSelection } from "../contexts/SelectionContext";
import { useModelRegistry } from "../contexts/ModelRegistryContext";
import { useIfcHighlighter } from "../lib/useIfcHighlighter";

export default function IfcViewer() {
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  const modelsRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);

  const { filterGlobalIds, isolationMode, setSelectedExpressID, filterColor, filterColorMap, classColorMap } =
    useSelection();

  const { allModelsList, setModelLoaded } = useModelRegistry();

  const guidToExpress = useMemo(() => {
    const m = new Map();
    for (const entry of allModelsList) {
      const d = entry.dashboardData;
      if (!d?.elements) continue;
      for (const el of d.elements) {
        if (el.id) m.set(el.id, { expressId: el.expressId, modelId: entry.id });
      }
    }
    return m;
  }, [allModelsList]);

  const defaultColorInfo = useMemo(() => {
    if (!classColorMap || Object.keys(classColorMap).length === 0) return null;
    const globalIds = [];
    const colorMap = {};
    for (const entry of allModelsList) {
      if (!entry.dashboardData?.elements) continue;
      for (const el of entry.dashboardData.elements) {
        if (el.id) {
          globalIds.push(el.id);
          colorMap[el.id] = classColorMap[el.type] || "#999";
        }
      }
    }
    return globalIds.length > 0 ? { globalIds, colorMap } : null;
  }, [allModelsList, classColorMap]);

  // ─── Initialize That Open engine (once) ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    (async () => {
      const components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      const world = worlds.create();

      world.scene = new OBC.SimpleScene(components);
      world.scene.setup();
      world.scene.three.background = new THREE.Color(0xeef1f5);

      let hasPostprod = false;
      try {
        world.renderer = new OBCF.PostproductionRenderer(components, container);
        hasPostprod = true;
      } catch {
        world.renderer = new OBC.SimpleRenderer(components, container);
      }

      world.camera = new OBC.SimpleCamera(components);

      if (hasPostprod) {
        try { world.renderer.postproduction.enabled = true; } catch (err) {
          console.warn("Postproduction failed:", err);
        }
      }

      const grids = components.get(OBC.Grids);
      grids.create(world);

      const fragments = components.get(OBC.FragmentsManager);
      const workerResp = await fetch("/Worker/worker.mjs");
      const workerBlob = await workerResp.blob();
      const workerFile = new File([workerBlob], "worker.mjs", { type: "text/javascript" });
      const workerUrl = URL.createObjectURL(workerFile);
      fragments.init(workerUrl);

      if (disposed) {
        URL.revokeObjectURL(workerUrl);
        components.dispose();
        return;
      }

      world.camera.controls.addEventListener("update", () => {
        if (fragments.initialized) fragments.core.update();
      });

      fragments.list.onItemSet.add(({ value: model }) => {
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);
        fragments.core.update(true);
      });

      fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
        if (!("isLodMaterial" in material && material.isLodMaterial)) {
          material.polygonOffset = true;
          material.polygonOffsetUnits = 1;
          material.polygonOffsetFactor = Math.random();
        }
      });

      world.onCameraChanged.add((camera) => {
        for (const [, model] of fragments.list) {
          model.useCamera(camera.three);
        }
        fragments.core.update(true);
      });

      const loader = components.get(OBC.IfcLoader);
      await loader.setup({
        autoSetWasm: false,
        wasm: { path: "/", absolute: true },
      });

      if (disposed) {
        URL.revokeObjectURL(workerUrl);
        components.dispose();
        return;
      }

      components.get(OBC.Raycasters).get(world);

      const highlighter = components.get(OBCF.Highlighter);
      highlighter.setup({
        world,
        selectMaterialDefinition: {
          color: new THREE.Color("#ff6600"),
          opacity: 1,
          transparent: false,
          renderedFaces: 0,
        },
      });

      components.init();
      ctxRef.current = { components, world, workerUrl };
      setReady(true);
    })().catch((err) => console.error("That Open init failed:", err));

    return () => {
      disposed = true;
      setReady(false);
      if (ctxRef.current) {
        URL.revokeObjectURL(ctxRef.current.workerUrl);
        ctxRef.current.components.dispose();
        ctxRef.current = null;
      }
      modelsRef.current.clear();
    };
  }, []);

  // ─── Load / dispose / toggle models ───
  useEffect(() => {
    if (!ready || !ctxRef.current) return;
    let cancelled = false;

    const currentIds = new Set(modelsRef.current.keys());
    const incomingEntries = allModelsList.filter((e) => e.dashboardData);
    const incomingIds = new Set(incomingEntries.map((e) => e.id));

    const toRemove = [...currentIds].filter((id) => !incomingIds.has(id));
    const toAdd = incomingEntries.filter((e) => !currentIds.has(e.id));

    if (toRemove.length === 0 && toAdd.length === 0) return;

    (async () => {
      const { components, world } = ctxRef.current;
      const fragments = components.get(OBC.FragmentsManager);

      for (const id of toRemove) {
        const model = modelsRef.current.get(id);
        if (model) {
          try { fragments.core.disposeModel(model.modelId); } catch {
            try {
              world.scene.three.remove(model.object);
              model.dispose();
            } catch {}
          }
        }
        modelsRef.current.delete(id);
      }

      if (toAdd.length === 0 || cancelled) return;

      setLoading(true);
      const loader = components.get(OBC.IfcLoader);
      let loadedCount = 0;

      for (const entry of toAdd) {
        if (cancelled) break;

        setProgress(`Loading ${entry.fileName}…`);
        setProgressPct(Math.round((loadedCount / toAdd.length) * 100));

        try {
          const buf = await entry.file.arrayBuffer();
          if (cancelled) break;

          const model = await loader.load(new Uint8Array(buf), true, entry.fileName, {
            processData: {
              progressCallback: (pct) => {
                if (!cancelled) {
                  const base = (loadedCount / toAdd.length) * 100;
                  const segment = (1 / toAdd.length) * 100;
                  setProgressPct(Math.round(base + pct * segment));
                }
              },
            },
          });

          if (cancelled) {
            try { model.dispose(); } catch {}
            break;
          }

          modelsRef.current.set(entry.id, model);

          const cls = components.get(OBC.Classifier);
          await cls.byCategory();
          try { await cls.byIfcBuildingStorey(); } catch {}

          setModelLoaded(entry.id, true);
          loadedCount++;
        } catch (err) {
          console.error(`IFC load failed for ${entry.fileName}:`, err);
          loadedCount++;
        }
      }

      if (!cancelled) {
        fitCameraToAllModels(world, modelsRef.current);
        setProgress("");
        setProgressPct(100);
        setLoading(false);
        setViewVersion((v) => v + 1);
      }
    })();

    return () => { cancelled = true; };
  }, [ready, allModelsList, setModelLoaded]);

  // ─── Toggle visibility for models ───
  useEffect(() => {
    if (!ready || !ctxRef.current) return;

    for (const entry of allModelsList) {
      const model = modelsRef.current.get(entry.id);
      if (!model?.object) continue;
      model.object.visible = entry.visible;
    }

    setViewVersion((v) => v + 1);
  }, [ready, allModelsList]);

  // ─── Filter / isolation effect ───
  useIfcHighlighter(
    ctxRef.current?.components ?? null,
    ready,
    modelsRef.current,
    { filterGlobalIds, isolationMode, filterColor, filterColorMap },
    viewVersion,
    defaultColorInfo,
  );

  // ─── Click → expressID resolver (multi-model) ───
  useEffect(() => {
    if (!ready || !ctxRef.current) return;
    const { components } = ctxRef.current;
    const hl = components.get(OBCF.Highlighter);

    if (!hl.events?.select) return;

    const onHighlight = async (modelIdMap) => {
      for (const [modelKey, localIds] of Object.entries(modelIdMap)) {
        for (const [entryId, model] of modelsRef.current) {
          if (!model) continue;
          try {
            const guids = model.getGuidsByLocalIds([...localIds]);
            for (const g of guids) {
              const found = guidToExpress.get(g);
              if (found) {
                setSelectedExpressID(found.expressId, found.modelId);
                return;
              }
            }
          } catch {}
        }
      }
      setSelectedExpressID(null);
    };

    const onClear = () => setSelectedExpressID(null);

    hl.events.select.onHighlight.add(onHighlight);
    hl.events.select.onClear.add(onClear);
    return () => {
      try {
        hl.events.select.onHighlight.remove(onHighlight);
        hl.events.select.onClear.remove(onClear);
      } catch {}
    };
  }, [ready, guidToExpress, setSelectedExpressID]);

  return (
    <div ref={containerRef} style={containerStyle}>
      {loading && (
        <div style={overlayStyle}>
          <div className="spinner" />
          <div style={{ marginTop: 12, color: "#333", fontSize: 14 }}>{progress}</div>
          {progressPct > 0 && (
            <div style={barBgStyle}>
              <div style={{ ...barFgStyle, width: `${progressPct}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fitCameraToAllModels(world, modelsMap) {
  try {
    const mergedBox = new THREE.Box3();
    let hasBox = false;
    for (const [, model] of modelsMap) {
      if (model.box && !model.box.isEmpty()) {
        mergedBox.union(model.box);
        hasBox = true;
      }
    }
    if (!hasBox) return;

    const center = mergedBox.getCenter(new THREE.Vector3());
    const size = mergedBox.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z);
    const cc = world.camera.controls;
    if (cc?.setLookAt) {
      cc.setLookAt(
        center.x + d, center.y + d * 0.8, center.z + d,
        center.x, center.y, center.z,
        false
      );
    }
  } catch (err) {
    console.warn("Camera fit:", err);
  }
}

const containerStyle = { width: "100%", height: "100%", position: "relative" };

const overlayStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "rgba(255,255,255,0.95)",
  padding: "24px 40px",
  borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
  zIndex: 100,
  textAlign: "center",
  minWidth: 280,
};

const barBgStyle = {
  marginTop: 8,
  height: 4,
  borderRadius: 2,
  background: "#e5e7eb",
  overflow: "hidden",
};

const barFgStyle = {
  height: "100%",
  borderRadius: 2,
  background: "linear-gradient(90deg, #4f46e5, #06b6d4)",
  transition: "width 0.3s ease",
};
