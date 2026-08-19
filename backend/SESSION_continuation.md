# SESSION_continuation — Adversarial Validation Baseline Harness

For immediate pickup in a fresh session. Read `HANDOVER.md` for full state; this is the focused restart note.

## Session objective

Execute the **baseline harness** phase of `title_matching_adversarial_validation_plan.md` in ONE uninterrupted coding pass. No algorithm changes (Changes 1–6 are phase 2, not yet approved).

## Active task (do first, in order)

1. **Write `tests/fixtures/adversarial_corpus.csv`** — copy from plan §"Synthetic Corpus" (csv verbatim: header + 15 title rows).
2. **Write `tests/fixtures/adversarial_queries.json`** — copy from plan §"JSON Test Suite" (27 query entries, A01–G02).
3. **Edit `src/verify.py`**: add `debug: bool = False` param to `verify_title`. When `debug=True`: skip cache read AND cache write, append `all_candidates` (list of per-candidate breakdowns from `score_candidate`), `input_phonetics`, `normalized_title` to the returned dict. Prod path (`debug=False`) unchanged. Also add a `verify_title_debug()` wrapper that is NOT imported by `app.py`.
4. **Write `tests/test_adversarial_title_matching.py`**:
   - `isolated_db` fixture: temp sqlite, `ingest_csv(corpus_path, reset=True, db_path=tmp)`. Mock embeddings by monkeypatching `src.embeddings.embed_text`/`embed_texts` (and the `embed_texts` name in `ingest.py`) — must be deterministic, no LaBSE.
   - Port plan's tests: phonetic-shape test passes as-is; `test_namascar_darpan_retrieves_namaskar_darpan(isolated_db)` → needs `debug=True` for candidates; generic-token test → skip/xfail (feature absent); cross-language (`Pratidin Sandhya`→`Daily Evening`) → `xfail(strict=True, reason="Semantic candidate retrieval not implemented")`; cache-invalidation G-test via Flask `app.test_client()`.
5. **Write `tools/run_adversarial_validation.py`**: args `--corpus --cases --db --report-dir` (+ optional `--mock-embeddings`); reset DB; ingest; run each query through `verify_title(..., debug=True)`; run G workflows (verify Metro Mirror → register pending → verify again; register pending → verify "Metro Mrror"); emit `data/reports/adversarial_validation_<timestamp>.json` (fields: query_id, title, candidate_count, candidate_titles, top_match, status, verification_probability, rule_violations, input_phonetics, top_score_breakdown, assertion_result=PASS|FAIL|MANUAL_REVIEW, notes); exit non-zero only on mandatory-fail.
6. **Run**: `python -m pytest` (must stay 101+ green) then `python tools/run_adversarial_validation.py`.
7. Report the baseline JSON path + a short findings table to the user. Stop. Do not proceed to plan Changes 1–6 without approval.

## Key technical facts (do not re-derive)

- `verify_title(raw_title, db_path=None)` already accepts `db_path` → isolates to a temp DB by passing it.
- `register_pending(..., db_path=None)` also accepts `db_path` (used by G workflows + cache-invalidation test).
- `register_pending` calls `verification_cache.invalidate_all()` after insert → G01 second verify is fresh.
- `ingest_csv(csv_path, reset=True, db_path=None)` exists; it batches `embed_texts` (batch) — that's the only real-model touchpoint; mock it or accept load.
- Cache keys on lowercased+stripped raw title (MD5). Debug must bypass it.
- Retrieval FTS5 clause: `len(norm.replace(" ","")) >= 3` else LIKE fallback. "A" and "A A" hit the LIKE path.
- No git repo. No feature branch exists. Copy `src/verify.py` before editing if paranoid.
- `tests/conftest.py` already inserts repo root into `sys.path`.

## Files to open first

- `title_matching_adversarial_validation_plan.md` (source of truth, has verbatim fixtures)
- `src/verify.py`, `src/retrieval.py`, `src/pending.py`, `src/ingest.py`
- `project_docs/TRACKER.md`, `HANDOVER.md`

## Recommended model / effort

- **deepseek/deepseek-v4-flash-0731**, effort high, thinking on. (pro model is not used by policy.)
- Do NOT start with a subagent for exploration — context is already loaded here; write code immediately.

## Constraints from prior session (why it stalled)

Prior session repeatedly re-read source files and re-planned instead of writing files. **Write the fixture JSON/CSV verbatim from the plan, edit verify.py, then run pytest + runner — no intermediate pauses for confirmation.**