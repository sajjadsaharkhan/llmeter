import random
from typing import List
from models.provider import Provider


def select_provider(providers: List[Provider]) -> Provider | None:
    active = [p for p in providers if p.is_active and p.weight > 0]
    if not active:
        return None
    total = sum(p.weight for p in active)
    r = random.uniform(0, total)
    cumulative = 0
    for p in active:
        cumulative += p.weight
        if r <= cumulative:
            return p
    return active[-1]


def get_fallback_providers(providers: List[Provider], exclude_id: int) -> List[Provider]:
    return [p for p in providers if p.is_active and p.id != exclude_id]
