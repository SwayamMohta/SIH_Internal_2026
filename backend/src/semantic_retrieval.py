"""Conditional local semantic fallback retrieval.

This is deliberately a local prototype fallback. It performs a linear scan
only if normal blocking finds no candidates. Do not run it for every query.
"""

from __future__ import annotations

from .embeddings import cosine_similarity, deserialize_vector

_COLUMNS = [
    "id", "title_raw", "title_normalized", "title_core", "language",
    "state", "status", "embedding", "metaphone_primary",
    "metaphone_secondary", "soundex_code",
]


def get_semantic_fallback_candidates(
    conn,
    query_embedding,
    *,
    min_score: float,
    top_k: int,
) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, title_raw, title_normalized, title_core, language, state,
               status, embedding, metaphone_primary, metaphone_secondary,
               soundex_code
        FROM titles
        WHERE status IN ('registered', 'pending')
          AND embedding IS NOT NULL
        """
    ).fetchall()

    scored: list[tuple[float, dict]] = []
    for row in rows:
        candidate = dict(zip(_COLUMNS, row))
        score = cosine_similarity(
            query_embedding,
            deserialize_vector(candidate["embedding"]),
        )
        if score >= min_score:
            candidate["semantic_retrieval_score"] = round(float(score), 4)
            candidate["retrieval_sources"] = ["semantic_fallback"]
            scored.append((float(score), candidate))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [candidate for _score, candidate in scored[:top_k]]
