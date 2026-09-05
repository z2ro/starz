"""Piecewise constant production; resource exhaustion is an event, not a tick."""
from .data import Catalog


def produce(catalog: Catalog, stocks: dict[str, float], districts: dict[str, int], elapsed: float, coverage: float) -> None:
    remaining = elapsed / 60
    ordered = sorted(districts, key=lambda key: (bool(catalog.get('districts', key).processing), key))
    # ponytail: stable ID priority for competing processes; explicit priorities if the economy grows.
    while remaining > 0:
        rates: dict[str, float] = {}
        for key in ordered:
            district = catalog.get('districts', key)
            batches_per_minute = districts[key] * coverage
            for resource, amount in district.processing.items():
                if stocks.get(resource, 0) <= 0:
                    batches_per_minute = min(batches_per_minute, max(0, rates.get(resource, 0)) / amount)
            for resource, amount in district.processing.items():
                rates[resource] = rates.get(resource, 0) - amount * batches_per_minute
            for resource, amount in district.production.items():
                rates[resource] = rates.get(resource, 0) + amount * batches_per_minute
        depletion = {resource: stocks.get(resource, 0) / -rate for resource, rate in rates.items() if rate < 0 and stocks.get(resource, 0) > 0}
        interval = min([remaining, *depletion.values()])
        for resource, rate in rates.items():
            stocks[resource] = max(0, stocks.get(resource, 0) + rate * interval)
        # Set exhausted inputs exactly to zero to prevent floating-point zero-length loops.
        for resource, duration in depletion.items():
            if duration <= interval:
                stocks[resource] = 0
        remaining -= interval
