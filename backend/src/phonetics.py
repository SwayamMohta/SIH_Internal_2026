"""Phonetic features for title matching.

Provides:
- full-title Soundex + Double Metaphone for existing retrieval indexes;
- per-token Double Metaphone codes for explainable token-aware scoring.
"""

from __future__ import annotations

import jellyfish
from metaphone import doublemetaphone

from .config import GENERIC_TITLE_TOKENS


def _codes(text: str) -> set[str]:
    primary, secondary = doublemetaphone(text)
    return {code for code in (primary, secondary) if code}


def token_phonetic_map(normalized_text: str) -> dict:
    """Per-token Double Metaphone codes, for candidates derived at scoring time."""
    return {token: sorted(_codes(token)) for token in (normalized_text or "").split() if token}


def compute_phonetic_codes(normalized_text: str) -> dict:
    text = normalized_text or ""
    primary, secondary = doublemetaphone(text)
    token_metaphones = token_phonetic_map(text)
    return {
        "soundex": jellyfish.soundex(text) if text else "",
        "metaphone_primary": primary,
        "metaphone_secondary": secondary or primary,
        "token_metaphones": token_metaphones,
    }


def token_phonetic_similarity(query_codes: dict, candidate_codes: dict) -> float:
    """Meaningful-token recall using Double Metaphone overlap.

    Generic terms are excluded. A query token counts as matched if any
    meaningful candidate token has a shared phonetic code.
    """
    query = {
        token: set(codes)
        for token, codes in query_codes["token_metaphones"].items()
        if token not in GENERIC_TITLE_TOKENS and codes
    }
    candidate = {
        token: set(codes)
        for token, codes in candidate_codes["token_metaphones"].items()
        if token not in GENERIC_TITLE_TOKENS and codes
    }

    if not query or not candidate:
        return 0.0

    matched = 0
    for query_token_codes in query.values():
        if any(query_token_codes & candidate_token_codes
               for candidate_token_codes in candidate.values()):
            matched += 1

    return matched / len(query)
