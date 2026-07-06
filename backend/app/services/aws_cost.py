from datetime import date, timedelta

import boto3


def fetch_daily_costs_by_service(start: date, end_inclusive: date, credentials: dict) -> list[dict]:
    """Fetch daily unblended cost by service from AWS Cost Explorer for [start, end_inclusive].

    `credentials` must contain `access_key_id`, `secret_access_key`, and `region`.
    """
    client = boto3.client(
        "ce",
        region_name=credentials["region"],
        aws_access_key_id=credentials["access_key_id"],
        aws_secret_access_key=credentials["secret_access_key"],
    )

    # Cost Explorer's TimePeriod.End is exclusive, so extend by one day to include end_inclusive.
    end_exclusive = end_inclusive + timedelta(days=1)
    time_period = {"Start": start.isoformat(), "End": end_exclusive.isoformat()}

    results: list[dict] = []
    next_token = None
    while True:
        kwargs = dict(
            TimePeriod=time_period,
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )
        if next_token:
            kwargs["NextPageToken"] = next_token

        response = client.get_cost_and_usage(**kwargs)
        for result_by_time in response["ResultsByTime"]:
            usage_date = date.fromisoformat(result_by_time["TimePeriod"]["Start"])
            for group in result_by_time["Groups"]:
                amount_data = group["Metrics"]["UnblendedCost"]
                amount = float(amount_data["Amount"])
                if amount == 0:
                    continue
                results.append(
                    {
                        "usage_date": usage_date,
                        "service_name": group["Keys"][0],
                        "amount": amount,
                        "currency": amount_data["Unit"],
                    }
                )

        next_token = response.get("NextPageToken")
        if not next_token:
            break

    return results
