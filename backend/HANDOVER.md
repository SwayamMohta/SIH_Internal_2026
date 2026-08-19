# HANDOVER — PRGI Title Verification (+ Adversarial Validation Work)

Updated: 2026-08-19

## Current objective

Build M0–M11 core (DONE) **then** execute the adversarial title-matching validation program in `title_matching_adversarial_validation_plan.md`, **baseline harness first** (user-confirmed scope): create fixtures + test module + `verify_title(debug=True)` support + runner, generate a baseline JSON report against current code, **no algorithm changes yet**.

## What was completed (before this session's stalling)

- M0–M11 build complete and validated: `python -m pytest` → 101 passed, 1 skipped (real-model test gated behind `RUN_REAL_EMBED=1`). Real ingest: 77,671 titles accepted, 128.5 s. Live e2e verified (disallowed → REJECTED, exact match → REJECTED, novel → LIKELY_APPROVED, pending self-block works).
- Tracker updated (`project_docs/TRACKER.md`): adversarial-validation program now listed as the active objective; stage/M11 evidence sections untouched.
- **Context fully re-established this session**: read all of `src/{phonetics,scoring,retrieval,ingest,probability,verify,normalize,config,embeddings,rules,cache,db,pending,csv_mapping}.py`, `app.py`, `schema.sql`, `tests/conftest.py`, `requirements.txt`, `project_docs/TRACKER.md`.

## The plan's 6 verified findings (hold against code as written)

1. **Whole-title phonetics** — `phonetics.py:compute_phonetic_codes` encodes the complete title string (Soundex + Double Metaphone), never per token.
2. **Binary phonetic score** — `scoring.py:phonetic_match_score` returns 1.0 on ANY code overlap else 0.0.
3. **Full-phrase semantic compare** — one embedding per full normalized title; cosine in `score_candidate`.
4. **No semantic retrieval** — `retrieval.py:get_candidates` is Soundex/Metaphone/FTS5-trigram OR only; cross-lingual titles (e.g. "Pratidin Sandhya" vs "Daily Evening") never reach the semantic layer → reads LIKELY_APPROVED. This is the confirmed architectural gap.
5. **Phrase-level edit distance** — Jaro-Winkler + Levenshtein over whole strings, no token awareness.
6. **Metadata unused in ranking** — language/state/periodicity stored but not used in `get_candidates`.

## What changed this session

- `project_docs/TRACKER.md` — objective/active-task/status/next-steps sections rewritten to point at the adversarial validation program. (Milestone table + evidence untouched.)

## Current status

`in-progress (baseline harness task, partially blocked by session flakiness — see Restart instructions)`

## Open issues

- **NOTHING is implemented yet for the adversarial program.** Files below do NOT exist and must be created from scratch:
  - `tests/fixtures/adversarial_corpus.csv` (15-row corpus — content is in the plan §"Synthetic Corpus")
  - `tests/fixtures/adversarial_queries.json` (A01–G02 matrix — content is in the plan §"JSON Test Suite")
  - `tests/test_adversarial_title_matching.py`
  - `tools/run_adversarial_validation.py`
  - `src/verify.py` debug flag (see below)
- The plan mandates: do NOT change algorithm code (token phonetics, semantic fallback, etc.) until the baseline report demonstrates the issue.

## Risks and caveats

- **The harness must not require LaBSE (1.9 GB) for the pytest suite** — mock embeddings (deterministic hash-seeded unit vectors OK; plan's test #4 is `xfail` anyway).
- **`verify_title` must gain a test-only debug path** — plan says: "If `verify_title` does not return all candidate breakdowns, add a test-only debug flag or a dedicated internal `verify_title_debug()` function. Do not expose all corpus candidates in the public production API by default."
  - Plan's proposed change: `verify_title(raw_title, db_path=isolated_db, debug=True)` returning `{..., "all_candidates": [...breakdowns]}`; add `verify_title_debug()` wrapper that calls `verify_title(..., debug=True)` and the wrapper is **never** routed from `app.py`. Suggested implementation: add `debug: bool = False` param, and when True, skip the cache-read/write and append `all_candidates` (list of candidate score breakdowns) + `input_phonetics` + `normalized_title` to the returned dict.
  - Runner captures per-query: `query_id, title, candidate_count, candidate_titles, top_match, status, verification_probability, rule_violations, input_phonetics, top_score_breakdown, assertion_result, notes`.
- **No git repo here** (`git status` → "not a git repository"). The plan says work in a feature branch but there is none; just make a backup copy of `src/verify.py` before editing if desired.
- Semantic scores with mock embeddings will be noise but deterministic — acceptable for baseline since the plan's key assertions (retrieval gaps, hard-rule short-circuit, pending+spelling) are embed-independent.

## Validation completed

Full suite 101 passed / 1 skipped before this session. Nothing new validated this session (files not yet created).

## Exact next steps (in order)

1. Create directory `tests/fixtures/` and write the two fixture files exactly as given in the plan (corpus CSV §"Synthetic Corpus" with 16 data rows; queries JSON §"JSON Test Suite" with 27 entries).
2. Edit `src/verify.py` to add `debug=False` param per caveat above (do NOT touch scoring/retrieval logic).
3. Write `tests/test_adversarial_title_matching.py`:
   - `verify_title` runs against an isolated DB fixture → use `db_path=` arg (verify.py already accepts `db_path``); conftest inserts repo root into sys.path so `from src... import` works. Mock embeddings via `@patch`/`monkeypatch` on `src.embeddings.embed_text`/`embed_texts` (and `embed_text` on `ingest.py`'s import) — simpler: use a local fixture that monkeypatches `src.embeddings` bits.
   - Port the plan's required tests: phonetic-encoding shape; `test_namascar_darpan_retrieves_namaskar_darpan(isolated_db)` asserting `"namaskar darpan" in {c["candidate_title"].lower()}`; `test_generic_token_does_not_create_full_phonetic_match` → **skip/xfail** (token feature doesn't exist yet); `test_cross_language_semantic_candidate_is_retrieved` → `pytest.mark.xfail(strict=True, reason="Semantic candidate retrieval not implemented")`; `test_pending_insert_invalidates_stale_approval_cache(client)` (Flask test client; G-group).
4. Write `tools/run_adversarial_validation.py` (CLI per plan §"Test Runner Requirements"): `--corpus`, `--cases`, `--db data/adversarial_validation.db`, `--report-dir data/reports`; ingest corpus (reset) → run every single-title query via `verify_title(..., db_path=..., debug=True)`, run G01/G02/in-PROJECT workflows (G01 = verify Metro Mirror → register pending → verify again; G02 = register pending Metro Mirror → verify Metro Mrror); capture the diagnostic fields listed above; write `data/reports/adversarial_validation_<timestamp>.json`; exit non-zero only for queries marked mandatory.
   - Ingest via `src.ingest.ingest_csv(csv_path, reset=True, db_path=...)` — verify it accepts `db_path` param (it does). But NOTE ingest calls `embed_texts` (batch) → real LaBSE. For baseline that's OK (model is cached locally) but slow; a `--mock-embeddings` flag is a nice-to-have.
   - Cache: `register_pending` invalidates cache; verify_title reads cache — debug=True must bypass cache or results go stale (plan G03 covers this).
5. Run `python -m pytest` (whole suite must stay green), then `python tools/run_adversarial_validation.py` to produce the baseline report.
6. Save/report the baseline JSON path. Do NOT start Changes 1–6 (token phonetics, semantic fallback, etc.) without user go-ahead for phase 2.

## Recommended model path for next session

- **deepseek/deepseek-v4-flash-0731** — all work (the pro model is not used by policy).

## Restart instructions

- Open first: `title_matching_adversarial_validation_plan.md` (the source of truth for the program) + `project_docs/TRACKER.md` (project state).
- Plan of record for project build: `PRGI Title Verification – Local SQLite Build Spec (Source of Truth).md`.
- Do first: create the two fixture files (they are copy-paste-ready from the plan), then the verify.py debug flag, then the test module + runner, then run them.
- Checks first: `python -m pytest` (baseline 101/1 must stay green); confirm `src/verify.py` still has `db_path` param.
- Stay in Claude Code. Run the track skill (`/track`) to re-sync the tracker, and consider the `ponytail` skill (repo uses it — lazy/shortest-diff norms apply).
- **Session-specific strictness (why this session stalled): ** previous session kept re-planning and re-reading instead of executing. This session must WRITE the files immediately — do not re-read source files; the corpus/queries JSON are verbatim in the plan. Create fixtures → debug flag → tests → runner → run — in one uninterrupted pass.