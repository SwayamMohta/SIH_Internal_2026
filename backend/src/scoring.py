"""Ensemble similarity scoring: edit (0.35) + phonetic (0.25) + semantic (0.40)."""

import jellyfish

from .config import (EDIT_WEIGHT, GENERIC_TITLE_TOKENS, JW_WEIGHT, LEV_WEIGHT,
                     PHONETIC_WEIGHT, SEMANTIC_WEIGHT)
from .embeddings import deserialize_vector, cosine_similarity
from .phonetics import token_phonetic_similarity


def edit_distance_score(a: str, b: str) -> float:
    """0.6 * Jaro-Winkler + 0.4 * normalized Levenshtein similarity."""
    jw = jellyfish.jaro_winkler_similarity(a, b)
    max_len = max(len(a), len(b), 1)
    lev_sim = 1 - (jellyfish.levenshtein_distance(a, b) / max_len)
    return JW_WEIGHT * jw + LEV_WEIGHT * lev_sim


def meaningful_tokens(text: str) -> set:
    return {tok for tok in text.split() if tok and tok not in GENERIC_TITLE_TOKENS}


def token_jaccard_similarity(a: str, b: str) -> float:
    """Jaccard over meaningful (non-generic) tokens; diagnostic only for now."""
    a_tokens = meaningful_tokens(a)
    b_tokens = meaningful_tokens(b)
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)


def phonetic_match_score(new_codes: dict, cand_codes: dict) -> tuple[float, dict]:
    """Meaningful-token phonetic recall, boosted by full-title code overlap.

    A whole-title Double Metaphone overlap remains evidence but no longer
    yields an unconditional 1.0 for a multi-word title.
    """
    full_overlap = bool(
        {new_codes["metaphone_primary"], new_codes["metaphone_secondary"]}
        & {cand_codes["metaphone_primary"], cand_codes["metaphone_secondary"]}
    )

    token_score = token_phonetic_similarity(new_codes, cand_codes)

    score = max(token_score, 0.70 if full_overlap else 0.0)

    return score, {
        "full_title_phonetic_overlap": full_overlap,
        "token_phonetic_similarity": round(token_score, 4),
    }


def score_candidate(new_title_data: dict, new_embedding, new_phonetic_codes: dict,
                    candidate: dict, candidate_phonetic_codes: dict) -> dict:
    """Score one candidate; returns the rounded breakdown dict the API exposes."""
    edit_sim = edit_distance_score(new_title_data["normalized"], candidate["title_normalized"])
    phon_sim, phonetic_details = phonetic_match_score(new_phonetic_codes, candidate_phonetic_codes)

    cand_embedding = deserialize_vector(candidate["embedding"])
    sem_sim = cosine_similarity(new_embedding, cand_embedding)
    sem_sim = max(0.0, min(1.0, sem_sim))  # clamp for float drift

    token_overlap = token_jaccard_similarity(
        new_title_data["normalized"],
        candidate["title_normalized"],
    )

    combined = (EDIT_WEIGHT * edit_sim
                + PHONETIC_WEIGHT * phon_sim
                + SEMANTIC_WEIGHT * sem_sim)

    return {
        "candidate_id": candidate["id"],
        "candidate_title": candidate["title_raw"],
        "edit_similarity": round(edit_sim, 4),
        "phonetic_similarity": round(phon_sim, 4),
        "semantic_similarity": round(sem_sim, 4),
        "token_overlap_similarity": round(token_overlap, 4),
        **phonetic_details,
        "combined_similarity": round(combined, 4),
    }
