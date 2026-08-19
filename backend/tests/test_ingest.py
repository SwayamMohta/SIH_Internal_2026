import csv
import os

import numpy as np
import pytest

from src import db
from src import ingest as ingest_mod
from src.csv_mapping import CANONICAL_COLUMNS


@pytest.fixture()
def fixture_csv(tmp_path):
    p = os.path.join(str(tmp_path), "titles.csv")
    rows = [
        ["Title", "Registration Number", "Language", "State", "Periodicity"],
        ["Daily Samachar", "101", "English", "Delhi", "Daily"],
        ["Daily Samachar", "101", "English", "Delhi", "Daily"],  # dup reg
        ["Weekly Patrika", "102", "Hindi", "UP", "Weekly"],
    ]
    with open(p, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    return p


@pytest.fixture()
def fake_embed(monkeypatch):
    def fake(texts):
        return np.ones((len(texts), 768), dtype=np.float32) / np.sqrt(768)
    monkeypatch.setattr(ingest_mod, "embed_texts", fake)


def _counts(conn):
    total = conn.execute("SELECT COUNT(*) FROM titles").fetchone()[0]
    reg = conn.execute("SELECT COUNT(*) FROM titles WHERE status='registered'").fetchone()[0]
    emb = conn.execute("SELECT COUNT(*) FROM titles WHERE embedding IS NOT NULL").fetchone()[0]
    ph = conn.execute("SELECT COUNT(*) FROM titles WHERE soundex_code IS NOT NULL").fetchone()[0]
    fts = conn.execute("SELECT COUNT(*) FROM titles_fts").fetchone()[0]
    return total, reg, emb, ph, fts


def test_ingest_reset_and_idempotent(fixture_csv, fake_embed, tmp_path):
    dbp = os.path.join(str(tmp_path), "ingest.db")
    r1 = ingest_mod.ingest_csv(fixture_csv, reset=True, db_path=dbp)
    assert r1["accepted"] == 2
    assert r1["skipped_duplicates"] == 1  # the duplicate reg row

    c = db.get_connection(dbp)
    total, reg, emb, ph, fts = _counts(c)
    assert total == 2
    assert reg == 2
    assert emb == 2
    assert ph == 2
    assert fts == 2  # FTS trigger synced each insert
    c.close()

    # idempotent: second run without --reset inserts nothing
    r2 = ingest_mod.ingest_csv(fixture_csv, reset=False, db_path=dbp)
    assert r2["accepted"] == 0
    assert r2["skipped_duplicates"] == 3


def test_ingest_missing_title_column(tmp_path):
    p = os.path.join(str(tmp_path), "bad.csv")
    with open(p, "w", newline="", encoding="utf-8") as f:
        f.write("Foo,Bar\n1,2\n")
    with pytest.raises(ValueError):
        ingest_mod.ingest_csv(p, reset=True, db_path=os.path.join(str(tmp_path), "x.db"))


def test_ingest_embedding_bytes_shape(fixture_csv, fake_embed, tmp_path):
    dbp = os.path.join(str(tmp_path), "ingest2.db")
    ingest_mod.ingest_csv(fixture_csv, reset=True, db_path=dbp)
    c = db.get_connection(dbp)
    blob = c.execute("SELECT embedding FROM titles LIMIT 1").fetchone()[0]
    assert len(blob) == 768 * 4  # float32 x 768
    c.close()


def test_ingest_invalidates_cache(fixture_csv, fake_embed, tmp_path):
    from src.cache import verification_cache
    verification_cache.set("warm key", {"k": 1})
    ingest_mod.ingest_csv(fixture_csv, reset=True, db_path=os.path.join(str(tmp_path), "i.db"))
    assert verification_cache.get("warm key") is None