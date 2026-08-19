"""Pending-title workflow: verify-first, then store as `pending`."""

from . import config, db
from .cache import verification_cache
from .embeddings import embed_text, serialize_vector
from .normalize import normalize_title
from .phonetics import compute_phonetic_codes
from .verify import verify_title


def register_pending(raw_title: str, language: str = None, state: str = None,
                     periodicity: str = None, db_path: str = None) -> dict:
    """Verify, then insert as `pending` (unless REJECTED). Invalidates the cache.

    Returns a dict with `registered` True on success, False on rejection.
    """
    if not raw_title or not raw_title.strip():
        raise ValueError("title is required")

    result = verify_title(raw_title, db_path=db_path)
    if result["status"] == "REJECTED":
        return {
            "registered": False,
            "status": "REJECTED",
            "error": "Cannot register pending: the title was rejected by the automated check.",
            "reasons": result["reasons"],
            "verification": result,
            "disclaimer": config.DISCLAIMER,
        }

    data = normalize_title(raw_title)
    phon = compute_phonetic_codes(data["normalized"])
    vec = embed_text(data["normalized"])
    blob = serialize_vector(vec)

    conn = db.connect(db_path)
    try:
        cur = conn.execute(
            "INSERT INTO titles (title_raw, title_normalized, title_core, language,"
            " state, periodicity, status, soundex_code, metaphone_primary,"
            " metaphone_secondary, embedding)"
            " VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
            (raw_title, data["normalized"], data["core"], language, state,
             periodicity, phon["soundex"], phon["metaphone_primary"],
             phon["metaphone_secondary"], blob),
        )
        conn.commit()
        new_id = cur.lastrowid
    finally:
        conn.close()

    # Candidate corpus changed -> drop cached verification results.
    verification_cache.invalidate_all()

    return {
        "registered": True,
        "id": new_id,
        "title_normalized": data["normalized"],
        "status": "pending",
        "verification": result,
        "disclaimer": config.DISCLAIMER,
    }