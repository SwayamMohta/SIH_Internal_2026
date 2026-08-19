# Implementation Prompt: Fix the Confirmed Adversarial-Validation Failures

## Role and Objective

You are modifying an existing local PRGI title-verification project built with Python, SQLite, FTS5 trigram search, Double Metaphone/Soundex, Jaro-Winkler/Levenshtein, and LaBSE embeddings.

A baseline adversarial report has already been generated in **mock embedding mode**. Preserve its current results as a baseline. Implement the corrections below incrementally, add tests, rerun the adversarial suite, and produce a before/after JSON comparison report.

**Do not replace the whole system. Do not add Postgres, Redis, FAISS, cloud services, or a new frontend. Keep the local SQLite architecture.**

## Evidence From the Baseline Report

The report establishes several real failures or misleading test conditions:

1. **Combination detection fails because it only examines retrieved candidates.**
   - `Hindu Indian Express` returned `LIKELY_APPROVED` with zero candidates.
   - `Indian Hindu Express` returned `REVIEW`, with only `Indian Express` retrieved; it missed `Hindu`.
   - Therefore, the deterministic combination rule is incorrectly dependent on fuzzy/phonetic retrieval. It must not be.

2. **Periodicity insertion can fail for the same reason.**
   - `Namaskar Darpan Weekly` was correctly rejected because the base title was retrieved.
   - `Bharat Daily Samachar` returned `LIKELY_APPROVED` with zero candidates, even though `Bharat Samachar` exists.
   - Therefore, the periodicity rule must not rely only on the normal candidate-retrieval result.

3. **Cross-language semantic equivalence is not retrievable.**
   - `Pratidin Sandhya` returned `LIKELY_APPROVED` with `candidate_count=0`; `Daily Evening` never entered scoring.
   - This is a confirmed candidate-generation gap: semantic scoring cannot help if lexical/phonetic retrieval finds nothing.

4. **The mock embedding implementation is not useful for semantic validity.**
   - Many unrelated pairs have `semantic_similarity=1.0`, including `Namascar Patrika` vs `Namaskar Darpan`, `Morning Chronicle` vs `Morning Herald`, and reversed word order (`Express Indian` vs `Indian Express`).
   - Treat all semantic conclusions from this report as invalid until the same suite is rerun with the actual LaBSE model (`RUN_REAL_EMBED=1` or equivalent).
   - Do not tune semantic weights or thresholds from mock-mode output.

5. **Whole-title phonetic encoding is confirmed structurally; its production impact needs better instrumentation.**
   - Current `compute_phonetic_codes()` runs Soundex and Double Metaphone on the full normalized title string.
   - Current phonetic scoring is binary: complete-title code overlap gives `1.0`, otherwise `0.0`.
   - Add per-token phonetic diagnostics and a meaningful-token phonetic feature; retain full-title phonetics as a secondary signal.

6. **Short/generic titles need explicit product policy.**
   - `A` returned 13 candidates and `REVIEW`; `A A` returned `LIKELY_APPROVED` at 100%; `News` returned `REVIEW` due to `News Today`.
   - Do not attempt to “match” one-character titles. Add a validation rule: title must contain at least 3 alphanumeric characters after normalization, otherwise return `INVALID_INPUT`, not `LIKELY_APPROVED`.
   - Generic-only titles should return `REVIEW` with an explainable reason, not an unjustified approval.

7. **Pending-title indexing and cache invalidation work in the tested flow.**
   - `Metro Mirror` became a pending record and then blocked exact and spelling-variant resubmissions.
   - Preserve this behaviour and add regression tests; do not rewrite it unnecessarily.

## Non-Negotiable Constraints

- Preserve existing public endpoints and response fields unless adding optional diagnostic fields.
- Keep deterministic hard rules before expensive embedding work.
- Keep `verification_probability = (1 - highest_combined_similarity) * 100` for ordinary similarity-based decisions.
- Hard-rule violations still return `REJECTED` with probability `0.0`.
- Do not use mock embeddings for final semantic accept/reject tests.
- Maintain unit tests and add regression tests for every defect fixed.
- Never claim official PRGI approval; this remains a preliminary assessment.

## Implementation Order

Implement in this exact order:

1. Decouple deterministic rules from candidate retrieval.
2. Add robust input/generic-title policy.
3. Add token-aware phonetic features and diagnostics.
4. Add semantic fallback retrieval behind a feature flag.
5. Add debug provenance and tests.
6. Run baseline vs post-fix report using real embeddings for semantic cases.

---

# Part 1 — Decouple Hard Rules From Fuzzy Retrieval

## 1A. Create exact token-subset lookup helpers

### Why

The current combination and periodicity checks receive only `get_candidates()` output. This is incorrect: a title combination can have no trigram/phonetic overlap with one of its source titles, as `Hindu Indian Express` proved.

Hard rules must use a **separate exact-token lookup** against the entire registered + pending corpus. This is not expensive for the local prototype because it uses token boundaries / normalized strings and returns a limited set of base titles.

### Required file: `src/rule_retrieval.py`

Create this module:

```python
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
```

### Notes for the coding agent

- Use `sqlite3.Row` from your existing DB connection or adapt this helper to your project’s row format.
- The second query in `find_exact_base_title_after_removing_periodicity()` is acceptable for this local prototype, but log its latency. If required, optimize it later with a normalized sorted-token signature column.
- Do **not** silently use FTS/trigram for a hard-rule decision. Fuzzy matching may miss a required base title.

## 1B. Refactor rule engine API

### Required changes: `src/rules.py`

Change the rule engine so it receives a DB connection and performs deterministic lookups itself:

```python
from .config import PERIODICITY_WORDS
from .rule_retrieval import (
    find_exact_base_title_after_removing_periodicity,
    find_titles_whose_tokens_are_subset_of_query,
)


def check_periodicity_addition_from_corpus(conn, new_normalized: str) -> str | None:
    matches = find_exact_base_title_after_removing_periodicity(
        conn,
        new_normalized,
        PERIODICITY_WORDS,
    )
    if not matches:
        return None

    # One exact base match is sufficient for a hard violation.
    match = matches[0]
    return (
        "Title formed by adding periodicity to existing title "
        f"'{match['title_raw']}'"
    )


def check_title_combination_from_corpus(conn, new_normalized: str) -> str | None:
    query_tokens = set(new_normalized.split())
    matches = find_titles_whose_tokens_are_subset_of_query(conn, new_normalized)

    # Candidate title must contribute at least one token. Do not count a title
    # identical to the full query as a two-title combination.
    selected: list[dict] = []
    covered: set[str] = set()

    # Prefer multi-token source titles first; then select titles that add new
    # token coverage. Sorting makes output deterministic.
    matches.sort(
        key=lambda row: (-len(set(row['title_normalized'].split())), row['title_normalized'])
    )

    for match in matches:
        tokens = set(match["title_normalized"].split())
        if tokens == query_tokens:
            continue
        if not (tokens - covered):
            continue
        selected.append(match)
        covered |= tokens
        if len(selected) >= 2 and covered == query_tokens:
            return (
                "Title appears to combine existing titles: "
                + ", ".join(f"'{row['title_raw']}'" for row in selected)
            )

    return None


def run_rule_engine(conn, new_title_data: dict) -> list[str]:
    """Run hard rules before candidate retrieval and embedding."""
    violations: list[str] = []

    # Keep existing disallowed-word check here.
    disallowed = check_disallowed_words(new_title_data["tokens"])
    if disallowed:
        violations.append(disallowed)

    periodicity = check_periodicity_addition_from_corpus(
        conn,
        new_title_data["normalized"],
    )
    if periodicity:
        violations.append(periodicity)

    combination = check_title_combination_from_corpus(
        conn,
        new_title_data["normalized"],
    )
    if combination:
        violations.append(combination)

    return violations
```

### Required orchestration change: `src/verify.py`

Run hard rules **before** `get_candidates()` and before `embed_text()`:

```python
new_title_data = normalize_title(raw_title)

rule_violations = run_rule_engine(conn, new_title_data)
if rule_violations:
    response = compute_verification_result(rule_violations, [])
    response["from_cache"] = False
    verification_cache.set(raw_title, response)
    return response

# Only then do phonetic/FTS retrieval and embeddings.
new_phonetic_codes = compute_phonetic_codes(new_title_data["normalized"])
candidates = get_candidates(conn, new_title_data, new_phonetic_codes)
```

### Mandatory regression tests

```python
def test_combination_rule_does_not_depend_on_fuzzy_retrieval(isolated_db):
    seed_titles(isolated_db, ["Hindu", "Indian Express"])
    result = verify_title("Hindu Indian Express", db_path=isolated_db)
    assert result["status"] == "REJECTED"
    assert result["verification_probability"] == 0.0
    assert any("combine" in reason.lower() for reason in result["reasons"])


def test_combination_rule_is_order_independent(isolated_db):
    seed_titles(isolated_db, ["Hindu", "Indian Express"])
    result = verify_title("Indian Hindu Express", db_path=isolated_db)
    assert result["status"] == "REJECTED"


def test_periodicity_rule_does_not_depend_on_fuzzy_retrieval(isolated_db):
    seed_titles(isolated_db, ["Bharat Samachar"])
    result = verify_title("Bharat Daily Samachar", db_path=isolated_db)
    assert result["status"] == "REJECTED"
    assert any("periodicity" in reason.lower() for reason in result["reasons"])
```

---

# Part 2 — Add Input Quality and Generic-Only Title Policy

## 2A. Minimum title length

### Why

The baseline demonstrated inconsistent weak-input outcomes: `A` produced `REVIEW`, while `A A` produced `LIKELY_APPROVED`. A one-character or effectively empty title is not a meaningful title-verification query.

### Required configuration additions: `src/config.py`

```python
MIN_TITLE_ALNUM_CHARS = 3

GENERIC_TITLE_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin",
    "express", "journal", "magazine"
}
```

### Required validation helper: `src/rules.py`

```python
import re
from .config import MIN_TITLE_ALNUM_CHARS, GENERIC_TITLE_TOKENS


def check_input_quality(new_title_data: dict) -> str | None:
    normalized = new_title_data["normalized"]
    alnum_count = len(re.sub(r"[^a-z0-9]", "", normalized))
    if alnum_count < MIN_TITLE_ALNUM_CHARS:
        return "Title must contain at least 3 alphanumeric characters"

    tokens = set(normalized.split())
    if tokens and tokens.issubset(GENERIC_TITLE_TOKENS):
        return (
            "Title contains only generic terms and requires manual review; "
            "add a distinctive word"
        )
    return None
```

### Status decision

Add an `INVALID_INPUT` status for minimum-length failures. For generic-only title failures, return `REVIEW`, not `REJECTED`, unless PRGI policy explicitly bans the generic word.

Modify the result path rather than abusing probability:

```python
# in verify.py, before run_rule_engine
input_quality_issue = check_input_quality(new_title_data)
if input_quality_issue:
    if "at least" in input_quality_issue:
        return {
            "verification_probability": None,
            "status": "INVALID_INPUT",
            "reasons": [input_quality_issue],
            "closest_match": None,
            "from_cache": False,
        }
    return {
        "verification_probability": None,
        "status": "REVIEW",
        "reasons": [input_quality_issue],
        "closest_match": None,
        "from_cache": False,
    }
```

### Mandatory tests

```python
@pytest.mark.parametrize("title", ["A", "A A", "--"])
def test_too_short_title_is_invalid(title, isolated_db):
    result = verify_title(title, db_path=isolated_db)
    assert result["status"] == "INVALID_INPUT"
    assert result["verification_probability"] is None


def test_generic_only_title_requires_review(isolated_db):
    result = verify_title("News", db_path=isolated_db)
    assert result["status"] == "REVIEW"
    assert "generic" in result["reasons"][0].lower()
```

---

# Part 3 — Make Phonetics Token-Aware Without Losing Phrase-Level Evidence

## 3A. Current problem

The current code computes one Double Metaphone output over the whole title and returns `1.0` for any whole-title code overlap. Keep it for compatibility/retrieval, but it is not enough for multi-word title resolution.

## 3B. Required changes: `src/phonetics.py`

Replace the file with the following working implementation:

```python
"""Phonetic features for title matching.

Provides:
- full-title Soundex + Double Metaphone for existing retrieval indexes;
- per-token Double Metaphone codes for explainable token-aware scoring.
"""

from __future__ import annotations

import jellyfish
from metaphone import doublemetaphone

GENERIC_PHONETIC_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin",
    "express", "journal", "magazine"
}


def _codes(text: str) -> set[str]:
    primary, secondary = doublemetaphone(text)
    return {code for code in (primary, secondary) if code}


def compute_phonetic_codes(normalized_text: str) -> dict:
    text = normalized_text or ""
    primary, secondary = doublemetaphone(text)
    token_metaphones = {
        token: sorted(_codes(token))
        for token in text.split()
        if token
    }
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
        if token not in GENERIC_PHONETIC_TOKENS and codes
    }
    candidate = {
        token: set(codes)
        for token, codes in candidate_codes["token_metaphones"].items()
        if token not in GENERIC_PHONETIC_TOKENS and codes
    }

    if not query or not candidate:
        return 0.0

    matched = 0
    for query_token_codes in query.values():
        if any(query_token_codes & candidate_token_codes for candidate_token_codes in candidate.values()):
            matched += 1

    return matched / len(query)
```

## 3C. Required changes: `src/scoring.py`

Do not make `phonetic_match_score()` binary. Use both whole-title and per-token features.

```python
from .phonetics import token_phonetic_similarity


def phonetic_match_score(new_codes: dict, cand_codes: dict) -> tuple[float, dict]:
    full_overlap = bool(
        {new_codes["metaphone_primary"], new_codes["metaphone_secondary"]}
        & {cand_codes["metaphone_primary"], cand_codes["metaphone_secondary"]}
    )

    token_score = token_phonetic_similarity(new_codes, cand_codes)

    # Full-title exact phonetic equality remains evidence, but it no longer
    # creates an unconditional score of 1.0 for a multi-word title.
    score = max(token_score, 0.70 if full_overlap else 0.0)

    return score, {
        "full_title_phonetic_overlap": full_overlap,
        "token_phonetic_similarity": round(token_score, 4),
    }
```

Update the caller:

```python
phon_sim, phonetic_details = phonetic_match_score(
    new_phonetic_codes,
    candidate_phonetic_codes,
)

# Include this in score_candidate() output.
return {
    # existing fields...
    "phonetic_similarity": round(phon_sim, 4),
    **phonetic_details,
}
```

### Do not change the existing global 0.25 phonetic ensemble weight yet

Run real-embedding adversarial tests first. Adjust the feature’s internal score and ensemble weight only after observing before/after precision and false-positive behaviour.

### Mandatory tests

```python
def test_token_phonetics_catches_partial_soundalike():
    q = compute_phonetic_codes("namascar darpan")
    c = compute_phonetic_codes("namaskar darpan")
    assert token_phonetic_similarity(q, c) == 1.0


def test_generic_tokens_do_not_drive_token_phonetic_score():
    q = compute_phonetic_codes("news chronicle")
    c = compute_phonetic_codes("news today")
    assert token_phonetic_similarity(q, c) == 0.0


def test_distinctive_partial_token_match_is_explainable():
    q = compute_phonetic_codes("kisan darshan")
    c = compute_phonetic_codes("kisan darpan")
    score = token_phonetic_similarity(q, c)
    assert 0.0 < score < 1.0
```

---

# Part 4 — Add a Token-Overlap Diagnostic Feature

## Why

Whole-string edit distance is not designed to show whether titles share one distinctive word, all distinctive words, or merely generic terms. Add this feature now for diagnosis and explanations. Do not add it to the weighted final score until you have real-model results and a labelled evaluation set.

### Required additions: `src/scoring.py`

```python
GENERIC_LEXICAL_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin",
    "express", "journal", "magazine"
}


def meaningful_tokens(text: str) -> set[str]:
    return {
        token for token in text.split()
        if token and token not in GENERIC_LEXICAL_TOKENS
    }


def token_jaccard_similarity(a: str, b: str) -> float:
    a_tokens = meaningful_tokens(a)
    b_tokens = meaningful_tokens(b)
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)
```

In `score_candidate()`:

```python
token_overlap = token_jaccard_similarity(
    new_title_data["normalized"],
    candidate["title_normalized"],
)

return {
    # current output...
    "token_overlap_similarity": round(token_overlap, 4),
}
```

---

# Part 5 — Add Conditional Semantic Fallback Retrieval

## Critical warning

Do not implement or tune this based on the existing **mock embedding** report. The mock produced `semantic_similarity=1.0` for unrelated strings, so it cannot validate semantic behaviour.

First confirm the actual model is loaded and run:

```bash
RUN_REAL_EMBED=1 python tools/run_adversarial_validation.py \
  --corpus tests/fixtures/adversarial_corpus.csv \
  --cases tests/fixtures/adversarial_queries.json \
  --db data/adversarial_validation_real.db \
  --report-dir data/reports
```

## Goal

Allow `Pratidin Sandhya` to reach `Daily Evening` for semantic comparison even if FTS5 and phonetic blocking return zero candidates.

## Required configuration: `src/config.py`

```python
ENABLE_SEMANTIC_FALLBACK = True
SEMANTIC_FALLBACK_TOP_K = 20
SEMANTIC_FALLBACK_MIN_SCORE = 0.72
SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN = 1
```

These are **provisional experiment settings**, not final PRGI policy values.

## Required file: `src/semantic_retrieval.py`

```python
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
```

## Required integration: `src/verify.py`

```python
from .config import (
    ENABLE_SEMANTIC_FALLBACK,
    SEMANTIC_FALLBACK_MIN_SCORE,
    SEMANTIC_FALLBACK_TOP_K,
    SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN,
)
from .semantic_retrieval import get_semantic_fallback_candidates

# Existing sequence after hard rules:
new_phonetic_codes = compute_phonetic_codes(new_title_data["normalized"])
candidates = get_candidates(conn, new_title_data, new_phonetic_codes)

# Preserve standard lazy embedding behaviour except semantic fallback requires an
# embedding when no candidate exists. This is the explicit trade-off.
needs_embedding = bool(candidates)
if ENABLE_SEMANTIC_FALLBACK and len(candidates) < SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN:
    needs_embedding = True

new_embedding = embed_text(new_title_data["normalized"]) if needs_embedding else None

if (
    ENABLE_SEMANTIC_FALLBACK
    and new_embedding is not None
    and len(candidates) < SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN
):
    semantic_candidates = get_semantic_fallback_candidates(
        conn,
        new_embedding,
        min_score=SEMANTIC_FALLBACK_MIN_SCORE,
        top_k=SEMANTIC_FALLBACK_TOP_K,
    )

    existing_ids = {candidate["id"] for candidate in candidates}
    candidates.extend(
        candidate for candidate in semantic_candidates
        if candidate["id"] not in existing_ids
    )
```

## Required safety decision

A semantic fallback candidate must not cause automatic rejection by itself until calibrated. Add a response field such as:

```json
"requires_manual_semantic_review": true
```

when the top candidate came only from `semantic_fallback` and there is no strong lexical/phonetic corroboration.

### Mandatory real-model tests

```python
@pytest.mark.real_embedding
def test_semantic_fallback_retrieves_cross_language_candidate(isolated_db):
    seed_titles(isolated_db, ["Daily Evening"])
    result = verify_title("Pratidin Sandhya", db_path=isolated_db)
    titles = {
        item["candidate_title"].lower()
        for item in result["all_candidate_breakdowns"]
    }
    assert "daily evening" in titles


@pytest.mark.real_embedding
def test_semantic_only_candidate_is_marked_for_manual_review(isolated_db):
    seed_titles(isolated_db, ["Daily Evening"])
    result = verify_title("Pratidin Sandhya", db_path=isolated_db)
    assert result["requires_manual_semantic_review"] is True
```

If LaBSE does **not** give a sufficiently high score for the exact intended translation pair, record that honestly. Do not lower the threshold until unrelated controls such as `Jana Awaaz` and `Morning Chronicle` are tested at the same time.

---

# Part 6 — Add Candidate Provenance and Debug Diagnostics

## Why

The baseline report could identify `candidate_count` but not always tell which retrieval channel caused a candidate to appear. This makes tuning impossible.

## Required update: `src/retrieval.py`

Refactor retrieval into separate channel queries, then union candidates in Python. This is clearer than one opaque `OR` query.

```python
def _with_source(row: dict, source: str) -> dict:
    row = dict(row)
    row.setdefault("retrieval_sources", [])
    if source not in row["retrieval_sources"]:
        row["retrieval_sources"].append(source)
    return row


def get_candidates(conn, new_title_data, phonetic_codes, limit=300):
    by_id: dict[int, dict] = {}

    # Run each existing query channel separately: soundex, metaphone, FTS5/LIKE.
    # For every result call: by_id[row["id"]] = _with_source(existing_or_row, "soundex")
    # Use equivalent labels: "metaphone", "fts5_trigram", "like_short_title".

    # Keep registered/pending filter in every query.
    # Return at most `limit` deterministically, e.g. sorted by id after source union.
    return list(by_id.values())[:limit]
```

Do not expose every candidate to normal users. Add a `debug=False` parameter to the internal verify function; only the test runner receives all candidate breakdowns.

Expected debug response extension:

```python
{
  "candidate_count": 2,
  "all_candidate_breakdowns": [
    {
      "candidate_title": "Namaskar Darpan",
      "retrieval_sources": ["soundex", "metaphone", "fts5_trigram"],
      "edit_similarity": 0.9573,
      "token_overlap_similarity": 0.5,
      "full_title_phonetic_overlap": true,
      "token_phonetic_similarity": 1.0,
      "semantic_similarity": 0.88,
      "combined_similarity": 0.93
    }
  ]
}
```

---

# Part 7 — Test and Reporting Deliverables

## Required test additions

Create or update:

- `tests/test_rule_retrieval.py`
- `tests/test_rules.py`
- `tests/test_phonetics.py`
- `tests/test_scoring.py`
- `tests/test_semantic_retrieval.py`
- `tests/test_verify.py`
- `tests/test_adversarial_title_matching.py`

## Required commands

```bash
# 1. Existing unit/regression suite
python -m pytest -q

# 2. Fast adversarial run with deterministic/mock embeddings for non-semantic logic
python tools/run_adversarial_validation.py \
  --corpus tests/fixtures/adversarial_corpus.csv \
  --cases tests/fixtures/adversarial_queries.json \
  --db data/adversarial_validation_mock_after.db \
  --report-dir data/reports

# 3. Real LaBSE adversarial run, mandatory for semantic conclusions
RUN_REAL_EMBED=1 python tools/run_adversarial_validation.py \
  --corpus tests/fixtures/adversarial_corpus.csv \
  --cases tests/fixtures/adversarial_queries.json \
  --db data/adversarial_validation_real_after.db \
  --report-dir data/reports
```

## Required comparison report

Write `data/reports/adversarial_comparison_<timestamp>.json` with at least:

```json
{
  "baseline_report": "adversarial_validation_20260819_114006.json",
  "post_fix_mock_report": "...",
  "post_fix_real_embedding_report": "...",
  "fixed_cases": ["C01", "C02", "C04", "F03", "F04"],
  "semantic_cases_real_model": {
    "E01": {
      "daily_evening_retrieved": true,
      "semantic_similarity": 0.0,
      "manual_review_flag": true
    }
  },
  "regressions": [],
  "latency_ms": {
    "lexical_only_p50": 0,
    "semantic_fallback_p50": 0,
    "semantic_fallback_p95": 0
  },
  "manual_decisions_needed": [
    "Confirm final PRGI scope policy for state/language filtering",
    "Calibrate semantic fallback threshold on labelled accepted/rejected examples",
    "Confirm generic-title handling policy"
  ]
}
```

## Completion Criteria

This task is complete only if all conditions below are met:

- [ ] `Hindu Indian Express` and `Indian Hindu Express` reject through deterministic combination detection, even if fuzzy retrieval returns zero candidates.
- [ ] `Bharat Daily Samachar` rejects through deterministic periodicity detection, even if fuzzy retrieval returns zero candidates.
- [ ] `A`, `A A`, and punctuation-only input return `INVALID_INPUT`, not 100% likely approved.
- [ ] Generic-only titles return explainable `REVIEW` rather than arbitrary acceptance/rejection.
- [ ] Token-level phonetic diagnostics are present and generic terms do not drive the token phonetic feature.
- [ ] Semantic fallback is tested using **real LaBSE**, not mock embeddings.
- [ ] `Pratidin Sandhya` either retrieves `Daily Evening` through semantic fallback or produces a documented, measured model limitation—never a hidden untested assumption.
- [ ] Semantic-only candidate results are manual-review signals until calibrated.
- [ ] Existing pending-title blocking and cache invalidation tests still pass.
- [ ] Full test suite passes, and the before/after comparison JSON is generated.

## Do Not Do These Things

- Do not use the mock report’s `semantic_similarity=1.0` values to tune any threshold.
- Do not make token matching a hard reject by itself; generic/shared terms will cause false positives.
- Do not remove title-level phonetic or full-title edit features; add token-aware features alongside them.
- Do not make semantic similarity alone an automatic legal decision.
- Do not add FAISS, Postgres, Redis, or cloud dependencies for this local-project task.
- Do not hide the `Pratidin Sandhya` result if the real model does not retrieve `Daily Evening`; report the limitation and measured score.
