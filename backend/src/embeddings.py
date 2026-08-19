"""Semantic embeddings: LaBSE (768-dim) + float32 BLOB (de)serialization.

The model is loaded lazily so modules that never embed (audit, merge, and any
import of this package) don't pay the ~1.9 GB load cost.
"""

import numpy as np
from sentence_transformers import SentenceTransformer

from .config import EMBEDDING_MODEL, EMBEDDING_DIM

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed_text(text: str) -> np.ndarray:
    """Embed `text` with LaBSE, L2-normalized so dot product == cosine."""
    vec = _get_model().encode(text, normalize_embeddings=True)
    vec = np.asarray(vec, dtype=np.float32)
    if vec.shape[0] != EMBEDDING_DIM:
        raise ValueError(
            f"Embedding dim {vec.shape[0]} != expected {EMBEDDING_DIM}; "
            "re-embed the entire corpus if the model changed."
        )
    return vec


def embed_texts(texts: list) -> np.ndarray:
    """Batch-embed a list of texts (much faster than N single encodes for the
    one-time corpus build). Returns shape (len(texts), EMBEDDING_DIM)."""
    if not texts:
        return np.empty((0, EMBEDDING_DIM), dtype=np.float32)
    vecs = _get_model().encode(texts, normalize_embeddings=True, batch_size=32)
    vecs = np.asarray(vecs, dtype=np.float32)
    if vecs.ndim != 2 or vecs.shape[1] != EMBEDDING_DIM:
        raise ValueError(
            f"Embedding dim {vecs.shape} != expected {EMBEDDING_DIM}; "
            "re-embed the entire corpus if the model changed."
        )
    return vecs


def serialize_vector(vec: np.ndarray) -> bytes:
    """Pack a float32 array into raw bytes for SQLite BLOB storage."""
    return np.asarray(vec, dtype=np.float32).tobytes()


def deserialize_vector(blob: bytes) -> np.ndarray:
    """Unpack a BLOB back into a float32 array (zero-copy, read-only)."""
    return np.frombuffer(blob, dtype=np.float32)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Both vectors are L2-normalized, so dot product == cosine similarity."""
    return float(np.dot(vec_a, vec_b))


def model_is_loaded() -> bool:
    return _model is not None