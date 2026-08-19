from src.phonetics import compute_phonetic_codes


def test_soundex_known_value():
    assert compute_phonetic_codes("Namaskar")["soundex"] == "N526"


def test_double_metaphone_known_value():
    r = compute_phonetic_codes("Namaskar")
    # metaphone lib returns primary 'NMSKR' and empty secondary.
    assert r["metaphone_primary"] == "NMSKR"
    assert r["metaphone_secondary"] == r["metaphone_primary"]


def test_secondary_falls_back_to_primary_when_empty():
    r = compute_phonetic_codes("Namaskar")
    assert r["metaphone_secondary"] == r["metaphone_primary"] != ""


def test_empty_string():
    r = compute_phonetic_codes("")
    assert r["soundex"] == ""
    assert r["metaphone_primary"] == ""
    assert r["metaphone_secondary"] == ""


def test_deterministic():
    a = compute_phonetic_codes("samachar patrika")
    b = compute_phonetic_codes("samachar patrika")
    assert a == b


def test_token_metaphones_populated():
    r = compute_phonetic_codes("namaskar darpan")
    assert set(r["token_metaphones"]) == {"namaskar", "darpan"}
    assert r["token_metaphones"]["namaskar"]  # non-empty code list per token


def test_empty_string_token_metaphones():
    r = compute_phonetic_codes("")
    assert r["token_metaphones"] == {}