#!/usr/bin/env python
"""Run the adversarial title-matching validation suite and emit a baseline report.

Reproduces title_matching_adversarial_validation_plan.md against CURRENT code (no
algorithm changes). Reset-and-ingests a dedicated DB, executes every single-title query
via the production orchestrator with `debug=True` (bypasses cache; exposes all candidate
breakdowns), runs the G-group pending workflows, and writes
`data/reports/adversarial_validation_<timestamp>.json`.

Exit code is 0 unless a query whose expectation is a hard deterministic outcome
(hard-rule reject, exact-title reject) came back outside that expectation.
"""

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src import config, ingest, pending, verify  # noqa: E402
from src.cache import verification_cache  # noqa: E402

# Query IDs whose expectation is a hard, deterministic outcome (used for exit code only).
# C01/C02 combination-rule findings are excluded: they are retrieval-dependent and are
# evidence FOR phase-2 fixes, not baseline gates. They still get recorded as FAIL in
# the report via _assert_single's explicit handling.
MANDATORY = {"A01", "F01", "F02"}


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


def _diagnostics(result: dict) -> dict:
    breakdowns = result.get("all_candidate_breakdowns", []) or []
    cb = result.get("closest_match_breakdown")
    return {
        "normalized_title": result.get("normalized_title"),
        "candidate_count": result.get("candidate_count"),
        "candidate_titles": [c["candidate_title"] for c in breakdowns],
        "candidate_statuses": [c["candidate_status"] for c in breakdowns],
        "top_match": result.get("closest_match"),
        "top_match_status": result.get("closest_match_status"),
        "status": result.get("status"),
        "verification_probability": result.get("verification_probability"),
        "rule_violations": result.get("reasons") or [],
        "input_phonetics": result.get("input_phonetics"),
        "top_score_breakdown": cb,
        "requires_manual_semantic_review": result.get("requires_manual_semantic_review"),
        "from_cache": result.get("from_cache"),
    }


def _assert_single(q: dict, result: dict) -> tuple:
    """Return (assertion_result, note). Evidence-first; non-deterministic -> MANUAL_REVIEW."""
    rid = q["id"]; expect = q["expect"]; status = result["status"]
    prob = result["verification_probability"]
    if rid in {"F01", "F02"}:
        if status == "REJECTED" and prob == 0.0:
            return "PASS", "hard-reject short-circuit confirmed (no embedding needed)"
        return "FAIL", f"expected hard reject p=0, got {status}/{prob}"
    if rid in {"C01", "C02", "A01"}:
        if status == "REJECTED":
            return "PASS", "hard outcome confirmed"
        return "FAIL", f"expected REJECTED, got {status}"
    if rid == "E01":
        # Plan: candidate may not be retrieved — record, do not gate.
        found = any("daily evening" in (t or "").lower() for t in result["candidate_titles"])
        return "MANUAL_REVIEW", (
            "semantic retrieval not implemented; "
            f"daily_evening_in_candidates={found}"
        )
    return "MANUAL_REVIEW", f"evidence captured; expect: {expect}"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Run adversarial title-matching validation.")
    ap.add_argument("--corpus", default="tests/fixtures/adversarial_corpus.csv")
    ap.add_argument("--cases", default="tests/fixtures/adversarial_queries.json")
    ap.add_argument("--db", default=os.path.join("data", "adversarial_validation.db"))
    ap.add_argument("--report-dir", default=os.path.join("data", "reports"))
    ap.add_argument("--embed", choices=["real", "mock"], default="real",
                    help="real=LaBSE (default, cached); mock=unit vectors, no model")
    args = ap.parse_args(argv)

    os.makedirs(os.path.dirname(args.db) or ".", exist_ok=True)
    os.makedirs(args.report_dir, exist_ok=True)

    if args.embed == "mock":
        U = _unit()
        import numpy as _np
        ingest.embed_texts = lambda texts: _np.tile(U, (len(texts), 1))
        verify.embed_text = lambda text: U
        pending.embed_text = lambda text: U
        # Mock embeddings all-score 1.0 -> the semantic fallback would fabricate
        # matches against every corpus title. Disable it for non-semantic logic.
        verify.ENABLE_SEMANTIC_FALLBACK = False

    cases = json.load(open(args.cases, encoding="utf-8"))

    # Ingest corpus into a fresh dedicated DB.
    ingest.ingest_csv(args.corpus, reset=True, db_path=args.db)
    verification_cache.invalidate_all()

    results = []
    failures = []

    for q in cases["queries"]:
        rid = q["id"]
        entry = {"query_id": rid, "group": q["group"], "title": q.get("title"),
                 "expect": q["expect"], "steps": []}

        if "workflow" in q:
            # G-group: pending registration then re-verification (variable step count).
            for step in q["workflow"]:
                action, _, arg = step.partition(":")
                if action == "verify":
                    diag = _diagnostics(verify.verify_title(arg, db_path=args.db, debug=True))
                    entry["steps"].append(("verify", arg, diag))
                elif action == "register_pending":
                    reg = pending.register_pending(arg, language="en", state="Telangana",
                                                    periodicity="Daily", db_path=args.db)
                    entry["steps"].append(("register_pending", arg,
                                           {"registered": reg["registered"]}))
            entry["assertion_result"] = "MANUAL_REVIEW"
            entry["notes"] = "G-group workflow; see steps for pending+stale evidence"
        else:
            result = verify.verify_title(q["title"], db_path=args.db, debug=True)
            entry.update(_diagnostics(result))
            entry["assertion_result"], entry["notes"] = _assert_single(q, entry)
            if rid in MANDATORY and entry["assertion_result"] == "FAIL":
                failures.append((rid, entry["notes"]))

        results.append(entry)

    report = {
        "suite_name": cases["suite_name"],
        "version": cases["version"],
        "notes": cases["notes"],
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "embed_mode": args.embed,
        "db": os.path.abspath(args.db),
        "corpus": os.path.abspath(args.corpus),
        "query_count": len(results),
        "queries": results,
    }

    out = os.path.join(args.report_dir, f"adversarial_validation_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Report: {out}")
    print(f"Queries: {len(results)}  "
          f"PASS={sum(r['assertion_result']=='PASS' for r in results)}  "
          f"FAIL={sum(r['assertion_result']=='FAIL' for r in results)}  "
          f"MANUAL_REVIEW={sum(r['assertion_result']=='MANUAL_REVIEW' for r in results)}")
    print("Mandatory expectations:")
    for r in results:
        if r["query_id"] in MANDATORY:
            print(f"  {r['query_id']}: {r['assertion_result']} — {r['notes']}")

    if failures:
        print("Mandatory expectation FAILED: " + ", ".join(f"{rid}: {note}" for rid, note in failures),
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
