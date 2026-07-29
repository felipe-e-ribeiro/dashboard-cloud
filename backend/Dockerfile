FROM python:3.11-slim AS build

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

FROM gcr.io/distroless/python3-debian12

WORKDIR /app
ENV PYTHONPATH=/app/deps

COPY --from=build /app/deps /app/deps
COPY . .

CMD ["entrypoint.py"]
