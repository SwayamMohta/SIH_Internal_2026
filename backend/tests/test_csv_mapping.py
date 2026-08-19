import os

from src.csv_mapping import ALIASES, CANONICAL_COLUMNS, get_value, map_headers, read_csv_rows


def test_map_headers_case_and_whitespace_insensitive():
    m = map_headers(["Title", "  Registration Number ", "SN."])
    assert m["title"] == "Title"
    assert m["registration_number"] == "  Registration Number "
    assert "sn" not in m  # unknown ignored, don't invent a canonical name


def test_map_headers_aliases():
    m = map_headers(["RNI No", "Publication State", "Publication District"])
    assert m["registration_number"] == "RNI No"
    assert m["state"] == "Publication State"
    assert m["district"] == "Publication District"


def test_canonical_columns_order():
    assert CANONICAL_COLUMNS[0] == "title"
    assert CANONICAL_COLUMNS[-1] == "status"


def test_get_value_missing_canonical():
    m = map_headers(["Title"])
    row = {"Title": "  Hello  "}
    assert get_value(row, m, "title") == "Hello"
    assert get_value(row, m, "state") == ""


def test_read_csv_rows_with_bom(tmp_path):
    p = os.path.join(str(tmp_path), "bom.csv")
    with open(p, "w", newline="", encoding="utf-8-sig") as f:
        f.write("Title,Registration Number\nA,1\nB,2\n")
    headers, rows, enc = read_csv_rows(p)
    assert enc == "utf-8-sig"
    assert headers == ["Title", "Registration Number"]
    assert rows[0]["Title"] == "A"