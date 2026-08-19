"""Central policy constants for the PRGI title-verification system.

Everything tunable lives here so a policy change never touches algorithm code.
Edit values here; never re-declare them in another module.
"""

# --- Paths / storage ------------------------------------------------------
DB_PATH = "prgi_titles.db"
DATA_DIR = "data"
CANONICAL_CSV_PATH = "data/prgi_titles.csv"
DEMO_CSV_PATH = "data/demo_prgi_titles.csv"
RAW_EXPORTS_DIR = "data/raw_prgi_exports"
REPORTS_DIR = "data/reports"

# --- Embedding model ------------------------------------------------------
# EMBEDDING_DIM is fixed for the project lifetime. Changing the model
# requires re-embedding the entire `titles` table (never mix old/new vectors).
EMBEDDING_MODEL = "sentence-transformers/LaBSE"
EMBEDDING_DIM = 768

# --- Policy word lists -----------------------------------------------------
# Disallowed words force an automatic REJECT (hard legal/policy rule).
DISALLOWED_WORDS = {
    "police", "crime", "corruption", "cbi", "cid", "army",
    "cognizable", "intelligence", "raw", "terrorist", "encounter",
    # TODO: extend from PRGI's full published banned-word list before production.
}

# Periodicity words used only by the periodicity-addition rule. They are
# deliberately NOT part of PREFIX_SUFFIX_STOPWORDS so the rule can detect them.
PERIODICITY_WORDS = {
    "daily", "weekly", "monthly", "fortnightly", "annual",
    "bimonthly", "quarterly", "biweekly",
}

# Generic prefix/suffix words stripped from `title_core`. Keep generic words
# only (periodicity words belong in PERIODICITY_WORDS, not here).
PREFIX_SUFFIX_STOPWORDS = {
    "the", "india", "indian", "samachar", "news", "times",
    "bharat", "desh", "patrika", "sandesh", "bulletin",
}

# --- Input quality / generic-title policy (adversarial fix Part 2) ----------
# A title shorter than this many alphanumeric characters is not a meaningful
# verification query -> INVALID_INPUT (not LIKELY_APPROVED).
MIN_TITLE_ALNUM_CHARS = 3

# Words that carry no distinctive identity; a title composed only of these is
# not confidently matchable -> REVIEW with an explainable reason.
GENERIC_TITLE_TOKENS = {
    "the", "india", "indian", "news", "samachar", "times",
    "daily", "weekly", "monthly", "patrika", "darpan", "bulletin",
    "express", "journal", "magazine",
}

# --- Semantic fallback retrieval (adversarial fix Part 5) --------------------
# Conditional linear semantic scan, only when lexical/phonetic blocking finds
# too few candidates. Provisional experiment settings, not PRGI policy.
ENABLE_SEMANTIC_FALLBACK = True
SEMANTIC_FALLBACK_TOP_K = 20
SEMANTIC_FALLBACK_MIN_SCORE = 0.72   # initial test value; calibrate on labelled data
SEMANTIC_FALLBACK_TRIGGER_WHEN_CANDIDATES_LESS_THAN = 1

# --- Similarity weight mix (must stay constant so scores are comparable) ---
EDIT_WEIGHT = 0.35
PHONETIC_WEIGHT = 0.25
SEMANTIC_WEIGHT = 0.40
# Sub-weights inside the edit score (Jaro-Winkler vs normalized Levenshtein).
JW_WEIGHT = 0.60
LEV_WEIGHT = 0.40

# --- Retrieval / cache -----------------------------------------------------
CANDIDATE_LIMIT = 300
# Titles shorter than this rely on the short-title fallback in retrieval
# (FTS5 trigram substring matching is weak on very short strings).
SHORT_TITLE_LEN = 4
CACHE_TTL_SECONDS = 3600

# --- Status thresholds (named so tests can assert exact boundaries) --------
# verification_probability < REJECT_THRESHOLD -> REJECTED
# REJECT_THRESHOLD <= p < REVIEW_THRESHOLD -> REVIEW
# REVIEW_THRESHOLD <= p -> LIKELY_APPROVED
REJECT_THRESHOLD = 30.0
REVIEW_THRESHOLD = 60.0

# --- Reporting / messaging -------------------------------------------------
DISCLAIMER = (
    "This is an automated preliminary assessment, not official PRGI "
    "title verification."
)