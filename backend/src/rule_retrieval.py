"""Exact/token-aware corpus lookups used by deterministic PRGI policy rules.

These lookups are intentionally separate from fuzzy candidate retrieval.
A hard rule must not fail merely because Soundex/Metaphone/FTS5 did not
retrieve a source title.
"""

from __future__ import annotations

import sqlite3


def _rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]


def find_titles_whose_tokens_are_subset_of_query(
    conn: sqlite3.Connection,
    query_normalized: str,
    *,
    max_tokens_in_title: int | None = None,
    limit: int = 200,
) -> list[dict]:
    """Return corpus titles whose complete normalized token set is contained in query.

    Example:
      query:    "hindu indian express"
      matches:  "hindu", "indian express"

    This uses an initial cheap SQL narrowing query and then exact Python
    token-set verification. It only includes registered/pending corpus rows.
    """
    query_tokens = set(query_normalized.split())
    if not query_tokens:
        return []

    # Fetch only records which share at least one complete token. The final
    # subset test below guarantees correctness.
    placeholders = ", ".join("?" for _ in query_tokens)
    sql = f"""
        SELECT id, title_raw, title_normalized, title_core, language, state,
               periodicity, status
        FROM titles
        WHERE status IN ('registered', 'pending')
          AND (
              {' OR '.join(["(' ' || title_normalized || ' ') LIKE ?" for _ in query_tokens])}
          )
        LIMIT ?
    """
    params = [f"% {token} %" for token in query_tokens] + [limit]

    rows = conn.execute(sql, params).fetchall()
    result = []
    for row in rows:
        candidate_tokens = set(row["title_normalized"].split())
        if not candidate_tokens:
            continue
        if max_tokens_in_title is not None and len(candidate_tokens) > max_tokens_in_title:
            continue
        if candidate_tokens.issubset(query_tokens):
            result.append(dict(row))
    return result


def find_exact_base_title_after_removing_periodicity(
    conn: sqlite3.Connection,
    query_normalized: str,
    periodicity_words: set[str],
) -> list[dict]:
    """Find a title equal to query after only periodicity tokens are removed.

    This is order-independent.

    Example:
      query = "bharat daily samachar"
      base  = "bharat samachar"
    """
    tokens = query_normalized.split()
    remaining = [t for t in tokens if t not in periodicity_words]

    # Require at least one periodicity token; otherwise this helper is not applicable.
    if len(remaining) == len(tokens) or not remaining:
        return []

    base_normalized = " ".join(remaining)
    rows = conn.execute(
        """
        SELECT id, title_raw, title_normalized, title_core, language, state,
               periodicity, status
        FROM titles
        WHERE status IN ('registered', 'pending')
          AND title_normalized = ?
        """,
        (base_normalized,),
    ).fetchall()

    # Also support reordered input, e.g. "bharat daily samachar" where stored
    # title might have same tokens in a different order. This is intentionally
    # a second exact token-set comparison, not fuzzy similarity.
    if rows:
        return _rows_to_dicts(rows)

    query_base_tokens = set(remaining)
    rows = conn.execute(
        """
        SELECT id, title_raw, title_normalized, title_core, language, state,
               periodicity, status
        FROM titles
        WHERE status IN ('registered', 'pending')
        """
    ).fetchall()
    return [
        dict(row)
        for row in rows
        if set(row["title_normalized"].split()) == query_base_tokens
    ]
