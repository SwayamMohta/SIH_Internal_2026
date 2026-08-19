import os

import numpy as np
import pytest

from src import db, verify
from src.cache import verification_cache
from src.embeddings import serialize_vector
from src.phonetics import compute_phonetic_codes


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


@pytest.fixture()
def seeded(tmp_path, monkeypatch):
    path = os.path.join(str(tmp_path), "verify.db")
    db.init_db(path)
    c = db.get_connection(path)
    U = _unit()
    phon = compute_phonetic_codes("panorama samachar")
    c.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary, embedding)"
        " VALUES (?, ?, ?, 'registered', ?, ?, ?, ?)",
        ("Panorama Samachar", "panorama samachar", "panorama samachar",
         phon["soundex"], phon["metaphone_primary"], phon["metaphone_secondary"],
         serialize_vector(U)),
    )
    c.commit()
    c.close()
    monkeypatch.setattr(verify, "embed_text", lambda text: U)
    # Semantic-fallback off keeps the no-candidate / lazy-embedding tests
    # deterministic under mocked embeddings (which would otherwise all-score 1.0).
    monkeypatch.setattr(verify, "ENABLE_SEMANTIC_FALLBACK", False)
    verification_cache.invalidate_all()
    yield path


def test_too_similar_rejected(seeded):
    r = verify.verify_title("Panorama Samachar", seeded)
    assert r["status"] == "REJECTED"
    assert r["verification_probability"] == 0.0
    assert r["closest_match"] == "Panorama Samachar"
    assert r["closest_match_status"] == "registered"
    assert r["closest_match_breakdown"]["candidate_id"] is not None
    assert r["candidate_count"] >= 1
    assert r["from_cache"] is False
    assert r["requires_manual_semantic_review"] is False
    assert "preliminary assessment" in r["disclaimer"]


def test_disallowed_word_rejected(seeded, monkeypatch):
    called = []
    monkeypatch.setattr(verify, "embed_text", lambda text: called.append(text) or _unit())
    r = verify.verify_title("police daily", seeded)
    assert r["status"] == "REJECTED"
    assert r["verification_probability"] == 0.0
    assert any("police" in reason for reason in r["reasons"])
    assert r["closest_match"] is None
    assert r["closest_match_status"] is None
    assert r["closest_match_breakdown"] is None
    assert called == []  # hard rule short-circuits before embedding/scoring


def test_no_candidates_likely_approved(seeded, monkeypatch):
    called = []
    monkeypatch.setattr(verify, "embed_text", lambda text: called.append(text) or _unit())
    r = verify.verify_title("Zxqj Quvly Umberable", seeded)
    assert r["status"] == "LIKELY_APPROVED"
    assert r["verification_probability"] == 100.0
    assert r["closest_match"] is None
    assert r["candidate_count"] == 0
    assert called == []  # no candidates -> no embedding


def test_short_title_is_invalid_input(seeded):
    r = verify.verify_title("A A", seeded)
    assert r["status"] == "INVALID_INPUT"
    assert r["verification_probability"] is None


def test_generic_only_title_requires_review(seeded):
    r = verify.verify_title("patrika", seeded)
    assert r["status"] == "REVIEW"
    assert "generic" in r["reasons"][0].lower()


def test_cache_hit(seeded):
    verify.verify_title("Panorama Samachar", seeded)
    r = verify.verify_title("Panorama Samachar", seeded)
    assert r["from_cache"] is True
    assert r["status"] == "REJECTED"


def test_blank_title_raises(seeded):
    with pytest.raises(ValueError):
        verify.verify_title("   ", seeded)