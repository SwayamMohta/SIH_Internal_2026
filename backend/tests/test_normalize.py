from src.normalize import normalize_title


def test_basic_normalization():
    r = normalize_title("  The   Indian  Express!  ")
    assert r["raw"] == "  The   Indian  Express!  "
    assert r["normalized"] == "the indian express"
    # "the" and "indian" are stopwords stripped from core
    assert r["core"] == "express"
    assert r["tokens"] == {"the", "indian", "express"}


def test_lowercase():
    assert normalize_title("HELLO World")["normalized"] == "hello world"


def test_punctuation_removed():
    assert normalize_title("A & S India")["normalized"] == "a s india"
    assert normalize_title("What's New")["normalized"] == "whats new"


def test_whitespace_collapsed():
    r = normalize_title("a\t b\n  c   d")
    assert r["normalized"] == "a b c d"


def test_nfkc_compat_normalization():
    # Fullwidth Latin letters normalize to ASCII under NFKC.
    assert normalize_title("ＡＢＣ")["normalized"] == "abc"


def test_digits_preserved():
    assert normalize_title("A D I T I 2")["normalized"] == "a d i t i 2"


def test_empty_title():
    r = normalize_title("")
    assert r["normalized"] == ""
    assert r["core"] == ""
    assert r["tokens"] == set()


def test_punctuation_only():
    r = normalize_title("!!! *** ???")
    assert r["normalized"] == ""
    assert r["core"] == ""


def test_stopword_only_title_falls_back_to_normalized():
    # If every token is a stopword, core falls back to the full normalized text.
    r = normalize_title("the news")
    assert r["core"] == "the news"


def test_periodicity_word_not_stripped_from_core():
    # "daily" is a PERIODICITY_WORD, not a PREFIX_SUFFIX_STOPWORD, so it must
    # survive into core (generic words like "samachar"/"patrika" are stripped).
    r = normalize_title("daily evening")
    assert r["core"] == "daily evening"


def test_generic_stopwords_stripped_from_core():
    # "samachar" and "patrika" are generic stopwords; only "daily" survives.
    assert normalize_title("daily samachar patrika")["core"] == "daily"