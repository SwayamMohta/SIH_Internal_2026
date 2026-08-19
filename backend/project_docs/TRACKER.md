# PRGI Title Verification — Tracker

*Plan of record: `PRGI Title Verification – Local SQLite Build Spec (Source of Truth).md` (algorithms) + lead briefing (milestones, data model, acceptance criteria). On conflict the briefing's explicit requirements win; the `.md` is the algorithmic reference.*

## Current objective

Ship the adversarial title-matching validation + fixes per `implementation_prompt_after_adversarial_report.md` (Parts 1–6). **Done & verified 2026-08-19** — baseline + post-fix reports generated; comparison report written; full suite green. Remaining items below are policy decisions for sign-off, not code.

## Active task

Adversarial fixes implemented and validated (Parts 1–6). Latest completed change: UI now shows the **nearest 5 conflicts comma-separated** instead of one — `verify.py:_shape_response` adds `top_conflicts` (top-5 by combined similarity), `templates/index.html` "Nearest conflicts" row, `static/app.js` joins with `, `. All live-app fixes verified against the real 77k `prgi_titles.db`.

## Status

`review` — implementation + tests complete; needs sign-off on open policy decisions (E01 model limitation, semantic threshold calibration, generic-title policy, state/language scope).

## Adversarial validation program (baseline + fix)

Plan: `title_matching_adversarial_validation_plan.md` → baseline; `implementation_prompt_after_adversarial_report.md` → fixes.

**Baseline report:** `data/reports/adversarial_validation_20260819_114006.json` (mock embed). Confirmed failures: C01/C02 (combination depends on retrieval → bypassed), C04 (periodicity bypassed), F03/F04 (short titles), plus E01 semantic-retrieval gap (known).

**Post-fix reports:** mock `..._121446.json`, real `..._121511.json`. **Comparison:** `data/reports/adversarial_comparison_20260819_122017.json`. Fixed: C01, C02, C04, F03, F04, F05.

**E01 measured model limitation (real LaBSE):** `cos('Pratidin Sandhya','Daily Evening') = 0.318`, below the 0.72 provisional semantic-fallback threshold; the fallback mechanism works (E04 retrieved `Jana Vani` @ 0.796 → REVIEW + `requires_manual_semantic_review`). Honest result: no fabricated cross-lingual match at full-title level; per-token / threshold calibration is an open decision.

## Milestone progress

| # | Milestone | Deliverables | Status | Validated? |
|---|---|---|---|---|
| 0 | Audit + plan | `/track` plan, traceability, data audit | done | yes |
| 1 | Setup | skeleton, `requirements.txt`, `src/config.py`, test setup, README, `.gitignore`, DB init | done | yes (LaBSE cached) |
| 2 | SQLite + FTS | `schema.sql`, `src/db.py`, FTS5 trigram, WAL, sync triggers | done | yes (test_db.py) |
| 3 | Text preprocessing | `normalize.py`, `phonetics.py` | done | yes |
| 4 | Dataset tools + ingestion | `csv_mapping.py`, `audit_dataset.py`, `tools/acquire_prgi_dataset.py`, `ingest.py`, reports | done | yes (+ real-data audit run) |
| 5 | Rule engine | `rules.py` | done | yes |
| 6 | Retrieval | `retrieval.py` | done | yes |
| 7 | Scores + probability | `embeddings.py`, `scoring.py`, `probability.py` | done | yes |
| 8 | Verify service + cache | `verify.py`, `cache.py` | done | yes |
| 9 | Pending workflow | `pending.py` | done | yes |
| 10 | API + UI | `app.py`, `templates/`, `static/` | done | yes (+ serving smoke test) |
| 11 | Final quality gate | full tests, subagent review, clean-env run, README, limits | done | yes |

## Correctness invariants (must all hold before sign-off)

- [ ] Single `normalize_title` used at **both** ingestion and verification — never a second near-copy.
- [ ] `EMBEDDING_DIM = 768` (LaBSE) fixed for project lifetime; model change ⇒ re-embed whole `titles` table.
- [ ] `titles_fts` written only via schema triggers, never directly.
- [ ] Rule engine runs and short-circuits **before** semantic scoring (and before embedding, since embedding is only needed for scoring).
- [ ] `verification_probability = (1 − max(combined_similarity)) × 100`, single closest match, never averaged.
- [ ] Cache keyed by lowercased + stripped **raw** title.
- [ ] Pending insert invalidates the whole verification cache.
- [ ] Status thresholds evaluated at exact boundaries (30.00 / 60.00) via named config constants.
- [ ] No-LLM rule engine; deterministic only.

## Dependencies

| Package | Required | Status |
|---|---|---|
| `flask` | yes | installed 3.1.2 |
| `numpy` | yes | installed 2.2.6 |
| `sentence-transformers` | yes | installed 5.6.0 |
| `jellyfish` | yes | **not installed** (M1) |
| `metaphone` | yes | **not installed** (M1) |
| `openpyxl` | merge-XLSX only | **not installed** (M4, add only if XLSX fixtures used) |
| `indic_transliteration` | optional | **skip** — 1 Indic script row in 82,284 (see Decisions) |

Model: `sentence-transformers/LaBSE` (768-dim) — **cached locally and working** (real-embedding runs succeed 2026-08-19: adversarial real suite, E01/E04 measurements). Runtime stays offline after download.

## Decisions & resolutions (recorded, not open)

1. **Schema = briefing superset.** `titles` columns = briefing list (id, title_raw, title_normalized, title_core, registration_number, registration_date, language, state, periodicity, publisher, owner, district, status, soundex_code, metaphone_primary, metaphone_secondary, embedding, created_at). The `.md` schema is a subset; briefing explicitly requires registration/publisher/owner/district columns. Superset chosen.
2. **Real data, no demo.** `prgi_registered_titles.csv` = 82,284 rows of real PRGI data (0 empty titles, 3 empty reg numbers, 22 duplicate reg-number rows, 82,259 unique). Use it as `data/prgi_titles.csv`. No demo CSV needed.
3. **Periodicity rule vs stopwords.** `PREFIX_SUFFIX_STOPWORDS` strips only generic words (`the, india, indian, samachar, news, times, bharat, desh, patrika, sandesh, bulletin`) — **not** periodicity words. `PERIODICITY_WORDS` = `daily, weekly, monthly, fortnightly, annual, bimonthly, quarterly, biweekly`, used only by the periodicity-addition rule. Periodicity and combination rules compare **full normalized tokens** (not `core`), else the `.md`'s own example (`daily samachar patrika`) never fires.
4. **Lazy embedding.** Compute the input embedding only when rules pass AND candidates exist. A hard-rule reject skips semantic scoring entirely (briefing requirement + saves compute vs `.md` reference).
5. **Indic transliteration skipped.** 1 row of 82,284 uses non-Latin script; Latin-script encoding of Hindi/Telugu/etc. titles dominates. No `indic_transliteration` dependency (adds ambiguity for ~0 benefit). Flagged English/Latin-script-only in docs.
6. **CSV column map.** `Title→title`, `Registration Number→registration_number`, `Registration Date→registration_date`, `Language→language`, `Periodicity→periodicity`, `Publisher→publisher`, `Owner→owner`, `Publication State→state`, `Publication District→district`; `SN.` ignored. `status` absent in source ⇒ default `registered`.
7. **API surface = briefing set.** `POST /verify-title`, `POST /register-pending`, `GET /health` only. Ingestion is CLI-only (`python -m src.ingest`); no `/setup` web endpoint.
8. **Verify CLI added** (`python -m src.verify "<title>"`) to satisfy acceptance #6 ("works from CLI").
9. **`/register-pending` on REJECTED** returns HTTP 400 with `{error, status, reasons}`; otherwise inserts `pending`.
10. **Model policy = flash only.** All tiers pinned to `deepseek/deepseek-v4-flash-0731` in `.claude/settings.local.json` (`ANTHROPIC_MODEL`, DEFAULT_OPUS/SONNET/HAIKU, `CLAUDE_CODE_SUBAGENT_MODEL`). `deepseek-v4-pro` is not used for any purpose (user directive 2026-08-19); zero pro references remain in repo docs.
11. **graphify off** (`skillOverrides.graphify: "off"`; no `graphify-out/`). Graph navigation skipped.
12. **UTF-8 / BOM** handled by `utf-8-sig` decode in ingestion + audit (big CSV no BOM, small CSV has BOM).

## Open TODOs

- [ ] Extend `DISALLOWED_WORDS` from PRGI's full published banned-word list before production use.
- [ ] Tune similarity weights / status thresholds if a validated accept-reject pair set becomes available.
- [ ] Calibrate `SEMANTIC_FALLBACK_MIN_SCORE` (0.72 provisional) on a labelled set — do not tune from mock output.
- [ ] Decide cross-lingual equivalence policy: per-token vs full-title (LaBSE gives 0.318 for the E01 pair at phrase level).
- [ ] Confirm generic-title handling policy (generic-only → REVIEW currently).
- [ ] Confirm PRGI state/language scope policy before using metadata in ranking (Change 6 of the plan).

## Deferred items (locked — never implement now)

Postgres + `pg_trgm` · FAISS/HNSW vector index · Redis distributed cache · `sqlite-vec` extension. Document as future-scaling theory only (M11 README section).

## Blockers

None blocking. Risks: LaBSE ~1.9 GB download time; sentence-transformers 5.6 vs legacy `LaBSE` wrapper (verify at M1; pin ST version or shim if needed).

## Validation & checks run

**M0 (audit):** Python 3.10.8; SQLite 3.37.2 (FTS5 trigram confirmed); deps flask/numpy/sentence-transformers present, jellyfish/metaphone absent then; HuggingFace reachable.

**M1–M10 (build):** `python -m pytest` → **100 passed, 1 skipped** (real-model test gated behind `RUN_REAL_EMBED=1`). Components:
- `tests/test_db.py` (7): schema objects, WAL, status CHECK, FTS insert/update/delete sync.
- `tests/test_normalize.py` (11), `test_phonetics.py` (5): NFKC/punct/stopwords/periodicity-word retention; Soundex + Double Metaphone.
- `tests/test_rules.py` (11): disallowed/periodicity/combination + false-positive prevention.
- `tests/test_scoring.py` (9), `test_probability.py` (8): edit/phon/sem + combined weights; exact 30/60 boundaries.
- `tests/test_retrieval.py` (10): every blocking path + short-title LIKE fallback + pending/rejected filtering.
- `tests/test_verify.py` (6), `test_pending.py` (5): e2e orchestration, lazy-embed short-circuit, cache hit, pending-blocks-later.
- `tests/test_cache.py` (6): miss/hit/TTL expiry/invalidate-all.
- `tests/test_embeddings.py` (6+1skip): BLOB round-trip, cosine, dim guard, mocked embed.
- `tests/test_csv_mapping.py` (5), `test_audit_dataset.py` (2), `test_ingest.py` (3), `test_acquire_merge.py` (2): mapping, audit report, idempotent ingest, CSV+XLSX merge.
- `tests/test_api.py` (7): Flask test client — health, verify shape, validation 400s, no tracebacks.

**Real-data audit:** `python -m src.audit_dataset --csv data/prgi_titles.csv` → 82,284 rows, 0 empty titles, 22 dup reg-numbers, 2,377 dup composites, 319 languages / 36 states / 22 periodicities; report at `data/reports/audit_prgi_titles_*.json`.

**UI serving smoke test:** `app.run` → `GET /` 200 (title + disclaimer + Verify), `GET /health` 200 (database_ready, dim 768), `POST /verify-title` empty → 400.

## Final quality gate (M11) — evidence

- **Full suite:** `python -m pytest -q` → **101 passed, 1 skipped** (real-model test gated behind `RUN_REAL_EMBED=1`). Real-model test run separately: `RUN_REAL_EMBED=1 python -m pytest tests/test_embeddings.py::test_real_model_dim_and_unit_norm` → **1 passed** (768-dim, L2-norm 1.0).
- **Real ingestion:** `python -m src.ingest --csv data/prgi_titles.csv --reset` → **77,671 accepted**, 4,613 dupes skipped, 0 empty, 0 errors, 128.5 s.
- **Real end-to-end verify (live DB):** disallowed word → REJECTED/0.0; exact existing title → REJECTED/0.0 (combined 1.0); novel title → LIKELY_APPROVED/100.0; pending register + self-block → REJECTED/pending. All correct.
- **Subagent code review (flash-0731):** no Critical/Important defects; all 8 invariants confirmed. 5 Minor findings → adjudicated: #1 (ingest cache invalidation) **fixed** + test added; #2 rounding (spec-exact, no change); #3 word-order claim **refuted by test** (FTS5 trigram does match reversed order); #4/#5 non-issues (`status` alias + `isalnum` deliberately out of spec's alias list / harmless).

## Known limitations (final)

- `DISALLOWED_WORDS` = 10-word starter set; extend from PRGI's full list before production.
- Corpus is ~99.99% Latin-script → `indic_transliteration` skipped (documented).
- Semantic recall: a title with zero lexical/phonetic overlap now triggers the conditional semantic fallback (Part 5); remaining gap is measured — LaBSE full-phrase similarity for the E01 cross-lingual pair is 0.318 (below the 0.72 provisional threshold), an open per-token/threshold decision, not a hidden gap.
- Bounded retrieval (300) via a single `OR` query; pathological Soundex collisions could crowd out other channels.
- Scoring weights/thresholds are defaults, not tuned against validated pairs.

## Next steps

Adversarial-fix milestone is code-complete. Next actions (decisions, not defects):
1. Sign off on the E01 cross-lingual finding (per-token vs threshold calibration).
2. Provide a labelled accept/reject pair set to calibrate `SEMANTIC_FALLBACK_MIN_SCORE` and the ensemble weights.
3. Confirm generic-title and state/language scope policies.
4. Optional M11 follow-ups: extend `DISALLOWED_WORDS`.

## Adversarial validation & checks run (2026-08-19)

- `src/verify.py` gained a test-only `debug=True` path (bypass cache; append `input_phonetics`, `normalized_title`, `all_candidate_breakdowns`) — never routed from `app.py`.
- New modules: `src/rule_retrieval.py`, `src/semantic_retrieval.py`. Changed: `config.py`, `rules.py`, `phonetics.py`, `scoring.py`, `retrieval.py`, `verify.py`.
- New/updated tests: `test_rule_retrieval.py`, `test_semantic_retrieval.py`, `test_scoring.py`, `test_rules.py`, `test_phonetics.py`, `test_verify.py`, `test_api.py`, `test_adversarial_title_matching.py`.
- `python -m pytest -q` → **135 passed, 3 skipped, 1 xfailed** (skips = real-model RUN_REAL_EMBED-gated).
- **Live app check vs real `prgi_titles.db` (2026-08-19):** `A`/`A A` → INVALID_INPUT; `News` → REVIEW (generic); `Crime Bulletin` → REJECTED p=0; `Hindu Indian Express`/`Bharat Daily Samachar` → REJECTED (via similarity when exact source titles aren't registered); novel → LIKELY_APPROVED. `top_conflicts` live: `NAMASKAR PUNE, NAMASKAR BHARAT, NAMASKAAR PALGHAR, NAMASKAAR PALGHAR, NAMASKAR` (dups possible — real corpus has duplicate names with distinct reg numbers).

## Full suite baseline (pre-fix)

`python -m pytest` → 104 passed / 2 skipped / 1 xfailed (after fixtures + debug flag). M11 evidence (101/1) preserved.

## Recommended model path

`deepseek/deepseek-v4-flash-0731` — all work (pro model is not used by policy).