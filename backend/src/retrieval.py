"""Candidate retrieval (blocking) — soundex + Double Metaphone + FTS5 trigram.

Each channel runs as its own query, then candidates are unioned by id with a
`retrieval_sources` list so scoring/reporting can explain why a candidate
appeared.
"""

import sqlite3

from .config import CANDIDATE_LIMIT

_COLUMNS = ["id", "title_raw", "title_normalized", "title_core", "language",
            "state", "status", "embedding", "metaphone_primary",
            "metaphone_secondary", "soundex_code"]


def _rows_to_dicts(rows) -> list:
    return [dict(zip(_COLUMNS, row)) for row in rows]


def _with_source(row: dict, source: str) -> dict:
    row = dict(row)
    row.setdefault("retrieval_sources", [])
    if source not in row["retrieval_sources"]:
        row["retrieval_sources"].append(source)
    return row


def _merge(by_id: dict, rows: list, source: str):
    for row in _rows_to_dicts(rows):
        rid = row["id"]
        if rid in by_id:
            by_id[rid] = _with_source(by_id[rid], source)
        else:
            by_id[rid] = _with_source(row, source)


def get_candidates(conn: sqlite3.Connection, new_title_data: dict,
                   phonetic_codes: dict, limit: int = CANDIDATE_LIMIT) -> list:
    """Union of blocking signals, deduplicated by id, bounded by `limit`.

    Includes `registered` and `pending` titles (not `rejected`). Each candidate
    carries its retrieval sources, stored phonetic codes, and embedding.
    """
    norm = new_title_data["normalized"]
    phon = phonetic_codes

    if not norm:
        return []

    params = {
        "soundex": phon["soundex"],
        "mp": phon["metaphone_primary"],
        "ms": phon["metaphone_secondary"],
    }
    where = "WHERE t.status IN ('registered','pending')"
    cols = ", ".join("t." + c for c in _COLUMNS)

    by_id: dict[int, dict] = {}

    if phon["soundex"]:
        rows = conn.execute(
            f"SELECT DISTINCT {cols} FROM titles t {where} AND t.soundex_code = :soundex LIMIT :limit",
            {**params, "limit": limit},
        ).fetchall()
        _merge(by_id, rows, "soundex")

    if phon["metaphone_primary"] or phon["metaphone_secondary"]:
        rows = conn.execute(
            f"SELECT DISTINCT {cols} FROM titles t {where} AND (t.metaphone_primary IN (:mp, :ms) OR t.metaphone_secondary IN (:mp, :ms)) LIMIT :limit",
            {**params, "limit": limit},
        ).fetchall()
        _merge(by_id, rows, "metaphone")

    # FTS5 trigram matches >= 3-char queries; short titles need a LIKE fallback.
    if len(norm.replace(" ", "")) >= 3:
        rows = conn.execute(
            f"SELECT DISTINCT {cols} FROM titles t {where} AND t.id IN (SELECT rowid FROM titles_fts WHERE title_normalized MATCH :q) LIMIT :limit",
            {"q": norm.replace('"', ""), "limit": limit},
        ).fetchall()
        _merge(by_id, rows, "fts5_trigram")
    else:
        rows = conn.execute(
            f"SELECT DISTINCT {cols} FROM titles t {where} AND t.title_normalized LIKE :q LIMIT :limit",
            {"q": "%" + norm + "%", "limit": limit},
        ).fetchall()
        _merge(by_id, rows, "like_short_title")

    return sorted(by_id.values(), key=lambda row: row["id"])[:limit]