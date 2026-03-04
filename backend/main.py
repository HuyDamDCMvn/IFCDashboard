from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import ifcopenshell
import ifcopenshell.util.element as element_util
import tempfile
import os

app = FastAPI(title="IFC Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def get_predefined_type(product):
    """Extract PredefinedType, falling back to ObjectType for USERDEFINED."""
    ptype = getattr(product, "PredefinedType", None)
    if ptype == "USERDEFINED":
        return getattr(product, "ObjectType", None) or "USERDEFINED"
    return ptype or ""


def get_export_as(product, schema):
    """Get the effective IFC export class.

    For IFC2x3 legacy types like IfcWallStandardCase, normalize to the
    base type (IfcWall) so charts are consistent across schemas.
    """
    ifc_class = product.is_a()
    ifc2x3_aliases = {
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
    if schema and schema.startswith("IFC2"):
        return ifc2x3_aliases.get(ifc_class, ifc_class)
    return ifc_class


def get_psets(product):
    """Extract all property sets from an IFC product."""
    psets = {}
    for definition in product.IsDefinedBy:
        if definition.is_a("IfcRelDefinesByProperties"):
            pset = definition.RelatingPropertyDefinition
            if pset.is_a("IfcPropertySet"):
                props = {}
                for prop in pset.HasProperties:
                    if prop.is_a("IfcPropertySingleValue") and prop.NominalValue:
                        props[prop.Name] = str(prop.NominalValue.wrappedValue)
                    elif prop.is_a("IfcPropertyEnumeratedValue"):
                        vals = [str(v.wrappedValue) for v in (prop.EnumerationValues or [])]
                        props[prop.Name] = ", ".join(vals)
                if props:
                    psets[pset.Name] = props
            elif pset.is_a("IfcElementQuantity"):
                quants = {}
                for q in pset.Quantities:
                    for attr in ["LengthValue", "AreaValue", "VolumeValue", "WeightValue", "CountValue"]:
                        val = getattr(q, attr, None)
                        if val is not None:
                            quants[q.Name] = round(float(val), 4)
                            break
                if quants:
                    psets[pset.Name] = quants
    return psets


def get_materials(product):
    """Extract material info from an IFC product."""
    materials = []
    if hasattr(product, "HasAssociations"):
        for assoc in product.HasAssociations:
            if assoc.is_a("IfcRelAssociatesMaterial"):
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
    if hasattr(product, "ContainedInStructure"):
        for rel in product.ContainedInStructure:
            structure = rel.RelatingStructure
            if structure.is_a("IfcBuildingStorey"):
                info["storey"] = structure.Name or ""
            elif structure.is_a("IfcBuilding"):
                info["building"] = structure.Name or ""
            elif structure.is_a("IfcSite"):
                info["site"] = structure.Name or ""
    return info


@app.post("/api/parse-ifc")
async def parse_ifc(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        ifc = ifcopenshell.open(tmp_path)
    finally:
        os.unlink(tmp_path)

    # Project info
    project = ifc.by_type("IfcProject")
    project_info = {
        "name": project[0].Name if project else "",
        "description": project[0].Description or "" if project else "",
        "schema": ifc.schema,
    }

    # Building info
    buildings = ifc.by_type("IfcBuilding")
    building_info = []
    for b in buildings:
        building_info.append({
            "name": b.Name or "",
            "description": b.Description or "",
        })

    # Storeys
    storeys = ifc.by_type("IfcBuildingStorey")
    storey_info = []
    for s in storeys:
        storey_info.append({
            "name": s.Name or "",
            "elevation": float(s.Elevation) if s.Elevation else 0,
        })
    storey_info.sort(key=lambda x: x["elevation"])

    schema = ifc.schema  # IFC2X3, IFC4, IFC4X3_ADD2, etc.
    is_ifc4x3 = "IFC4X3" in schema.upper() if schema else False

    # Elements by storey
    storey_breakdown = {}
    for s in storeys:
        name = s.Name or "Unknown"
        storey_breakdown[name] = {}

    # Detailed elements
    elements = []
    summary = {}           # exportAs counts
    predef_summary = {}    # predefinedType counts
    export_predef = {}     # exportAs → { predefinedType → count }

    for product in ifc.by_type("IfcProduct"):
        if product.is_a("IfcOpeningElement"):
            continue

        psets = get_psets(product)
        materials = get_materials(product)
        spatial = get_spatial_info(product)

        export_as = get_export_as(product, schema)
        predef = get_predefined_type(product)

        el = {
            "id": product.GlobalId,
            "expressId": product.id(),
            "type": export_as,
            "rawType": product.is_a(),
            "predefinedType": predef,
            "name": product.Name or "",
            "description": product.Description or "",
            "storey": spatial["storey"],
            "materials": materials,
            "propertySets": psets,
        }
        elements.append(el)

        # Summary by exportAs
        summary[export_as] = summary.get(export_as, 0) + 1

        # Summary by predefinedType
        if predef:
            label = f"{export_as}.{predef}"
            predef_summary[label] = predef_summary.get(label, 0) + 1

        # Cross-tab: exportAs → predefinedType breakdown
        if export_as not in export_predef:
            export_predef[export_as] = {}
        pt_key = predef or "(none)"
        export_predef[export_as][pt_key] = export_predef[export_as].get(pt_key, 0) + 1

        # Storey breakdown
        storey_name = spatial["storey"] or "Unassigned"
        if storey_name not in storey_breakdown:
            storey_breakdown[storey_name] = {}
        storey_breakdown[storey_name][export_as] = storey_breakdown[storey_name].get(export_as, 0) + 1

    # Material summary
    material_counts = {}
    for el in elements:
        for mat in el["materials"]:
            mat_name = mat.split(" (")[0]
            material_counts[mat_name] = material_counts.get(mat_name, 0) + 1

    # Schema capabilities
    schema_info = {
        "schema": schema,
        "isIfc4x3": is_ifc4x3,
        "hasStoreys": len(storeys) > 0,
        "hasMaterials": len(material_counts) > 0,
        "hasInfraTypes": is_ifc4x3 and any(
            t in summary for t in IFC4X3_INFRA_TYPES
        ),
    }

    return {
        "project": project_info,
        "buildings": building_info,
        "storeys": storey_info,
        "summary": summary,
        "predefinedTypeSummary": predef_summary,
        "exportPredefinedBreakdown": export_predef,
        "storeyBreakdown": storey_breakdown,
        "materialSummary": material_counts,
        "schemaInfo": schema_info,
        "totalElements": len(elements),
        "elements": elements,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
