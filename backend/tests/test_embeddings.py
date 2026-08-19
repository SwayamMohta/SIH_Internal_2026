import os

import numpy as np
import pytest

from src import embeddings
from src.config import EMBEDDING_DIM


def test_serialize_deserialize_roundtrip():
    v = np.arange(768, dtype=np.float32) / 1000.0
    assert np.allclose(embeddings.deserialize_vector(embeddings.serialize_vector(v)), v)


def test_deserialize_empty():
    assert embeddings.deserialize_vector(b"").size == 0


def test_serialize_dtype_float32():
    v = np.array([1.5, 2.5], dtype=np.float64)
    blob = embeddings.serialize_vector(v)
    back = embeddings.deserialize_vector(blob)
    assert back.dtype == np.float32
    assert list(back) == [1.5, 2.5]


def test_cosine_identity():
    v = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert round(embeddings.cosine_similarity(v, v), 6) == 1.0


def test_cosine_orthogonal():
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([0.0, 1.0], dtype=np.float32)
    assert round(embeddings.cosine_similarity(a, b), 6) == 0.0


def test_embed_text_uses_model_and_checks_dim(monkeypatch):
    class FakeModel:
        def encode(self, text, normalize_embeddings):
            assert normalize_embeddings is True
            return np.ones(EMBEDDING_DIM, dtype=np.float32)

    monkeypatch.setattr(embeddings, "_model", FakeModel())
    out = embeddings.embed_text("hello")
    assert out.shape == (EMBEDDING_DIM,)
    assert out.dtype == np.float32


def test_embed_text_dim_mismatch_raises(monkeypatch):
    class FakeModel:
        def encode(self, text, normalize_embeddings):
            return np.ones(3, dtype=np.float32)

    monkeypatch.setattr(embeddings, "_model", FakeModel())
    with pytest.raises(ValueError):
        embeddings.embed_text("hello")


@pytest.mark.skipif(
    not os.environ.get("RUN_REAL_EMBED"),
    reason="slow real-model test; set RUN_REAL_EMBED=1 to run",
)
def test_real_model_dim_and_unit_norm():
    v = embeddings.embed_text("daily evening news")
    assert v.shape == (EMBEDDING_DIM,)
    assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-3