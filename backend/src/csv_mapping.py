"""CSV column mapping + reading (shared by audit, merge, and ingest)."""

import csv

CANONICAL_COLUMNS = [
    "title", "registration_number", "registration_date", "language",
    "periodicity", "publisher", "owner", "state", "district", "status",
]

# canonical column -> set of recognized header aliases (lowercased, stripped)
ALIASES = {
    "title": {"title", "title_name", "publication title"},
    "registration_number": {"registration number", "rni no", "registration_no"},
    "registration_date": {"registration date", "date_of_registration"},
    "language": {"language", "language_name"},
    "periodicity": {"periodicity", "frequency"},
    "publisher": {"publisher"},
    "owner": {"owner"},
    "state": {"publication state", "state"},
    "district": {"publication district", "district"},
}


def map_headers(headers) -> dict:
    """Map raw headers -> {canonical: original_header}. Unknown headers ignored."""
    mapping = {}
    for h in headers:
        nh = (h or "").strip().lower()
        for canon, aliases in ALIASES.items():
            if nh in aliases and canon not in mapping:
                mapping[canon] = h
                break
    return mapping


def get_value(row, mapping, canonical, default="") -> str:
    """Read a row value by canonical name ('' if the column is absent/empty)."""
    h = mapping.get(canonical)
    if h is None:
        return default
    return (row.get(h) or default).strip()


def read_csv_rows(path, encoding=None):
    """Return (headers, rows, used_encoding). Rows are dicts keyed by raw header.

    Tries utf-8-sig (handles BOM and plain UTF-8), then utf-8, then latin-1.
    """
    encodings = [encoding] if encoding else ["utf-8-sig", "utf-8", "latin-1"]
    last_err = None
    for enc in encodings:
        try:
            with open(path, newline="", encoding=enc) as f:
                reader = csv.DictReader(f)
                headers = list(reader.fieldnames or [])
                rows = [dict(row) for row in reader]
            return headers, rows, enc
        except UnicodeDecodeError as exc:
            last_err = exc
    raise ValueError(f"could not decode {path}: {last_err}")