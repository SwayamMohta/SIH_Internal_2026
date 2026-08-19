"""Deterministic hard-fail policy rules (no ML, no LLM).

Hard rules (disallowed words, periodicity addition, title combination) run
against the corpus via exact token-set lookups (`rule_retrieval.py`) so they
never depend on fuzzy Soundex/Metaphone/FTS5 retrieval succeeding.
"""

import re

from .config import (DISALLOWED_WORDS, GENERIC_TITLE_TOKENS,
                     MIN_TITLE_ALNUM_CHARS, PERIODICITY_WORDS)
from .rule_retrieval import (find_exact_base_title_after_removing_periodicity,
                             find_titles_whose_tokens_are_subset_of_query)


def check_disallowed_words(tokens: set) -> str | None:
    hit = tokens & DISALLOWED_WORDS
    if hit:
        return f"Title contains disallowed word(s): {', '.join(sorted(hit))}"
    return None


def check_input_quality(new_title_data: dict) -> str | None:
    """Reject meaningless queries and generic-only titles.

    Returns a violation string, or None if the title is a meaningful query.
    The caller maps length failures to INVALID_INPUT and generic-only failures
    to REVIEW (never an unjustified approval).
    """
    normalized = new_title_data["normalized"]
    alnum_count = len(re.sub(r"[^a-z0-9]", "", normalized))
    if alnum_count < MIN_TITLE_ALNUM_CHARS:
        return "Title must contain at least 3 alphanumeric characters"

    tokens = set(normalized.split())
    if tokens and tokens.issubset(GENERIC_TITLE_TOKENS):
        return (
            "Title contains only generic terms and requires manual review; "
            "add a distinctive word"
        )
    return None


def check_periodicity_addition_from_corpus(conn, new_normalized: str) -> str | None:
    matches = find_exact_base_title_after_removing_periodicity(
        conn,
        new_normalized,
        PERIODICITY_WORDS,
    )
    if not matches:
        return None

    # One exact base match is sufficient for a hard violation.
    match = matches[0]
    return (
        "Title formed by adding periodicity to existing title "
        f"'{match['title_raw']}'"
    )


def check_title_combination_from_corpus(conn, new_normalized: str) -> str | None:
    query_tokens = set(new_normalized.split())
    matches = find_titles_whose_tokens_are_subset_of_query(conn, new_normalized)

    # Candidate title must contribute at least one token. Do not count a title
    # identical to the full query as a two-title combination.
    selected: list[dict] = []
    covered: set[str] = set()

    # Prefer multi-token source titles first; then select titles that add new
    # token coverage. Sorting makes output deterministic.
    matches.sort(
        key=lambda row: (-len(set(row["title_normalized"].split())), row["title_normalized"])
    )

    for match in matches:
        tokens = set(match["title_normalized"].split())
        if tokens == query_tokens:
            continue
        if not (tokens - covered):
            continue
        selected.append(match)
        covered |= tokens
        if len(selected) >= 2 and covered == query_tokens:
            return (
                "Title appears to combine existing titles: "
                + ", ".join(f"'{row['title_raw']}'" for row in selected)
            )

    return None


def run_rule_engine(conn, new_title_data: dict) -> list[str]:
    """Run hard rules before candidate retrieval and embedding."""
    violations: list[str] = []

    disallowed = check_disallowed_words(new_title_data["tokens"])
    if disallowed:
        violations.append(disallowed)

    periodicity = check_periodicity_addition_from_corpus(
        conn,
        new_title_data["normalized"],
    )
    if periodicity:
        violations.append(periodicity)

    combination = check_title_combination_from_corpus(
        conn,
        new_title_data["normalized"],
    )
    if combination:
        violations.append(combination)

    return violations
