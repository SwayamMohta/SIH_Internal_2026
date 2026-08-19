"""Dataset audit — read-only, never modifies the database."""

import argparse
import hashlib
import json
import os
import sys
import time
from collections import Counter

from . import config
from .csv_mapping import CANONICAL_COLUMNS, get_value, map_headers, read_csv_rows
from .normalize import normalize_title


def _is_indic(ch: str) -> bool:
    o = ord(ch)
    return (0x0900 <= o <= 0x0DFF) or (0x0E00 <= o <= 0x0E7F) or (0x1CD0 <= o <= 0x1DFF)


def _median(values):
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


def audit_csv(csv_path: str) -> dict:
    size = os.path.getsize(csv_path)
    with open(csv_path, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()

    headers, rows, encoding = read_csv_rows(csv_path)
    mapping = map_headers(headers)

    raw_count = len(rows)
    valid = empty = 0
    reg_counter = Counter()
    comp_counter = Counter()
    missing = {c: 0 for c in CANONICAL_COLUMNS}
    lengths = []
    lang_c, state_c, per_c = Counter(), Counter(), Counter()
    nonascii = indic = 0
    samples = []
    warnings = []

    if "title" not in mapping:
        warnings.append("No 'title' column found — audit is degraded.")

    for row in rows:
        # missing-value counts across every canonical column (over all rows)
        for c in CANONICAL_COLUMNS:
            if not get_value(row, mapping, c):
                missing[c] += 1

        raw_title = get_value(row, mapping, "title")
        if not raw_title:
            empty += 1
            continue
        valid += 1

        norm = normalize_title(raw_title)["normalized"]
        lengths.append(len(norm))

        reg = get_value(row, mapping, "registration_number")
        if reg:
            reg_counter[reg] += 1

        language = get_value(row, mapping, "language")
        state = get_value(row, mapping, "state")
        periodicity = get_value(row, mapping, "periodicity")
        comp_counter[f"{norm}|{language}|{state}|{periodicity}"] += 1

        if language:
            lang_c[language] += 1
        if state:
            state_c[state] += 1
        if periodicity:
            per_c[periodicity] += 1

        has_nonascii = any(ord(ch) > 127 for ch in raw_title)
        if has_nonascii:
            nonascii += 1
            if any(_is_indic(ch) for ch in raw_title):
                indic += 1

        if len(samples) < 5:
            samples.append(raw_title)

    duplicate_reg = sum(1 for c in reg_counter.values() if c > 1)
    duplicate_comp = sum(1 for c in comp_counter.values() if c > 1)

    if empty:
        warnings.append(f"{empty} row(s) have an empty title.")
    if duplicate_reg:
        warnings.append(f"{duplicate_reg} registration number(s) are duplicated.")
    if duplicate_comp:
        warnings.append(f"{duplicate_comp} normalized composite key(s) are duplicated.")
    if encoding != "utf-8-sig" and encoding != "utf-8":
        warnings.append(f"Decoded with fallback encoding '{encoding}'.")
    if indic == 0 and nonascii == 0:
        warnings.append("No non-ASCII titles detected (Latin-script-only corpus).")

    report = {
        "input_path": os.path.abspath(csv_path),
        "sha256": sha,
        "size_bytes": size,
        "encoding": encoding,
        "original_headers": headers,
        "column_mapping": mapping,
        "raw_row_count": raw_count,
        "valid_title_count": valid,
        "empty_title_count": empty,
        "duplicate_registration_number_count": duplicate_reg,
        "duplicate_composite_key_count": duplicate_comp,
        "missing_value_counts": missing,
        "title_length_summary": {
            "min": min(lengths) if lengths else None,
            "max": max(lengths) if lengths else None,
            "mean": (sum(lengths) / len(lengths)) if lengths else None,
            "median": _median(lengths),
        },
        "language_distribution": dict(lang_c.most_common()),
        "state_distribution": dict(state_c.most_common()),
        "periodicity_distribution": dict(per_c.most_common()),
        "unicode_detection": {
            "rows_with_non_ascii": nonascii,
            "rows_with_indic_script": indic,
        },
        "samples": samples,
        "warnings": warnings,
    }
    return report


def save_report(report: dict, path: str) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description="Audit a PRGI titles CSV (no DB writes).")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--report", default=None, help="override report path (for tests)")
    args = ap.parse_args(argv)

    if not os.path.exists(args.csv):
        print(f"error: csv not found: {args.csv}", file=sys.stderr)
        return 1

    report = audit_csv(args.csv)
    if args.report:
        out = args.report
    else:
        base = os.path.splitext(os.path.basename(args.csv))[0]
        out = os.path.join(config.REPORTS_DIR, f"audit_{base}_{time.strftime('%Y%m%d_%H%M%S')}.json")
    save_report(report, out)

    print(f"Input:           {args.csv}")
    print(f"SHA-256:         {report['sha256']}")
    print(f"Encoding:        {report['encoding']}  size={report['size_bytes']} bytes")
    print(f"Raw rows:        {report['raw_row_count']}")
    print(f"Valid titles:    {report['valid_title_count']}  (empty: {report['empty_title_count']})")
    print(f"Dup reg numbers: {report['duplicate_registration_number_count']}  "
          f"Dup composites: {report['duplicate_composite_key_count']}")
    print(f"Languages:       {len(report['language_distribution'])}  "
          f"States: {len(report['state_distribution'])}  "
          f"Periodicities: {len(report['periodicity_distribution'])}")
    print(f"Report:          {out}")
    for w in report["warnings"]:
        print(f"  warning: {w}")
    return 0


if __name__ == "__main__":
    sys.exit(main())