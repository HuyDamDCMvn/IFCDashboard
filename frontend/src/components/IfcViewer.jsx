import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import { useSelection } from "../contexts/SelectionContext";

export default function IfcViewer({ ifcFile, dashboardData }) {
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  const modelRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [ready, setReady] = useState(false);

  const { filterGlobalIds, isolationMode, setSelectedExpressID } =
    useSelection();

  const guidToExpress = useMemo(() => {
    const m = new Map();
    if (dashboardData?.elements) {
      for (const el of dashboardData.elements) {
        if (el.id) m.set(el.id, el.expressId);
      }
    }
    return m;
  }, [dashboardData]);

  // ─── Initialize That Open engine ───
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
        world.renderer = new OBCF.PostproductionRenderer(
          components,
          container
        );
        hasPostprod = true;
      } catch {
        world.renderer = new OBC.SimpleRenderer(components, container);
      }

      world.camera = new OBC.SimpleCamera(components);

      if (hasPostprod) {
        try {
          world.renderer.postproduction.enabled = true;
        } catch (err) {
          console.warn("Postproduction failed:", err);
        }
      }

      const grids = components.get(OBC.Grids);
      grids.create(world);

      // FragmentsManager: fetch worker as blob URL to avoid CORS issues
      const fragments = components.get(OBC.FragmentsManager);
      const workerResp = await fetch("/Worker/worker.mjs");
      const workerBlob = await workerResp.blob();
      const workerFile = new File([workerBlob], "worker.mjs", {
        type: "text/javascript",
      });
      const workerUrl = URL.createObjectURL(workerFile);
      fragments.init(workerUrl);

      if (disposed) {
        URL.revokeObjectURL(workerUrl);
        components.dispose();
        return;
      }

      // Camera movement triggers tile refresh
      world.camera.controls.addEventListener("update", () => {
        if (fragments.initialized) fragments.core.update();
      });

      // When a model loads, connect it to the camera and scene
      fragments.list.onItemSet.add(({ value: model }) => {
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);
        fragments.core.update(true);
      });

      // Reduce z-fighting on fragment materials
      fragments.core.models.materials.list.onItemSet.add(
        ({ value: material }) => {
          if (!("isLodMaterial" in material && material.isLodMaterial)) {
            material.polygonOffset = true;
            material.polygonOffsetUnits = 1;
            material.polygonOffsetFactor = Math.random();
          }
        }
      );

      // Camera change handler (multi-viewport ready)
      world.onCameraChanged.add((camera) => {
        for (const [, model] of fragments.list) {
          model.useCamera(camera.three);
        }
        fragments.core.update(true);
      });

      // IfcLoader with local WASM (buildingSMART compatible)
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

      // Raycasters must be created before Highlighter (ThatOpen pattern)
      components.get(OBC.Raycasters).get(world);

      // Highlighter with selection material
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
      modelRef.current = null;
    };
  }, []);

  // ─── Load IFC model ───
  useEffect(() => {
    if (!ifcFile || !ready || !ctxRef.current) return;
    let cancelled = false;

    (async () => {
      const { components, world } = ctxRef.current;
      setLoading(true);
      setProgress("Reading file…");
      setProgressPct(0);

      // Dispose previous via FragmentsManager (ThatOpen pattern)
      const fragments = components.get(OBC.FragmentsManager);
      if (modelRef.current) {
        try {
          fragments.core.disposeModel(modelRef.current.modelId);
        } catch {
          try {
            world.scene.three.remove(modelRef.current.object);
            modelRef.current.dispose();
          } catch {}
        }
        modelRef.current = null;
      }

      try {
        const buf = await ifcFile.arrayBuffer();
        if (cancelled) return;

        setProgress("Parsing IFC geometry…");
        setProgressPct(30);

        const loader = components.get(OBC.IfcLoader);
        const model = await loader.load(new Uint8Array(buf), true, ifcFile.name, {
          processData: {
            progressCallback: (pct) => {
              if (!cancelled) {
                setProgressPct(30 + Math.round(pct * 50));
              }
            },
          },
        });

        if (cancelled) {
          try { model.dispose(); } catch {}
          return;
        }

        modelRef.current = model;

        setProgress("Classifying elements…");
        setProgressPct(80);

        const cls = components.get(OBC.Classifier);
        await cls.byCategory();
        try { await cls.byIfcBuildingStorey(); } catch {}

        // Fit camera
        try {
          const box = model.box;
          if (box && !box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const d = Math.max(size.x, size.y, size.z);
            const cc = world.camera.controls;
            if (cc?.setLookAt) {
              cc.setLookAt(
                center.x + d, center.y + d * 0.8, center.z + d,
                center.x, center.y, center.z,
                false
              );
            }
          }
        } catch (err) {
          console.warn("Camera fit:", err);
        }

        setProgress("");
        setProgressPct(100);
      } catch (err) {
        if (!cancelled) {
          console.error("IFC load failed:", err);
          setProgress("Error: " + err.message);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [ifcFile, ready]);

  // ─── Filter / isolation effect ───
  useEffect(() => {
    if (!ready || !ctxRef.current || !modelRef.current) return;
    const { components } = ctxRef.current;

    (async () => {
      const fragments = components.get(OBC.FragmentsManager);
      const hider = components.get(OBC.Hider);
      const hl = components.get(OBCF.Highlighter);

      try { await hl.clear("select"); } catch {}
      try { await hider.set(true); } catch {}

      if (!filterGlobalIds?.length) return;

      try {
        const map = await fragments.guidsToModelIdMap(filterGlobalIds);
        if (!map || Object.keys(map).length === 0) {
          console.warn("guidsToModelIdMap returned empty — GUID format mismatch?");
          return;
        }

        switch (isolationMode) {
          case "highlight":
            await hl.highlightByID("select", map, true, true);
            break;
          case "isolate":
            await hl.clear("select");
            await hider.isolate(map);
            break;
          case "xray":
            await hider.isolate(map);
            await hl.highlightByID("select", map, true, false);
            break;
        }
      } catch (err) {
        console.error("Filter error:", err);
      }
    })();
  }, [filterGlobalIds, isolationMode, ready]);

  // ─── Click → expressID resolver ───
  useEffect(() => {
    if (!ready || !ctxRef.current) return;
    const { components } = ctxRef.current;
    const hl = components.get(OBCF.Highlighter);

    if (!hl.events?.select) return;

    const onHighlight = async (modelIdMap) => {
      const model = modelRef.current;
      if (!model) { setSelectedExpressID(null); return; }
      for (const localIds of Object.values(modelIdMap)) {
        try {
          const guids = model.getGuidsByLocalIds([...localIds]);
          for (const g of guids) {
            const eid = guidToExpress.get(g);
            if (eid != null) { setSelectedExpressID(eid); return; }
          }
        } catch {}
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
          <div style={{ marginTop: 12, color: "#333", fontSize: 14 }}>
            {progress}
          </div>
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
