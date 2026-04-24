from models.provider import Provider


def calculate_cost(
    provider: Provider,
    prompt_tokens: int,
    cache_tokens: int,
    completion_tokens: int,
    model_requested: str = "",
) -> float:
    aliases = provider.model_aliases or {}
    model_config = aliases.get(model_requested)

    if isinstance(model_config, dict):
        cost_input = model_config.get("cost_input_per_1m", provider.cost_input_per_1m)
        cost_cache = model_config.get("cost_cache_per_1m", provider.cost_cache_per_1m)
        cost_output = model_config.get("cost_output_per_1m", provider.cost_output_per_1m)
    else:
        cost_input = provider.cost_input_per_1m
        cost_cache = provider.cost_cache_per_1m
        cost_output = provider.cost_output_per_1m

    billable_prompt = max(0, prompt_tokens - cache_tokens)
    cost = (
        billable_prompt / 1_000_000 * cost_input
        + cache_tokens / 1_000_000 * cost_cache
        + completion_tokens / 1_000_000 * cost_output
    )
    return round(cost, 8)
