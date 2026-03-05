from fastapi import FastAPI, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import ifcopenshell
import ifcopenshell.util.element as element_util
import tempfile
import os
import json
from uuid import uuid4
from datetime import date

try:
    from ifctester import ids as ifctester_ids
    HAS_IFCTESTER = True
except ImportError:
    HAS_IFCTESTER = False

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
async def parse_ifc(file: UploadFile = File(...), model_id: str = Form(None)):
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
        "modelId": model_id or str(uuid4()),
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
    return {"status": "ok", "ifctester": HAS_IFCTESTER}


# ─── IDS Builder Endpoints ────────────────────────────────────────

def _build_restriction(val_def):
    """Convert a JSON restriction/value to ifctester-compatible form."""
    if not val_def:
        return None
    if isinstance(val_def, str):
        return val_def if val_def else None
    if isinstance(val_def, dict) and val_def.get("type"):
        from ifctester.facet import Restriction
        r = Restriction()
        r.base = val_def.get("base", "xs:string")
        rtype = val_def["type"]
        if rtype == "enumeration":
            r.options = {"enumeration": val_def.get("values", [])}
        elif rtype == "pattern":
            r.options = {"pattern": val_def.get("pattern", "")}
        elif rtype == "bounds":
            opts = {}
            for k in ("minInclusive", "maxInclusive", "minExclusive", "maxExclusive"):
                if val_def.get(k) not in (None, ""):
                    opts[k] = val_def[k]
            r.options = opts
        elif rtype == "length":
            opts = {}
            if val_def.get("length") not in (None, ""):
                opts["length"] = val_def["length"]
            if val_def.get("minLength") not in (None, ""):
                opts["minLength"] = val_def["minLength"]
            if val_def.get("maxLength") not in (None, ""):
                opts["maxLength"] = val_def["maxLength"]
            r.options = opts
        return r
    return None


def _resolve_param(val):
    """Resolve a facet param that may be a simple string or a restriction dict."""
    if isinstance(val, dict) and val.get("type"):
        return _build_restriction(val)
    if isinstance(val, str):
        return val if val else None
    return None


def _build_facet(fdef):
    """Convert a JSON facet definition to an ifctester facet object."""
    t = fdef["type"]
    p = fdef.get("params", {})
    card = fdef.get("cardinality", "required")
    instr = fdef.get("instructions") or None

    if t == "entity":
        return ifctester_ids.Entity(
            name=_resolve_param(p.get("name")) or "IFCWALL",
            predefinedType=_resolve_param(p.get("predefinedType")),
            instructions=instr,
        )
    elif t == "attribute":
        return ifctester_ids.Attribute(
            name=_resolve_param(p.get("name")) or "Name",
            value=_build_restriction(p.get("value")),
            cardinality=card,
            instructions=instr,
        )
    elif t == "property":
        return ifctester_ids.Property(
            propertySet=_resolve_param(p.get("propertySet")) or "",
            baseName=_resolve_param(p.get("baseName")) or "",
            value=_build_restriction(p.get("value")),
            dataType=p.get("dataType") or None,
            uri=p.get("uri") or None,
            cardinality=card,
            instructions=instr,
        )
    elif t == "classification":
        return ifctester_ids.Classification(
            system=_resolve_param(p.get("system")),
            value=_build_restriction(p.get("value")),
            uri=p.get("uri") or None,
            cardinality=card,
            instructions=instr,
        )
    elif t == "material":
        return ifctester_ids.Material(
            value=_build_restriction(p.get("value")),
            uri=p.get("uri") or None,
            cardinality=card,
            instructions=instr,
        )
    elif t == "partOf":
        return ifctester_ids.PartOf(
            name=p.get("name") or "IFCBUILDINGSTOREY",
            predefinedType=p.get("predefinedType") or None,
            relation=p.get("relation") or None,
            cardinality=card,
            instructions=instr,
        )
    raise ValueError(f"Unknown facet type: {t}")


def _json_to_ids(payload: dict):
    """Convert a JSON IDS document to an ifctester Ids object."""
    if not HAS_IFCTESTER:
        raise RuntimeError("ifctester not installed")

    info = payload.get("info", {})
    ids_kwargs = dict(
        title=info.get("title", "Untitled"),
        version=info.get("version", "1.0"),
        author=info.get("author", ""),
        description=info.get("description", ""),
        date=info.get("date", str(date.today())),
    )
    for extra_key in ("copyright", "purpose", "milestone"):
        val = info.get(extra_key)
        if val:
            ids_kwargs[extra_key] = val

    specs = ifctester_ids.Ids(**ids_kwargs)

    for sdef in payload.get("specifications", []):
        spec_kwargs = dict(
            name=sdef.get("name", "Untitled"),
            description=sdef.get("description") or None,
            ifcVersion=sdef.get("ifcVersion", ["IFC4"]),
        )
        if sdef.get("instructions"):
            spec_kwargs["instructions"] = sdef["instructions"]
        if sdef.get("identifier"):
            spec_kwargs["identifier"] = sdef["identifier"]
        min_occ = sdef.get("minOccurs")
        max_occ = sdef.get("maxOccurs")
        if min_occ is not None:
            spec_kwargs["minOccurs"] = int(min_occ)
        if max_occ is not None:
            spec_kwargs["maxOccurs"] = max_occ if max_occ == "unbounded" else int(max_occ)

        spec = ifctester_ids.Specification(**spec_kwargs)
        for fdef in sdef.get("applicability", []):
            spec.applicability.append(_build_facet(fdef))
        for fdef in sdef.get("requirements", []):
            spec.requirements.append(_build_facet(fdef))
        specs.specifications.append(spec)

    return specs


@app.post("/api/build-ids")
async def build_ids(payload: dict = Body(...)):
    """Build IDS XML from JSON definition and return as downloadable file."""
    if not HAS_IFCTESTER:
        return Response(
            content="ifctester not installed. Run: pip install ifctester",
            status_code=501,
        )
    try:
        specs = _json_to_ids(payload)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".ids")
        tmp.close()
        specs.to_xml(tmp.name)
        with open(tmp.name, "r", encoding="utf-8") as f:
            xml_content = f.read()
        os.unlink(tmp.name)
        return Response(content=xml_content, media_type="application/xml")
    except Exception as e:
        return Response(content=str(e), status_code=400)


@app.post("/api/parse-ids")
async def parse_ids_file(file: UploadFile = File(...)):
    """Parse an IDS XML file and return JSON representation for the editor."""
    if not HAS_IFCTESTER:
        return Response(
            content="ifctester not installed. Run: pip install ifctester",
            status_code=501,
        )
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ids") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        specs = ifctester_ids.open(tmp_path)
    finally:
        os.unlink(tmp_path)

    def facet_to_json(f):
        result = {
            "id": str(uuid4()),
            "type": "",
            "cardinality": getattr(f, "cardinality", "required") or "required",
            "instructions": getattr(f, "instructions", "") or "",
            "params": {},
        }
        cls_name = type(f).__name__

        def val_str(v):
            if v is None:
                return ""
            if hasattr(v, "options") and v.options:
                opts = v.options
                if "enumeration" in opts:
                    return {"type": "enumeration", "base": getattr(v, "base", "xs:string"), "values": opts["enumeration"]}
                if "pattern" in opts:
                    return {"type": "pattern", "base": getattr(v, "base", "xs:string"), "pattern": opts["pattern"]}
                parsed = {}
                bound_keys = ("minInclusive", "maxInclusive", "minExclusive", "maxExclusive")
                len_keys = ("length", "minLength", "maxLength")
                for k in bound_keys:
                    if k in opts:
                        parsed[k] = opts[k]
                for k in len_keys:
                    if k in opts:
                        parsed[k] = opts[k]
                if parsed:
                    is_bounds = any(k in parsed for k in bound_keys)
                    rtype = "bounds" if is_bounds else "length"
                    return {"type": rtype, "base": getattr(v, "base", "xs:string"), **parsed}
            return str(v) if v else ""

        def param_val(v):
            """Parse a param that could be a simple string or a Restriction."""
            if v is None:
                return ""
            if hasattr(v, "options") and v.options:
                return val_str(v)
            return str(v) if v else ""

        if cls_name == "Entity":
            result["type"] = "entity"
            result["params"] = {
                "name": param_val(getattr(f, "name", "")),
                "predefinedType": param_val(getattr(f, "predefinedType", "")),
            }
        elif cls_name == "Attribute":
            result["type"] = "attribute"
            result["params"] = {
                "name": param_val(getattr(f, "name", "")),
                "value": val_str(getattr(f, "value", None)),
            }
        elif cls_name == "Property":
            result["type"] = "property"
            result["params"] = {
                "propertySet": param_val(getattr(f, "propertySet", "")),
                "baseName": param_val(getattr(f, "baseName", "")),
                "dataType": getattr(f, "dataType", "") or "",
                "value": val_str(getattr(f, "value", None)),
                "uri": getattr(f, "uri", "") or "",
            }
        elif cls_name == "Classification":
            result["type"] = "classification"
            result["params"] = {
                "system": param_val(getattr(f, "system", "")),
                "value": val_str(getattr(f, "value", None)),
                "uri": getattr(f, "uri", "") or "",
            }
        elif cls_name == "Material":
            result["type"] = "material"
            result["params"] = {
                "value": val_str(getattr(f, "value", None)),
                "uri": getattr(f, "uri", "") or "",
            }
        elif cls_name == "PartOf":
            result["type"] = "partOf"
            result["params"] = {
                "name": getattr(f, "name", "") or "",
                "predefinedType": getattr(f, "predefinedType", "") or "",
                "relation": getattr(f, "relation", "") or "",
            }
        return result

    doc = {
        "info": {
            "title": getattr(specs, "title", "") or "Imported IDS",
            "copyright": getattr(specs, "copyright", "") or "",
            "version": getattr(specs, "version", "") or "1.0",
            "author": getattr(specs, "author", "") or "",
            "description": getattr(specs, "description", "") or "",
            "date": getattr(specs, "date", "") or str(date.today()),
            "purpose": getattr(specs, "purpose", "") or "",
            "milestone": getattr(specs, "milestone", "") or "",
        },
        "specifications": [],
    }
    for spec in specs.specifications:
        min_occ = getattr(spec, "minOccurs", 1)
        max_occ = getattr(spec, "maxOccurs", "unbounded")
        if min_occ is None:
            min_occ = 1
        if max_occ is None:
            max_occ = "unbounded"

        sdef = {
            "id": str(uuid4()),
            "name": getattr(spec, "name", "") or "Untitled",
            "identifier": getattr(spec, "identifier", "") or "",
            "description": getattr(spec, "description", "") or "",
            "ifcVersion": getattr(spec, "ifcVersion", ["IFC4"]) or ["IFC4"],
            "instructions": getattr(spec, "instructions", "") or "",
            "minOccurs": min_occ,
            "maxOccurs": max_occ,
            "applicability": [facet_to_json(f) for f in (spec.applicability or [])],
            "requirements": [facet_to_json(f) for f in (spec.requirements or [])],
        }
        doc["specifications"].append(sdef)

    return doc


@app.post("/api/validate-ids")
async def validate_ids(
    ifc_file: UploadFile = File(...),
    ids_json: str = Form(...),
):
    """Validate an IFC file against IDS specifications.

    Accepts the raw IFC file and the IDS document as JSON string.
    Returns per-specification pass/fail results with element details.
    """
    if not HAS_IFCTESTER:
        return Response(
            content="ifctester not installed. Run: pip install ifctester",
            status_code=501,
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp_ifc:
        content = await ifc_file.read()
        tmp_ifc.write(content)
        ifc_path = tmp_ifc.name

    try:
        payload = json.loads(ids_json)
        ids_obj = _json_to_ids(payload)

        ifc = ifcopenshell.open(ifc_path)
        ids_obj.validate(ifc)

        results = []
        for spec in ids_obj.specifications:
            applicable = getattr(spec, "applicable_entities", []) or []
            total = len(applicable)
            passed = sum(
                1 for e in applicable
                if getattr(e, "is_satisfied", lambda: True)()
            ) if applicable else 0
            failed = total - passed

            failed_elements = []
            for entity in applicable:
                if not getattr(entity, "is_satisfied", lambda: True)():
                    reasons = []
                    for req in (spec.requirements or []):
                        status = getattr(req, "status", None)
                        if status is False:
                            msg = getattr(req, "message", "") or ""
                            reasons.append(msg)
                    failed_elements.append({
                        "expressId": entity.id() if hasattr(entity, "id") else None,
                        "globalId": entity.GlobalId if hasattr(entity, "GlobalId") else "",
                        "name": entity.Name if hasattr(entity, "Name") else "",
                        "type": entity.is_a() if hasattr(entity, "is_a") else "",
                        "reasons": reasons,
                    })

            spec_status = getattr(spec, "status", None)

            results.append({
                "name": getattr(spec, "name", ""),
                "description": getattr(spec, "description", "") or "",
                "status": spec_status,
                "total": total,
                "passed": passed,
                "failed": failed,
                "failedElements": failed_elements[:200],
            })

        overall = all(r["status"] for r in results) if results else True
        return {
            "overall": overall,
            "fileName": ifc_file.filename,
            "totalSpecs": len(results),
            "passedSpecs": sum(1 for r in results if r["status"]),
            "failedSpecs": sum(1 for r in results if not r["status"]),
            "specifications": results,
        }
    except Exception as e:
        import traceback
        return Response(
            content=json.dumps({"error": str(e), "trace": traceback.format_exc()}),
            status_code=400,
            media_type="application/json",
        )
    finally:
        os.unlink(ifc_path)
