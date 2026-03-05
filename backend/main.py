from fastapi import FastAPI, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import hashlib
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element as element_util
import ifcopenshell.util.placement
import numpy as np
import tempfile
import os
import json
import time
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


# ─── IFC Edit Session Endpoints ───────────────────────────────────

_edit_sessions: dict[str, dict] = {}
_SESSION_TTL = 1800  # 30 minutes

def _cleanup_sessions():
    """Remove sessions older than TTL."""
    now = time.time()
    expired = [sid for sid, s in _edit_sessions.items() if now - s["ts"] > _SESSION_TTL]
    for sid in expired:
        _edit_sessions.pop(sid, None)


def _get_session(session_id: str):
    s = _edit_sessions.get(session_id)
    if not s:
        return None
    s["ts"] = time.time()
    return s


@app.post("/api/edit-session/open")
async def open_edit_session(file: UploadFile = File(...)):
    """Upload an IFC file and open an edit session."""
    _cleanup_sessions()

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        ifc = ifcopenshell.open(tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    session_id = str(uuid4())
    _edit_sessions[session_id] = {
        "ifc": ifc,
        "fileName": file.filename or "model.ifc",
        "history": [],
        "ts": time.time(),
    }

    return {
        "sessionId": session_id,
        "schema": ifc.schema,
        "fileName": file.filename,
    }


@app.post("/api/edit-session/{session_id}/edit")
async def apply_edits(session_id: str, payload: dict = Body(...)):
    """Apply a batch of edits to the IFC model in the session.

    payload = { "edits": [ { "globalId": "...", "Name": "...", ... , "psetEdits": { ... } } ] }
    """
    sess = _get_session(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)

    ifc = sess["ifc"]
    results = []

    for edit in payload.get("edits", []):
        guid = edit.get("globalId")
        if not guid:
            results.append({"globalId": guid, "status": "error", "message": "Missing globalId"})
            continue

        try:
            entity = ifc.by_guid(guid)
        except Exception:
            results.append({"globalId": guid, "status": "error", "message": "Entity not found"})
            continue

        changes_applied = {}

        for attr in ("Name", "Description", "ObjectType"):
            if attr in edit:
                old_val = getattr(entity, attr, None)
                new_val = edit[attr] if edit[attr] != "" else None
                setattr(entity, attr, new_val)
                changes_applied[attr] = {"old": old_val, "new": new_val}

        if "PredefinedType" in edit and hasattr(entity, "PredefinedType"):
            old_val = getattr(entity, "PredefinedType", None)
            new_val = edit["PredefinedType"] if edit["PredefinedType"] != "" else None
            try:
                entity.PredefinedType = new_val
                changes_applied["PredefinedType"] = {"old": old_val, "new": new_val}
            except Exception:
                pass

        pset_edits = edit.get("psetEdits", {})
        for pset_name, props in pset_edits.items():
            if not hasattr(entity, "IsDefinedBy"):
                continue
            for rel in entity.IsDefinedBy:
                if not rel.is_a("IfcRelDefinesByProperties"):
                    continue
                pset = rel.RelatingPropertyDefinition
                if not pset.is_a("IfcPropertySet") or pset.Name != pset_name:
                    continue
                try:
                    ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties=props)
                    changes_applied[f"pset:{pset_name}"] = props
                except Exception as e:
                    changes_applied[f"pset:{pset_name}"] = {"error": str(e)}

        sess["history"].append({
            "globalId": guid,
            "entityName": getattr(entity, "Name", "") or "",
            "entityType": entity.is_a(),
            "changes": changes_applied,
            "timestamp": time.time(),
        })

        results.append({"globalId": guid, "status": "ok", "applied": changes_applied})

    return {"results": results, "totalHistory": len(sess["history"])}


@app.get("/api/edit-session/{session_id}/history")
async def get_edit_history(session_id: str):
    """Return the edit history for the session."""
    sess = _get_session(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)
    return {"history": sess["history"], "total": len(sess["history"])}


@app.get("/api/edit-session/{session_id}/element/{global_id}")
async def get_element_data(session_id: str, global_id: str):
    """Get the current (possibly edited) data for a single element."""
    sess = _get_session(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)

    ifc = sess["ifc"]
    try:
        entity = ifc.by_guid(global_id)
    except Exception:
        return Response(content="Entity not found", status_code=404)

    return {
        "globalId": entity.GlobalId,
        "expressId": entity.id(),
        "type": entity.is_a(),
        "Name": entity.Name or "",
        "Description": entity.Description or "",
        "ObjectType": getattr(entity, "ObjectType", "") or "",
        "PredefinedType": get_predefined_type(entity),
        "propertySets": get_psets(entity),
        "materials": get_materials(entity),
        "spatial": get_spatial_info(entity),
    }


@app.get("/api/edit-session/{session_id}/export")
async def export_edited_ifc(session_id: str):
    """Export the modified IFC file."""
    sess = _get_session(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)

    ifc = sess["ifc"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as out:
        out_path = out.name
    try:
        ifc.write(out_path)
        with open(out_path, "rb") as f:
            data = f.read()
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass

    base_name = sess["fileName"].rsplit(".", 1)[0] if "." in sess["fileName"] else sess["fileName"]
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{base_name}_edited.ifc"'},
    )


@app.delete("/api/edit-session/{session_id}")
async def close_edit_session(session_id: str):
    """Close the edit session and free memory."""
    removed = _edit_sessions.pop(session_id, None)
    return {"status": "closed" if removed else "not_found"}


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

            failure_map = {}
            for req in (spec.requirements or []):
                for fail_info in getattr(req, "failures", []) or []:
                    if isinstance(fail_info, dict):
                        entity = fail_info.get("element")
                        reason = fail_info.get("reason", "")
                    else:
                        entity = fail_info
                        reason = ""
                    if entity is None or not hasattr(entity, "id"):
                        continue
                    eid = entity.id()
                    if eid not in failure_map:
                        failure_map[eid] = {"entity": entity, "reasons": []}
                    if reason:
                        failure_map[eid]["reasons"].append(reason)

            failed = len(failure_map)
            passed = total - failed

            failed_elements = []
            for eid, info in failure_map.items():
                entity = info["entity"]
                spatial = get_spatial_info(entity)
                failed_elements.append({
                    "expressId": eid,
                    "globalId": entity.GlobalId if hasattr(entity, "GlobalId") else "",
                    "name": entity.Name if hasattr(entity, "Name") else "",
                    "type": entity.is_a() if hasattr(entity, "is_a") else "",
                    "predefinedType": get_predefined_type(entity),
                    "level": spatial.get("storey", ""),
                    "reasons": info["reasons"],
                })

            spec_status = getattr(spec, "status", None)
            usage = spec.get_usage() if hasattr(spec, "get_usage") else "required"

            results.append({
                "name": getattr(spec, "name", ""),
                "description": getattr(spec, "description", "") or "",
                "status": spec_status,
                "usage": usage,
                "total": total,
                "passed": passed,
                "failed": failed,
                "failedElements": failed_elements[:200],
            })

        required_results = [r for r in results if r.get("usage") != "optional"]
        overall = all(r["status"] for r in required_results) if required_results else True
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


# ─── IFC Diff Endpoints ──────────────────────────────────────────

def _get_schema_id(ifc):
    try:
        return ifc.schema_identifier
    except Exception:
        return ifc.schema


def _collect_products(ifc):
    """Collect all diffable products (IfcElement + IfcSpatialElement, excluding features)."""
    elems = ifc.by_type("IfcElement")
    if ifc.schema == "IFC2X3":
        elems += ifc.by_type("IfcSpatialStructureElement")
    else:
        try:
            elems += ifc.by_type("IfcSpatialElement")
        except Exception:
            pass
    return [e for e in elems if not e.is_a("IfcFeatureElement") and getattr(e, "GlobalId", None)]


def _pset_hash(psets: dict) -> str:
    cleaned = {}
    for pn, props in sorted(psets.items()):
        cleaned[pn] = {k: v for k, v in sorted(props.items()) if k != "id"}
    return hashlib.md5(json.dumps(cleaned, sort_keys=True, default=str).encode()).hexdigest()


def _diff_element_detail(old_el, new_el, old_ifc, new_ifc, precision=1e-4):
    """Return detailed change dict for a single element, or None if unchanged."""
    changes = {}

    # Attribute changes
    for attr in ("Name", "Description", "ObjectType", "PredefinedType", "Tag"):
        ov = getattr(old_el, attr, None)
        nv = getattr(new_el, attr, None)
        if ov != nv:
            changes.setdefault("attributes", {})[attr] = {
                "old": str(ov) if ov is not None else None,
                "new": str(nv) if nv is not None else None,
            }

    # Placement changes
    try:
        old_m = ifcopenshell.util.placement.get_local_placement(
            old_el.ObjectPlacement
        ) if getattr(old_el, "ObjectPlacement", None) else None
        new_m = ifcopenshell.util.placement.get_local_placement(
            new_el.ObjectPlacement
        ) if getattr(new_el, "ObjectPlacement", None) else None
        if old_m is not None and new_m is not None:
            if not np.allclose(old_m, new_m, atol=precision):
                changes["placement"] = True
        elif (old_m is None) != (new_m is None):
            changes["placement"] = True
    except Exception:
        pass

    # Property changes (hash-first, detail on mismatch)
    try:
        old_psets = ifcopenshell.util.element.get_psets(old_el)
    except Exception:
        old_psets = {}
    try:
        new_psets = ifcopenshell.util.element.get_psets(new_el)
    except Exception:
        new_psets = {}
    if _pset_hash(old_psets) != _pset_hash(new_psets):
        prop_changes = {}
        all_names = set(old_psets) | set(new_psets)
        for pn in all_names:
            op = {k: v for k, v in old_psets.get(pn, {}).items() if k != "id"}
            np_ = {k: v for k, v in new_psets.get(pn, {}).items() if k != "id"}
            if pn not in old_psets:
                prop_changes[pn] = {"_status": "added"}
            elif pn not in new_psets:
                prop_changes[pn] = {"_status": "deleted"}
            else:
                diffs = {}
                for k in set(op) | set(np_):
                    ov, nv = op.get(k), np_.get(k)
                    if ov != nv:
                        if isinstance(ov, (int, float)) and isinstance(nv, (int, float)):
                            if abs(ov - nv) <= precision:
                                continue
                        diffs[k] = {"old": ov, "new": nv}
                if diffs:
                    prop_changes[pn] = {"_status": "modified", "properties": diffs}
        if prop_changes:
            changes["properties"] = prop_changes

    # Type changes
    try:
        old_type = ifcopenshell.util.element.get_type(old_el)
        new_type = ifcopenshell.util.element.get_type(new_el)
    except Exception:
        old_type = new_type = None
    old_tid = old_type.GlobalId if old_type else None
    new_tid = new_type.GlobalId if new_type else None
    if old_tid != new_tid:
        changes["type"] = {
            "old": {"globalId": old_tid, "name": old_type.Name if old_type else None},
            "new": {"globalId": new_tid, "name": new_type.Name if new_type else None},
        }

    # Container changes
    try:
        old_c = ifcopenshell.util.element.get_container(old_el)
        new_c = ifcopenshell.util.element.get_container(new_el)
    except Exception:
        old_c = new_c = None
    old_cn = old_c.Name if old_c else None
    new_cn = new_c.Name if new_c else None
    if old_cn != new_cn:
        changes["container"] = {"old": old_cn, "new": new_cn}

    return changes if changes else None


def _format_element_info(el, ifc):
    schema = ifc.schema
    spatial = get_spatial_info(el)
    return {
        "globalId": el.GlobalId,
        "expressId": el.id(),
        "type": get_export_as(el, schema),
        "name": el.Name or "",
        "predefinedType": get_predefined_type(el),
        "storey": spatial.get("storey", ""),
    }


_DIFF_MAX_FILE_SIZE = 300 * 1024 * 1024  # 300 MB per file
_DIFF_MAX_RESULTS = 2000  # cap elements per category in response


@app.post("/api/diff-ifc")
async def diff_ifc(
    old_file: UploadFile = File(...),
    new_file: UploadFile = File(...),
    filter_types: str = Form(None),
):
    """Compare two IFC files. Both must share the same general schema."""
    old_path = new_path = None
    try:
        old_bytes = await old_file.read()
        new_bytes = await new_file.read()
        for label, data in [("Old", old_bytes), ("New", new_bytes)]:
            if len(data) > _DIFF_MAX_FILE_SIZE:
                return Response(
                    content=json.dumps({
                        "error": f"{label} file too large ({len(data) // (1024*1024)} MB). "
                                 f"Max {_DIFF_MAX_FILE_SIZE // (1024*1024)} MB."
                    }),
                    status_code=413, media_type="application/json",
                )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            tmp.write(old_bytes)
            old_path = tmp.name
        del old_bytes
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            tmp.write(new_bytes)
            new_path = tmp.name
        del new_bytes

        try:
            old_ifc = ifcopenshell.open(old_path)
        except Exception as e:
            return Response(
                content=json.dumps({"error": f"Cannot parse old file: {e}"}),
                status_code=400, media_type="application/json",
            )
        try:
            new_ifc = ifcopenshell.open(new_path)
        except Exception as e:
            return Response(
                content=json.dumps({"error": f"Cannot parse new file: {e}"}),
                status_code=400, media_type="application/json",
            )

        # Schema compatibility gate
        old_schema = old_ifc.schema
        new_schema = new_ifc.schema
        old_schema_id = _get_schema_id(old_ifc)
        new_schema_id = _get_schema_id(new_ifc)

        if old_schema != new_schema:
            return Response(
                content=json.dumps({
                    "error": "schema_mismatch",
                    "message": f"Schema mismatch: {old_schema} vs {new_schema}. Both files must use the same IFC schema.",
                    "oldFile": {"name": old_file.filename, "schema": old_schema, "schemaId": old_schema_id},
                    "newFile": {"name": new_file.filename, "schema": new_schema, "schemaId": new_schema_id},
                }),
                status_code=422, media_type="application/json",
            )

        schema_warning = None
        if old_schema_id != new_schema_id:
            schema_warning = f"Minor version difference: {old_schema_id} vs {new_schema_id}"

        # Collect products
        old_products = _collect_products(old_ifc)
        new_products = _collect_products(new_ifc)

        if not old_products and not new_products:
            return Response(
                content=json.dumps({"error": "Both files contain no diffable elements."}),
                status_code=400, media_type="application/json",
            )

        old_guids = {e.GlobalId for e in old_products}
        new_guids = {e.GlobalId for e in new_products}

        deleted_guids = old_guids - new_guids
        added_guids = new_guids - old_guids
        common_guids = old_guids & new_guids

        # Optional type filter
        type_filter = set()
        if filter_types and filter_types.strip():
            type_filter = {t.strip() for t in filter_types.split(",") if t.strip()}

        # Format added / deleted
        added = []
        for guid in added_guids:
            el = new_ifc.by_guid(guid)
            info = _format_element_info(el, new_ifc)
            if type_filter and info["type"] not in type_filter:
                continue
            added.append(info)

        deleted = []
        for guid in deleted_guids:
            el = old_ifc.by_guid(guid)
            info = _format_element_info(el, old_ifc)
            if type_filter and info["type"] not in type_filter:
                continue
            deleted.append(info)

        # Diff common elements (hash+placement strategy)
        changed = []
        unchanged_count = 0
        for guid in common_guids:
            old_el = old_ifc.by_guid(guid)
            new_el = new_ifc.by_guid(guid)

            if type_filter:
                etype = get_export_as(new_el, new_schema)
                if etype not in type_filter:
                    continue

            detail = _diff_element_detail(old_el, new_el, old_ifc, new_ifc)
            if detail:
                info = _format_element_info(new_el, new_ifc)
                info["changes"] = detail
                changed.append(info)
            else:
                unchanged_count += 1

        added.sort(key=lambda x: (x["type"], x["name"]))
        deleted.sort(key=lambda x: (x["type"], x["name"]))
        changed.sort(key=lambda x: (x["type"], x["name"]))

        total_added = len(added)
        total_deleted = len(deleted)
        total_changed = len(changed)

        # Change type summary for charts (computed before truncation)
        change_type_summary = {}
        for el in changed:
            for key in el.get("changes", {}):
                change_type_summary[key] = change_type_summary.get(key, 0) + 1

        # Element type summary for charts
        type_summary = {"added": {}, "deleted": {}, "changed": {}}
        for el in added:
            type_summary["added"][el["type"]] = type_summary["added"].get(el["type"], 0) + 1
        for el in deleted:
            type_summary["deleted"][el["type"]] = type_summary["deleted"].get(el["type"], 0) + 1
        for el in changed:
            type_summary["changed"][el["type"]] = type_summary["changed"].get(el["type"], 0) + 1

        truncated = (total_added > _DIFF_MAX_RESULTS
                     or total_deleted > _DIFF_MAX_RESULTS
                     or total_changed > _DIFF_MAX_RESULTS)

        return {
            "schemaCheck": {
                "schema": old_schema,
                "oldSchemaId": old_schema_id,
                "newSchemaId": new_schema_id,
                "match": "exact" if not schema_warning else "compatible",
                "warning": schema_warning,
            },
            "oldFile": {
                "name": old_file.filename,
                "schema": old_schema_id,
                "totalProducts": len(old_products),
            },
            "newFile": {
                "name": new_file.filename,
                "schema": new_schema_id,
                "totalProducts": len(new_products),
            },
            "summary": {
                "addedCount": total_added,
                "deletedCount": total_deleted,
                "changedCount": total_changed,
                "unchangedCount": unchanged_count,
            },
            "truncated": truncated,
            "maxResults": _DIFF_MAX_RESULTS if truncated else None,
            "changeTypeSummary": change_type_summary,
            "typeSummary": type_summary,
            "added": added[:_DIFF_MAX_RESULTS],
            "deleted": deleted[:_DIFF_MAX_RESULTS],
            "changed": changed[:_DIFF_MAX_RESULTS],
        }

    except Exception as e:
        import traceback
        return Response(
            content=json.dumps({"error": str(e), "trace": traceback.format_exc()}),
            status_code=500, media_type="application/json",
        )
    finally:
        for p in (old_path, new_path):
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass
