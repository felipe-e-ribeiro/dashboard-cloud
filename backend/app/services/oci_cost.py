import time
from datetime import date, datetime, timedelta, timezone

import oci

from ..config import settings

# The OCI Usage API rejects DAILY-granularity requests spanning more than 93 days,
# so multi-month ranges (e.g. the 6-month backfill) must be split into chunks.
MAX_CHUNK_DAYS = 90

# The Usage API occasionally returns transient 5xx errors under load; retry those with backoff.
MAX_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 5


def _client() -> "oci.usage_api.UsageapiClient":
    config = {
        "user": settings.oci_user_ocid,
        "key_file": settings.oci_key_file_path,
        "fingerprint": settings.oci_fingerprint,
        "tenancy": settings.oci_tenancy_ocid,
        "region": settings.oci_region,
    }
    # The Usage API can take well over a minute to aggregate a ~90-day window across all services.
    return oci.usage_api.UsageapiClient(config, timeout=(10, 180))


def _is_retryable(exc: Exception) -> bool:
    status = getattr(exc, "status", None)
    return status is None or status >= 500


def _fetch_chunk(client: "oci.usage_api.UsageapiClient", start: date, end_inclusive: date) -> list[dict]:
    # The Usage API's time_usage_ended is exclusive, so extend by one day to include end_inclusive.
    end_exclusive = end_inclusive + timedelta(days=1)
    details = oci.usage_api.models.RequestSummarizedUsagesDetails(
        tenant_id=settings.oci_tenancy_ocid,
        granularity="DAILY",
        query_type="COST",
        group_by=["service"],
        time_usage_started=datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
        time_usage_ended=datetime.combine(end_exclusive, datetime.min.time(), tzinfo=timezone.utc),
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.request_summarized_usages(details)
            break
        except Exception as exc:  # noqa: BLE001 - retry transient Usage API errors, re-raise once attempts are exhausted
            if attempt == MAX_ATTEMPTS or not _is_retryable(exc):
                raise
            time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    results: list[dict] = []
    for item in response.data.items:
        amount = float(item.computed_amount or 0)
        if amount == 0:
            continue
        results.append(
            {
                "usage_date": item.time_usage_started.date(),
                "service_name": item.service or "Unknown",
                "amount": amount,
                "currency": item.currency or "USD",
            }
        )
    return results


def fetch_daily_costs_by_service(start: date, end_inclusive: date) -> list[dict]:
    """Fetch daily cost by service from the OCI Usage API for [start, end_inclusive]."""
    client = _client()

    results: list[dict] = []
    chunk_start = start
    while chunk_start <= end_inclusive:
        chunk_end = min(chunk_start + timedelta(days=MAX_CHUNK_DAYS - 1), end_inclusive)
        results.extend(_fetch_chunk(client, chunk_start, chunk_end))
        chunk_start = chunk_end + timedelta(days=1)

    return results
