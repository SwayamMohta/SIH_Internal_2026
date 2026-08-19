import os

import numpy as np
import pytest

from src import db, pending, verify
from src.cache import verification_cache


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


@pytest.fixture()
def env(tmp_path, monkeypatch):
    path = os.path.join(str(tmp_path), "pending.db")
    db.init_db(path)
    U = _unit()
    monkeypatch.setattr(verify, "embed_text", lambda text: U)
    monkeypatch.setattr(pending, "embed_text", lambda text: U)
    verification_cache.invalidate_all()
    yield path


def test_register_pending_success(env):
    r = pending.register_pending("Unique Future Weekly", "English", "Telangana", "Weekly", env)
    assert r["registered"] is True
    assert r["status"] == "pending"
    assert r["id"] is not None
    assert r["title_normalized"] == "unique future weekly"
    assert r["verification"]["status"] == "LIKELY_APPROVED"


def test_pending_blocks_later_similar(env):
    pending.register_pending("Future Daily Chronicle", db_path=env)
    # The same title now collides with its own pending record.
    r = verify.verify_title("Future Daily Chronicle", env)
    assert r["status"] == "REJECTED"
    assert r["closest_match_status"] == "pending"


def test_register_pending_rejects_rejected_title(env):
    r = pending.register_pending("police daily", db_path=env)
    assert r["registered"] is False
    assert r["status"] == "REJECTED"
    assert any("police" in reason for reason in r["reasons"])


def test_register_pending_invalidates_cache(env):
    verify.verify_title("Cache Warmer", env)
    assert len(verification_cache) >= 1
    pending.register_pending("Another Unique Weekly", db_path=env)
    assert len(verification_cache) == 0


def test_blank_title_raises(env):
    with pytest.raises(ValueError):
        pending.register_pending("  ", db_path=env)