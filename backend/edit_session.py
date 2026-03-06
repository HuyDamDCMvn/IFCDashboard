"""IFC edit session manager.

Holds IFC models in memory for stateful editing. No FastAPI dependency.
"""

import time
from uuid import uuid4

import ifcopenshell.api

from element_utils import get_predefined_type, get_psets, get_materials, get_spatial_info


class SessionManager:
    def __init__(self, ttl: int = 1800):
        self._sessions: dict[str, dict] = {}
        self._ttl = ttl

    def cleanup(self):
        """Remove sessions older than TTL."""
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if now - s["ts"] > self._ttl]
        for sid in expired:
            self._sessions.pop(sid, None)

    def get(self, session_id: str):
        s = self._sessions.get(session_id)
        if not s:
            return None
        s["ts"] = time.time()
        return s

    def create(self, ifc, filename: str) -> str:
        session_id = str(uuid4())
        self._sessions[session_id] = {
            "ifc": ifc,
            "fileName": filename or "model.ifc",
            "history": [],
            "ts": time.time(),
        }
        return session_id

    def close(self, session_id: str) -> bool:
        return self._sessions.pop(session_id, None) is not None

    def apply_edits(self, session_id: str, edits: list) -> tuple[list, int] | None:
        """Apply edits, return (results, total_history) or None if session not found."""
        sess = self.get(session_id)
        if not sess:
            return None

        ifc = sess["ifc"]
        results = []

        for edit in edits:
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

        return results, len(sess["history"])

    def get_element_data(self, session_id: str, global_id: str):
        """Return element dict or None tuple: (data, error_str)."""
        sess = self.get(session_id)
        if not sess:
            return None, "Session not found"

        ifc = sess["ifc"]
        try:
            entity = ifc.by_guid(global_id)
        except Exception:
            return None, "Entity not found"

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
        }, None
