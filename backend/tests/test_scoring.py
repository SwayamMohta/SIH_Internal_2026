import numpy as np

from src.embeddings import deserialize_vector, serialize_vector
from src.phonetics import compute_phonetic_codes, token_phonetic_similarity
from src.scoring import (edit_distance_score, phonetic_match_score,
                         score_candidate, token_jaccard_similarity)


def test_edit_identical_is_one():
    assert edit_distance_score("namaskar", "namaskar") == 1.0


def test_edit_different_is_less_than_one():
    assert 0.0 <= edit_distance_score("namaskar", "xyzzy") < 1.0


def test_phonetic_overlap_full_title():
    a = compute_phonetic_codes("namaskar patrika")
    b = compute_phonetic_codes("namaskar patrika")
    score, details = phonetic_match_score(a, b)
    assert details["full_title_phonetic_overlap"] is True
    assert score >= 0.70


def test_phonetic_disjoint():
    a = compute_phonetic_codes("zzzz")
    b = compute_phonetic_codes("qqqqqq")
    score, details = phonetic_match_score(a, b)
    assert score == 0.0


def test_token_phonetics_catches_partial_soundalike():
    q = compute_phonetic_codes("namascar darpan")
    c = compute_phonetic_codes("namaskar darpan")
    assert token_phonetic_similarity(q, c) == 1.0


def test_generic_tokens_do_not_drive_token_phonetic_score():
    q = compute_phonetic_codes("news chronicle")
    c = compute_phonetic_codes("news today")
    assert token_phonetic_similarity(q, c) == 0.0


def test_distinctive_partial_token_match_is_explainable():
    q = compute_phonetic_codes("kisan darshan")
    c = compute_phonetic_codes("kisan darpan")
    score = token_phonetic_similarity(q, c)
    assert 0.0 < score < 1.0


def test_token_jaccard_meaningful_overlap():
    # generic-only shared words do not move the score...
    assert token_jaccard_similarity("samachar chronicle", "samachar today") == 0.0
    # ...but a shared distinctive token does.
    assert token_jaccard_similarity("hindu telegraph", "hindu times") > 0.0


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_score_candidate_identical_is_full():
    codes = compute_phonetic_codes("namaskar darpan")
    emb = serialize_vector(_unit())
    new_data = {"normalized": "namaskar darpan"}
    cand = {"id": 1, "title_raw": "Namaskar Darpan", "title_normalized": "namaskar darpan",
            "embedding": emb}
    r = score_candidate(new_data, _unit(), codes, cand, codes)
    assert r["edit_similarity"] == 1.0
    assert r["phonetic_similarity"] >= 0.70
    assert round(r["semantic_similarity"], 2) == 1.0
    assert round(r["token_overlap_similarity"], 2) == 1.0
    assert r["combined_similarity"] == 1.0
    assert r["candidate_id"] == 1
    assert r["candidate_title"] == "Namaskar Darpan"
    assert r["full_title_phonetic_overlap"] is True


def test_score_candidate_cosine_clamped():
    codes = compute_phonetic_codes("zzzz")
    other = compute_phonetic_codes("qqqqqq")
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([0.0, 1.0], dtype=np.float32)
    new_data = {"normalized": "zzzz"}
    cand = {"id": 2, "title_raw": "qqqqqq", "title_normalized": "qqqqqq",
            "embedding": serialize_vector(b)}
    r = score_candidate(new_data, a, codes, cand, other)
    assert round(r["semantic_similarity"], 4) == 0.0
    assert 0.0 <= r["combined_similarity"] <= 1.0


def test_blob_roundtrip():
    v = _unit(8)
    back = deserialize_vector(serialize_vector(v))
    assert back.shape == v.shape
    assert np.allclose(back, v)


def test_empty_blob():
    assert deserialize_vector(b"").size == 0