"""Reusable IFC element inspection utilities.

Pure functions — no FastAPI, no HTTP. Only depends on ifcopenshell.
"""

import ifcopenshell.util.element

IFC4X3_INFRA_TYPES = {
    "IfcAlignment", "IfcAlignmentCant", "IfcAlignmentHorizontal",
    "IfcAlignmentVertical", "IfcAlignmentSegment",
    "IfcCourse", "IfcPavement", "IfcKerb",
    "IfcRailway", "IfcRoad", "IfcBridge", "IfcBridgePart",
    "IfcFacility", "IfcFacilityPart", "IfcFacilityPartCommon",
    "IfcMarineFacility", "IfcNavigationElement",
    "IfcLinearElement", "IfcReferent",
    "IfcEarthworksCut", "IfcEarthworksFill", "IfcEarthworksElement",
    "IfcGeomodel", "IfcGeotechnicalStratum", "IfcBorehole",
    "IfcDeepFoundation", "IfcCaissonFoundation",
    "IfcSignal", "IfcSign",
    "IfcMobileTelecommunicationsAppliance",
    "IfcDistributionBoard",
}

_IFC2X3_ALIASES = {
    "IfcWallStandardCase": "IfcWall",
    "IfcSlabStandardCase": "IfcSlab",
    "IfcDoorStandardCase": "IfcDoor",
    "IfcWindowStandardCase": "IfcWindow",
    "IfcColumnStandardCase": "IfcColumn",
    "IfcBeamStandardCase": "IfcBeam",
    "IfcMemberStandardCase": "IfcMember",
    "IfcPlateStandardCase": "IfcPlate",
    "IfcOpeningStandardCase": "IfcOpeningElement",
}


def get_predefined_type(product):
    """Extract PredefinedType, falling back to ObjectType for USERDEFINED."""
    ptype = getattr(product, "PredefinedType", None)
    if ptype == "USERDEFINED":
        return getattr(product, "ObjectType", None) or "USERDEFINED"
    return ptype or ""


def get_export_as(product, schema):
    """Normalize IFC2x3 StandardCase types to base type for consistent charts."""
    ifc_class = product.is_a()
    if schema and schema.startswith("IFC2"):
        return _IFC2X3_ALIASES.get(ifc_class, ifc_class)
    return ifc_class


def get_psets(product):
    """Unified property-set extraction via ifcopenshell utilities.

    Returns {psetName: {propName: value, ...}, ...} with internal 'id' keys
    stripped.  Values keep their native Python types (str, int, float).
    """
    try:
        raw = ifcopenshell.util.element.get_psets(product, psets_only=True)
    except Exception:
        raw = {}
    try:
        qtos = ifcopenshell.util.element.get_psets(product, qtos_only=True)
        raw.update(qtos)
    except Exception:
        pass

    result = {}
    for pset_name, props in raw.items():
        cleaned = {k: v for k, v in props.items() if k != "id"}
        if cleaned:
            result[pset_name] = cleaned
    return result


def get_psets_for_display(product):
    """Like get_psets but coerces all values to strings (for JSON parse-ifc)."""
    psets = get_psets(product)
    return {
        pn: {k: str(v) if v is not None else "" for k, v in props.items()}
        for pn, props in psets.items()
    }


def get_materials(product):
    """Extract material info from an IFC product."""
    materials = []
    if not hasattr(product, "HasAssociations"):
        return materials
    for assoc in product.HasAssociations:
        if not assoc.is_a("IfcRelAssociatesMaterial"):
            continue
        mat = assoc.RelatingMaterial
        if mat.is_a("IfcMaterial"):
            materials.append(mat.Name)
        elif mat.is_a("IfcMaterialLayerSetUsage"):
            for layer in mat.ForLayerSet.MaterialLayers:
                name = layer.Material.Name if layer.Material else "Unknown"
                materials.append(f"{name} ({round(layer.LayerThickness, 2)}mm)")
        elif mat.is_a("IfcMaterialLayerSet"):
            for layer in mat.MaterialLayers:
                name = layer.Material.Name if layer.Material else "Unknown"
                materials.append(f"{name} ({round(layer.LayerThickness, 2)}mm)")
        elif mat.is_a("IfcMaterialList"):
            for m in mat.Materials:
                materials.append(m.Name)
    return materials


def get_spatial_info(product):
    """Get the storey/building/site the element belongs to."""
    info = {"storey": "", "building": "", "site": ""}
    if not hasattr(product, "ContainedInStructure"):
        return info
    for rel in product.ContainedInStructure:
        structure = rel.RelatingStructure
        if structure.is_a("IfcBuildingStorey"):
            info["storey"] = structure.Name or ""
        elif structure.is_a("IfcBuilding"):
            info["building"] = structure.Name or ""
        elif structure.is_a("IfcSite"):
            info["site"] = structure.Name or ""
    return info
