import os

import numpy as np
import pytest

from src import db
from src.embeddings import serialize_vector
from src.normalize import normalize_title
from src.phonetics import compute_phonetic_codes
from src.semantic_retrieval import get_semantic_fallback_candidates


@pytest.fixture()
def conn(tmp_path):
    path = os.path.join(str(tmp_path), "semantic_retrieval.db")
    db.init_db(path)
    c = db.get_connection(path)
    yield c
    c.close()


def _insert(conn, title, vector, status="registered"):
    norm = normalize_title(title)["normalized"]
    phon = compute_phonetic_codes(norm)
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary, embedding)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (title, norm, norm, status, phon["soundex"], phon["metaphone_primary"],
         phon["metaphone_secondary"], serialize_vector(vector)),
    )
    conn.commit()


def _unit():
    v = np.ones(4, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_fallback_returns_above_threshold_sorted(conn):
    _insert(conn, "Daily Evening", _unit())
    other = np.zeros(4, dtype=np.float32); other[0] = 1.0
    _insert(conn, "Unrelated", other)  # orthogonal -> cosine 0 < min_score

    query = _unit()  # cosine 1.0 with "Daily Evening", 0 with "Unrelated"
    res = get_semantic_fallback_candidates(conn, query, min_score=0.72, top_k=10)
    assert [r["title_normalized"] for r in res] == ["daily evening"]
    assert res[0]["semantic_retrieval_score"] == 1.0
    assert res[0]["retrieval_sources"] == ["semantic_fallback"]


def test_fallback_top_k_bounds(conn):
    for i in range(5):
        _insert(conn, f"Match Title {i}", _unit())
    res = get_semantic_fallback_candidates(conn, _unit(), min_score=0.0, top_k=2)
    assert len(res) == 2


def test_fallback_excludes_rejected(conn):
    _insert(conn, "Daily Evening", _unit(), status="rejected")
    res = get_semantic_fallback_candidates(conn, _unit(), min_score=0.0, top_k=10)
    assert res == []
