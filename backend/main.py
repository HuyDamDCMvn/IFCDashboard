"""IFC Dashboard API — thin route layer.

All business logic lives in dedicated modules:
  element_utils  – IFC element inspection (psets, materials, spatial)
  diff_engine    – model comparison (fingerprint, one/two-pass)
  ids_service    – IDS build / parse / validate
  edit_session   – stateful edit session manager
"""

from contextlib import contextmanager
from fastapi import FastAPI, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import ifcopenshell
import tempfile
import os
import json
import time
from uuid import uuid4

from element_utils import (
    IFC4X3_INFRA_TYPES,
    get_predefined_type, get_export_as,
    get_psets_for_display, get_materials, get_spatial_info,
)
from diff_engine import (
    MAX_FILE_SIZE as _DIFF_MAX_FILE_SIZE,
    TWO_PASS_THRESHOLD as _DIFF_TWO_PASS_THRESHOLD,
    run_one_pass, run_two_pass,
)
from ids_service import (
    HAS_IFCTESTER,
    json_to_ids, ids_to_json, facet_to_json,
    validate_ids as _validate_ids_logic,
)
from edit_session import SessionManager

app = FastAPI(title="IFC Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = SessionManager()


# ─── FIX #4: temp file context manager (was repeated 9 times) ────

@contextmanager
def _temp_path(suffix=".ifc"):
    """Create a temp file path with guaranteed cleanup on context exit.

    Yields a *closed* file path — caller can write/read as needed.
    The file is deleted when the ``with`` block exits.
    """
    fd = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    path = fd.name
    fd.close()
    try:
        yield path
    finally:
        if os.path.exists(path):
            try:
                os.unlink(path)
            except OSError:
                pass


# ─── IFC Parsing ──────────────────────────────────────────────────

@app.post("/api/parse-ifc")
async def parse_ifc(file: UploadFile = File(...), model_id: str = Form(None)):
    content = await file.read()
    with _temp_path(".ifc") as tmp_path:
        with open(tmp_path, "wb") as f:
            f.write(content)
        ifc = ifcopenshell.open(tmp_path)

    project = ifc.by_type("IfcProject")
    project_info = {
        "name": project[0].Name if project else "",
        "description": project[0].Description or "" if project else "",
        "schema": ifc.schema,
    }

    buildings = ifc.by_type("IfcBuilding")
    building_info = [{"name": b.Name or "", "description": b.Description or ""} for b in buildings]

    storeys = ifc.by_type("IfcBuildingStorey")
    storey_info = sorted(
        [{"name": s.Name or "", "elevation": float(s.Elevation) if s.Elevation else 0} for s in storeys],
        key=lambda x: x["elevation"],
    )

    schema = ifc.schema
    is_ifc4x3 = "IFC4X3" in schema.upper() if schema else False

    storey_breakdown = {(s.Name or "Unknown"): {} for s in storeys}

    elements = []
    summary = {}
    predef_summary = {}
    export_predef = {}

    for product in ifc.by_type("IfcProduct"):
        if product.is_a("IfcOpeningElement"):
            continue

        psets = get_psets_for_display(product)
        materials = get_materials(product)
        spatial = get_spatial_info(product)
        export_as = get_export_as(product, schema)
        predef = get_predefined_type(product)

        elements.append({
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
        })

        summary[export_as] = summary.get(export_as, 0) + 1

        if predef:
            label = f"{export_as}.{predef}"
            predef_summary[label] = predef_summary.get(label, 0) + 1

        export_predef.setdefault(export_as, {})
        pt_key = predef or "(none)"
        export_predef[export_as][pt_key] = export_predef[export_as].get(pt_key, 0) + 1

        storey_name = spatial["storey"] or "Unassigned"
        storey_breakdown.setdefault(storey_name, {})
        storey_breakdown[storey_name][export_as] = storey_breakdown[storey_name].get(export_as, 0) + 1

    material_counts = {}
    for el in elements:
        for mat in el["materials"]:
            mat_name = mat.split(" (")[0]
            material_counts[mat_name] = material_counts.get(mat_name, 0) + 1

    schema_info = {
        "schema": schema,
        "isIfc4x3": is_ifc4x3,
        "hasStoreys": len(storeys) > 0,
        "hasMaterials": len(material_counts) > 0,
        "hasInfraTypes": is_ifc4x3 and any(t in summary for t in IFC4X3_INFRA_TYPES),
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


# ─── IFC Edit Session Endpoints ──────────────────────────────────

@app.post("/api/edit-session/open")
async def open_edit_session(file: UploadFile = File(...)):
    sessions.cleanup()
    content = await file.read()

    with _temp_path(".ifc") as tmp_path:
        with open(tmp_path, "wb") as f:
            f.write(content)
        ifc = ifcopenshell.open(tmp_path)

    session_id = sessions.create(ifc, file.filename)
    return {"sessionId": session_id, "schema": ifc.schema, "fileName": file.filename}


@app.post("/api/edit-session/{session_id}/edit")
async def apply_edits(session_id: str, payload: dict = Body(...)):
    result = sessions.apply_edits(session_id, payload.get("edits", []))
    if result is None:
        return Response(content="Session not found", status_code=404)
    results, total = result
    return {"results": results, "totalHistory": total}


@app.get("/api/edit-session/{session_id}/history")
async def get_edit_history(session_id: str):
    sess = sessions.get(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)
    return {"history": sess["history"], "total": len(sess["history"])}


@app.get("/api/edit-session/{session_id}/element/{global_id}")
async def get_element_data(session_id: str, global_id: str):
    data, err = sessions.get_element_data(session_id, global_id)
    if err:
        status = 404
        return Response(content=err, status_code=status)
    return data


@app.get("/api/edit-session/{session_id}/export")
async def export_edited_ifc(session_id: str):
    sess = sessions.get(session_id)
    if not sess:
        return Response(content="Session not found", status_code=404)

    ifc = sess["ifc"]
    with _temp_path(".ifc") as out_path:
        ifc.write(out_path)
        with open(out_path, "rb") as f:
            data = f.read()

    base_name = sess["fileName"].rsplit(".", 1)[0] if "." in sess["fileName"] else sess["fileName"]
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{base_name}_edited.ifc"'},
    )


@app.delete("/api/edit-session/{session_id}")
async def close_edit_session(session_id: str):
    removed = sessions.close(session_id)
    return {"status": "closed" if removed else "not_found"}


# ─── IDS Builder Endpoints ───────────────────────────────────────

@app.post("/api/build-ids")
async def build_ids(payload: dict = Body(...)):
    if not HAS_IFCTESTER:
        return Response(content="ifctester not installed. Run: pip install ifctester", status_code=501)
    try:
        specs = json_to_ids(payload)
        with _temp_path(".ids") as tmp_path:
            specs.to_xml(tmp_path)
            with open(tmp_path, "r", encoding="utf-8") as f:
                xml_content = f.read()
        return Response(content=xml_content, media_type="application/xml")
    except Exception as e:
        return Response(content=str(e), status_code=400)


@app.post("/api/parse-ids")
async def parse_ids_endpoint(file: UploadFile = File(...)):
    if not HAS_IFCTESTER:
        return Response(content="ifctester not installed. Run: pip install ifctester", status_code=501)
    from ifctester import ids as ifctester_ids

    content = await file.read()
    with _temp_path(".ids") as tmp_path:
        with open(tmp_path, "wb") as f:
            f.write(content)
        specs = ifctester_ids.open(tmp_path)

    return ids_to_json(specs)


@app.post("/api/validate-ids")
async def validate_ids_endpoint(
    ifc_file: UploadFile = File(...),
    ids_json: str = Form(...),
):
    if not HAS_IFCTESTER:
        return Response(content="ifctester not installed. Run: pip install ifctester", status_code=501)

    content = await ifc_file.read()
    with _temp_path(".ifc") as ifc_path:
        with open(ifc_path, "wb") as f:
            f.write(content)
        try:
            payload = json.loads(ids_json)
            ifc = ifcopenshell.open(ifc_path)
            result = _validate_ids_logic(ifc, payload)
            result["fileName"] = ifc_file.filename
            return result
        except Exception as e:
            import traceback
            return Response(
                content=json.dumps({"error": str(e), "trace": traceback.format_exc()}),
                status_code=400, media_type="application/json",
            )


# ─── IFC Diff ────────────────────────────────────────────────────

@app.post("/api/diff-ifc")
async def diff_ifc(
    old_file: UploadFile = File(...),
    new_file: UploadFile = File(...),
    filter_types: str = Form(None),
):
    old_path = new_path = None
    try:
        t_start = time.time()
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
        old_size = len(old_bytes)
        del old_bytes
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            tmp.write(new_bytes)
            new_path = tmp.name
        new_size = len(new_bytes)
        del new_bytes

        type_filter = set()
        if filter_types and filter_types.strip():
            type_filter = {t.strip() for t in filter_types.split(",") if t.strip()}

        use_two_pass = old_size > _DIFF_TWO_PASS_THRESHOLD or new_size > _DIFF_TWO_PASS_THRESHOLD

        if use_two_pass:
            result, err = run_two_pass(old_path, new_path,
                                       old_file.filename, new_file.filename,
                                       type_filter, t_start)
        else:
            result, err = run_one_pass(old_path, new_path,
                                       old_file.filename, new_file.filename,
                                       type_filter, t_start)

        if err:
            return Response(content=json.dumps(err), status_code=422, media_type="application/json")
        return result

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
