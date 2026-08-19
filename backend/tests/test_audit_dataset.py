import csv
import json
import os

from src.audit_dataset import audit_csv, save_report


def _write_fixture(path):
    rows = [
        ["Title", "Registration Number", "Language", "State", "Periodicity"],
        ["Alpha One", "111", "English", "Delhi", "Daily"],
        ["Alpha One", "111", "English", "Delhi", "Daily"],
        ["Beta", "222", "English", "Mumbai", "Weekly"],
        ["", "333", "", "", ""],
        ["Gamma", "444", "Hindi", "UP", "Monthly"],
        ["Gamma", "555", "Hindi", "UP", "Monthly"],
        ["अखबार", "666", "Hindi", "UP", "Monthly"],
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f).writerows(rows)


def test_audit_counts(tmp_path):
    p = os.path.join(str(tmp_path), "audit.csv")
    _write_fixture(p)
    r = audit_csv(p)

    assert r["raw_row_count"] == 7
    assert r["valid_title_count"] == 6
    assert r["empty_title_count"] == 1
    assert r["duplicate_registration_number_count"] == 1   # 111 repeats
    assert r["duplicate_composite_key_count"] == 2         # alpha... + gamma...
    assert r["encoding"] == "utf-8-sig"
    assert len(r["sha256"]) == 64
    assert r["column_mapping"]["title"] == "Title"
    assert r["unicode_detection"]["rows_with_indic_script"] == 1


def test_audit_report_json_roundtrip(tmp_path):
    p = os.path.join(str(tmp_path), "audit.csv")
    _write_fixture(p)
    r = audit_csv(p)
    out = save_report(r, os.path.join(str(tmp_path), "report.json"))
    with open(out, encoding="utf-8") as f:
        data = json.load(f)
    assert data["raw_row_count"] == 7
    assert set(data) >= {
        "input_path", "sha256", "size_bytes", "encoding", "original_headers",
        "column_mapping", "raw_row_count", "valid_title_count", "empty_title_count",
        "duplicate_registration_number_count", "duplicate_composite_key_count",
        "missing_value_counts", "title_length_summary", "language_distribution",
        "state_distribution", "periodicity_distribution", "unicode_detection",
        "samples", "warnings",
    }