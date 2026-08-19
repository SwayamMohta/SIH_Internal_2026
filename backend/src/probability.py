"""Verification probability + status bands."""

from .config import REJECT_THRESHOLD, REVIEW_THRESHOLD


def compute_verification_result(rule_violations: list, similarity_results: list) -> dict:
    """verification_probability = (1 − max(combined_similarity)) × 100.

    Rule violations force 0.0 / REJECTED regardless of similarity. Uses only the
    single closest candidate — never an average.
    """
    if rule_violations:
        return {
            "verification_probability": 0.0,
            "status": "REJECTED",
            "reasons": rule_violations,
            "closest_match": None,
        }

    if not similarity_results:
        return {
            "verification_probability": 100.0,
            "status": "LIKELY_APPROVED",
            "reasons": [],
            "closest_match": None,
        }

    top_match = max(similarity_results, key=lambda r: r["combined_similarity"])
    probability = round((1 - top_match["combined_similarity"]) * 100, 2)

    if probability < REJECT_THRESHOLD:
        status = "REJECTED"
    elif probability < REVIEW_THRESHOLD:
        status = "REVIEW"
    else:
        status = "LIKELY_APPROVED"

    reasons = ([] if status != "REJECTED"
               else [f"Too similar to existing title '{top_match['candidate_title']}'"])

    return {
        "verification_probability": probability,
        "status": status,
        "reasons": reasons,
        "closest_match": top_match["candidate_title"],
        "closest_match_breakdown": top_match,
    }