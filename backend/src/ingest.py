"""Idempotent CSV ingestion into the SQLite corpus (batched, embeddings as BLOB)."""

import argparse
import json
import os
import sys
import time

from . import config, db
from .cache import verification_cache
from .csv_mapping import get_value, map_headers, read_csv_rows
from .embeddings import embed_texts, serialize_vector
from .normalize import normalize_title
from .phonetics import compute_phonetic_codes

BATCH = 500

_INSERT_SQL = (
    "INSERT INTO titles (title_raw, title_normalized, title_core,"
    " registration_number, registration_date, language, state, periodicity,"
    " publisher, owner, district, status, soundex_code, metaphone_primary,"
    " metaphone_secondary, embedding)"
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?, ?)"
)


def _composite(norm, language, state, periodicity):
    return f"{norm}|{language}|{state}|{periodicity}"


def _embed_and_flush(conn, meta):
    """Embed all normalized titles in `meta` in one batch, then insert."""
    norms = [n for (_row, n) in meta]
    vecs = embed_texts(norms)
    batch = [row + (serialize_vector(vec),) for (row, _), vec in zip(meta, vecs)]
    conn.executemany(_INSERT_SQL, batch)
    conn.commit()


def ingest_csv(csv_path: str, reset: bool = False, db_path: str = None) -> dict:
    headers, rows, _encoding = read_csv_rows(csv_path)
    mapping = map_headers(headers)
    if "title" not in mapping:
        raise ValueError(f"No 'title' column found in {csv_path}. Headers: {headers}")

    start = time.time()
    # Ingesting changes the candidate corpus -> drop stale cached verdicts.
    verification_cache.invalidate_all()
    conn = db.connect(db_path)
    try:
        if reset:
            conn.execute("DELETE FROM titles")
            conn.commit()

        # Existing keys for idempotency (dedupe against prior ingestion runs).
        existing_reg = {
            r[0] for r in conn.execute(
                "SELECT registration_number FROM titles"
                " WHERE registration_number IS NOT NULL AND registration_number != ''"
            )
        }
        existing_comp = {
            r[0] for r in conn.execute(
                "SELECT title_normalized || '|' || IFNULL(language,'') || '|'"
                " || IFNULL(state,'') || '|' || IFNULL(periodicity,'') FROM titles"
            )
        }

        accepted = skipped_dup = empty_titles = errors = 0
        meta = []  # (row_tuple_without_embedding, normalized_title)

        for row in rows:
            raw_title = get_value(row, mapping, "title")
            if not raw_title:
                empty_titles += 1
                continue

            norm = normalize_title(raw_title)
            reg = get_value(row, mapping, "registration_number")
            language = get_value(row, mapping, "language")
            state = get_value(row, mapping, "state")
            periodicity = get_value(row, mapping, "periodicity")

            if reg and reg in existing_reg:
                skipped_dup += 1
                continue
            comp = _composite(norm["normalized"], language, state, periodicity)
            if comp in existing_comp:
                skipped_dup += 1
                continue

            phon = compute_phonetic_codes(norm["normalized"])
            row_tuple = (
                raw_title, norm["normalized"], norm["core"], reg,
                get_value(row, mapping, "registration_date"), language, state,
                periodicity, get_value(row, mapping, "publisher"),
                get_value(row, mapping, "owner"), get_value(row, mapping, "district"),
                phon["soundex"], phon["metaphone_primary"], phon["metaphone_secondary"],
            )
            meta.append((row_tuple, norm["normalized"]))
            if reg:
                existing_reg.add(reg)
            existing_comp.add(comp)
            accepted += 1

            if len(meta) >= BATCH:
                try:
                    _embed_and_flush(conn, meta)
                except Exception:
                    errors += len(meta)
                    accepted -= len(meta)
                meta = []

        if meta:
            try:
                _embed_and_flush(conn, meta)
            except Exception:
                errors += len(meta)
                accepted -= len(meta)
    finally:
        conn.close()

    return {
        "input_path": os.path.abspath(csv_path),
        "total_rows": len(rows),
        "accepted": accepted,
        "skipped_duplicates": skipped_dup,
        "empty_titles": empty_titles,
        "errors": errors,
        "elapsed_seconds": round(time.time() - start, 3),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Ingest a PRGI titles CSV into SQLite.")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--reset", action="store_true", help="rebuild corpus from CSV")
    ap.add_argument("--db", default=None, help="override DB path")
    args = ap.parse_args(argv)

    if not os.path.exists(args.csv):
        print(f"error: csv not found: {args.csv}", file=sys.stderr)
        return 1

    try:
        report = ingest_csv(args.csv, reset=args.reset, db_path=args.db)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    os.makedirs(config.REPORTS_DIR, exist_ok=True)
    base = os.path.splitext(os.path.basename(args.csv))[0]
    out = os.path.join(config.REPORTS_DIR, f"ingest_{base}_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Accepted:        {report['accepted']}")
    print(f"Skipped dupes:   {report['skipped_duplicates']}")
    print(f"Empty titles:    {report['empty_titles']}")
    print(f"Errors:          {report['errors']}")
    print(f"Elapsed:         {report['elapsed_seconds']}s")
    print(f"Report:          {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())