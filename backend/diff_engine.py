"""IFC model comparison engine.

Pure functions — no FastAPI, no HTTP. Only depends on ifcopenshell + hashlib.
Fixes applied vs original main.py:
  - _compare_psets() extracted (was copy-pasted in two places)
  - _check_schema_match() extracted (was duplicated in one-pass and two-pass)
  - Unified get_psets via element_utils (was two different implementations)
"""

import gc
import hashlib
import json
import time

import ifcopenshell
import ifcopenshell.util.element

from element_utils import get_predefined_type, get_export_as, get_spatial_info

# ─── Constants ────────────────────────────────────────────────────

MAX_FILE_SIZE = 300 * 1024 * 1024
MAX_RESULTS = 2000
TWO_PASS_THRESHOLD = 50 * 1024 * 1024
FLOAT_DIGITS = 6
NOISE_TYPES = frozenset([
    "IfcDistributionPort", "IfcOpeningElement",
    "IfcFeatureElementSubtraction", "IfcVirtualElement",
])
DIFF_ATTRS = (
    "Name", "Description", "ObjectType", "PredefinedType", "Tag",
    "LongName", "Status",
)


# ─── Shared helpers ───────────────────────────────────────────────

def _get_schema_id(ifc):
    try:
        return ifc.schema_identifier
    except Exception:
        return ifc.schema


def _collect_products(ifc, include_noise=False):
    """Collect diffable products, optionally excluding noise types."""
    elems = ifc.by_type("IfcElement")
    if ifc.schema == "IFC2X3":
        elems += ifc.by_type("IfcSpatialStructureElement")
    else:
        try:
            elems += ifc.by_type("IfcSpatialElement")
        except Exception:
            pass
    products = [e for e in elems
                if not e.is_a("IfcFeatureElement")
                and getattr(e, "GlobalId", None)]
    if not include_noise:
        products = [e for e in products if e.is_a() not in NOISE_TYPES]
    return products


def _norm_val(v):
    """Round floats for tolerance-aware hashing."""
    if isinstance(v, float):
        return round(v, FLOAT_DIGITS)
    return v


def _get_psets_safe(el) -> dict:
    """Property sets via ifcopenshell utilities, never raises."""
    try:
        return ifcopenshell.util.element.get_psets(el)
    except Exception:
        return {}


def _pset_hash(psets: dict) -> str:
    cleaned = {}
    for pn, props in sorted(psets.items()):
        cleaned[pn] = {k: _norm_val(v) for k, v in sorted(props.items()) if k != "id"}
    return hashlib.md5(json.dumps(cleaned, sort_keys=True, default=str).encode()).hexdigest()


def _geometry_hash(el):
    """Hash geometry representation STEP IDs — detects shape changes without tessellation."""
    rep = getattr(el, "Representation", None)
    if not rep:
        return None
    try:
        ids = []
        for r in rep.Representations:
            for item in r.Items:
                ids.append(item.id())
        return hashlib.md5(str(sorted(ids)).encode()).hexdigest() if ids else None
    except Exception:
        return None


def _relative_placement(el):
    """Extract relative placement tuple avoiding UTM float amplification."""
    op = getattr(el, "ObjectPlacement", None)
    if not op:
        return None
    try:
        rp = op.RelativePlacement
        if not rp:
            return None
        loc = tuple(round(c, FLOAT_DIGITS) for c in rp.Location.Coordinates) if rp.Location else None
        axis = tuple(round(c, FLOAT_DIGITS) for c in rp.Axis.DirectionRatios) if getattr(rp, "Axis", None) else None
        ref_dir = tuple(round(c, FLOAT_DIGITS) for c in rp.RefDirection.DirectionRatios) if getattr(rp, "RefDirection", None) else None
        parent_id = op.PlacementRelTo.id() if getattr(op, "PlacementRelTo", None) else None
        return (loc, axis, ref_dir, parent_id)
    except Exception:
        return None


def _placements_equal(fp1, fp2):
    if fp1 is None and fp2 is None:
        return True
    if fp1 is None or fp2 is None:
        return False
    return fp1 == fp2


# ─── FIX #1: Extracted _compare_psets (was duplicated) ────────────

def _compare_psets(old_psets: dict, new_psets: dict, precision=1e-4):
    """Compare two property-set dicts. Returns change dict or None."""
    all_names = set(old_psets) | set(new_psets)
    prop_changes = {}
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
    return prop_changes if prop_changes else None


# ─── FIX #2: Extracted schema check (was duplicated) ─────────────

def check_schema_match(old_schema, new_schema, old_schema_id, new_schema_id,
                       old_name, new_name):
    """Return (error_dict, warning_str).  error_dict is None when schemas match."""
    if old_schema != new_schema:
        return {
            "error": "schema_mismatch",
            "message": f"Schema mismatch: {old_schema} vs {new_schema}. "
                       "Both files must use the same IFC schema.",
            "oldFile": {"name": old_name, "schema": old_schema, "schemaId": old_schema_id},
            "newFile": {"name": new_name, "schema": new_schema, "schemaId": new_schema_id},
        }, None

    warning = None
    if old_schema_id != new_schema_id:
        warning = f"Minor version difference: {old_schema_id} vs {new_schema_id}"
    return None, warning


# ─── Element detail diff (one-pass, uses live IFC objects) ────────

def _diff_element_detail(old_el, new_el, precision=1e-4):
    """Return change dict or None."""
    changes = {}

    for attr in DIFF_ATTRS:
        ov = getattr(old_el, attr, None)
        nv = getattr(new_el, attr, None)
        if ov != nv:
            changes.setdefault("attributes", {})[attr] = {
                "old": str(ov) if ov is not None else None,
                "new": str(nv) if nv is not None else None,
            }

    old_rp = _relative_placement(old_el)
    new_rp = _relative_placement(new_el)
    if not _placements_equal(old_rp, new_rp):
        changes["placement"] = True

    old_gh = _geometry_hash(old_el)
    new_gh = _geometry_hash(new_el)
    if old_gh != new_gh:
        changes["geometry"] = True

    old_psets = _get_psets_safe(old_el)
    new_psets = _get_psets_safe(new_el)
    if _pset_hash(old_psets) != _pset_hash(new_psets):
        prop_changes = _compare_psets(old_psets, new_psets, precision)
        if prop_changes:
            changes["properties"] = prop_changes

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


# ─── Fingerprint extraction (used by both passes) ────────────────

def _extract_fingerprints(ifc_path, include_noise=False):
    """Load IFC, extract per-element fingerprints, return (meta, fingerprints)."""
    ifc = ifcopenshell.open(ifc_path)
    schema = ifc.schema
    schema_id = _get_schema_id(ifc)
    products = _collect_products(ifc, include_noise=include_noise)

    fps = {}
    for el in products:
        guid = el.GlobalId
        attrs = {}
        for attr in DIFF_ATTRS:
            v = getattr(el, attr, None)
            if v is not None:
                attrs[attr] = str(v)

        psets = _get_psets_safe(el)
        cleaned_psets = {
            pn: {k: v for k, v in props.items() if k != "id"}
            for pn, props in psets.items()
        }

        fps[guid] = {
            "class": el.is_a(),
            "name": el.Name or "",
            "expressId": el.id(),
            "attrs": attrs,
            "placement": _relative_placement(el),
            "geo": _geometry_hash(el),
            "pset_hash": _pset_hash(psets),
            "psets": cleaned_psets,
            "type_guid": None,
            "type_name": None,
            "container": None,
            "storey": "",
        }
        try:
            etype = ifcopenshell.util.element.get_type(el)
            if etype:
                fps[guid]["type_guid"] = etype.GlobalId
                fps[guid]["type_name"] = etype.Name
        except Exception:
            pass
        try:
            c = ifcopenshell.util.element.get_container(el)
            if c:
                fps[guid]["container"] = c.Name
        except Exception:
            pass
        spatial = get_spatial_info(el)
        fps[guid]["storey"] = spatial.get("storey", "")

    meta = {
        "schema": schema,
        "schema_id": schema_id,
        "total_products": len(products),
    }
    del ifc, products
    gc.collect()
    return meta, fps


def _compare_fingerprints(old_fps, new_fps, type_filter, precision=1e-4):
    """Compare two fingerprint dicts. Returns (added, deleted, changed, unchanged_count)."""
    old_guids = set(old_fps)
    new_guids = set(new_fps)

    added_guids = new_guids - old_guids
    deleted_guids = old_guids - new_guids
    common_guids = old_guids & new_guids

    added = []
    for g in added_guids:
        fp = new_fps[g]
        if type_filter and fp["class"] not in type_filter:
            continue
        added.append({
            "globalId": g, "expressId": fp["expressId"],
            "type": fp["class"], "name": fp["name"],
            "predefinedType": fp["attrs"].get("PredefinedType", ""),
            "storey": fp["storey"],
        })

    deleted = []
    for g in deleted_guids:
        fp = old_fps[g]
        if type_filter and fp["class"] not in type_filter:
            continue
        deleted.append({
            "globalId": g, "expressId": fp["expressId"],
            "type": fp["class"], "name": fp["name"],
            "predefinedType": fp["attrs"].get("PredefinedType", ""),
            "storey": fp["storey"],
        })

    changed = []
    unchanged_count = 0
    for g in common_guids:
        o, n = old_fps[g], new_fps[g]
        if type_filter and n["class"] not in type_filter:
            continue

        changes = {}

        if o["attrs"] != n["attrs"]:
            attr_diff = {}
            for k in set(o["attrs"]) | set(n["attrs"]):
                ov, nv = o["attrs"].get(k), n["attrs"].get(k)
                if ov != nv:
                    attr_diff[k] = {"old": ov, "new": nv}
            if attr_diff:
                changes["attributes"] = attr_diff

        if not _placements_equal(o["placement"], n["placement"]):
            changes["placement"] = True

        if o["geo"] != n["geo"]:
            changes["geometry"] = True

        if o["pset_hash"] != n["pset_hash"]:
            prop_changes = _compare_psets(o["psets"], n["psets"], precision)
            if prop_changes:
                changes["properties"] = prop_changes

        if o.get("type_guid") != n.get("type_guid"):
            changes["type"] = {
                "old": {"globalId": o.get("type_guid"), "name": o.get("type_name")},
                "new": {"globalId": n.get("type_guid"), "name": n.get("type_name")},
            }

        if o["container"] != n["container"]:
            changes["container"] = {"old": o["container"], "new": n["container"]}

        if changes:
            changed.append({
                "globalId": g, "expressId": n["expressId"],
                "type": n["class"], "name": n["name"],
                "predefinedType": n["attrs"].get("PredefinedType", ""),
                "storey": n["storey"],
                "changes": changes,
            })
        else:
            unchanged_count += 1

    added.sort(key=lambda x: (x["type"], x["name"]))
    deleted.sort(key=lambda x: (x["type"], x["name"]))
    changed.sort(key=lambda x: (x["type"], x["name"]))
    return added, deleted, changed, unchanged_count


def _build_diff_response(
    added, deleted, changed, unchanged_count,
    old_file_name, new_file_name,
    old_meta, new_meta,
    schema_warning, elapsed_s, mode,
    noise_excluded=0,
):
    total_added, total_deleted, total_changed = len(added), len(deleted), len(changed)

    change_type_summary = {}
    for el in changed:
        for key in el.get("changes", {}):
            change_type_summary[key] = change_type_summary.get(key, 0) + 1

    type_summary = {"added": {}, "deleted": {}, "changed": {}}
    for el in added:
        type_summary["added"][el["type"]] = type_summary["added"].get(el["type"], 0) + 1
    for el in deleted:
        type_summary["deleted"][el["type"]] = type_summary["deleted"].get(el["type"], 0) + 1
    for el in changed:
        type_summary["changed"][el["type"]] = type_summary["changed"].get(el["type"], 0) + 1

    truncated = (total_added > MAX_RESULTS
                 or total_deleted > MAX_RESULTS
                 or total_changed > MAX_RESULTS)

    return {
        "schemaCheck": {
            "schema": old_meta["schema"],
            "oldSchemaId": old_meta["schema_id"],
            "newSchemaId": new_meta["schema_id"],
            "match": "exact" if not schema_warning else "compatible",
            "warning": schema_warning,
        },
        "oldFile": {
            "name": old_file_name,
            "schema": old_meta["schema_id"],
            "totalProducts": old_meta["total_products"],
        },
        "newFile": {
            "name": new_file_name,
            "schema": new_meta["schema_id"],
            "totalProducts": new_meta["total_products"],
        },
        "summary": {
            "addedCount": total_added,
            "deletedCount": total_deleted,
            "changedCount": total_changed,
            "unchangedCount": unchanged_count,
        },
        "truncated": truncated,
        "maxResults": MAX_RESULTS if truncated else None,
        "changeTypeSummary": change_type_summary,
        "typeSummary": type_summary,
        "timing": {"elapsed_s": round(elapsed_s, 2), "mode": mode},
        "noiseExcluded": noise_excluded,
        "added": added[:MAX_RESULTS],
        "deleted": deleted[:MAX_RESULTS],
        "changed": changed[:MAX_RESULTS],
    }


# ─── FIX #5: Unified diff runner ─────────────────────────────────

def run_one_pass(old_path, new_path, old_name, new_name, type_filter, t_start):
    """Standard one-pass: both models in memory simultaneously."""
    old_ifc = ifcopenshell.open(old_path)
    new_ifc = ifcopenshell.open(new_path)

    old_schema_id = _get_schema_id(old_ifc)
    new_schema_id = _get_schema_id(new_ifc)

    err, schema_warning = check_schema_match(
        old_ifc.schema, new_ifc.schema,
        old_schema_id, new_schema_id,
        old_name, new_name,
    )
    if err:
        return None, err

    old_products = _collect_products(old_ifc)
    new_products = _collect_products(new_ifc)

    all_old = [e for e in old_ifc.by_type("IfcElement") if getattr(e, "GlobalId", None)]
    noise_excluded = len(all_old) - len([e for e in all_old if e.is_a() not in NOISE_TYPES])

    old_guids = {e.GlobalId for e in old_products}
    new_guids = {e.GlobalId for e in new_products}

    added = []
    for guid in (new_guids - old_guids):
        el = new_ifc.by_guid(guid)
        info = _format_element_info(el, new_ifc)
        if type_filter and info["type"] not in type_filter:
            continue
        added.append(info)

    deleted = []
    for guid in (old_guids - new_guids):
        el = old_ifc.by_guid(guid)
        info = _format_element_info(el, old_ifc)
        if type_filter and info["type"] not in type_filter:
            continue
        deleted.append(info)

    changed = []
    unchanged_count = 0
    for guid in (old_guids & new_guids):
        old_el = old_ifc.by_guid(guid)
        new_el = new_ifc.by_guid(guid)
        if type_filter:
            etype = get_export_as(new_el, new_ifc.schema)
            if etype not in type_filter:
                continue
        detail = _diff_element_detail(old_el, new_el)
        if detail:
            info = _format_element_info(new_el, new_ifc)
            info["changes"] = detail
            changed.append(info)
        else:
            unchanged_count += 1

    old_meta = {"schema": old_ifc.schema, "schema_id": old_schema_id, "total_products": len(old_products)}
    new_meta = {"schema": new_ifc.schema, "schema_id": new_schema_id, "total_products": len(new_products)}
    result = _build_diff_response(
        added, deleted, changed, unchanged_count,
        old_name, new_name, old_meta, new_meta,
        schema_warning, time.time() - t_start, "one-pass",
        noise_excluded=noise_excluded,
    )
    return result, None


def run_two_pass(old_path, new_path, old_name, new_name, type_filter, t_start):
    """Memory-efficient two-pass: load one file at a time."""
    old_meta, old_fps = _extract_fingerprints(old_path)
    gc.collect()

    new_meta, new_fps = _extract_fingerprints(new_path)
    gc.collect()

    err, schema_warning = check_schema_match(
        old_meta["schema"], new_meta["schema"],
        old_meta["schema_id"], new_meta["schema_id"],
        old_name, new_name,
    )
    if err:
        return None, err

    added, deleted, changed, unchanged_count = _compare_fingerprints(old_fps, new_fps, type_filter)

    result = _build_diff_response(
        added, deleted, changed, unchanged_count,
        old_name, new_name, old_meta, new_meta,
        schema_warning, time.time() - t_start, "two-pass",
    )
    return result, None
