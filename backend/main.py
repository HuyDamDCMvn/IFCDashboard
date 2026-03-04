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

TRACKED_TYPES = [
    "IfcWall", "IfcWallStandardCase",
    "IfcSlab",
    "IfcColumn",
    "IfcBeam",
    "IfcDoor",
    "IfcWindow",
    "IfcStair", "IfcStairFlight",
    "IfcRoof",
    "IfcRailing",
    "IfcCurtainWall",
    "IfcPlate",
    "IfcMember",
    "IfcFooting",
    "IfcPile",
    "IfcBuildingElementProxy",
    "IfcFurnishingElement",
    "IfcFlowTerminal",
    "IfcFlowSegment",
    "IfcFlowFitting",
    "IfcDistributionPort",
    "IfcSpace",
]


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

    # Summary count by type
    summary = {}
    for entity_type in TRACKED_TYPES:
        count = len(ifc.by_type(entity_type))
        if count > 0:
            summary[entity_type] = count

    # Elements by storey
    storey_breakdown = {}
    for s in storeys:
        name = s.Name or "Unknown"
        storey_breakdown[name] = {}

    # Detailed elements
    elements = []
    for product in ifc.by_type("IfcProduct"):
        if product.is_a("IfcOpeningElement"):
            continue

        psets = get_psets(product)
        materials = get_materials(product)
        spatial = get_spatial_info(product)

        el = {
            "id": product.GlobalId,
            "expressId": product.id(),
            "type": product.is_a(),
            "name": product.Name or "",
            "description": product.Description or "",
            "storey": spatial["storey"],
            "materials": materials,
            "propertySets": psets,
        }
        elements.append(el)

        storey_name = spatial["storey"] or "Unassigned"
        if storey_name not in storey_breakdown:
            storey_breakdown[storey_name] = {}
        etype = product.is_a()
        storey_breakdown[storey_name][etype] = storey_breakdown[storey_name].get(etype, 0) + 1

    # Material summary
    material_counts = {}
    for el in elements:
        for mat in el["materials"]:
            mat_name = mat.split(" (")[0]
            material_counts[mat_name] = material_counts.get(mat_name, 0) + 1

    return {
        "project": project_info,
        "buildings": building_info,
        "storeys": storey_info,
        "summary": summary,
        "storeyBreakdown": storey_breakdown,
        "materialSummary": material_counts,
        "totalElements": len(elements),
        "elements": elements,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
