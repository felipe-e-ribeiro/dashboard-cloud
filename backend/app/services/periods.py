from datetime import date, timedelta

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


def previous_period_range(period: str, today: date | None = None) -> tuple[date, date]:
    """Returns the inclusive (start, end) date range immediately preceding
    period_range(period, today), covering the same number of days."""
    start, end = period_range(period, today)
    length = (end - start).days
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=length)
    return previous_start, previous_end


def months_ago_start(months: int, today: date | None = None) -> date:
    """Returns the first day of the month `months` calendar months before today's month
    (e.g. months=6 with today in July returns January 1st) — covers `months` closed
    months plus the current month when paired with `today` as the range end."""
    today = today or date.today()
    year = today.year
    month = today.month - months
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)
