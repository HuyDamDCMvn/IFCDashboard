"""IDS (Information Delivery Specification) build / parse / validate logic.

Depends on ifctester. All functions are pure — no FastAPI.
"""

from datetime import date
from uuid import uuid4

from element_utils import get_predefined_type, get_spatial_info

try:
    from ifctester import ids as ifctester_ids
    HAS_IFCTESTER = True
except ImportError:
    HAS_IFCTESTER = False


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


def json_to_ids(payload: dict):
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


def facet_to_json(f):
    """Convert an ifctester facet object back to JSON representation."""
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


def ids_to_json(specs):
    """Convert a parsed ifctester Ids object to a full JSON document."""
    info = getattr(specs, "info", {}) or {}

    def _info_get(key, default=""):
        """Retrieve from .info dict first, then fall back to direct attribute."""
        val = info.get(key) if isinstance(info, dict) else None
        if val:
            return val
        return getattr(specs, key, default) or default

    doc = {
        "info": {
            "title": _info_get("title", "Imported IDS"),
            "copyright": _info_get("copyright"),
            "version": _info_get("version", "1.0"),
            "author": _info_get("author"),
            "description": _info_get("description"),
            "date": _info_get("date", str(date.today())),
            "purpose": _info_get("purpose"),
            "milestone": _info_get("milestone"),
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


def validate_ids(ifc, payload):
    """Validate an IFC model against IDS specs. Returns result dict."""
    ids_obj = json_to_ids(payload)
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
        "totalSpecs": len(results),
        "passedSpecs": sum(1 for r in results if r["status"]),
        "failedSpecs": sum(1 for r in results if not r["status"]),
        "specifications": results,
    }
