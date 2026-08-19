import os

import numpy as np
import pytest

from app import app
from src import config, db, pending, verify
from src.cache import verification_cache
from src.embeddings import serialize_vector
from src.phonetics import compute_phonetic_codes


def _unit(dim=768):
    v = np.ones(dim, dtype=np.float32)
    return v / np.linalg.norm(v)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", os.path.join(str(tmp_path), "api.db"))
    db.init_db()

    U = _unit()
    phon = compute_phonetic_codes("panorama samachar")
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO titles (title_raw, title_normalized, title_core, status,"
        " soundex_code, metaphone_primary, metaphone_secondary, embedding)"
        " VALUES (?, ?, ?, 'registered', ?, ?, ?, ?)",
        ("Panorama Samachar", "panorama samachar", "panorama samachar",
         phon["soundex"], phon["metaphone_primary"], phon["metaphone_secondary"],
         serialize_vector(U)),
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(verify, "embed_text", lambda t: U)
    monkeypatch.setattr(pending, "embed_text", lambda t: U)
    # Mock embeddings all-score 1.0, so the semantic fallback would fabricate
    # matches against the seeded title; disable it for deterministic API tests.
    monkeypatch.setattr(verify, "ENABLE_SEMANTIC_FALLBACK", False)
    verification_cache.invalidate_all()

    app.config["TESTING"] = True
    return app.test_client()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.get_json()
    assert body["database_ready"] is True
    assert body["total_titles"] == 1
    assert body["registered_titles"] == 1
    assert body["pending_titles"] == 0
    assert isinstance(body["embedding_dim"], int)
    # no sensitive paths / tracebacks
    assert "Traceback" not in r.get_data(as_text=True)


def test_verify_success_shape(client):
    r = client.post("/verify-title", json={"title": "Panorama Samachar"})
    assert r.status_code == 200
    b = r.get_json()
    assert b["status"] == "REJECTED"
    assert b["verification_probability"] == 0.0
    assert b["closest_match"] == "Panorama Samachar"
    assert b["closest_match_status"] == "registered"
    assert b["closest_match_breakdown"]["candidate_id"] is not None
    assert "edit_similarity" in b["closest_match_breakdown"]
    assert b["top_conflicts"] == ["Panorama Samachar"]
    assert b["from_cache"] is False
    assert "preliminary assessment" in b["disclaimer"]


def test_verify_missing_title(client):
    r = client.post("/verify-title", json={"title": ""})
    assert r.status_code == 400
    assert r.get_json() == {"error": "title is required"}


def test_verify_no_json_body(client):
    r = client.post("/verify-title", data="not json", content_type="text/plain")
    assert r.status_code == 400


def test_register_pending_rejects_disallowed(client):
    r = client.post("/register-pending", json={"title": "police daily"})
    assert r.status_code == 400
    b = r.get_json()
    assert b["status"] == "REJECTED"
    assert any("police" in reason for reason in b["reasons"])


def test_register_pending_success(client):
    r = client.post("/register-pending", json={
        "title": "Unique Weekly Constellation",
        "language": "English", "state": "Telangana", "periodicity": "Weekly",
    })
    assert r.status_code == 200
    b = r.get_json()
    assert b["status"] == "pending"
    assert b["id"] is not None
    assert b["title_normalized"] == "unique weekly constellation"


def test_error_is_json_not_traceback(client):
    r = client.post("/verify-title", json={"title": ""})
    assert r.is_json
    assert "Traceback" not in r.get_data(as_text=True)