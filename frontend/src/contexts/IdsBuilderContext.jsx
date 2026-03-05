import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { createEmptyIds, createEmptySpec, createEmptyFacet, newUUID, IFC_VERSIONS } from "../lib/ids-constants";

const IdsBuilderContext = createContext(null);

const STORAGE_KEY = "ids-builder-doc";

const VERSION_MIGRATION = { "IFC4X3": "IFC4X3_ADD2" };

function migrateDoc(doc) {
  if (!doc) return doc;
  (doc.specifications || []).forEach(s => {
    if (Array.isArray(s.ifcVersion)) {
      s.ifcVersion = [...new Set(
        s.ifcVersion.map(v => VERSION_MIGRATION[v] || v)
      )].filter(v => IFC_VERSIONS.includes(v));
      if (s.ifcVersion.length === 0) s.ifcVersion = ["IFC4"];
    }
  });
  return doc;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateDoc(JSON.parse(raw)) : null;
  } catch { return null; }
}

function persist(doc) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); } catch {}
}

export function IdsBuilderProvider({ children }) {
  const [idsDoc, setIdsDoc] = useState(() => loadSaved() || createEmptyIds());
  const [selectedSpecId, setSelectedSpecId] = useState(() => {
    const saved = loadSaved();
    return saved?.specifications?.[0]?.id || idsDoc.specifications[0]?.id || null;
  });
  const [isDirty, setDirty] = useState(false);
  const [previewXml, setPreviewXml] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [validationStatus, setValidationStatus] = useState("idle");

  const update = useCallback((updater) => {
    setIdsDoc(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      setDirty(true);
      return next;
    });
  }, []);

  const updateInfo = useCallback((patch) => {
    update(prev => ({ ...prev, info: { ...prev.info, ...patch } }));
  }, [update]);

  const addSpecification = useCallback(() => {
    const spec = createEmptySpec();
    update(prev => ({
      ...prev,
      specifications: [...prev.specifications, spec],
    }));
    setSelectedSpecId(spec.id);
    return spec.id;
  }, [update]);

  const removeSpecification = useCallback((specId) => {
    update(prev => {
      const specs = prev.specifications.filter(s => s.id !== specId);
      return { ...prev, specifications: specs };
    });
    setSelectedSpecId(prev => prev === specId
      ? idsDoc.specifications.find(s => s.id !== specId)?.id || null
      : prev
    );
  }, [update, idsDoc.specifications]);

  const duplicateSpecification = useCallback((specId) => {
    update(prev => {
      const src = prev.specifications.find(s => s.id === specId);
      if (!src) return prev;
      const clone = JSON.parse(JSON.stringify(src));
      clone.id = newUUID();
      clone.name = `${src.name} (copy)`;
      clone.applicability.forEach(f => { f.id = newUUID(); });
      clone.requirements.forEach(f => { f.id = newUUID(); });
      const idx = prev.specifications.findIndex(s => s.id === specId);
      const specs = [...prev.specifications];
      specs.splice(idx + 1, 0, clone);
      return { ...prev, specifications: specs };
    });
  }, [update]);

  const updateSpecification = useCallback((specId, patch) => {
    update(prev => ({
      ...prev,
      specifications: prev.specifications.map(s =>
        s.id === specId ? { ...s, ...patch } : s
      ),
    }));
  }, [update]);

  const addFacet = useCallback((specId, section, facetType) => {
    const facet = createEmptyFacet(facetType);
    update(prev => ({
      ...prev,
      specifications: prev.specifications.map(s => {
        if (s.id !== specId) return s;
        return { ...s, [section]: [...s[section], facet] };
      }),
    }));
    return facet.id;
  }, [update]);

  const updateFacet = useCallback((specId, section, facetId, patch) => {
    update(prev => ({
      ...prev,
      specifications: prev.specifications.map(s => {
        if (s.id !== specId) return s;
        return {
          ...s,
          [section]: s[section].map(f =>
            f.id === facetId ? { ...f, ...patch } : f
          ),
        };
      }),
    }));
  }, [update]);

  const updateFacetParams = useCallback((specId, section, facetId, paramsPatch) => {
    update(prev => ({
      ...prev,
      specifications: prev.specifications.map(s => {
        if (s.id !== specId) return s;
        return {
          ...s,
          [section]: s[section].map(f =>
            f.id === facetId ? { ...f, params: { ...f.params, ...paramsPatch } } : f
          ),
        };
      }),
    }));
  }, [update]);

  const removeFacet = useCallback((specId, section, facetId) => {
    update(prev => ({
      ...prev,
      specifications: prev.specifications.map(s => {
        if (s.id !== specId) return s;
        return { ...s, [section]: s[section].filter(f => f.id !== facetId) };
      }),
    }));
  }, [update]);

  const resetDocument = useCallback(() => {
    const doc = createEmptyIds();
    setIdsDoc(doc);
    persist(doc);
    setSelectedSpecId(doc.specifications[0]?.id || null);
    setDirty(false);
    setPreviewXml(null);
    setValidationResults(null);
  }, []);

  const loadDocument = useCallback((doc) => {
    migrateDoc(doc);
    doc.specifications.forEach(s => {
      if (!s.id) s.id = newUUID();
      (s.applicability || []).forEach(f => { if (!f.id) f.id = newUUID(); });
      (s.requirements || []).forEach(f => { if (!f.id) f.id = newUUID(); });
    });
    setIdsDoc(doc);
    persist(doc);
    setSelectedSpecId(doc.specifications[0]?.id || null);
    setDirty(false);
  }, []);

  const selectedSpec = useMemo(
    () => idsDoc.specifications.find(s => s.id === selectedSpecId) || null,
    [idsDoc.specifications, selectedSpecId]
  );

  return (
    <IdsBuilderContext.Provider value={{
      idsDoc,
      selectedSpecId,
      selectedSpec,
      isDirty,
      previewXml,
      validationResults,
      validationStatus,
      setSelectedSpecId,
      setPreviewXml,
      setValidationResults,
      setValidationStatus,
      updateInfo,
      addSpecification,
      removeSpecification,
      duplicateSpecification,
      updateSpecification,
      addFacet,
      updateFacet,
      updateFacetParams,
      removeFacet,
      resetDocument,
      loadDocument,
    }}>
      {children}
    </IdsBuilderContext.Provider>
  );
}

export function useIdsBuilder() {
  const ctx = useContext(IdsBuilderContext);
  if (!ctx) throw new Error("useIdsBuilder must be used within IdsBuilderProvider");
  return ctx;
}
