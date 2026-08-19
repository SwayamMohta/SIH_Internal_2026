import os

import pytest

from src import db
from src.normalize import normalize_title
from src.phonetics import compute_phonetic_codes
from src.retrieval import get_candidates


@pytest.fixture()
def conn(tmp_path):
    path = os.path.join(str(tmp_path), "retrieval.db")
    db.init_db(path)
    c = db.get_connection(path)
    yield c
    c.close()


def _insert(conn, title, status="registered", norm=None):
    norm = norm or normalize_title(title)["normalized"]
    phon = compute_phonetic_codes(norm)
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (title, norm, norm, status, phon["soundex"],
         phon["metaphone_primary"], phon["metaphone_secondary"]),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def _ids(results):
    return {r["id"] for r in results}


def _candidates(conn, title):
    data = normalize_title(title)
    phon = compute_phonetic_codes(data["normalized"])
    return get_candidates(conn, data, phon)


def test_soundex_path(conn):
    _insert(conn, "Namaskar Patrika")
    _insert(conn, "Namascar Bulletin")  # same Soundex (N526...)
    _insert(conn, "Quarterly Journal")
    res = _candidates(conn, "Namaskar")
    assert _ids(res)  # soundex channel returns at least the Namaskar-ish rows


def test_metaphone_path(conn):
    _insert(conn, "India Today")
    _insert(conn, "Republic")  # unrelated
    res = _candidates(conn, "India Todey")
    # phonetic (double metaphone) overlap catches the misspelling
    assert any("india today" in r["title_normalized"] for r in res)


def test_fts_trigram_path(conn):
    _insert(conn, "Samachar Patrika")
    _insert(conn, "Practical Quarterly")
    res = _candidates(conn, "Samachar")
    assert any("samachar patrika" == r["title_normalized"] for r in res)


def test_short_title_like_fallback(conn):
    _insert(conn, "AB News")
    _insert(conn, "XYZ News")
    # "ab" is <3 chars -> trigram can't match; LIKE fallback must.
    res = _candidates(conn, "ab")
    assert any("ab news" == r["title_normalized"] for r in res)


def test_dedup_across_signals(conn):
    rid = _insert(conn, "Samachar Daily")
    res = _candidates(conn, "Samachar Daily")
    ids = [r["id"] for r in res]
    assert ids.count(rid) == 1  # a row matching every signal appears once


def test_limit_bounded(conn):
    for i in range(10):
        _insert(conn, f"Common Weekly {i}")
    res = get_candidates(conn, normalize_title("Common"),  # all share tokens
                         compute_phonetic_codes("common"), limit=5)
    assert len(res) <= 5


def test_pending_included(conn):
    _insert(conn, "Pending Title", status="pending")
    res = _candidates(conn, "Pending")
    assert any(r["status"] == "pending" for r in res)


def test_rejected_excluded(conn):
    _insert(conn, "Rejected Title", status="rejected")
    res = _candidates(conn, "Rejected")
    assert all(r["status"] != "rejected" for r in res)


def test_empty_title_returns_none(conn):
    _insert(conn, "Something")
    assert get_candidates(conn, normalize_title(""), compute_phonetic_codes("")) == []


def test_candidate_carries_phonetics_and_embedding_column(conn):
    rid = _insert(conn, "Carrier Weekly")
    res = _candidates(conn, "Carrier")
    hit = next(r for r in res if r["id"] == rid)
    assert "metaphone_primary" in hit and "soundex_code" in hit
    assert "embedding" in hit  # column present (may be NULL for these seeds)