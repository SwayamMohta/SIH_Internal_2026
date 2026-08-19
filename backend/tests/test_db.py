import os
import sqlite3

import pytest

from src import db


@pytest.fixture()
def conn(tmp_path):
    path = os.path.join(str(tmp_path), "test.db")
    db.init_db(path)
    c = db.get_connection(path)
    yield c
    c.close()


def _tables(c):
    return {r[0] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )}


def _triggers(c):
    return {r[0] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger'"
    )}


def _indexes(c):
    return {r[0] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='index'"
    )}


def test_schema_objects_exist(conn):
    assert {"titles", "titles_fts"} <= _tables(conn)
    assert {"titles_ai", "titles_ad", "titles_au"} <= _triggers(conn)
    assert {
        "idx_titles_soundex",
        "idx_titles_metaphone_p",
        "idx_titles_metaphone_s",
        "idx_titles_state_lang",
        "idx_titles_status",
        "idx_titles_reg_number",
    } <= _indexes(conn)


def test_wal_mode(conn):
    assert conn.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"


def test_status_check_constraint(conn):
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO titles (title_raw, title_normalized, title_core, status)"
            " VALUES ('x', 'x', 'x', 'nonsense')"
        )


def _insert(conn, raw, norm):
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status)"
        " VALUES (?, ?, ?, 'registered')",
        (raw, norm, norm),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def _fts_rowids(conn, q):
    return {r[0] for r in conn.execute(
        "SELECT rowid FROM titles_fts WHERE titles_fts MATCH ?", (q,)
    )}


def test_insert_syncs_fts(conn):
    rid = _insert(conn, "samachar patrika", "samachar patrika")
    assert rid in _fts_rowids(conn, "patrik")


def test_update_syncs_fts(conn):
    rid = _insert(conn, "alpha beta", "alpha beta")
    assert rid in _fts_rowids(conn, "alpha")
    conn.execute(
        "UPDATE titles SET title_normalized = 'gamma delta' WHERE id = ?", (rid,)
    )
    conn.commit()
    assert rid not in _fts_rowids(conn, "alpha")
    assert rid in _fts_rowids(conn, "gamma")


def test_delete_syncs_fts(conn):
    rid = _insert(conn, "zeta eta", "zeta eta")
    assert rid in _fts_rowids(conn, "zeta")
    conn.execute("DELETE FROM titles WHERE id = ?", (rid,))
    conn.commit()
    assert rid not in _fts_rowids(conn, "zeta")