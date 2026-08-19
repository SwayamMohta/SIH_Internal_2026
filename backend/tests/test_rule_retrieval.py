import os

import pytest

from src import db
from src.normalize import normalize_title
from src.rule_retrieval import (find_exact_base_title_after_removing_periodicity,
                                find_titles_whose_tokens_are_subset_of_query)


@pytest.fixture()
def conn(tmp_path):
    path = os.path.join(str(tmp_path), "rule_retrieval.db")
    db.init_db(path)
    c = db.get_connection(path)
    yield c
    c.close()


def _insert(conn, title, status="registered"):
    norm = normalize_title(title)["normalized"]
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary)"
        " VALUES (?, ?, ?, ?, '', '', '')",
        (title, norm, norm, status),
    )
    conn.commit()


def test_subset_matches_two_source_titles(conn):
    _insert(conn, "Hindu")
    _insert(conn, "Indian Express")
    _insert(conn, "Unrelated Gazette")
    rows = find_titles_whose_tokens_are_subset_of_query(conn, "hindu indian express")
    norms = {r["title_normalized"] for r in rows}
    assert norms == {"hindu", "indian express"}


def test_subset_does_not_include_unrelated(conn):
    _insert(conn, "Hindu")
    _insert(conn, "Telangana Chronicle")
    rows = find_titles_whose_tokens_are_subset_of_query(conn, "hindu indian express")
    norms = {r["title_normalized"] for r in rows}
    assert norms == {"hindu"}


def test_subset_excludes_pending_of_other_status(conn):
    _insert(conn, "Hindu")
    _insert(conn, "Pending Extra", status="rejected")  # rejected must not appear
    rows = find_titles_whose_tokens_are_subset_of_query(conn, "pending extra")
    assert rows == []


def test_exact_base_after_periodicity(conn):
    _insert(conn, "Bharat Samachar")
    rows = find_exact_base_title_after_removing_periodicity(
        conn, "bharat daily samachar", {"daily"})
    assert [r["title_normalized"] for r in rows] == ["bharat samachar"]


def test_exact_base_reordered_input(conn):
    _insert(conn, "Bharat Samachar")
    rows = find_exact_base_title_after_removing_periodicity(
        conn, "samachar daily bharat", {"daily"})
    assert [r["title_normalized"] for r in rows] == ["bharat samachar"]


def test_exact_base_no_periodicity_word(conn):
    _insert(conn, "Bharat Samachar")
    # 'express' is not a periodicity word -> helper not applicable
    assert find_exact_base_title_after_removing_periodicity(
        conn, "express bharat samachar", {"daily"}) == []


def test_exact_base_no_base_title(conn):
    _insert(conn, "Bharat Samachar")
    assert find_exact_base_title_after_removing_periodicity(
        conn, "daily telangana bulletin", {"daily"}) == []
