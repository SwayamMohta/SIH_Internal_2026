# PRGI Title Verification — Local Build

A local-first decision-support system that assesses a proposed periodical/publication
title against a locally imported PRGI title corpus and locally stored pending
applications. Built on **Python + SQLite (WAL + FTS5 trigram) + in-process Python**
only — no Postgres, Redis, FAISS, or cloud services.

> **⚠️ Disclaimer:** this tool produces an automated *preliminary* assessment. It
> never claims a title is officially verified, approved, legally available, or
> accepted by PRGI. Final verification remains PRGI's responsibility.

---

## What it does

1. Accepts a proposed title.
2. Normalizes it consistently (NFKC, punctuation-stripped, lowercased, whitespace-collapsed).
3. Runs deterministic PRGI-style policy rules (disallowed words, periodicity additions, combination of existing titles).
4. Retrieves a bounded set of likely-matching titles (Soundex + Double Metaphone + FTS5 trigram).
5. Scores candidates on edit / phonetic / semantic similarity.
6. Computes a verification probability from the single closest match.
7. Returns a clear, explainable result.
8. Stores non-rejected submissions as `pending` (first-come-first-served blocking).
9. Runs entirely locally with SQLite; provides a web UI, JSON API, CLI, and tests.

## Requirements

- Python 3.10+
- SQLite ≥ 3.34 (bundled with CPython 3.10; trigram FTS5 confirmed on 3.37.2)

## Setup

```bash
pip install -r requirements.txt
```

This installs `flask`, `numpy`, `sentence-transformers`, `jellyfish`, `metaphone`,
`openpyxl`, and `pytest`.

On first use the embedding model (`sentence-transformers/LaBSE`, 768-dim, ~1.9 GB)
is downloaded from Hugging Face and cached locally. After that the app runs
fully offline — it never requires internet access at runtime.

## Dataset

The canonical input CSV is `data/prgi_titles.csv`. Only a `title` column is
mandatory; all other columns are optional metadata.

| Canonical column | Common aliases |
|---|---|
| `title` | `Title`, `title_name`, `Publication Title` |
| `registration_number` | `Registration Number`, `RNI No` |
| `registration_date` | `Registration Date` |
| `language` | `Language` |
| `periodicity` | `Periodicity`, `frequency` |
| `publisher` | `Publisher` |
| `owner` | `Owner` |
| `state` | `Publication State`, `State` |
| `district` | `Publication District`, `District` |
| `status` | (absent → `registered`) |

### Audit the dataset

```bash
python -m src.audit_dataset --csv data/prgi_titles.csv
```

Read-only. Prints a summary and writes a JSON report under `data/reports/` with
SHA-256, size, encoding, header mapping, row/duplicate counts, distributions,
Unicode/Indic-script detection, samples, and data-quality warnings.

### Merge manual page exports (offline)

```bash
python tools/acquire_prgi_dataset.py merge \
  --input-dir data/raw_prgi_exports \
  --output data/prgi_titles.csv
```

Merges CSV and XLSX page exports, applies column mapping, deduplicates (by
non-empty registration number, else by `title_normalized|language|state|periodicity`
— never by title alone), and writes a merge report to `data/reports/`.

### Ingest into the local corpus

```bash
python -m src.ingest --csv data/prgi_titles.csv --reset
```

- `--reset` rebuilds application-managed contents; without it, ingestion is idempotent.
- Normalizes, computes phonetics, generates one float32 embedding per title, and
  batch-writes rows (status `registered`). Writes an ingestion report to `data/reports/`.

## Run

```bash
python app.py          # http://127.0.0.1:5000
```

Or verify a title from the CLI:

```bash
python -m src.verify "Daily Samachar Patrika"
```

## Test

```bash
python -m pytest -q                    # full suite
RUN_REAL_EMBED=1 python -m pytest tests/test_embeddings.py::test_real_model_dim_and_unit_norm -q   # real-model check
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/verify-title` | POST | `{"title": "..."}` → status, probability, reasons, closest match + breakdown, candidate count, cache state, disclaimer. |
| `/register-pending` | POST | `{"title","language","state","periodicity"}` → registers as `pending` (unless the title is REJECTED). |
| `/health` | GET | service/database/embedding readiness + counts. |

Hard-rule violations return `status="REJECTED"`, `verification_probability=0.0`,
and human-readable `reasons`. Invalid requests return JSON `400`; tracebacks are
never exposed.

## Schema (SQLite)

- `titles` — id, title_raw, title_normalized, title_core, registration_number,
  registration_date, language, state, periodicity, publisher, owner, district,
  status (`registered`/`pending`/`rejected`), soundex_code, metaphone_primary,
  metaphone_secondary, embedding (float32 BLOB), created_at.
- `titles_fts` — FTS5 `tokenize='trigram'` external-content table, kept in sync by
  insert/update/delete triggers.
- Indexes on soundex, metaphone primary/secondary, (state, language), status, and
  registration number. WAL mode enabled.

## Where to edit policy

All tunable policy lives in **`src/config.py`**:

- `DISALLOWED_WORDS` — banned-word set (hard reject).
- `PERIODICITY_WORDS` — used by the periodicity-addition rule.
- `PREFIX_SUFFIX_STOPWORDS` — generic words stripped from `title_core`.
- `EDIT_WEIGHT` / `PHONETIC_WEIGHT` / `SEMANTIC_WEIGHT` — scoring mix (0.35/0.25/0.40).
- `CANDIDATE_LIMIT` (300), `CACHE_TTL_SECONDS` (3600).
- `REJECT_THRESHOLD` (30) / `REVIEW_THRESHOLD` (60).

## Status bands

`verification_probability = (1 − max_combined_similarity) × 100`, from the single
closest candidate only (never averaged). `< 30` → REJECTED, `30–60` → REVIEW,
`≥ 60` → LIKELY_APPROVED. These thresholds are tunable design choices, not PRGI mandates.

## Dataset used

**Real PRGI data.** `data/prgi_titles.csv` is a 82,284-row export of registered
titles (Hindi/Marathi/Telugu/etc., largely Latin-script). Audit: 0 empty titles,
22 duplicate registration numbers, 2,377 duplicate composite keys.

## Known limitations

- `DISALLOWED_WORDS` is a starter set (10 words) — extend from PRGI's full
  published list before production use.
- Corpus is ~99.99% Latin-script; Indic-script transliteration is intentionally
  skipped (`indic_transliteration` not added). 1 row uses a non-Latin script.
- Candidate retrieval is bounded (default 300) via a single `OR` query; extreme
  Soundex collisions could crowd out other channels in pathological cases.
- Semantic embeddings are LaBSE (768-dim); changing the model requires re-embedding
  the entire corpus.
- Scoring weights and status thresholds are defensible defaults, not tuned against
  a validated accept/reject pair set.

## Future scaling theory (deferred — not implemented)

- **PostgreSQL + `pg_trgm`** — if many concurrent writers outgrow one SQLite file,
  migrate `titles` and swap FTS5 trigram for `pg_trgm`.
- **FAISS/HNSW** — replace the brute-force cosine scan if blocking recall ever
  proves insufficient for full-corpus semantic search.
- **Redis** — replace the in-process `TTLCache` when the service spans multiple
  processes/machines.
- **`sqlite-vec`** — intermediate native-KNN step before Postgres/FAISS.

See `project_docs/TRACKER.md` (milestones + decisions) and
`project_docs/TRACEABILITY.md` (acceptance-criteria traceability).
