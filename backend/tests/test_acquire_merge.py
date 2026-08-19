import csv
import os
import sys

from openpyxl import Workbook

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.csv_mapping import CANONICAL_COLUMNS
from tools.acquire_prgi_dataset import merge


def _csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)


def _xlsx(path, rows):
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    wb.save(path)


def test_merge_csv_and_xlsx_dedup(tmp_path):
    indir = os.path.join(str(tmp_path), "raw")
    os.makedirs(indir)
    header = ["Title", "Registration Number", "Language", "State", "Periodicity"]
    _csv(os.path.join(indir, "a_page.csv"), [
        header,
        ["Merged One", "201", "English", "Delhi", "Weekly"],
    ])
    _xlsx(os.path.join(indir, "b_page.xlsx"), [
        header,
        ["Merged One", "201", "English", "Delhi", "Weekly"],  # dup reg -> dropped
        ["Merged Two", "202", "", "", ""],
    ])

    out = os.path.join(str(tmp_path), "out.csv")
    report = merge(indir, out)

    assert report["raw_rows"] == 3
    assert report["accepted_rows"] == 2
    assert report["duplicate_rows"] == 1
    assert report["output_rows"] == 2

    with open(out, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == CANONICAL_COLUMNS
        rows = list(reader)
    assert {r["title"] for r in rows} == {"Merged One", "Merged Two"}
    assert {r["registration_number"] for r in rows} == {"201", "202"}


def test_merge_dedup_by_composite_not_title_alone(tmp_path):
    # Same title text but different state -> NOT a duplicate (title alone never dedupes)
    indir = os.path.join(str(tmp_path), "raw2")
    os.makedirs(indir)
    header = ["Title", "Registration Number", "Language", "State", "Periodicity"]
    _csv(os.path.join(indir, "p.csv"), [
        header,
        ["Same Name", "", "English", "Delhi", "Daily"],
        ["Same Name", "", "English", "Mumbai", "Daily"],  # different state -> keep
    ])
    out = os.path.join(str(tmp_path), "out2.csv")
    report = merge(indir, out)
    assert report["accepted_rows"] == 2
    assert report["duplicate_rows"] == 0