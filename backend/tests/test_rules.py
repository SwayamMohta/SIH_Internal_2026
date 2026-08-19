import os

import pytest

from src import db
from src.normalize import normalize_title
from src.rules import (check_disallowed_words, check_input_quality,
                       check_periodicity_addition_from_corpus,
                       check_title_combination_from_corpus, run_rule_engine)


@pytest.fixture()
def conn(tmp_path):
    path = os.path.join(str(tmp_path), "rules.db")
    db.init_db(path)
    c = db.get_connection(path)
    yield c
    c.close()


def _insert(conn, title):
    norm = normalize_title(title)["normalized"]
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary)"
        " VALUES (?, ?, ?, 'registered', '', '', '')",
        (title, norm, norm),
    )
    conn.commit()


# --- Disallowed words --------------------------------------------------------

def test_disallowed_single_word():
    r = check_disallowed_words({"weekly", "police"})
    assert r == "Title contains disallowed word(s): police"


def test_disallowed_multiple_sorted():
    r = check_disallowed_words({"cbi", "army", "police"})
    assert r == "Title contains disallowed word(s): army, cbi, police"


def test_disallowed_none():
    assert check_disallowed_words({"daily", "samachar"}) is None


# --- Input quality (Part 2) -------------------------------------------------

def test_too_short_is_invalid():
    r = check_input_quality({"normalized": "a"})
    assert r is not None and "at least 3 alphanumeric" in r


def test_generic_only_is_review():
    r = check_input_quality({"normalized": "news"})
    assert r is not None and "generic" in r


def test_meaningful_title_passes():
    assert check_input_quality({"normalized": "namaskar darpan"}) is None


# --- Periodicity from corpus (Part 1) --------------------------------------

def test_periodicity_addition_from_corpus(conn):
    _insert(conn, "Samachar Patrika")
    r = check_periodicity_addition_from_corpus(conn, "daily samachar patrika")
    assert r == "Title formed by adding periodicity to existing title 'Samachar Patrika'"


def test_periodicity_no_base(conn):
    _insert(conn, "Samachar Patrika")
    assert check_periodicity_addition_from_corpus(conn, "daily express bulletin") is None


def test_periodicity_requires_periodicity_word(conn):
    _insert(conn, "Samachar Patrika")
    # 'express' is not a periodicity word -> not applicable
    assert check_periodicity_addition_from_corpus(conn, "express samachar patrika") is None


# --- Combination from corpus (Part 1) --------------------------------------

def test_combination_detected_order_independent(conn):
    _insert(conn, "Hindu")
    _insert(conn, "Indian Express")
    r = check_title_combination_from_corpus(conn, "indian hindu express")
    assert "combine" in r and "Indian Express" in r and "Hindu" in r


def test_combination_not_triggered_by_shared_word_only(conn):
    _insert(conn, "Daily Times")
    _insert(conn, "The Hindu")
    # only one title's full token set is a subset -> no false positive
    assert check_title_combination_from_corpus(conn, "the hindu daily") is None


def test_combination_ignores_query_identical_to_one_title(conn):
    # A title equal to a single existing title is not a "combination".
    _insert(conn, "Hindu Express")
    assert check_title_combination_from_corpus(conn, "hindu express") is None


# --- run_rule_engine --------------------------------------------------------

def test_run_rule_engine_periodicity(conn):
    _insert(conn, "Bharat Samachar")
    data = normalize_title("bharat daily samachar")
    violations = run_rule_engine(conn, data)
    assert len(violations) == 1
    assert "periodicity" in violations[0]


def test_run_rule_engine_combination(conn):
    _insert(conn, "Hindu")
    _insert(conn, "Indian Express")
    violations = run_rule_engine(conn, normalize_title("hindu indian express"))
    assert any("combine" in v for v in violations)


def test_run_rule_engine_disallowed_only(conn):
    violations = run_rule_engine(conn, normalize_title("police daily"))
    assert violations == ["Title contains disallowed word(s): police"]


def test_run_rule_engine_clean(conn):
    _insert(conn, "Other Title")
    assert run_rule_engine(conn, normalize_title("unique constellation")) == []