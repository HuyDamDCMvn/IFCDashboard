/**
 * ids-constants.js — IFC entity types, data types, common property sets,
 * and IDS facet metadata for the IDS Builder UI.
 */

export const IFC_VERSIONS = ["IFC2X3", "IFC4", "IFC4X3_ADD2"];

export const IFC_ENTITIES = [
  // Abstract parent types (commonly used in IDS applicability)
  "IFCPRODUCT", "IFCELEMENT",
  "IFCBUILDINGELEMENT", "IFCDISTRIBUTIONELEMENT",
  // Architectural
  "IFCWALL", "IFCWALLSTANDARDCASE", "IFCSLAB", "IFCCOLUMN", "IFCBEAM",
  "IFCDOOR", "IFCWINDOW", "IFCROOF", "IFCSTAIR", "IFCSTAIRFLIGHT",
  "IFCRAMP", "IFCRAMPFLIGHT", "IFCRAILING", "IFCCURTAINWALL",
  "IFCPLATE", "IFCMEMBER", "IFCFOOTING", "IFCPILE",
  "IFCBUILDINGELEMENTPROXY", "IFCOPENINGELEMENT",
  "IFCFURNISHINGELEMENT", "IFCCOVERING", "IFCCHIMNEY",
  // MEP — Distribution
  "IFCDISTRIBUTIONFLOWELEMENT", "IFCDISTRIBUTIONCONTROLELEMENT",
  "IFCDISTRIBUTIONCHAMBER",
  "IFCFLOWSEGMENT", "IFCFLOWTERMINAL",
  "IFCFLOWFITTING", "IFCFLOWCONTROLLER", "IFCFLOWMOVINGDEVICE",
  "IFCFLOWSTORAGEDEVICE", "IFCFLOWTREATMENTDEVICE",
  "IFCENERGYCONVERSIONDEVICE",
  "IFCUNITARYEQUIPMENT", "IFCFIRESUPPRESSIONTERMINAL",
  "IFCSANITARYTERMINAL", "IFCWASTETERMINAL", "IFCSTACKTERMINAL",
  "IFCAIRTERMINALMOVINGDEVICE", "IFCAIRTERMINAL",
  // Spatial
  "IFCSPACE", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY",
  // IFC4x3 Infrastructure
  "IFCALIGNMENT", "IFCROAD", "IFCBRIDGE", "IFCRAILWAY",
  "IFCFACILITY", "IFCFACILITYPART",
];

export const IFC_DATA_TYPES = [
  "IFCLABEL", "IFCTEXT", "IFCIDENTIFIER",
  "IFCBOOLEAN", "IFCLOGICAL",
  "IFCINTEGER", "IFCREAL", "IFCCOUNTMEASURE",
  "IFCLENGTHMEASURE", "IFCAREAMEASURE", "IFCVOLUMEMEASURE",
  "IFCMASSMEASURE", "IFCFORCEMEASURE", "IFCPRESSUREMEASURE",
  "IFCTHERMALTRANSMITTANCEMEASURE", "IFCTHERMALRESISTANCEMEASURE",
  "IFCPOSITIVERATIOMEASURE", "IFCRATIOMEASURE",
  "IFCPOSITIVELENGTHMEASURE", "IFCPLANEANGLEMEASURE",
  "IFCMOMENTOFINERTIAMEASURE", "IFCSECTIONMODULUSMEASURE",
];

export const IFC_ATTRIBUTES = [
  "Name", "Description", "ObjectType", "Tag",
  "LongName", "GlobalId", "PredefinedType",
];

export const COMMON_PSETS = {
  Pset_WallCommon: ["IsExternal", "LoadBearing", "FireRating", "ThermalTransmittance", "Reference", "AcousticRating", "Combustible", "SurfaceSpreadOfFlame", "ExtendToStructure"],
  Pset_SlabCommon: ["IsExternal", "LoadBearing", "FireRating", "ThermalTransmittance", "Reference", "AcousticRating", "Combustible", "SurfaceSpreadOfFlame", "PitchAngle"],
  Pset_ColumnCommon: ["IsExternal", "LoadBearing", "FireRating", "Reference", "Slope"],
  Pset_BeamCommon: ["IsExternal", "LoadBearing", "FireRating", "Reference", "Slope", "Span"],
  Pset_DoorCommon: ["IsExternal", "FireRating", "Reference", "AcousticRating", "SecurityRating", "FireExit", "SelfClosing", "SmokeStop", "HandicapAccessible"],
  Pset_WindowCommon: ["IsExternal", "FireRating", "Reference", "AcousticRating", "SecurityRating", "ThermalTransmittance", "GlazingAreaFraction", "SmokeStop"],
  Pset_RoofCommon: ["IsExternal", "FireRating", "Reference", "TotalArea", "ProjectedArea"],
  Pset_StairCommon: ["IsExternal", "FireRating", "Reference", "FireExit", "HandicapAccessible", "NumberOfRiser", "NumberOfTreads"],
  Pset_SpaceCommon: ["IsExternal", "Reference", "GrossPlannedArea", "NetPlannedArea", "PubliclyAccessible", "HandicapAccessible"],
  Pset_BuildingCommon: ["BuildingID", "IsPermanentID", "YearOfConstruction", "NumberOfStoreys"],
  Qto_WallBaseQuantities: ["Length", "Height", "Width", "GrossFootprintArea", "NetFootprintArea", "GrossSideArea", "NetSideArea", "GrossVolume", "NetVolume"],
  Qto_SlabBaseQuantities: ["Width", "Length", "Depth", "Perimeter", "GrossArea", "NetArea", "GrossVolume", "NetVolume"],
  Qto_ColumnBaseQuantities: ["Length", "CrossSectionArea", "OuterSurfaceArea", "GrossSurfaceArea", "NetSurfaceArea", "GrossVolume", "NetVolume"],
  Qto_BeamBaseQuantities: ["Length", "CrossSectionArea", "OuterSurfaceArea", "GrossSurfaceArea", "NetSurfaceArea", "GrossVolume", "NetVolume"],
  Qto_SpaceBaseQuantities: ["Height", "FinishCeilingHeight", "FinishFloorHeight", "GrossPerimeter", "NetPerimeter", "GrossFloorArea", "NetFloorArea", "GrossVolume", "NetVolume"],
};

export const FACET_TYPES = [
  { key: "entity", label: "Entity", icon: "\u25A0", desc: "Filter by IFC class and predefined type" },
  { key: "attribute", label: "Attribute", icon: "\u2630", desc: "Require specific attribute values" },
  { key: "property", label: "Property", icon: "\u2261", desc: "Require property set values" },
  { key: "classification", label: "Classification", icon: "\u2637", desc: "Require classification reference" },
  { key: "material", label: "Material", icon: "\u25C8", desc: "Require material assignment" },
  { key: "partOf", label: "Part Of", icon: "\u2B21", desc: "Require spatial/aggregation relationship" },
];

export const CARDINALITIES = [
  { key: "required", label: "Required", desc: "Must be present" },
  { key: "optional", label: "Optional", desc: "May be present" },
  { key: "prohibited", label: "Prohibited", desc: "Must not be present" },
];

export const RESTRICTION_TYPES = [
  { key: "enumeration", label: "Enumeration", desc: "One of specific values" },
  { key: "pattern", label: "Pattern", desc: "Regex pattern match" },
  { key: "bounds", label: "Range", desc: "Min/max bounds (inclusive or exclusive)" },
  { key: "length", label: "Length", desc: "String length constraint (exact, min, max)" },
];

export const IDS_PURPOSES = [
  "quantity take-off", "cost estimation", "clash detection",
  "coordination", "code compliance", "accessibility analysis",
  "energy analysis", "facility management", "asset management",
  "construction planning", "sustainability assessment",
];

export const IDS_MILESTONES = [
  "Concept Design", "Schematic Design", "Detailed Design",
  "Construction Documentation", "Construction", "Commissioning",
  "As-built", "Operation", "Renovation",
  "RIBA Stage 1", "RIBA Stage 2", "RIBA Stage 3",
  "RIBA Stage 4", "RIBA Stage 5", "RIBA Stage 6", "RIBA Stage 7",
  "LOD 100", "LOD 200", "LOD 300", "LOD 350", "LOD 400", "LOD 500",
];

export const XS_BASE_TYPES = [
  "xs:string", "xs:integer", "xs:decimal", "xs:double",
  "xs:float", "xs:boolean", "xs:date", "xs:dateTime", "xs:duration",
];

export const PARTOF_RELATIONS = [
  "IFCRELAGGREGATES",
  "IFCRELCONTAINEDINSPATIALSTRUCTURE",
  "IFCRELASSIGNSTOGROUP",
  "IFCRELVOIDSELEMENT",
  "IFCRELFILLSELEMENT",
  "IFCRELNESTS",
];

export const SPATIAL_ENTITIES = [
  "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY",
  "IFCSPACE", "IFCFACILITY", "IFCFACILITYPART",
];

export function newUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyFacet(type) {
  const base = { id: newUUID(), type, cardinality: "required", instructions: "" };
  switch (type) {
    case "entity":
      return { ...base, params: { name: "IFCWALL", predefinedType: "" } };
    case "attribute":
      return { ...base, params: { name: "Name", value: "" } };
    case "property":
      return { ...base, params: { propertySet: "", baseName: "", dataType: "", value: "", uri: "" } };
    case "classification":
      return { ...base, params: { system: "", value: "", uri: "" } };
    case "material":
      return { ...base, params: { value: "", uri: "" } };
    case "partOf":
      return { ...base, params: { name: "IFCBUILDINGSTOREY", predefinedType: "", relation: "IFCRELCONTAINEDINSPATIALSTRUCTURE" } };
    default:
      return base;
  }
}

export function createEmptySpec() {
  return {
    id: newUUID(),
    name: "New Specification",
    identifier: "",
    description: "",
    ifcVersion: ["IFC4"],
    instructions: "",
    minOccurs: 1,
    maxOccurs: "unbounded",
    applicability: [createEmptyFacet("entity")],
    requirements: [],
  };
}

export function createEmptyIds() {
  return {
    info: {
      title: "Untitled IDS",
      copyright: "",
      version: "1.0",
      author: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      purpose: "",
      milestone: "",
    },
    specifications: [createEmptySpec()],
  };
}
