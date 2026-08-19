import time

from src.cache import TTLCache


def test_miss_returns_none():
    c = TTLCache()
    assert c.get("nothing here") is None


def test_set_get_roundtrip():
    c = TTLCache()
    c.set("Some Title", {"status": "REVIEW", "verification_probability": 42.0})
    assert c.get("Some Title") == {"status": "REVIEW", "verification_probability": 42.0}


def test_key_is_case_and_whitespace_insensitive():
    c = TTLCache()
    c.set("  The Daily  ", {"k": 1})
    assert c.get("the daily") == {"k": 1}
    assert c.get("THE DAILY") == {"k": 1}


def test_expiry(monkeypatch):
    fake_clock = {"now": 0.0}
    monkeypatch.setattr(time, "time", lambda: fake_clock["now"])
    c = TTLCache(ttl_seconds=10)
    c.set("x", {"k": 1})
    assert c.get("x") == {"k": 1}
    fake_clock["now"] = 10.0001  # past TTL
    assert c.get("x") is None


def test_stale_entry_removed(monkeypatch):
    fake_clock = {"now": 0.0}
    monkeypatch.setattr(time, "time", lambda: fake_clock["now"])
    c = TTLCache(ttl_seconds=10)
    c.set("x", {"k": 1})
    fake_clock["now"] = 11.0
    c.get("x")
    assert len(c) == 0


def test_invalidate_all():
    c = TTLCache()
    c.set("a", {"k": 1})
    c.set("b", {"k": 2})
    c.invalidate_all()
    assert c.get("a") is None
    assert c.get("b") is None