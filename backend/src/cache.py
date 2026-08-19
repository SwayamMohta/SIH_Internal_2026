"""In-process TTL cache (replaces Redis for a single local process)."""

import hashlib
import json
import time

from .config import CACHE_TTL_SECONDS


class TTLCache:
    def __init__(self, ttl_seconds: int = CACHE_TTL_SECONDS):
        self._store: dict = {}
        self.ttl_seconds = ttl_seconds

    def _make_key(self, title: str) -> str:
        return hashlib.md5(title.strip().lower().encode("utf-8")).hexdigest()

    def get(self, title: str):
        key = self._make_key(title)
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return json.loads(value)

    def set(self, title: str, value: dict):
        key = self._make_key(title)
        self._store[key] = (time.time() + self.ttl_seconds, json.dumps(value))

    def invalidate_all(self):
        self._store.clear()

    def __len__(self):
        return len(self._store)


# Shared verification cache; cleared whenever a pending title is inserted.
verification_cache = TTLCache(ttl_seconds=CACHE_TTL_SECONDS)