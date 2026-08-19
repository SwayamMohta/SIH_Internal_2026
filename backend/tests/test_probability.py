from src.probability import compute_verification_result


def _sim(combined, title="Existing"):
    return {"candidate_id": 1, "candidate_title": title,
            "edit_similarity": 0.0, "phonetic_similarity": 0.0,
            "semantic_similarity": 0.0, "combined_similarity": combined}


def test_rule_violation_forces_zero_and_rejected():
    r = compute_verification_result(["Title contains disallowed word(s): police"], [_sim(0.9)])
    assert r["verification_probability"] == 0.0
    assert r["status"] == "REJECTED"
    assert r["closest_match"] is None


def test_no_candidates_likely_approved():
    r = compute_verification_result([], [])
    assert r["verification_probability"] == 100.0
    assert r["status"] == "LIKELY_APPROVED"
    assert r["closest_match"] is None


def test_probability_formula_uses_top_only():
    r = compute_verification_result([], [_sim(0.8, "far"), _sim(0.5, "near")])
    # top is 0.8 -> probability = round(0.2 * 100) = 20.0
    assert r["verification_probability"] == 20.0
    assert r["status"] == "REJECTED"
    assert r["closest_match"] == "far"


def test_review_band():
    r = compute_verification_result([], [_sim(0.5)])
    assert r["verification_probability"] == 50.0
    assert r["status"] == "REVIEW"


def test_exact_reject_boundary_30_is_review():
    # combined 0.70 -> probability exactly 30.00 -> REVIEW (not REJECTED)
    r = compute_verification_result([], [_sim(0.70)])
    assert r["verification_probability"] == 30.0
    assert r["status"] == "REVIEW"


def test_just_below_reject_boundary():
    r = compute_verification_result([], [_sim(0.7001)])
    assert r["verification_probability"] == 29.99
    assert r["status"] == "REJECTED"


def test_exact_approve_boundary_60():
    # combined 0.40 -> probability exactly 60.00 -> LIKELY_APPROVED
    r = compute_verification_result([], [_sim(0.40)])
    assert r["verification_probability"] == 60.0
    assert r["status"] == "LIKELY_APPROVED"