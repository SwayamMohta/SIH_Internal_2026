"""Adversarial title-matching validation tests (baseline + post-fix regression).

Reproduces the assertions in title_matching_adversarial_validation_plan.md and
the fix prompts in implementation_prompt_after_adversarial_report.md against the
CURRENT code. Mock-embedding tests are for non-semantic logic only; the semantic
fallback tests are gated behind RUN_REAL_EMBED=1.
"""

import os

import numpy as np
import pytest

from app import app
from src import config, db, ingest, pending, verify
from src.cache import verification_cache
from src.phonetics import compute_phonetic_codes, token_phonetic_similarity

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
CORPUS = os.path.join(FIXTURES, "adversarial_corpus.csv")


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


def _mock_embeddings(monkeypatch):
    """Route all embed calls to deterministic unit vectors (dot==cosine 1.0)."""
    U = _unit()
    monkeypatch.setattr(ingest, "embed_texts", lambda texts: np.tile(U, (len(texts), 1)))
    monkeypatch.setattr(verify, "embed_text", lambda text: U)
    monkeypatch.setattr(pending, "embed_text", lambda text: U)
    return U


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Fresh DB seeded with the adversarial corpus under mocked embeddings.

    Semantic fallback is disabled so lexical/candidate evidence is deterministic
    (mock embeddings would otherwise all-score 1.0 and fabricate matches).
    """
    _mock_embeddings(monkeypatch)
    monkeypatch.setattr(verify, "ENABLE_SEMANTIC_FALLBACK", False)
    db_path = os.path.join(str(tmp_path), "adv.db")
    ingest.ingest_csv(CORPUS, reset=True, db_path=db_path)
    verification_cache.invalidate_all()
    return db_path


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Empty DB + Flask test client (production verify path) for the G group."""
    _mock_embeddings(monkeypatch)
    monkeypatch.setattr(verify, "ENABLE_SEMANTIC_FALLBACK", False)
    monkeypatch.setattr(config, "DB_PATH", os.path.join(str(tmp_path), "api.db"))
    db.init_db()
    verification_cache.invalidate_all()
    app.config["TESTING"] = True
    return app.test_client()


@pytest.fixture()
def real_fallback_db(tmp_path):
    """Real LaBSE fallback DB (RUN_REAL_EMBED=1 only). Semantic fallback stays ON."""
    db_path = os.path.join(str(tmp_path), "sem.db")
    ingest.ingest_csv(CORPUS, reset=True, db_path=db_path)
    verification_cache.invalidate_all()
    return db_path


# --- Baseline: whole-title phonetic encoding --------------------------------

def test_phonetic_encoding_is_currently_full_title_based():
    full = compute_phonetic_codes("namaskar darpan")
    word_1 = compute_phonetic_codes("namaskar")
    word_2 = compute_phonetic_codes("darpan")

    # Establishes current implementation behaviour; the dict now also carries a
    # per-token table (token_metaphones) alongside the whole-title codes.
    assert {"soundex", "metaphone_primary", "metaphone_secondary"}.issubset(full)
    assert full["metaphone_primary"] != ""
    assert word_1["metaphone_primary"] != ""
    assert word_2["metaphone_primary"] != ""


def test_namascar_darpan_retrieves_namaskar_darpan(isolated_db):
    result = verify.verify_title("Namascar Darpan", db_path=isolated_db, debug=True)
    candidates = {c["candidate_title"].lower() for c in result["all_candidate_breakdowns"]}
    assert "namaskar darpan" in candidates


# --- Part 1: hard rules decoupled from fuzzy retrieval ----------------------

def test_combination_rule_does_not_depend_on_fuzzy_retrieval(isolated_db):
    result = verify.verify_title("Hindu Indian Express", db_path=isolated_db)
    assert result["status"] == "REJECTED"
    assert result["verification_probability"] == 0.0
    assert any("combine" in reason.lower() for reason in result["reasons"])


def test_combination_rule_is_order_independent(isolated_db):
    result = verify.verify_title("Indian Hindu Express", db_path=isolated_db)
    assert result["status"] == "REJECTED"
    assert result["verification_probability"] == 0.0


def test_periodicity_rule_does_not_depend_on_fuzzy_retrieval(isolated_db):
    result = verify.verify_title("Bharat Daily Samachar", db_path=isolated_db)
    assert result["status"] == "REJECTED"
    assert result["verification_probability"] == 0.0
    assert any("periodicity" in reason.lower() for reason in result["reasons"])


# --- Part 2: input quality + generic-only policy -----------------------------

@pytest.mark.parametrize("title", ["A", "A A", "--"])
def test_too_short_title_is_invalid(isolated_db, title):
    result = verify.verify_title(title, db_path=isolated_db)
    assert result["status"] == "INVALID_INPUT"
    assert result["verification_probability"] is None


def test_generic_only_title_requires_review(isolated_db):
    result = verify.verify_title("News", db_path=isolated_db)
    assert result["status"] == "REVIEW"
    assert "generic" in result["reasons"][0].lower()


# --- Part 3: token-aware phonetics (covered in test_scoring.py too) ----------

def test_token_phonetics_catches_partial_soundalike():
    assert token_phonetic_similarity(
        compute_phonetic_codes("namascar darpan"),
        compute_phonetic_codes("namaskar darpan"),
    ) == 1.0


# --- Baseline: semantic retrieval gap (still open without fallback) ----------

@pytest.mark.xfail(strict=True, reason="Semantic candidate retrieval requires the fallback")
def test_cross_language_semantic_candidate_is_retrieved(isolated_db):
    result = verify.verify_title("Pratidin Sandhya", db_path=isolated_db, debug=True)
    candidates = {c["candidate_title"].lower() for c in result["all_candidate_breakdowns"]}
    assert "daily evening" in candidates


# --- Part 5: semantic fallback (real LaBSE only) -----------------------------

@pytest.mark.skipif(
    not os.environ.get("RUN_REAL_EMBED"),
    reason="slow real-model test; set RUN_REAL_EMBED=1 to run",
)
def test_semantic_fallback_retrieves_cross_language_candidate(real_fallback_db):
    result = verify.verify_title("Pratidin Sandhya", db_path=real_fallback_db, debug=True)
    titles = {c["candidate_title"].lower() for c in result["all_candidate_breakdowns"]}
    assert "daily evening" in titles


@pytest.mark.skipif(
    not os.environ.get("RUN_REAL_EMBED"),
    reason="slow real-model test; set RUN_REAL_EMBED=1 to run",
)
def test_semantic_only_candidate_is_marked_for_manual_review(real_fallback_db):
    result = verify.verify_title("Pratidin Sandhya", db_path=real_fallback_db, debug=True)
    assert result["requires_manual_semantic_review"] is True


# --- Plan test 5: cache invalidation after a pending insert -----------------

def test_pending_insert_invalidates_stale_approval_cache(client):
    first = client.post("/verify-title", json={"title": "Metro Mirror"}).get_json()
    assert first["status"] in {"LIKELY_APPROVED", "REVIEW"}

    pending_r = client.post("/register-pending", json={"title": "Metro Mirror"})
    assert pending_r.status_code in {200, 201}

    second = client.post("/verify-title", json={"title": "Metro Mirror"}).get_json()
    assert second["status"] == "REJECTED"
    assert second.get("from_cache") is False
