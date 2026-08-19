"""End-to-end verification orchestration."""

import json
import sys

from . import config, db
from .cache import verification_cache
from .config import (ENABLE_SEMANTIC_FALLBACK, SEMANTIC_FALLBACK_MIN_SCORE,
                     SEMANTIC_FALLBACK_TOP_K,
                     SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN)
from .embeddings import embed_text
from .normalize import normalize_title
from .phonetics import compute_phonetic_codes, token_phonetic_map
from .probability import compute_verification_result
from .retrieval import get_candidates
from .rules import check_input_quality, run_rule_engine
from .scoring import score_candidate
from .semantic_retrieval import get_semantic_fallback_candidates


def _quality_response(issue: str) -> dict:
    """Response for an input-quality rejection (too short -> INVALID_INPUT,
    generic-only -> REVIEW). Never LIKELY_APPROVED without an explainable reason."""
    invalid = "at least" in issue
    return {
        "status": "INVALID_INPUT" if invalid else "REVIEW",
        "verification_probability": None,
        "reasons": [issue],
        "closest_match": None,
        "closest_match_status": None,
        "closest_match_breakdown": None,
        "candidate_count": 0,
        "from_cache": False,
        "requires_manual_semantic_review": False,
        "disclaimer": config.DISCLAIMER,
    }


def _shape_response(core: dict, status_by_id: dict, candidate_count: int,
                    semantic_only: bool = False,
                    similarity_results: list = None) -> dict:
    breakdown = core.get("closest_match_breakdown")
    cid = breakdown["candidate_id"] if breakdown else None
    top_conflicts = [
        s["candidate_title"]
        for s in sorted(similarity_results or [],
                        key=lambda r: r["combined_similarity"], reverse=True)[:5]
    ]
    return {
        "status": core["status"],
        "verification_probability": core["verification_probability"],
        "reasons": core["reasons"],
        "closest_match": core["closest_match"],
        "closest_match_status": status_by_id.get(cid),
        "closest_match_breakdown": breakdown,
        "top_conflicts": top_conflicts,
        "candidate_count": candidate_count,
        "requires_manual_semantic_review": semantic_only,
        "from_cache": False,
        "disclaimer": config.DISCLAIMER,
    }


def verify_title(raw_title: str, db_path: str = None, debug: bool = False) -> dict:
    """Assess a proposed title against the local corpus + pending titles.

    Order: input-quality policy -> deterministic hard rules (exact corpus
    lookups, independent of fuzzy retrieval) -> candidate retrieval -> optional
    semantic fallback -> scoring. Embeddings are only computed when scoring is
    actually needed (rule reject / quality reject skip embedding).

    `debug=True` is a test-only path: bypasses the cache and appends
    `normalized_title`, `input_phonetics` and `all_candidate_breakdowns`. It is
    never exposed in the production API (app.py does not pass `debug`).

    Raises ValueError for a blank title (callers validate first; this is a
    final guard so an empty string never silently reads LIKELY_APPROVED).
    """
    if not raw_title or not raw_title.strip():
        raise ValueError("title is required")

    if not debug:
        cached = verification_cache.get(raw_title)
        if cached is not None:
            cached["from_cache"] = True
            return cached

    conn = db.connect(db_path)
    try:
        new_title_data = normalize_title(raw_title)

        # Part 2: input-quality / generic-only policy.
        quality_issue = check_input_quality(new_title_data)
        if quality_issue:
            response = _quality_response(quality_issue)
            if not debug:
                verification_cache.set(raw_title, response)
            return response

        # Part 1: deterministic hard rules first, decoupled from retrieval.
        rule_violations = run_rule_engine(conn, new_title_data)
        if rule_violations:
            core = compute_verification_result(rule_violations, [])
            response = _shape_response(core, {}, 0)
            if not debug:
                verification_cache.set(raw_title, response)
            return response

        new_phonetic_codes = compute_phonetic_codes(new_title_data["normalized"])
        candidates = get_candidates(conn, new_title_data, new_phonetic_codes)

        # Part 5 — conditional semantic fallback when blocking finds nothing.
        # This forces an embedding even when there are no lexical candidates
        # (the documented trade-off of the fallback).
        needs_embedding = bool(candidates)
        if (ENABLE_SEMANTIC_FALLBACK
                and len(candidates) < SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN):
            needs_embedding = True

        new_embedding = embed_text(new_title_data["normalized"]) if needs_embedding else None

        semantic_only = False
        if (ENABLE_SEMANTIC_FALLBACK and new_embedding is not None
                and len(candidates) < SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN):
            semantic_candidates = get_semantic_fallback_candidates(
                conn, new_embedding,
                min_score=SEMANTIC_FALLBACK_MIN_SCORE,
                top_k=SEMANTIC_FALLBACK_TOP_K,
            )
            existing_ids = {c["id"] for c in candidates}
            added = [c for c in semantic_candidates if c["id"] not in existing_ids]
            semantic_only = bool(added) and not candidates
            candidates.extend(added)

        similarity_results = []
        if candidates and new_embedding is not None:
            for cand in candidates:
                cand_phon = {
                    "metaphone_primary": cand["metaphone_primary"],
                    "metaphone_secondary": cand["metaphone_secondary"],
                    "token_metaphones": token_phonetic_map(cand["title_normalized"]),
                }
                sim = score_candidate(new_title_data, new_embedding,
                                      new_phonetic_codes, cand, cand_phon)
                sim["candidate_status"] = cand["status"]
                sim["retrieval_sources"] = cand.get("retrieval_sources", [])
                similarity_results.append(sim)

        core = compute_verification_result(rule_violations, similarity_results)

        # Semantic-only candidates must be a manual-review signal, never an
        # automatic rejection (until calibrated on labelled data).
        if semantic_only and not rule_violations:
            core = dict(core)
            core["status"] = "REVIEW"
            core["reasons"] = [
                "Top match identified only via semantic similarity; manual review required."
            ]

        status_by_id = {c["id"]: c["status"] for c in candidates}
    finally:
        conn.close()

    response = _shape_response(core, status_by_id, len(candidates), semantic_only,
                               similarity_results)
    if debug:
        response["normalized_title"] = new_title_data["normalized"]
        response["input_phonetics"] = {
            "soundex": new_phonetic_codes["soundex"],
            "metaphone_primary": new_phonetic_codes["metaphone_primary"],
            "metaphone_secondary": new_phonetic_codes["metaphone_secondary"],
        }
        response["all_candidate_breakdowns"] = similarity_results
    else:
        verification_cache.set(raw_title, response)
    return response


if __name__ == "__main__":
    title = " ".join(sys.argv[1:])
    if not title.strip():
        print(json.dumps({"error": "title is required"}))
        sys.exit(2)
    try:
        result = verify_title(title)
    except Exception as exc:  # no traceback to the user
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
    print(json.dumps(result, indent=2))