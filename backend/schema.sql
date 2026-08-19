PRAGMA journal_mode = WAL;

-- Single source of truth for title storage. `title_raw` preserves the exact
-- submitted text for user feedback; `title_normalized`/`title_core` are
-- pre-computed once at insert time so downstream comparison is cheap.
CREATE TABLE IF NOT EXISTS titles (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    title_raw          TEXT NOT NULL,
    title_normalized   TEXT NOT NULL,
    title_core         TEXT NOT NULL,
    registration_number TEXT,
    registration_date  TEXT,
    language           TEXT,
    state              TEXT,
    periodicity        TEXT,
    publisher          TEXT,
    owner              TEXT,
    district           TEXT,
    status             TEXT NOT NULL CHECK (status IN ('registered','pending','rejected')),
    soundex_code       TEXT,
    metaphone_primary  TEXT,
    metaphone_secondary TEXT,
    embedding          BLOB,
    created_at         TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_titles_soundex     ON titles(soundex_code);
CREATE INDEX IF NOT EXISTS idx_titles_metaphone_p ON titles(metaphone_primary);
CREATE INDEX IF NOT EXISTS idx_titles_metaphone_s ON titles(metaphone_secondary);
CREATE INDEX IF NOT EXISTS idx_titles_state_lang  ON titles(state, language);
CREATE INDEX IF NOT EXISTS idx_titles_status      ON titles(status);
CREATE INDEX IF NOT EXISTS idx_titles_reg_number  ON titles(registration_number);

-- External-content FTS5 trigram table: fuzzy substring matching (replaces
-- pg_trgm). Never write to it directly — only via the triggers below.
CREATE VIRTUAL TABLE IF NOT EXISTS titles_fts USING fts5(
    title_normalized,
    content='titles',
    content_rowid='id',
    tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS titles_ai AFTER INSERT ON titles BEGIN
    INSERT INTO titles_fts(rowid, title_normalized) VALUES (new.id, new.title_normalized);
END;

CREATE TRIGGER IF NOT EXISTS titles_ad AFTER DELETE ON titles BEGIN
    INSERT INTO titles_fts(titles_fts, rowid, title_normalized) VALUES ('delete', old.id, old.title_normalized);
END;

CREATE TRIGGER IF NOT EXISTS titles_au AFTER UPDATE ON titles BEGIN
    INSERT INTO titles_fts(titles_fts, rowid, title_normalized) VALUES ('delete', old.id, old.title_normalized);
    INSERT INTO titles_fts(rowid, title_normalized) VALUES (new.id, new.title_normalized);
END;