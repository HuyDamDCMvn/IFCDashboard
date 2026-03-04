import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadIfcModel } from "../utils/ifcLoader";

export default function IfcViewer({ ifcFile, onElementSelect, onModelLoaded }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const modelRef = useRef(null);
  const selectedRef = useRef(null);
  const originalMaterialRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const highlightMaterial = useRef(
    new THREE.MeshPhongMaterial({
      color: 0xff6600,
      emissive: 0x331100,
      side: THREE.DoubleSide,
    })
  );

  const initScene = useCallback(() => {
    if (!containerRef.current || rendererRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.set(30, 30, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3);
    scene.add(hemiLight);

    const gridHelper = new THREE.GridHelper(200, 50, 0xdddddd, 0xeeeeee);
    scene.add(gridHelper);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  useEffect(() => {
    if (!ifcFile || !sceneRef.current) return;

    const loadModel = async () => {
      setLoading(true);
      setProgress("Reading file...");

      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }

      try {
        const buffer = await ifcFile.arrayBuffer();
        setProgress("Parsing IFC geometry...");
        const { group } = await loadIfcModel(buffer);

        sceneRef.current.add(group);
        modelRef.current = group;

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        cameraRef.current.position.set(
          center.x + maxDim,
          center.y + maxDim * 0.8,
          center.z + maxDim
        );
        controlsRef.current.target.copy(center);
        controlsRef.current.update();

        if (onModelLoaded) onModelLoaded();
        setProgress("");
      } catch (err) {
        console.error("Failed to load IFC model:", err);
        setProgress("Error loading model: " + err.message);
      }
      setLoading(false);
    };

    loadModel();
  }, [ifcFile, onModelLoaded]);

  const handleClick = useCallback(
    (event) => {
      if (!modelRef.current || !containerRef.current) return;

      if (selectedRef.current && originalMaterialRef.current) {
        selectedRef.current.material = originalMaterialRef.current;
        selectedRef.current = null;
        originalMaterialRef.current = null;
      }

      const container = containerRef.current;
      const bounds = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(
        modelRef.current.children,
        true
      );

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        originalMaterialRef.current = hit.material;
        selectedRef.current = hit;
        hit.material = highlightMaterial.current;

        if (onElementSelect) {
          onElementSelect(hit.userData);
        }
      }
    },
    [onElementSelect]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [handleClick]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div
          style={{
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
          }}
        >
          <div className="spinner" />
          <div style={{ marginTop: 12, color: "#333", fontSize: 14 }}>
            {progress}
          </div>
        </div>
      )}
    </div>
  );
}
