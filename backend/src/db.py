"""SQLite connection + initialization helpers (shared by all modules)."""

import os
import sqlite3

from . import config

SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql")


def get_connection(db_path: str = None) -> sqlite3.Connection:
    """Open a connection with WAL mode and row access by column name."""
    conn = sqlite3.connect(db_path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: str = None) -> None:
    """Create the schema (tables, indexes, FTS5, triggers) if not present."""
    conn = get_connection(db_path)
    try:
        conn.executescript(read_schema())
        conn.commit()
    finally:
        conn.close()


def connect(db_path: str = None) -> sqlite3.Connection:
    """Open a connection and ensure the schema exists (idempotent)."""
    conn = get_connection(db_path)
    has_titles = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='titles'"
    ).fetchone()
    if not has_titles:
        conn.executescript(read_schema())
        conn.commit()
    return conn


def read_schema() -> str:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return f.read()