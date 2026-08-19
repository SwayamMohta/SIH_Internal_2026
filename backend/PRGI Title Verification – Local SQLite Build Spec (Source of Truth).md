## Purpose of This Document

This document is the authoritative build specification for a **local, single-machine** implementation of the PRGI title verification system. It replaces the earlier Postgres/Redis/FAISS-oriented design with a **pure SQLite + in-process Python** stack suitable for a hackathon/local deployment, while preserving every functional capability required by the PRGI problem statement. Scaling techniques (Postgres, Redis, FAISS/HNSW) are described only as a **future theory section** at the end — they are not part of the implementation to be built now. Every component below states its purpose, the logic behind it, and an unambiguous code snippet, so a coding agent can implement it without needing to make design decisions.

## Why SQLite Can Fully Replace Postgres Here

The earlier design used Postgres for three things: (1) relational storage of titles, (2) `pg_trgm` for fuzzy substring blocking, (3) `pgvector` for embedding storage/search. SQLite has direct equivalents for all three, and at 160,000 rows (or a smaller local subset), none of these operations require a server process:

| Postgres feature | SQLite replacement | Why it's equivalent here |
|---|---|---|
| Relational tables | SQLite tables | Identical SQL semantics for this schema; SQLite is a single file, no server needed[^1] |
| `pg_trgm` fuzzy/substring search | FTS5 virtual table with `tokenize="trigram"` | Native to SQLite since 3.34, indexes 3-character sequences for substring/fuzzy matching, no extension compile needed[^2][^3] |
| `pgvector` embedding storage + cosine search | Embeddings stored as BLOBs + a custom SQL function `cosine_similarity` registered via `sqlite3.Connection.create_function` | Proven pattern for small-to-medium datasets (up to hundreds of thousands of vectors) run entirely in-process[^1][^4][^5] |

Redis is also removed. Since this is a single local process (not a distributed system), an **in-process Python dictionary with TTL** gives identical cache-aside behavior without running a second server. This is documented explicitly in Stage 7.

## Full Data Model (SQLite)

```sql
-- schema.sql
PRAGMA journal_mode = WAL;   -- allows concurrent reads while writing, important even in single-machine use

CREATE TABLE titles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title_raw         TEXT NOT NULL,          -- original submitted/registered text, unmodified
    title_normalized  TEXT NOT NULL,          -- lowercased, punctuation-stripped
    title_core        TEXT NOT NULL,          -- title_normalized with prefix/suffix stopwords removed
    language          TEXT,                   -- e.g. 'en', 'hi', 'te'
    state             TEXT,                   -- Indian state the title is registered/applied in
    periodicity       TEXT,                   -- daily/weekly/monthly/etc.
    status            TEXT NOT NULL CHECK(status IN ('registered','pending','rejected')),
    soundex_code      TEXT,
    metaphone_primary TEXT,
    metaphone_secondary TEXT,
    embedding         BLOB,                   -- float32 vector, packed via struct.pack, see Stage 3
    created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_titles_soundex ON titles(soundex_code);
CREATE INDEX idx_titles_metaphone_p ON titles(metaphone_primary);
CREATE INDEX idx_titles_metaphone_s ON titles(metaphone_secondary);
CREATE INDEX idx_titles_state_lang ON titles(state, language);
CREATE INDEX idx_titles_status ON titles(status);

-- Virtual FTS5 table for fuzzy substring matching (replaces pg_trgm)
CREATE VIRTUAL TABLE titles_fts USING fts5(
    title_normalized,
    content='titles',
    content_rowid='id',
    tokenize='trigram'
);

-- Triggers to keep titles_fts in sync with titles automatically
CREATE TRIGGER titles_ai AFTER INSERT ON titles BEGIN
    INSERT INTO titles_fts(rowid, title_normalized) VALUES (new.id, new.title_normalized);
END;

CREATE TRIGGER titles_ad AFTER DELETE ON titles BEGIN
    INSERT INTO titles_fts(titles_fts, rowid, title_normalized) VALUES('delete', old.id, old.title_normalized);
END;

CREATE TRIGGER titles_au AFTER UPDATE ON titles BEGIN
    INSERT INTO titles_fts(titles_fts, rowid, title_normalized) VALUES('delete', old.id, old.title_normalized);
    INSERT INTO titles_fts(rowid, title_normalized) VALUES (new.id, new.title_normalized);
END;
```

**Logic**: `title_raw` preserves exact submitted text for display in user feedback. `title_normalized` and `title_core` are pre-computed once at insert time (not recomputed per query) so every downstream comparison is cheap. The FTS5 trigram virtual table with `content='titles'` mirrors the main table without duplicating storage, and triggers keep it automatically in sync on insert/update/delete, so application code never manually maintains two tables.[^2][^3]

## Stage 1: Normalization

**Purpose**: Convert raw submitted text into consistent forms so phonetic, edit-distance, and rule checks operate on clean, comparable strings. This must run identically at ingestion time (for the 160K/subset corpus) and at query time (for a new submission) — using the same function guarantees no mismatch.

```python
# normalize.py
import re
import unicodedata

PREFIX_SUFFIX_STOPWORDS = {
    "the", "india", "indian", "samachar", "news", "times",
    "daily", "weekly", "monthly", "fortnightly", "annual",
    "bharat", "desh", "patrika", "sandesh", "bulletin"
}

def normalize_title(raw_title: str) -> dict:
    """
    Returns a dict with three representations of the title:
    - normalized: lowercase, punctuation-stripped, whitespace-collapsed
    - core: normalized with prefix/suffix stopwords removed
    - tokens: set of words in normalized form (for rule checks)
    """
    text = unicodedata.normalize("NFKC", raw_title.strip())
    text = re.sub(r"[^\w\s]", "", text)          # strip punctuation
    text = re.sub(r"\s+", " ", text).strip()      # collapse whitespace
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
```

**Note on transliteration**: If the local dataset includes non-Latin-script titles (Hindi/Telugu/etc.) and the phonetic layer needs a single script to compare across languages, add a transliteration step using the `indic_transliteration` library before phonetic encoding. This is optional for an English-only demo dataset — flag it as a TODO if the local dataset is English-only, since adding an unused dependency increases ambiguity for the coding agent. Do not silently drop this if the actual dataset contains Indic scripts.

## Stage 2: Phonetic Encoding

**Purpose**: Catch "sounds-alike" titles (e.g., "Namaskar" vs "Namascar") that pass a pure spelling check. Double Metaphone is used over plain Soundex because it returns two possible codes per word (primary/secondary), which improves recall for ambiguous pronunciations.[^6][^7]

```python
# phonetics.py
import jellyfish
from metaphone import doublemetaphone

def compute_phonetic_codes(normalized_text: str) -> dict:
    """
    Computes Soundex (secondary signal) and Double Metaphone (primary signal)
    codes for a normalized title string.
    """
    soundex = jellyfish.soundex(normalized_text) if normalized_text else ""
    mp_primary, mp_secondary = doublemetaphone(normalized_text)
    return {
        "soundex": soundex,
        "metaphone_primary": mp_primary,
        "metaphone_secondary": mp_secondary or mp_primary,  # fall back if no secondary code
    }
```

**Dependencies**: `pip install jellyfish metaphone`

## Stage 3: Embeddings (Semantic / Cross-Lingual Layer)

**Purpose**: Catch titles with the same *meaning* even if spelled/sounded differently or in a different language (e.g., "Daily Evening" vs "Pratidin Sandhya"), which no phonetic or edit-distance method can detect. A multilingual sentence embedding model is required because plain English sentence embedding models will not correctly align Indian-language text with English text in the same vector space.[^8][^9]

```python
# embeddings.py
import struct
import numpy as np
from sentence_transformers import SentenceTransformer

_MODEL = SentenceTransformer("sentence-transformers/LaBSE")  # 109-language coverage incl. major Indian languages
EMBEDDING_DIM = 768  # LaBSE output dimension — fixed, do not change without re-embedding entire corpus

def embed_text(text: str) -> np.ndarray:
    vec = _MODEL.encode(text, normalize_embeddings=True)  # L2-normalized so dot product == cosine similarity
    return np.asarray(vec, dtype=np.float32)

def serialize_vector(vec: np.ndarray) -> bytes:
    """Pack a float32 numpy array into raw bytes for SQLite BLOB storage."""
    return struct.pack(f"{len(vec)}f", *vec)

def deserialize_vector(blob: bytes) -> np.ndarray:
    """Unpack raw bytes back into a float32 numpy array."""
    count = len(blob) // 4
    return np.array(struct.unpack(f"{count}f", blob), dtype=np.float32)

def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Both vectors are pre-normalized, so dot product equals cosine similarity."""
    return float(np.dot(vec_a, vec_b))
```

**Dependencies**: `pip install sentence-transformers numpy`. **Important for the coding agent**: `EMBEDDING_DIM` must stay fixed at 768 for the whole project's lifetime — if the model is ever changed, every stored embedding in the `titles` table must be recomputed, not appended alongside old ones.

## Stage 4: Ingestion Pipeline (Building the Local Corpus)

**Purpose**: Populate the SQLite database once from the source title list (a CSV export scraped/downloaded from PRGI, or a smaller local sample for the hackathon demo). This runs as a one-time batch job, not per-request.

```python
# ingest.py
import sqlite3
import csv
from normalize import normalize_title
from phonetics import compute_phonetic_codes
from embeddings import embed_text, serialize_vector

DB_PATH = "prgi_titles.db"

def ingest_csv(csv_path: str):
    """
    Expects a CSV with at least a 'title' column, and optionally
    'language', 'state', 'periodicity' columns.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL;")
    cur = conn.cursor()

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        for row in reader:
            raw_title = row["title"].strip()
            if not raw_title:
                continue
            norm = normalize_title(raw_title)
            phon = compute_phonetic_codes(norm["normalized"])
            vec = embed_text(norm["normalized"])
            blob = serialize_vector(vec)

            batch.append((
                raw_title,
                norm["normalized"],
                norm["core"],
                row.get("language", ""),
                row.get("state", ""),
                row.get("periodicity", ""),
                "registered",
                phon["soundex"],
                phon["metaphone_primary"],
                phon["metaphone_secondary"],
                blob,
            ))

            if len(batch) >= 500:
                _flush_batch(cur, batch)
                conn.commit()
                batch = []

        if batch:
            _flush_batch(cur, batch)
            conn.commit()

    conn.close()

def _flush_batch(cur, batch):
    cur.executemany("""
        INSERT INTO titles
        (title_raw, title_normalized, title_core, language, state, periodicity,
         status, soundex_code, metaphone_primary, metaphone_secondary, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, batch)

if __name__ == "__main__":
    ingest_csv("prgi_titles.csv")
```

**Logic**: Batching inserts in groups of 500 avoids opening/committing a transaction per row, which would be extremely slow for tens of thousands of rows in SQLite. Embeddings are computed once here — never recompute an existing title's embedding at query time.

## Stage 5: Rule Engine (Hard-Fail Checks)

**Purpose**: Encodes PRGI's deterministic legal rules directly. These checks are cheap and must run before similarity scoring so obviously invalid titles are rejected instantly with a clear reason, satisfying the "clear feedback" requirement.[^10][^11]

```python
# rules.py

DISALLOWED_WORDS = {
    "police", "crime", "corruption", "cbi", "cid", "army",
    "cognizable", "intelligence", "raw", "terrorist", "encounter"
    # Extend this set from PRGI's full published banned-word list before production use.
}

PERIODICITY_WORDS = {
    "daily", "weekly", "monthly", "fortnightly", "annual",
    "bimonthly", "quarterly", "biweekly"
}

def check_disallowed_words(tokens: set) -> str | None:
    hit = tokens & DISALLOWED_WORDS
    if hit:
        return f"Title contains disallowed word(s): {', '.join(sorted(hit))}"
    return None

def check_periodicity_addition(new_core_tokens: set, candidate_core_tokens: set, candidate_title: str) -> str | None:
    """
    Detects: new title = existing title's core tokens + only periodicity word(s) added.
    Example: existing 'samachar patrika' -> new 'daily samachar patrika' is rejected.
    """
    if not candidate_core_tokens:
        return None
    extra_tokens = new_core_tokens - candidate_core_tokens
    if candidate_core_tokens.issubset(new_core_tokens) and extra_tokens and extra_tokens.issubset(PERIODICITY_WORDS):
        return f"Title formed by adding periodicity to existing title '{candidate_title}'"
    return None

def check_title_combination(new_tokens: set, candidates: list) -> str | None:
    """
    Detects: new title's token set fully contains two or more DISTINCT existing
    titles' full token sets. Example: 'hindu' + 'indian express' -> 'hindu indian express'.
    candidates: list of dicts each with keys 'title_raw' and 'title_normalized'.
    """
    matched_titles = []
    for cand in candidates:
        cand_tokens = set(cand["title_normalized"].split())
        if cand_tokens and cand_tokens.issubset(new_tokens):
            matched_titles.append(cand["title_raw"])
        if len(matched_titles) >= 2:
            return f"Title appears to combine existing titles: {', '.join(matched_titles)}"
    return None

def run_rule_engine(new_title_data: dict, candidates: list) -> list[str]:
    """
    Runs all hard-fail rule checks. Returns a list of violation reason strings
    (empty list means no rule violations found).
    """
    violations = []

    v = check_disallowed_words(new_title_data["tokens"])
    if v:
        violations.append(v)

    for cand in candidates:
        cand_core_tokens = set(cand["title_core"].split())
        v = check_periodicity_addition(set(new_title_data["core"].split()), cand_core_tokens, cand["title_raw"])
        if v:
            violations.append(v)
            break  # one periodicity violation is enough to reject

    v = check_title_combination(new_title_data["tokens"], candidates)
    if v:
        violations.append(v)

    return violations
```

**Logic explained**: `check_periodicity_addition` compares token sets, not raw strings, so word order doesn't matter (PRGI rules care about content, not position). `check_title_combination` requires the new title's tokens to be a strict superset of **two distinct** existing titles' full token sets before flagging — this avoids false positives on titles that merely share one common word with two unrelated existing titles.

## Stage 6: Candidate Retrieval (Blocking)

**Purpose**: Avoid comparing the new title against every row in the database. Instead, retrieve only a small set of plausible matches using phonetic codes and FTS5 trigram search, then run expensive comparisons only on this reduced set. This is the SQLite-only replacement for the Postgres blocking query in the earlier design.

```python
# retrieval.py
import sqlite3

def get_candidates(conn: sqlite3.Connection, new_title_data: dict, phonetic_codes: dict, limit: int = 300) -> list[dict]:
    """
    Retrieves candidate rows using a UNION of three blocking signals:
    1. Exact Soundex code match
    2. Metaphone primary/secondary code match
    3. FTS5 trigram substring match on normalized title
    Deduplicates by id and returns as a list of dicts.
    """
    cur = conn.cursor()

    query = """
        SELECT DISTINCT t.id, t.title_raw, t.title_normalized, t.title_core,
               t.language, t.state, t.status, t.embedding
        FROM titles t
        WHERE t.soundex_code = :soundex
           OR t.metaphone_primary IN (:mp, :ms)
           OR t.metaphone_secondary IN (:mp, :ms)
           OR t.id IN (
               SELECT rowid FROM titles_fts
               WHERE titles_fts MATCH :fts_query
               LIMIT :limit
           )
        LIMIT :limit
    """

    fts_query = new_title_data["normalized"].replace('"', '')  # sanitize for FTS5 MATCH syntax

    rows = cur.execute(query, {
        "soundex": phonetic_codes["soundex"],
        "mp": phonetic_codes["metaphone_primary"],
        "ms": phonetic_codes["metaphone_secondary"],
        "fts_query": fts_query,
        "limit": limit,
    }).fetchall()

    columns = ["id", "title_raw", "title_normalized", "title_core", "language", "state", "status", "embedding"]
    return [dict(zip(columns, row)) for row in rows]
```

**Logic**: The `UNION`-style `OR` across three independent signals (exact phonetic match, exact metaphone match, fuzzy trigram substring match) maximizes recall — a title only needs to trip **one** of the three signals to become a candidate for detailed scoring. This mirrors the multi-key blocking principle from entity-resolution research, adapted to run entirely inside a single SQLite query.[^12]

## Stage 7: Similarity Scoring (Ensemble)

**Purpose**: For each retrieved candidate, compute a combined similarity score from three independent signals — edit distance, phonetic match, and semantic embedding similarity — then combine them into one number.

```python
# scoring.py
import jellyfish
from embeddings import deserialize_vector, cosine_similarity, embed_text

def edit_distance_score(a: str, b: str) -> float:
    """Weighted combination of Jaro-Winkler and normalized Levenshtein similarity."""
    jw = jellyfish.jaro_winkler_similarity(a, b)
    max_len = max(len(a), len(b), 1)
    lev_sim = 1 - (jellyfish.levenshtein_distance(a, b) / max_len)
    return 0.6 * jw + 0.4 * lev_sim  # Jaro-Winkler weighted higher per empirical name-matching studies

def phonetic_match_score(new_codes: dict, cand_codes: dict) -> float:
    """Binary score: 1.0 if any phonetic code overlaps, else 0.0."""
    new_set = {new_codes["metaphone_primary"], new_codes["metaphone_secondary"]}
    cand_set = {cand_codes["metaphone_primary"], cand_codes["metaphone_secondary"]}
    return 1.0 if new_set & cand_set else 0.0

def score_candidate(new_title_data: dict, new_embedding, new_phonetic_codes: dict,
                     candidate: dict, candidate_phonetic_codes: dict) -> dict:
    edit_sim = edit_distance_score(new_title_data["normalized"], candidate["title_normalized"])
    phon_sim = phonetic_match_score(new_phonetic_codes, candidate_phonetic_codes)

    cand_embedding = deserialize_vector(candidate["embedding"])
    sem_sim = cosine_similarity(new_embedding, cand_embedding)
    sem_sim = max(0.0, min(1.0, sem_sim))  # clamp in case of floating point drift

    combined = (0.35 * edit_sim) + (0.25 * phon_sim) + (0.40 * sem_sim)

    return {
        "candidate_id": candidate["id"],
        "candidate_title": candidate["title_raw"],
        "edit_similarity": round(edit_sim, 4),
        "phonetic_similarity": round(phon_sim, 4),
        "semantic_similarity": round(sem_sim, 4),
        "combined_similarity": round(combined, 4),
    }
```

**Weighting rationale**: Semantic similarity (0.40) is weighted highest because it is the only signal that catches cross-lingual meaning equivalence, which PRGI explicitly flags as a required rejection criterion that string/phonetic methods cannot detect on their own. Edit distance (0.35) and phonetics (0.25) together catch spelling/typo/sound variants. These weights are a defensible starting point — if the local dataset later allows validation against a set of known accepted/rejected title pairs, the weights should be tuned rather than left fixed.[^9][^10]

## Stage 8: Probability Aggregation

**Purpose**: Combine rule-engine results and similarity scores into the final verification probability and a clear status the user sees.

```python
# probability.py

def compute_verification_result(rule_violations: list[str], similarity_results: list[dict]) -> dict:
    """
    Implements: verification_probability = 100% - max_similarity%
    Rule violations always force probability to 0 and status REJECTED,
    since these are hard legal violations, not similarity-based judgments.
    """
    if rule_violations:
        return {
            "verification_probability": 0.0,
            "status": "REJECTED",
            "reasons": rule_violations,
            "closest_match": None,
        }

    if not similarity_results:
        return {
            "verification_probability": 100.0,
            "status": "LIKELY_APPROVED",
            "reasons": [],
            "closest_match": None,
        }

    top_match = max(similarity_results, key=lambda r: r["combined_similarity"])
    probability = round((1 - top_match["combined_similarity"]) * 100, 2)

    if probability < 30:
        status = "REJECTED"
    elif probability < 60:
        status = "REVIEW"
    else:
        status = "LIKELY_APPROVED"

    return {
        "verification_probability": probability,
        "status": status,
        "reasons": [] if status != "REJECTED" else [f"Too similar to existing title '{top_match['candidate_title']}'"],
        "closest_match": top_match["candidate_title"],
        "closest_match_breakdown": top_match,
    }
```

**Logic**: The three-tier status band (REJECTED below 30%, REVIEW 30-60%, LIKELY_APPROVED above 60%) is a design choice, not a PRGI-mandated threshold — document this clearly to whoever evaluates the hackathon submission, and treat these numbers as tunable constants, not fixed law.

## Stage 9: In-Process Caching (Replaces Redis)

**Purpose**: Avoid recomputing normalization, phonetic codes, embeddings, and full candidate retrieval for identical repeat submissions within the same running process — without needing a separate Redis server, since this is a single local process.

```python
# cache.py
import time
import hashlib
import json

class TTLCache:
    """Simple in-process cache-aside implementation. Not persisted across restarts."""
    def __init__(self, ttl_seconds: int = 3600):
        self._store: dict[str, tuple[float, str]] = {}
        self.ttl_seconds = ttl_seconds

    def _make_key(self, title: str) -> str:
        return hashlib.md5(title.strip().lower().encode("utf-8")).hexdigest()

    def get(self, title: str):
        key = self._make_key(title)
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return json.loads(value)

    def set(self, title: str, value: dict):
        key = self._make_key(title)
        self._store[key] = (time.time() + self.ttl_seconds, json.dumps(value))

verification_cache = TTLCache(ttl_seconds=3600)
```

**Logic**: This is a direct behavioral substitute for the Redis cache-aside pattern — same interface (`get`/`set`, TTL-based expiry, hash-based key), but implemented as an in-memory Python dictionary since there is only one process and no need for cross-process/cross-machine cache sharing at local scale. It is explicitly **not persisted to disk** — this is acceptable for a local demo; if persistence across restarts is desired, it should be backed by a small dedicated SQLite table instead, but this is not required by the problem statement.[^13][^14]

## Stage 10: End-to-End Verification Function

**Purpose**: Ties every stage together into one callable function that a web layer (Flask/FastAPI) can wrap.

```python
# verify.py
import sqlite3
from normalize import normalize_title
from phonetics import compute_phonetic_codes
from embeddings import embed_text
from retrieval import get_candidates
from rules import run_rule_engine
from scoring import score_candidate
from probability import compute_verification_result
from cache import verification_cache

DB_PATH = "prgi_titles.db"

def verify_title(raw_title: str) -> dict:
    cached = verification_cache.get(raw_title)
    if cached is not None:
        cached["from_cache"] = True
        return cached

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = None

    new_title_data = normalize_title(raw_title)
    new_phonetic_codes = compute_phonetic_codes(new_title_data["normalized"])
    new_embedding = embed_text(new_title_data["normalized"])

    candidates = get_candidates(conn, new_title_data, new_phonetic_codes)

    rule_violations = run_rule_engine(new_title_data, candidates)

    similarity_results = []
    if not rule_violations:
        for cand in candidates:
            cand_phonetic_codes = compute_phonetic_codes(cand["title_normalized"])
            result = score_candidate(new_title_data, new_embedding, new_phonetic_codes, cand, cand_phonetic_codes)
            similarity_results.append(result)

    response = compute_verification_result(rule_violations, similarity_results)
    response["from_cache"] = False

    conn.close()
    verification_cache.set(raw_title, response)
    return response
```

**Note**: Candidate phonetic codes are recomputed at query time here rather than stored, for simplicity of this reference implementation. For better performance at 160K scale, add `metaphone_primary`/`metaphone_secondary` columns already exist in the schema (Stage 1) — the ingestion pipeline already stores them, so `retrieval.py`'s `get_candidates` should be extended to also `SELECT` `metaphone_primary, metaphone_secondary` and pass them through directly instead of recomputing. This avoids redundant computation and should be treated as the correct final version, not the simplified one shown above; the coding agent should select candidate columns to include `metaphone_primary, metaphone_secondary` and skip the recomputation line in `verify_title`.

## Stage 11: API Layer (Flask, Minimal)

```python
# app.py
from flask import Flask, request, jsonify
from verify import verify_title
from ingest import ingest_csv
import sqlite3, os

app = Flask(__name__)
DB_PATH = "prgi_titles.db"

@app.route("/setup", methods=["POST"])
def setup():
    """One-time endpoint to initialize schema and ingest a CSV. Run once, not per-request."""
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        with open("schema.sql") as f:
            conn.executescript(f.read())
        conn.close()
    csv_path = request.json.get("csv_path", "prgi_titles.csv")
    ingest_csv(csv_path)
    return jsonify({"status": "ingested"})

@app.route("/verify-title", methods=["POST"])
def verify():
    data = request.get_json()
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    result = verify_title(title)
    return jsonify(result)

@app.route("/register-pending", methods=["POST"])
def register_pending():
    """Adds a submitted title as 'pending' so it blocks future duplicate submissions."""
    from normalize import normalize_title
    from phonetics import compute_phonetic_codes
    from embeddings import embed_text, serialize_vector

    data = request.get_json()
    raw_title = data.get("title", "").strip()
    if not raw_title:
        return jsonify({"error": "title is required"}), 400

    norm = normalize_title(raw_title)
    phon = compute_phonetic_codes(norm["normalized"])
    vec = embed_text(norm["normalized"])

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO titles
        (title_raw, title_normalized, title_core, status, soundex_code, metaphone_primary, metaphone_secondary, embedding)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    """, (raw_title, norm["normalized"], norm["core"], phon["soundex"],
          phon["metaphone_primary"], phon["metaphone_secondary"], serialize_vector(vec)))
    conn.commit()
    conn.close()
    return jsonify({"status": "registered_pending"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

**Logic**: `/register-pending` implements PRGI's first-come-first-served requirement — once a title is submitted, it must immediately participate in blocking/scoring for all future submissions. Since the FTS5 trigger and phonetic-code columns are populated at insert time, no separate re-indexing step is needed; the new row is queryable immediately by `get_candidates`.[^15][^16]

## Component Correctness Checklist (For the Coding Agent)

- Normalization must be called with the exact same function (`normalize_title`) both during ingestion and during verification — never write a second, slightly different normalization function.
- `EMBEDDING_DIM` (768) must never change without re-embedding the entire `titles` table; mixing embeddings from different model versions silently corrupts cosine similarity.
- The FTS5 `titles_fts` table must never be written to directly — only through the triggers defined in the schema, which fire automatically on `INSERT`/`UPDATE`/`DELETE` to `titles`.
- Rule engine checks (Stage 5) must run and short-circuit **before** similarity scoring (Stage 7) — this saves compute for obviously invalid titles, and rule violations always cap probability to 0 regardless of similarity scores.
- `verification_probability` is defined strictly as `(1 - max_combined_similarity) * 100`, applied only when there are no rule violations. Do not average across all candidates — always use the single **closest** (highest similarity) match.
- The in-process cache (Stage 9) is keyed by the lowercased, stripped raw title string, not by normalized/core text, so that two visually different-but-normalizing-to-the-same-string queries are still both cached independently on their literal input (acceptable minor redundancy, avoids ambiguity).

## Future Scaling Path (Theory Only — Not Part of This Build)

The following are documented as forward-looking architecture notes for a future production version, not to be implemented now:

- **Postgres migration**: If the corpus grows well beyond what a single SQLite file can serve concurrently (many simultaneous writers), migrate `titles` to Postgres and replace FTS5 trigram with the `pg_trgm` extension, which offers equivalent fuzzy substring indexing at larger concurrency levels.[^2]
- **Dedicated vector index (FAISS/HNSW)**: The brute-force `cosine_similarity` SQL function scans all candidate embeddings linearly, which is fine for the few hundred rows returned by blocking, but would not scale to full-corpus semantic search without blocking. A FAISS `IndexHNSWFlat` index would replace this for a full-corpus semantic pass if blocking recall ever proves insufficient.[^17][^18]
- **Distributed caching (Redis)**: If the service is ever deployed across multiple server processes/machines (rather than one local process), the in-process `TTLCache` should be replaced with Redis so all instances share the same cache state, using the standard cache-aside pattern.[^14][^13]
- **sqlite-vec extension**: As an intermediate step before a full Postgres/FAISS migration, the `sqlite-vec` loadable extension adds native vector columns and KNN search directly inside SQLite without an external server, which could defer the need for Postgres/FAISS entirely for moderately larger datasets.[^19][^20]

These are explicitly deferred — the local build described in Stages 1-11 above is the complete, self-sufficient implementation target for this project.

---

## References

1. [SQLite as a Vector Database for Similarity Search - SQLite Forum](https://www.sqliteforum.com/p/sqlite-as-a-vector-database) - SQLite is not a vector database. However, it can store embeddings and perform similarity search reli...

2. [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html) - The trigram tokenizer, which treats each contiguous sequence of three characters as a token, allowin...

3. [SQLite Fuzzy Search - Dom](https://tdom.dev/sqlite-fuzzy-search.html)

4. [Building a Local Hybrid Search with a Single SQLite Database](https://wes5510.com/en/blog/posts/building-local-hybrid-search-with-single-sqlite/) - wes5510's dev blog

5. [Moving from Pinecone to SQLite for Static LLM Applications](https://revthat.com/optimizing-vector-storage-moving-from-pinecone-to-sqlite-for-static-llm-applications/) - Learn how to implement vector similarity search using SQLite instead of Pinecone, cutting infrastruc...

6. [An Efficient Review of Phonetics Algorithms](http://www.ijcset.com/docs/IJCSET13-04-05-046.pdf)

7. [Case Study](https://stevemorse.org/phonetics/bmpm2.htm)

8. [Multilingual Models — Sentence Transformers documentation](https://sbert.net/examples/sentence_transformer/training/multilingual/README.html) - Multilingual Semantic Textual Similarity . You can also measure the semantic textual similarity (STS...

9. [Language-Agnostic Semantic Text Similarity for “Every” ...](https://web.stanford.edu/class/archive/cs/cs224n/cs224n.1224/reports/custom_116626702.pdf)

10. [Guidelines for Admissibility of Titles | Press Registrar General of India](https://prgi.gov.in/policy/guidelines-admissibility-titles) - These Guidelines are implemented with effect from 01.07.2025. This supersedes the earlier guidelines...

11. [File No. 02/TVG/2024-TC](https://prgi.gov.in/sites/default/files/2024-11/notice_new_title_guidelines_1.pdf)

12. [Entity Resolution at Scale, Part 3: Blocking — Making Billion-Record ...](https://www.zingg.ai/post/entity-resolution-at-scale-part-3-blocking) - Comparing every record pair is computationally impossible at scale. Learn how blocking strategies re...

13. [Redis Caching Strategies Every Backend Developer Needs](https://www.techmarcos.com/redis-caching-strategies-production/) - Cache-Aside is your default strategy for read-heavy APIs. Simple, resilient, and widely supported. W...

14. [Redis cache-aside | Docs](https://redis.io/docs/latest/develop/use-cases/cache-aside/) - Cache database reads in Redis with TTL-bounded staleness.

15. [GUIDELINES FOR TITLE VERIFICATION | Press Registrar General ...](https://prgi.gov.in/node/368) - The publisher can directly file declaration and then submit required documents to PRGI for issuance ...

16. [Guidelines for Registration | Press Registrar General of India](https://prgi.gov.in/policy/archive-guidelines-for-registration) - Before applying for Title verification, the applicant may check the exhaustive list of verified Titl...

17. [Vector Search with FAISS: Approximate Nearest Neighbor (ANN ...](https://pyimagesearch.com/2026/02/16/vector-search-with-faiss-approximate-nearest-neighbor-ann-explained/) - Every FAISS index is a data structure that helps you locate nearest neighbors efficiently in a large...

18. [Welcome to Faiss Documentation — Faiss documentation](https://faiss.ai/index.html) - Faiss is a library for efficient similarity search and clustering of dense vectors. It contains algo...

19. [sqlite-vec skill by existential-birds/beagle - playbooks](https://playbooks.com/skills/existential-birds/beagle/sqlite-vec) - sqlite-vec extension for vector similarity search in SQLite. Use when storing embeddings, performing...

20. [SQLite-Vector - Fast vector search for embedded SQLite](https://www.sqlite.ai/sqlite-vector) - SQLite-Vector adds cross-platform vector search to SQLite, with ordinary tables, quantization, SIMD ...

