from datetime import date

VALID_PERIODS = {"current_month", "last_6_months"}


def period_range(period: str, today: date | None = None) -> tuple[date, date]:
    """Returns an inclusive (start, end) date range for the given period."""
    today = today or date.today()

    if period == "current_month":
        return today.replace(day=1), today

    if period == "last_6_months":
        year = today.year
        month = today.month - 6
        while month <= 0:
            month += 12
            year -= 1
        return date(year, month, 1), today

    raise ValueError(f"Unknown period: {period}")
