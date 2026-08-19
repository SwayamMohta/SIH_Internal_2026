# Title-Matching Adversarial Validation Plan and Required Corrections

## Purpose

This document is a **test-first validation plan** for the current PRGI title-verification implementation. Its purpose is to verify—not merely assume—whether the system has undesirable behaviour caused by whole-title phonetic encoding, title-level semantic embeddings, candidate retrieval gaps, and title tokenisation choices.

It also specifies a machine-readable JSON test suite and the code changes that must be made **only after the relevant tests demonstrate the issue**. Do not claim that a test title is officially allowed or rejected by PRGI; expected outcomes here concern the behaviour of this software's matching pipeline.

## Scope Reviewed

The review covers the supplied implementation files:

- `phonetics.py`
- `scoring.py`
- `retrieval.py`
- `ingest.py`
- `probability.py`

It is supplemented by the project README and tracker, which describe the expected end-to-end flow and known limitations.

## Verified Findings Before Testing

### Finding 1 — phonetics are currently applied to the complete title string

**Verified in code.** `compute_phonetic_codes(normalized_text)` calls:

```python
jellyfish.soundex(normalized_text)
doublemetaphone(normalized_text)
```

where `normalized_text` is the complete title, not one token at a time. During ingestion, `compute_phonetic_codes(norm["normalized"])` is called once per full corpus title; retrieval and scoring compare those stored complete-title codes. [file:76][file:75][file:78]

**What this proves:** the present design does **not** maintain per-word phonetic representations.

**What this does not prove:** that every observed bad match is caused by this choice. The tests below must establish its practical effect.

### Finding 2 — phonetic scoring is binary and coarse

**Verified in code.** `phonetic_match_score` returns `1.0` if **any** stored primary/secondary Double Metaphone code overlaps, otherwise `0.0`. It neither measures partial overlap nor identifies which token(s) caused the overlap. [file:77]

This can produce two problematic behaviours:

1. **False positive boost:** unrelated multi-word titles happen to receive the same whole-title phonetic code and receive the full 0.25 phonetic contribution.
2. **False negative miss:** titles sharing a meaningful sound-alike word but differing in the rest of the phrase may produce different complete-title codes and receive no phonetic boost/retrieval route.

### Finding 3 — semantic comparison is performed on the complete title phrase

**Verified in code and project design.** The scoring function compares one query embedding against one candidate-title embedding. The project stores one embedding per normalized full title, and scores it with cosine similarity. [file:77][file:75][file:73]

Full-title embeddings are appropriate for detecting **phrase-level semantic equivalence**, such as a translation of the entire title. They are not automatically a reliable substitute for lexical/entity matching of individual title words. For short titles, embedding similarity can also be unstable or semantically over-general because words like “daily”, “news”, “express”, and “samachar” are common contextual terms.

### Finding 4 — semantic matching can fail before scoring because candidate retrieval is lexical/phonetic only

**Verified in code and tracker.** Candidate retrieval uses an OR of Soundex, Double Metaphone, and FTS5 trigram signals; it has no semantic/vector retrieval path. A title must enter this candidate set before `score_candidate` computes semantic similarity. [file:78][file:70]

The tracker explicitly records the consequence: a cross-language title with no character or phonetic overlap, for example `Pratidin Sandhya` versus `Daily Evening`, may not reach the semantic layer and can be returned as likely approved. [file:70]

This is a **confirmed end-to-end design limitation**, not merely a hypothesis.

### Finding 5 — title-level edit distance has the same phrase-level limitation

`edit_distance_score` computes Jaro-Winkler and Levenshtein over complete normalized strings. It does not separately evaluate word alignment, token overlap, reordered terms, or an individual distinctive-token match. [file:77]

This is not always wrong: title order can be meaningful. But it means the system needs a separate **token-aware feature** rather than relying on full-string distance alone.

### Finding 6 — metadata is stored but not used to scope or rank candidates

The data model preserves `language`, `state`, and `periodicity`, but `get_candidates` does not filter/rank candidates using these fields; it retrieves all registered/pending records matching the blocking signals. [file:75][file:78]

This should be validated against the exact PRGI rule interpretation used by the project. If the rule is “same language nationally” and “any language within the same state,” then metadata should be part of candidate eligibility and/or risk weighting—not ignored.

## Do Not Implement Blindly

Do **not** replace whole-title methods with per-word methods everywhere. That would create a different error: generic shared words such as `daily`, `news`, `india`, `samachar`, and `times` could make unrelated titles look falsely similar.

The correct target is a **hybrid, token-aware ensemble**:

- retain complete-title phonetic, edit-distance, and semantic features;
- add per-token phonetic/token matching features;
- downweight generic words;
- score meaningful phrase overlap and word order separately;
- add semantic candidate generation only for the cross-language/meaning requirement;
- use explainable features in the final decision.

## Test Protocol

### Preconditions

1. Create an isolated SQLite test database. Never run this suite against the production corpus first.
2. Ingest the synthetic corpus from `tests/fixtures/adversarial_corpus.csv` below.
3. Run every query from `tests/fixtures/adversarial_queries.json`.
4. Save raw API results, candidate lists, and individual feature scores to `data/reports/adversarial_results.json`.
5. Compare actual outcome with the expected **behavioural assertion**, not merely with `REJECTED`/`LIKELY_APPROVED` status.
6. Repeat the tests against a sampled real PRGI corpus after the synthetic suite passes, preserving results separately.

### Required diagnostic fields

For each query result, log:

```json
{
  "query_id": "P01",
  "title": "Namascar Darpan",
  "candidate_count": 0,
  "candidate_titles": [],
  "top_match": null,
  "status": "LIKELY_APPROVED",
  "verification_probability": 100.0,
  "rule_violations": [],
  "input_phonetics": {
    "soundex": "",
    "metaphone_primary": "",
    "metaphone_secondary": ""
  },
  "top_score_breakdown": {
    "edit_similarity": null,
    "phonetic_similarity": null,
    "semantic_similarity": null,
    "combined_similarity": null
  },
  "assertion_result": "PASS | FAIL | MANUAL_REVIEW",
  "notes": ""
}
```

Without this evidence, it is impossible to distinguish a retrieval failure from a scoring failure.

## Synthetic Corpus

Create `tests/fixtures/adversarial_corpus.csv`:

```csv
title,language,state,periodicity
Namaskar Darpan,en,Telangana,Weekly
Bharat Samachar,en,Telangana,Daily
Daily Evening,en,Telangana,Daily
Indian Express,en,Delhi,Daily
Hindu,en,Delhi,Daily
Jan Vani,en,Telangana,Weekly
Jana Vani,en,Telangana,Weekly
Krishi Darshan,en,Telangana,Monthly
Kisan Darpan,en,Telangana,Monthly
Morning Herald,en,Telangana,Daily
Telangana Bulletin,en,Telangana,Weekly
Crime Watch,en,Telangana,Weekly
News Today,en,Telangana,Daily
India Times,en,Telangana,Daily
City Chronicle,en,Telangana,Weekly
```

This corpus intentionally includes:

- exact/near spelling pairs;
- phonetic variants;
- multi-word phrases;
- shared generic words;
- a known title-combination case;
- a same-meaning cross-language test target;
- an explicitly banned word.

## Query Test Matrix

Create `tests/fixtures/adversarial_queries.json` using the JSON section below.

### Group A — exact match and normalisation baseline

| ID | Query | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| A01 | `Namaskar Darpan` | Exact corpus title is retrieved; top combined similarity is 1.0 or effectively 1.0; result is rejected | Sanity-checks ingestion, retrieval, and scoring |
| A02 | ` NAMASKAR—DARPAN! ` | Normalises to `namaskar darpan`; behaves like A01 | Ensures punctuation/whitespace cannot bypass exact matching |
| A03 | `Namaskar Darpan Weekly` | Must be checked for periodicity/prefix logic; cannot become a clean novel title solely from added periodicity | Checks rules and token handling |

### Group B — phrase-level phonetic behaviour

| ID | Query | Expected behavioural assertion | What it can prove |
|---|---|---|---|
| B01 | `Namascar Darpan` | `Namaskar Darpan` must appear in candidates; inspect whether phonetic feature contributes | Detects intended spelling/sound-alike handling |
| B02 | `Namascar Patrika` | Inspect candidate list and score separately from B01. It must not be treated identically to B01 just because one word is similar | Detects whole-title phonetic overreach or failure |
| B03 | `Jan Vaani` | `Jan Vani` and/or `Jana Vani` should be candidates. Compare whole-title phonetic code vs token-level expected overlap | Tests vowel/spelling variants in short multi-word titles |
| B04 | `Kisan Darshan` | Must not receive a strong phonetic match simply because `Darshan` is shared unless evidence supports the complete-title match | Detects generic/partial-token false positive behaviour |
| B05 | `Morning Chronicle` | Must not be rejected merely because it shares one broad news-style word pattern with `Morning Herald` or `City Chronicle` | Tests phrase-level aggregation vs loose token coincidence |

### Group C — word order and combinations

| ID | Query | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| C01 | `Hindu Indian Express` | Deterministic combination rule must reject and name both source titles if available | Required PRGI scenario |
| C02 | `Indian Hindu Express` | Must also be caught; token order must not bypass combination detection | Tests order invariance of rule logic |
| C03 | `Express Indian` | Must **not** be automatically treated as `Indian Express` with full semantic/phonetic certainty; record edit and semantic scores for review | Separates token reorder from true duplicate policy |
| C04 | `Bharat Daily Samachar` | Must be evaluated against `Bharat Samachar` as periodicity insertion; the rule outcome should not depend on word order | Tests full-token periodicity logic |

### Group D — generic words and false positives

| ID | Query | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| D01 | `India Chronicle` | Should not be rejected solely due to common token `India` from `India Times`; inspect distinctive-token contribution | Generic-word false-positive test |
| D02 | `News Chronicle` | Should not inherit a full phonetic score from `News Today` merely because `News` is shared | Shows why token-level scoring needs IDF/stopword controls |
| D03 | `Telangana Herald` | Must not be rejected solely because `Telangana Bulletin` shares location context | Tests generic geography/descriptor impact |
| D04 | `Daily Chronicle` | Should be handled as a potential periodicity-style/generic prefix issue but must not be falsely mapped to any arbitrary daily title | Validates separation of policy and similarity |

### Group E — semantics and cross-language retrieval

| ID | Query | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| E01 | `Pratidin Sandhya` | **Current expected failure:** `Daily Evening` may not enter candidates because no semantic retrieval exists. Record candidate_count and actual result. | Confirms known retrieval-before-semantics gap |
| E02 | `Evening Daily` | Should retrieve `Daily Evening` through lexical/FTS overlap; inspect whether semantic score recognises phrase similarity | Separates semantic scoring from candidate retrieval |
| E03 | `Krishi Darpan` | Do not assume it equals `Kisan Darpan` or `Krishi Darshan`; record semantic score and whether it causes a harmful verdict | Tests semantic over-generalisation across agriculture-related terms |
| E04 | `Jana Awaaz` | Manual-review semantic test. It should not be given high confidence without a suitable corpus equivalent; record candidate path | Detects semantic hallucination/overconfidence |

### Group F — rule-engine and short-title edges

| ID | Query | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| F01 | `Crime Bulletin` | Hard reject with probability 0 and a `crime` reason; semantic model should not be called | Confirms short-circuit logic |
| F02 | `CBI Samachar` | Hard reject with probability 0; test case-insensitivity | Disallowed acronym test |
| F03 | `A` | Must not crash; short-title fallback must be deterministic and candidate count recorded | Tests FTS5 short-query fallback |
| F04 | `A A` | Must not crash or return arbitrary high-confidence phonetic match | Tests weak phonetic inputs |
| F05 | `News` | Must not treat generic title as a reliable semantic/phonetic duplicate without an explainable closest match | Tests one-token generic query |

### Group G — pending application consistency

| ID | Workflow | Expected behavioural assertion | Why it matters |
|---|---|---|---|
| G01 | Verify `Metro Mirror`; if allowed/review, register it as pending; then verify `Metro Mirror` again | Second request must retrieve pending title and reject or show high similarity | Validates immediate pending indexing |
| G02 | Register pending `Metro Mirror`; verify `Metro Mrror` | Candidate list must include pending record; tests spelling variant against pending corpus | Validates pending + fuzzy retrieval |
| G03 | Verify same title before and after pending registration with cache enabled | Second post-registration result must not be stale; cache must be invalidated | Validates freshness guarantee |

## Required Automated Tests

Add a new module: `tests/test_adversarial_title_matching.py`.

The test suite must not require the 1.9 GB real model for all tests. Use a deterministic mocked embedding function for most tests, then run selected integration tests with `RUN_REAL_EMBED=1` for semantic checks.

### 1. Test whole-title phonetic encoding explicitly

```python
from src.phonetics import compute_phonetic_codes

def test_phonetic_encoding_is_currently_full_title_based():
    full = compute_phonetic_codes("namaskar darpan")
    word_1 = compute_phonetic_codes("namaskar")
    word_2 = compute_phonetic_codes("darpan")

    # This establishes current implementation behaviour. It is not a desired-product assertion.
    assert set(full) == {"soundex", "metaphone_primary", "metaphone_secondary"}
    assert full["metaphone_primary"] != ""
    assert word_1["metaphone_primary"] != ""
    assert word_2["metaphone_primary"] != ""
```

### 2. Test candidate retrieval separately from scoring

```python
def test_namascar_darpan_retrieves_namaskar_darpan(isolated_db):
    result = verify_title("Namascar Darpan", db_path=isolated_db)
    candidates = {c["candidate_title"].lower() for c in result["all_candidate_breakdowns"]}
    assert "namaskar darpan" in candidates
```

If `verify_title` does not return all candidate breakdowns, add a **test-only debug flag** or a dedicated internal `verify_title_debug()` function. Do not expose all corpus candidates in the public production API by default.

### 3. Test that generic shared words do not by themselves determine a rejection

```python
def test_generic_token_does_not_create_full_phonetic_match():
    # Requires the token-aware phonetic feature after implementation.
    score = token_phonetic_similarity(
        "news chronicle", "news today", generic_tokens={"news"}
    )
    assert score < 0.50
```

This test will initially be skipped because `token_phonetic_similarity` does not exist. Add it only with the implementation change below.

### 4. Test cross-language semantic retrieval, not only semantic scoring

```python
@pytest.mark.real_embedding
def test_cross_language_semantic_candidate_is_retrieved(isolated_db_with_daily_evening):
    result = verify_title("Pratidin Sandhya", db_path=isolated_db_with_daily_evening)
    candidates = {c["candidate_title"].lower() for c in result["all_candidate_breakdowns"]}
    assert "daily evening" in candidates
```

**Important:** this is expected to fail under the current code because `get_candidates()` has no semantic retrieval. Mark it `xfail(strict=True, reason="Semantic candidate retrieval not implemented")` until the change is completed. Once implemented, remove `xfail`.

### 5. Test cache invalidation after a pending insert

```python
def test_pending_insert_invalidates_stale_approval_cache(client):
    first = client.post("/verify-title", json={"title": "Metro Mirror"}).get_json()
    assert first["status"] in {"LIKELY_APPROVED", "REVIEW"}

    pending = client.post("/register-pending", json={"title": "Metro Mirror"})
    assert pending.status_code in {200, 201}

    second = client.post("/verify-title", json={"title": "Metro Mirror"}).get_json()
    assert second["status"] == "REJECTED"
    assert second.get("from_cache") is False
```

## JSON Test Suite

Save the following as `tests/fixtures/adversarial_queries.json`.

```json
{
  "suite_name": "PRGI title matching adversarial validation",
  "version": 1,
  "notes": "Expected assertions describe system behaviour for validation, not official PRGI legal decisions.",
  "queries": [
    {"id":"A01","group":"baseline","title":"Namaskar Darpan","expect":"exact_title_retrieved_and_top_similarity_near_1"},
    {"id":"A02","group":"normalization","title":" NAMASKAR—DARPAN! ","expect":"normalizes_to_same_result_as_A01"},
    {"id":"A03","group":"periodicity","title":"Namaskar Darpan Weekly","expect":"not_cleanly_approved_by_periodicity_bypass"},
    {"id":"B01","group":"phonetic","title":"Namascar Darpan","expect":"namaskar_darpan_retrieved; record_phonetic_feature"},
    {"id":"B02","group":"phonetic","title":"Namascar Patrika","expect":"record_candidate_path; must_not_be_equivalent_to_B01_without_evidence"},
    {"id":"B03","group":"phonetic","title":"Jan Vaani","expect":"jan_vani_or_jana_vani_retrieved"},
    {"id":"B04","group":"phonetic","title":"Kisan Darshan","expect":"record_partial_token_effect; no_unexplained_full_phonetic_boost"},
    {"id":"B05","group":"phonetic","title":"Morning Chronicle","expect":"no_unexplained_rejection_from_single_phrase_fragment"},
    {"id":"C01","group":"combination","title":"Hindu Indian Express","expect":"hard_rule_reject_combination"},
    {"id":"C02","group":"combination","title":"Indian Hindu Express","expect":"hard_rule_reject_combination_despite_order"},
    {"id":"C03","group":"word_order","title":"Express Indian","expect":"record_edit_semantic_scores; no_unexplained_full_equivalence"},
    {"id":"C04","group":"periodicity","title":"Bharat Daily Samachar","expect":"periodicity_insertion_detected_or_manual_review"},
    {"id":"D01","group":"generic_tokens","title":"India Chronicle","expect":"no_rejection_solely_from_india_times"},
    {"id":"D02","group":"generic_tokens","title":"News Chronicle","expect":"no_full_phonetic_match_solely_from_news"},
    {"id":"D03","group":"generic_tokens","title":"Telangana Herald","expect":"no_rejection_solely_from_telangana_bulletin"},
    {"id":"D04","group":"generic_tokens","title":"Daily Chronicle","expect":"policy_and_similarity_reasons_must_be_explainable"},
    {"id":"E01","group":"semantic_retrieval","title":"Pratidin Sandhya","expect":"daily_evening_should_be_semantic_candidate; current_code_expected_to_fail"},
    {"id":"E02","group":"semantic_scoring","title":"Evening Daily","expect":"daily_evening_retrieved_and_semantic_score_recorded"},
    {"id":"E03","group":"semantic_overgeneralization","title":"Krishi Darpan","expect":"record_semantic_scores_against_kisan_darpan_and_krishi_darshan"},
    {"id":"E04","group":"semantic_overgeneralization","title":"Jana Awaaz","expect":"manual_review_of_candidate_path_and_confidence"},
    {"id":"F01","group":"hard_rules","title":"Crime Bulletin","expect":"hard_reject_probability_0_and_no_embedding"},
    {"id":"F02","group":"hard_rules","title":"CBI Samachar","expect":"hard_reject_probability_0_case_insensitive"},
    {"id":"F03","group":"short_title","title":"A","expect":"no_crash_and_deterministic_short_query_behavior"},
    {"id":"F04","group":"short_title","title":"A A","expect":"no_crash_no_arbitrary_high_phonetic_confidence"},
    {"id":"F05","group":"short_title","title":"News","expect":"explainable_closest_match_or_review"},
    {"id":"G01","group":"pending","workflow":["verify:Metro Mirror","register_pending:Metro Mirror","verify:Metro Mirror"],"expect":"second_verify_uses_pending_and_is_not_stale"},
    {"id":"G02","group":"pending","workflow":["register_pending:Metro Mirror","verify:Metro Mrror"],"expect":"pending_title_retrieved_for_spelling_variant"}
  ]
}
```

## Test Runner Requirements

Add `tools/run_adversarial_validation.py` with the following responsibilities:

1. Create or reset a dedicated SQLite database, e.g. `data/adversarial_validation.db`.
2. Ingest `tests/fixtures/adversarial_corpus.csv`.
3. Load `tests/fixtures/adversarial_queries.json`.
4. Execute every single-title query or workflow through the same service function used by the application.
5. Capture internal diagnostic values: normalised title, query phonetic codes, candidate count, candidate names, top result, individual similarity components, rule violations, status, probability, cache flag.
6. Write `data/reports/adversarial_validation_<timestamp>.json`.
7. Exit with non-zero status only for assertions that are marked as mandatory in the test definition; exploratory/manual-review cases should be reported but not silently converted into passes.

Suggested command:

```bash
python tools/run_adversarial_validation.py \
  --corpus tests/fixtures/adversarial_corpus.csv \
  --cases tests/fixtures/adversarial_queries.json \
  --db data/adversarial_validation.db \
  --report-dir data/reports
```

## Required Code Changes After Test Evidence

Implement the following in a feature branch after preserving a baseline report from current code. The changes are recommended because Findings 1–4 are verified structural limitations; the exact thresholds should be tuned only after the test evidence is available.

### Change 1 — add token-level phonetic codes without removing title-level codes

**Problem addressed:** The current phonetic feature is one code for the whole title. It cannot explain which word matched and can miss/overstate partial title similarity.

**Do not replace** title-level phonetics. Add token-level features alongside them.

Create or replace `src/phonetics.py` logic with this shape:

```python
import jellyfish
from metaphone import doublemetaphone

GENERIC_PHONETIC_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin"
}

def _token_codes(token: str) -> set[str]:
    primary, secondary = doublemetaphone(token)
    return {code for code in (primary, secondary) if code}

def compute_phonetic_codes(normalized_text: str) -> dict:
    """Keep full-title codes for backward compatibility and add token codes."""
    text = normalized_text or ""
    primary, secondary = doublemetaphone(text)
    token_map = {
        token: sorted(_token_codes(token))
        for token in text.split()
        if token
    }
    return {
        "soundex": jellyfish.soundex(text) if text else "",
        "metaphone_primary": primary,
        "metaphone_secondary": secondary or primary,
        "token_metaphones": token_map
    }
```

**Schema implication:** Do not store `token_metaphones` in the existing `titles` columns unless profiling proves it necessary. For local scale, derive token codes for the bounded candidate set at scoring time, or store JSON in a new optional `token_phonetics_json` column after migration. The latter reduces repeated candidate processing but requires a migration and re-ingestion.

### Change 2 — replace binary phonetic score with a generic-word-aware token score

**Problem addressed:** `1.0` for any complete-title code overlap and `0.0` otherwise is too coarse.

```python
from .phonetics import GENERIC_PHONETIC_TOKENS, compute_phonetic_codes

def token_phonetic_similarity(query_title: str, candidate_title: str) -> float:
    q = compute_phonetic_codes(query_title)["token_metaphones"]
    c = compute_phonetic_codes(candidate_title)["token_metaphones"]

    q_meaningful = {t: set(codes) for t, codes in q.items() if t not in GENERIC_PHONETIC_TOKENS}
    c_meaningful = {t: set(codes) for t, codes in c.items() if t not in GENERIC_PHONETIC_TOKENS}

    if not q_meaningful or not c_meaningful:
        return 0.0

    matched_query_tokens = 0
    for _q_token, q_codes in q_meaningful.items():
        if any(q_codes & c_codes for c_codes in c_meaningful.values()):
            matched_query_tokens += 1

    precision_like = matched_query_tokens / len(q_meaningful)
    return precision_like

def phonetic_match_score(new_codes: dict, cand_codes: dict, new_title: str, candidate_title: str) -> float:
    full_title_overlap = bool(
        {new_codes["metaphone_primary"], new_codes["metaphone_secondary"]}
        & {cand_codes["metaphone_primary"], cand_codes["metaphone_secondary"]}
    )
    token_score = token_phonetic_similarity(new_title, candidate_title)

    # A complete-title match remains meaningful, but no longer yields an unconditional 1.0.
    return max(token_score, 0.70 if full_title_overlap else 0.0)
```

**Important:** The proposed `0.70` is an initial hypothesis, not a final policy threshold. Run the adversarial report and tune it using labelled PRGI decisions where available.

### Change 3 — add token-aware lexical features

**Problem addressed:** full-string Jaro-Winkler and Levenshtein do not explicitly recognise distinctive-token overlap or word reordering.

```python
GENERIC_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin"
}

def meaningful_tokens(text: str) -> set[str]:
    return {t for t in text.split() if t and t not in GENERIC_TOKENS}

def token_jaccard(a: str, b: str) -> float:
    a_tokens = meaningful_tokens(a)
    b_tokens = meaningful_tokens(b)
    if not a_tokens and not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)
```

Add `token_overlap_similarity` to the diagnostic output. Initially, use it as a **review/explanation feature**, then tune its ensemble weight only after tests show it improves correct outcomes.

### Change 4 — make semantic retrieval explicit for cross-language equivalence

**Problem addressed:** semantic scoring cannot find a candidate that lexical/phonetic blocking never retrieves.

For the current local implementation, use a **bounded semantic fallback** rather than immediately introducing FAISS:

1. Run existing cheap lexical/phonetic retrieval.
2. If no candidates are returned, or the top lexical/phonetic score is below a configurable uncertainty threshold, compute the input embedding.
3. Compare it against stored corpus embeddings in batches and retain only top `K` semantic candidates, e.g. `K=20`.
4. Union semantic candidates with lexical candidates, deduplicate by title id, then score normally.
5. Add a strict semantic threshold and a manual-review band. Do not auto-reject solely based on semantic similarity until calibrated against labelled decisions.

Reference implementation shape:

```python
import numpy as np
from .embeddings import deserialize_vector, cosine_similarity

SEMANTIC_FALLBACK_TOP_K = 20
SEMANTIC_FALLBACK_MIN_SCORE = 0.72  # initial test value; calibrate later

def get_semantic_fallback_candidates(conn, query_embedding, top_k=SEMANTIC_FALLBACK_TOP_K):
    rows = conn.execute(
        """
        SELECT id, title_raw, title_normalized, title_core, language, state,
               status, embedding, metaphone_primary, metaphone_secondary, soundex_code
        FROM titles
        WHERE status IN ('registered', 'pending')
        """
    ).fetchall()

    scored = []
    for row in rows:
        candidate_embedding = deserialize_vector(row[7])
        score = cosine_similarity(query_embedding, candidate_embedding)
        if score >= SEMANTIC_FALLBACK_MIN_SCORE:
            scored.append((score, row))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [row for _score, row in scored[:top_k]]
```

At 82K–160K titles, a full linear embedding scan is likely too slow for every request. It is acceptable **only as a conditional fallback** in the local prototype. Log the latency. If it exceeds the latency budget, keep it for asynchronous/manual-review suggestions and present FAISS/HNSW or `sqlite-vec` as the production upgrade path.

### Change 5 — include candidate provenance and feature explanations

Every result must explain *why* a candidate appeared:

```json
{
  "candidate_title": "Namaskar Darpan",
  "retrieval_sources": ["fts5_trigram", "token_phonetic", "semantic_fallback"],
  "features": {
    "title_edit_similarity": 0.91,
    "token_overlap_similarity": 0.50,
    "full_title_phonetic_overlap": false,
    "token_phonetic_similarity": 0.50,
    "semantic_similarity": 0.88
  }
}
```

This is essential for auditability, threshold tuning, and explaining results to PRGI officials.

### Change 6 — use language/state metadata after the PRGI policy is confirmed

Implement a policy function rather than hard-coding a blanket SQL filter:

```python
def same_scope_for_prgi(query_language, query_state, cand_language, cand_state) -> bool:
    """
    Implement only after policy confirmation.
    Typical interpretation to validate:
    - same language anywhere in India; OR
    - any language within the same state.
    """
    return (
        bool(query_language and cand_language and query_language == cand_language)
        or bool(query_state and cand_state and query_state == cand_state)
    )
```

Use this as a candidate-ranking/risk feature at first, not as a hard retrieval exclusion, until official PRGI interpretation is signed off. A hard filter can create false negatives when metadata is missing or inconsistent.

## Acceptance Criteria for This Validation Work

Do not close this task until all items below are satisfied.

- [ ] Baseline report generated from current code with all A–G test groups.
- [ ] Report distinguishes `not retrieved`, `retrieved but low score`, `high score`, `hard-rule reject`, and `cache-stale` outcomes.
- [ ] E01 (`Pratidin Sandhya`) is explicitly recorded as pass/fail for semantic candidate retrieval; it must not be silently hidden by a 100% probability result.
- [ ] B01–B05 establish whether complete-title phonetic encoding causes misses/overmatches in this corpus.
- [ ] D01–D04 establish whether generic terms create unjustified matches.
- [ ] C01–C04 confirm token-order and combination/periodicity rule behaviour.
- [ ] F01/F02 prove hard rules bypass embedding computation.
- [ ] G01–G03 prove pending applications appear immediately and cache invalidation prevents stale approvals.
- [ ] Any code modification is accompanied by regression tests and a before/after comparison report.
- [ ] Final decision thresholds are not changed from individual anecdotes; they are tuned only using a labelled evaluation set or an explicitly documented temporary policy.

## Recommended Execution Order

1. Run the existing automated suite.
2. Generate the baseline adversarial JSON report without changing implementation logic.
3. Fix the semantic-retrieval gap first, because it is a confirmed requirement-level failure for same-meaning cross-language titles.
4. Add token-level phonetic diagnostics, then run B/D groups to quantify whether token-aware phonetics improves outcomes.
5. Add token-overlap features and provenance fields.
6. Only then decide whether feature weights or reject/review thresholds need calibration.

## Bottom Line

The concern about full-title phonetics is justified: the code conclusively shows whole-title encoding and binary phonetic scoring. However, replacing it wholesale with individual-word matching would introduce generic-word false positives. The appropriate implementation is a hybrid with both phrase-level and meaningful-token-level evidence.

The concern about semantics is also justified in a more serious way: the semantic model is not reached when the lexical/phonetic candidate generator cannot retrieve a cross-language equivalent. This is a confirmed architectural gap that the adversarial test suite should expose before implementing the conditional semantic fallback.
