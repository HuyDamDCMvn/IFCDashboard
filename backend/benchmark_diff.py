"""
IFC Diff Benchmark Suite
Measures performance and accuracy of different diff strategies.
"""

import copy
import gc
import hashlib
import json
import math
import multiprocessing
import os
import struct
import sys
import time
from contextlib import contextmanager
from pathlib import Path

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement
import numpy as np
import psutil
from deepdiff import DeepDiff
from ifcdiff import IfcDiff
from tabulate import tabulate


TEST_DIR = Path(__file__).parent.parent / "TestIFC"


# ── System Info ──────────────────────────────────────────

def print_system_info():
    mem = psutil.virtual_memory()
    freq = psutil.cpu_freq()
    print("=" * 72)
    print("  SYSTEM INFO")
    print("=" * 72)
    print(f"  Python:        {sys.version.split()[0]}")
    print(f"  ifcopenshell:  {ifcopenshell.version}")
    print(f"  CPU cores:     {multiprocessing.cpu_count()}")
    if freq:
        print(f"  CPU freq:      {freq.current:.0f} MHz")
    print(f"  Total RAM:     {mem.total / (1024**3):.1f} GB")
    print(f"  Available RAM: {mem.available / (1024**3):.1f} GB")
    print(f"  Platform:      {sys.platform}")
    print()


# ── Helpers ──────────────────────────────────────────────

@contextmanager
def timer():
    gc.collect()
    proc = psutil.Process()
    mem_before = proc.memory_info().rss
    t0 = time.perf_counter()
    result = {}
    yield result
    result["elapsed"] = time.perf_counter() - t0
    result["mem_delta_mb"] = (proc.memory_info().rss - mem_before) / (1024**2)


def file_info(ifc):
    elems = ifc.by_type("IfcElement")
    if ifc.schema == "IFC2X3":
        elems += ifc.by_type("IfcSpatialStructureElement")
    else:
        try:
            elems += ifc.by_type("IfcSpatialElement")
        except Exception:
            pass
    products = [e for e in elems if not e.is_a("IfcFeatureElement")]
    schema_id = ifc.schema
    try:
        schema_id = ifc.schema_identifier
    except Exception:
        pass
    return {
        "schema": ifc.schema,
        "schema_id": schema_id,
        "total_entities": len(list(ifc)),
        "products": len(products),
        "guids": set(e.GlobalId for e in products),
    }


def _pset_hash(psets):
    cleaned = {}
    for pn, props in sorted(psets.items()):
        cleaned[pn] = {k: v for k, v in sorted(props.items()) if k != "id"}
    return hashlib.md5(
        json.dumps(cleaned, sort_keys=True, default=str).encode()
    ).hexdigest()


# ── Diff Strategies ──────────────────────────────────────

def strategy_guid_only(old_ifc, new_ifc):
    old_g = file_info(old_ifc)["guids"]
    new_g = file_info(new_ifc)["guids"]
    return {
        "added": len(new_g - old_g),
        "deleted": len(old_g - new_g),
        "changed": 0,
    }


def strategy_hash_fast(old_ifc, new_ifc):
    old_inf = file_info(old_ifc)
    new_inf = file_info(new_ifc)
    deleted = old_inf["guids"] - new_inf["guids"]
    added = new_inf["guids"] - old_inf["guids"]
    common = new_inf["guids"] & old_inf["guids"]

    changed = 0
    for guid in common:
        old_el = old_ifc.by_guid(guid)
        new_el = new_ifc.by_guid(guid)

        attr_diff = False
        for attr in ("Name", "Description", "ObjectType", "PredefinedType", "Tag"):
            if getattr(old_el, attr, None) != getattr(new_el, attr, None):
                attr_diff = True
                break

        if attr_diff:
            changed += 1
            continue

        old_psets = ifcopenshell.util.element.get_psets(old_el)
        new_psets = ifcopenshell.util.element.get_psets(new_el)
        if _pset_hash(old_psets) != _pset_hash(new_psets):
            changed += 1

    return {"added": len(added), "deleted": len(deleted), "changed": changed}


def strategy_hash_placement(old_ifc, new_ifc):
    old_inf = file_info(old_ifc)
    new_inf = file_info(new_ifc)
    deleted = old_inf["guids"] - new_inf["guids"]
    added = new_inf["guids"] - old_inf["guids"]
    common = new_inf["guids"] & old_inf["guids"]

    changed = 0
    for guid in common:
        old_el = old_ifc.by_guid(guid)
        new_el = new_ifc.by_guid(guid)

        is_changed = False

        for attr in ("Name", "Description", "ObjectType", "PredefinedType", "Tag"):
            if getattr(old_el, attr, None) != getattr(new_el, attr, None):
                is_changed = True
                break

        if not is_changed:
            try:
                old_m = ifcopenshell.util.placement.get_local_placement(
                    old_el.ObjectPlacement
                ) if getattr(old_el, "ObjectPlacement", None) else None
                new_m = ifcopenshell.util.placement.get_local_placement(
                    new_el.ObjectPlacement
                ) if getattr(new_el, "ObjectPlacement", None) else None
                if old_m is not None and new_m is not None:
                    if not np.allclose(old_m, new_m, atol=1e-4):
                        is_changed = True
                elif (old_m is None) != (new_m is None):
                    is_changed = True
            except Exception:
                pass

        if not is_changed:
            old_psets = ifcopenshell.util.element.get_psets(old_el)
            new_psets = ifcopenshell.util.element.get_psets(new_el)
            if _pset_hash(old_psets) != _pset_hash(new_psets):
                is_changed = True

        if is_changed:
            changed += 1

    return {"added": len(added), "deleted": len(deleted), "changed": changed}


def strategy_ifcdiff_default(old_ifc, new_ifc):
    diff = IfcDiff(old_ifc, new_ifc, is_shallow=True)
    diff.diff()
    return {
        "added": len(diff.added_elements),
        "deleted": len(diff.deleted_elements),
        "changed": len(diff.change_register),
    }


def strategy_ifcdiff_full(old_ifc, new_ifc):
    diff = IfcDiff(
        old_ifc, new_ifc,
        relationships=["geometry", "type", "property", "container"],
        is_shallow=False,
    )
    diff.diff()
    return {
        "added": len(diff.added_elements),
        "deleted": len(diff.deleted_elements),
        "changed": len(diff.change_register),
    }


# ── Synthetic modifications ─────────────────────────────

def create_modified(ifc_path, mod_type):
    import ifcopenshell.api
    ifc = ifcopenshell.open(str(ifc_path))
    elems = [e for e in ifc.by_type("IfcElement") if not e.is_a("IfcFeatureElement")]

    if mod_type == "identical":
        pass

    elif mod_type == "rename":
        for i, el in enumerate(elems):
            if i % 3 == 0:
                el.Name = f"{el.Name or ''}_v2"

    elif mod_type == "move":
        for i, el in enumerate(elems):
            if i % 5 == 0 and getattr(el, "ObjectPlacement", None):
                try:
                    p = el.ObjectPlacement
                    if p.is_a("IfcLocalPlacement"):
                        rp = p.RelativePlacement
                        if rp and rp.is_a("IfcAxis2Placement3D"):
                            loc = rp.Location
                            c = list(loc.Coordinates)
                            c[0] += 500.0
                            loc.Coordinates = tuple(c)
                except Exception:
                    pass

    elif mod_type == "add_pset":
        for i, el in enumerate(elems):
            if i % 4 == 0:
                try:
                    pset = ifcopenshell.api.run("pset.add_pset", ifc, product=el, name="Pset_Benchmark")
                    ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset,
                                         properties={"BenchmarkVal": "test", "Score": 42.0})
                except Exception:
                    pass

    elif mod_type == "mixed":
        for i, el in enumerate(elems):
            if i % 7 == 0:
                el.Name = f"{el.Name or ''}_mod"
            if i % 11 == 0 and getattr(el, "ObjectPlacement", None):
                try:
                    p = el.ObjectPlacement
                    if p.is_a("IfcLocalPlacement"):
                        rp = p.RelativePlacement
                        if rp and rp.is_a("IfcAxis2Placement3D"):
                            loc = rp.Location
                            c = list(loc.Coordinates)
                            c[2] += 100.0
                            loc.Coordinates = tuple(c)
                except Exception:
                    pass

    return ifc


# ── Benchmark Runner ─────────────────────────────────────

STRATEGIES_SMALL = [
    ("guid_only",      strategy_guid_only),
    ("hash_fast",      strategy_hash_fast),
    ("hash+placement", strategy_hash_placement),
    ("ifcdiff_default", strategy_ifcdiff_default),
    ("ifcdiff_full",   strategy_ifcdiff_full),
]

STRATEGIES_LARGE = [
    ("guid_only",      strategy_guid_only),
    ("hash_fast",      strategy_hash_fast),
    ("hash+placement", strategy_hash_placement),
    ("ifcdiff_default", strategy_ifcdiff_default),
]


def run_pair(pair_name, old_ifc, new_ifc, strategies, n_runs=3):
    old_inf = file_info(old_ifc)
    new_inf = file_info(new_ifc)
    print(f"\n{'-' * 72}")
    print(f"  {pair_name}")
    print(f"  Old: {old_inf['products']} products, {old_inf['total_entities']} entities ({old_inf['schema_id']})")
    print(f"  New: {new_inf['products']} products, {new_inf['total_entities']} entities ({new_inf['schema_id']})")
    print(f"{'-' * 72}")

    if old_inf["schema"] != new_inf["schema"]:
        print(f"  SCHEMA MISMATCH: {old_inf['schema']} vs {new_inf['schema']} -> SKIP")
        return [{"pair": pair_name, "status": "schema_mismatch"}]

    rows = []
    for sname, sfn in strategies:
        timings = []
        mem_deltas = []
        result = None

        for _ in range(n_runs):
            gc.collect()
            with timer() as t:
                result = sfn(old_ifc, new_ifc)
            timings.append(t["elapsed"])
            mem_deltas.append(t["mem_delta_mb"])

        avg_t = sum(timings) / len(timings)
        min_t = min(timings)
        avg_m = sum(mem_deltas) / len(mem_deltas)

        print(f"  {sname:20s}  avg={avg_t:7.3f}s  min={min_t:7.3f}s  "
              f"mem={avg_m:+7.1f}MB  A={result['added']:4d}  "
              f"D={result['deleted']:4d}  C={result['changed']:4d}")

        rows.append({
            "pair": pair_name,
            "strategy": sname,
            "avg_s": round(avg_t, 4),
            "min_s": round(min_t, 4),
            "mem_mb": round(avg_m, 1),
            **result,
        })

    return rows


def main():
    print_system_info()

    ifc_files = sorted(TEST_DIR.glob("*.ifc"))
    print(f"Test files in {TEST_DIR}:")
    for f in ifc_files:
        sz = f.stat().st_size
        if sz > 1024 * 1024:
            print(f"  {f.name:55s}  {sz / (1024*1024):8.1f} MB")
        else:
            print(f"  {f.name:55s}  {sz / 1024:8.1f} KB")
    print()

    # ── Small file pairs ──
    arch4 = TEST_DIR / "Building-Architecture-IFC4.ifc"
    arch4x3 = TEST_DIR / "Building-Architecture-IFC4x3.ifc"
    road4 = TEST_DIR / "Infra-Road-IFC4.ifc"

    print("=" * 72)
    print("  PHASE 1: SMALL FILES (BuildingSMART test files)")
    print("=" * 72)

    all_results = []

    print("\n  Generating test pairs...")
    old_arch = ifcopenshell.open(str(arch4))

    pairs = [
        ("1_identical",    old_arch, ifcopenshell.open(str(arch4))),
        ("2_rename_30pct", old_arch, create_modified(arch4, "rename")),
        ("3_move_20pct",   old_arch, create_modified(arch4, "move")),
        ("4_add_pset",     old_arch, create_modified(arch4, "add_pset")),
        ("5_mixed",        old_arch, create_modified(arch4, "mixed")),
        ("6_cross_schema", old_arch, ifcopenshell.open(str(arch4x3))),
    ]

    road_old = ifcopenshell.open(str(road4))
    pairs.append(("7_road_mixed", road_old, create_modified(road4, "mixed")))

    for pname, o, n in pairs:
        rows = run_pair(pname, o, n, STRATEGIES_SMALL, n_runs=3)
        all_results.extend(rows)

    # ── Medium file ──
    medium_file = TEST_DIR / "small.ifc"
    if medium_file.exists():
        print()
        print("=" * 72)
        print("  PHASE 2: MEDIUM FILE (small.ifc, 2.5MB)")
        print("=" * 72)

        print("\n  Loading medium file...")
        with timer() as lt:
            med_ifc = ifcopenshell.open(str(medium_file))
        print(f"  Loaded in {lt['elapsed']:.1f}s, mem: {lt['mem_delta_mb']:+.0f} MB")

        med_inf = file_info(med_ifc)
        print(f"  Products: {med_inf['products']}, Entities: {med_inf['total_entities']}")
        print(f"  Schema: {med_inf['schema_id']}")

        print("\n  Generating modified copy...")
        with timer() as mt:
            med_mod = create_modified(medium_file, "mixed")
        print(f"  Modified copy in {mt['elapsed']:.1f}s")

        rows = run_pair("8_medium_mixed", med_ifc, med_mod, STRATEGIES_LARGE, n_runs=2)
        all_results.extend(rows)

        del med_mod
        gc.collect()

        print("\n  Testing identical medium file...")
        rows = run_pair("9_medium_identical", med_ifc, med_ifc, STRATEGIES_LARGE[:3], n_runs=2)
        all_results.extend(rows)

        del med_ifc
        gc.collect()

    # ── Large file (RAM-aware) ──
    large_file = TEST_DIR / "O1--_ASS_410_5-_FA-_T1_0000_-_GE_edited_edited.ifc"
    avail_gb = psutil.virtual_memory().available / (1024**3)
    if large_file.exists() and avail_gb > 4.0:
        print()
        print("=" * 72)
        print(f"  PHASE 3: LARGE FILE (178MB, avail RAM: {avail_gb:.1f} GB)")
        print("=" * 72)

        print("\n  Loading large file...")
        with timer() as lt:
            large_ifc = ifcopenshell.open(str(large_file))
        print(f"  Loaded in {lt['elapsed']:.1f}s, mem: {lt['mem_delta_mb']:+.0f} MB")

        large_inf = file_info(large_ifc)
        print(f"  Products: {large_inf['products']}, Entities: {large_inf['total_entities']}")

        rows = run_pair("10_large_identical", large_ifc, large_ifc,
                        STRATEGIES_LARGE[:3], n_runs=1)
        all_results.extend(rows)
    elif large_file.exists():
        print(f"\n  Skipping large file: only {avail_gb:.1f} GB RAM available (need >4 GB)")

    # ── Summary ──
    print()
    print("=" * 72)
    print("  SUMMARY TABLE")
    print("=" * 72)

    valid = [r for r in all_results if "strategy" in r]
    if valid:
        headers = ["Pair", "Strategy", "Avg(s)", "Min(s)", "Mem(MB)", "Added", "Deleted", "Changed"]
        rows = [[r["pair"], r["strategy"], r["avg_s"], r["min_s"],
                 r["mem_mb"], r["added"], r["deleted"], r["changed"]] for r in valid]
        print(tabulate(rows, headers=headers, tablefmt="grid"))

    print()
    print("  ACCURACY GROUND TRUTH:")
    print("  1_identical:     A=0, D=0, C=0")
    print("  2_rename_30pct:  A=0, D=0, C>0 (attr changes)")
    print("  3_move_20pct:    A=0, D=0, C>0 (placement)")
    print("  4_add_pset:      A=0, D=0, C>0 (property)")
    print("  5_mixed:         A=0, D=0, C>0 (combined)")
    print("  6_cross_schema:  REJECTED")
    print("  7_road_mixed:    A=0, D=0, C>0")
    print("  8_large_mixed:   A=0, D=0, C>0")
    print("  9_large_ident:   A=0, D=0, C=0")

    out = Path(__file__).parent / "benchmark_results.json"
    with open(out, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\n  Results saved: {out}")


if __name__ == "__main__":
    main()
