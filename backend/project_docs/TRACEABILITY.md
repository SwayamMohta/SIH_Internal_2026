# Requirements → Milestone Traceability

Maps the 17 final acceptance criteria and the spec's functional requirements to milestones, modules, and test coverage. Status column updated as milestones close.

## Acceptance criteria → milestones

| # | Acceptance criterion | Milestone | Module(s) | Test(s) | Status |
|---|---|---|---|---|---|
| 1 | SQLite DB initializes locally | M1, M2 | `schema.sql`, `src/db.py` | `tests/test_db.py` | done |
| 2 | Dataset audit command works | M4 | `src/audit_dataset.py` | `tests/test_audit_dataset.py` | done |
| 3 | Merge utility works with fixtures | M4 | `tools/acquire_prgi_dataset.py` | `tests/test_acquire_merge.py` | done |
| 4 | CSV ingestion works + reports | M4 | `src/ingest.py`, `src/csv_mapping.py` | `tests/test_ingest.py` | done |
| 5 | FTS + metadata indexes synchronized | M2 | `schema.sql` (triggers) | `tests/test_db.py` | done |
| 6 | Verify works from CLI/service/API/UI | M8, M10 | `verify.py`, `app.py`, `templates/` | `tests/test_verify.py`, `tests/test_api.py` | done |
| 7 | Hard rules reject correctly (prob 0) | M5 | `rules.py` | `tests/test_rules.py` | done |
| 8 | Similarity uses bounded candidate retrieval | M6 | `retrieval.py` | `tests/test_retrieval.py` | done |
| 9 | Probability follows required formula | M7 | `probability.py` | `tests/test_probability.py` | done |
| 10 | Pending blocks later similar apps | M9 | `pending.py`, `cache.py` | `tests/test_pending.py` | done |
| 11 | Cache hit/expiry/invalidation work | M8 | `cache.py` | `tests/test_cache.py` | done |
| 12 | API validates input, no tracebacks | M10 | `app.py` | `tests/test_api.py` | done |
| 13 | UI shows all result states + disclaimer | M10 | `templates/index.html`, `static/` | smoke test | done |
| 14 | Full automated suite passes | M11 | `tests/` | `pytest` | done |
| 15 | README has exact setup/audit/merge/ingest/test/run cmds | M11 | `README.md` | manual | done |
| 16 | `/track` has evidence for every milestone | all | `project_docs/TRACKER.md` | review | done |
| 17 | Final report states real vs demo data | M11 | README + report | — | done (real data) |

## Functional requirements → modules

| Requirement | Module |
|---|---|
| Normalization (NFKC, trim, strip punct, collapse, lowercase) | `src/normalize.py` |
| Policy constants (words, weights, thresholds, limits) | `src/config.py` |
| Phonetics (Soundex, Double Metaphone) | `src/phonetics.py` |
| Embeddings (LaBSE 768, BLOB serialize/deserialize, cosine) | `src/embeddings.py` |
| CSV column aliases + mapping | `src/csv_mapping.py` |
| Dataset audit (hash, sizes, distributions, warnings, JSON report) | `src/audit_dataset.py` |
| Offline merge (CSV/XLSX, dedup, report) | `tools/acquire_prgi_dataset.py` |
| Ingestion (idempotent, batched, `--reset`, report) | `src/ingest.py` |
| Rules (disallowed / periodicity-add / combination) | `src/rules.py` |
| Candidate retrieval (soundex + metaphone + FTS5 union, short-title fallback) | `src/retrieval.py` |
| Scoring (edit 0.35 + phonetic 0.25 + semantic 0.40) | `src/scoring.py` |
| Probability + status bands | `src/probability.py` |
| TTL cache | `src/cache.py` |
| End-to-end orchestration | `src/verify.py` |
| Pending workflow | `src/pending.py` |
| Flask API + health | `app.py` |
| DB connection / init / WAL | `src/db.py` |
| UI | `templates/index.html`, `static/styles.css`, `static/app.js` |

## Milestone → acceptance coverage

| Milestone | Covers criteria |
|---|---|
| M1 Setup | 1 |
| M2 SQLite+FTS | 1, 5 |
| M3 Preprocessing | (foundation) |
| M4 Dataset tools+ingest | 2, 3, 4 |
| M5 Rules | 7 |
| M6 Retrieval | 8 |
| M7 Scores+probability | 9 |
| M8 Verify+cache | 6, 11 |
| M9 Pending | 10 |
| M10 API+UI | 6, 12, 13 |
| M11 Quality gate | 14, 15, 16, 17 |