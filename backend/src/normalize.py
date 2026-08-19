"""Shared title normalization — used identically at ingestion and verification."""

import re
import unicodedata

from .config import PREFIX_SUFFIX_STOPWORDS


def normalize_title(raw_title: str) -> dict:
    """Return the canonical representations of a raw title.

    Keys:
      raw        — original text, unmodified
      normalized — NFKC + punctuation-stripped + whitespace-collapsed + lowercased
      core       — `normalized` with generic prefix/suffix stopwords removed
      tokens     — set of words in `normalized`
    """
    text = unicodedata.normalize("NFKC", raw_title.strip())
    # Remove punctuation safely: keep unicode letters/digits + whitespace only.
    text = "".join(ch for ch in text if ch.isalnum() or ch.isspace())
    text = re.sub(r"\s+", " ", text).strip()
    normalized = text.lower()

    tokens = normalized.split()
    core_tokens = [t for t in tokens if t not in PREFIX_SUFFIX_STOPWORDS]
    core = " ".join(core_tokens) if core_tokens else normalized

    return {
        "raw": raw_title,
        "normalized": normalized,
        "core": core,
        "tokens": set(tokens),
    }