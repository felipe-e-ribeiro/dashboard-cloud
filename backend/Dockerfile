FROM python:3.11-slim AS build

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# gcr.io/distroless/python3-debian12 has no shell/package manager, so its base
# packages can only get security fixes when Google rebuilds the image. When
# that lags behind Debian's own security repo (check with:
# `trivy image gcr.io/distroless/python3-debian12`), this stage grabs the
# already-patched files straight from Debian 12 and the final stage overlays
# them, without adding a shell or package manager to the runtime image.
# Assumes linux/amd64 (the only platform this project's CI builds); the
# directory name below would need to change to aarch64-linux-gnu on arm64.
FROM debian:12-slim AS patch
RUN apt-get update && apt-get install -y --no-install-recommends \
      libssl3 \
      libkrb5-3 libk5crypto3 libgssapi-krb5-2 libkrb5support0 \
      python3.11-minimal libpython3.11-minimal libpython3.11-stdlib \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /patched-status \
    && for pkg in libssl3 libkrb5-3 libk5crypto3 libgssapi-krb5-2 libkrb5support0 \
                  python3.11-minimal libpython3.11-minimal libpython3.11-stdlib; do \
         dpkg -s "$pkg" | grep -v '^Status:' > "/patched-status/$pkg"; \
         dpkg -L "$pkg" | while read -r f; do \
           [ -f "$f" ] && printf '%s  %s\n' "$(md5sum "$f" | cut -d' ' -f1)" "${f#/}"; \
         done > "/patched-status/$pkg.md5sums"; \
       done

FROM gcr.io/distroless/python3-debian12

WORKDIR /app
ENV PYTHONPATH=/app/deps

# Overlay the patched shared libs/interpreter/stdlib, then the matching dpkg
# status.d records (distroless splits /var/lib/dpkg/status into one file per
# package) so `trivy image` reports the new version instead of the stale one
# baked into this base image.
COPY --from=patch /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/libcrypto.so.3 /usr/lib/x86_64-linux-gnu/engines-3 /usr/lib/x86_64-linux-gnu/ossl-modules /usr/lib/x86_64-linux-gnu/
COPY --from=patch /usr/lib/x86_64-linux-gnu/libkrb5.so.3* /usr/lib/x86_64-linux-gnu/libk5crypto.so.3* /usr/lib/x86_64-linux-gnu/libgssapi_krb5.so.2* /usr/lib/x86_64-linux-gnu/libkrb5support.so.0* /usr/lib/x86_64-linux-gnu/krb5 /usr/lib/x86_64-linux-gnu/
COPY --from=patch /usr/bin/python3.11 /usr/bin/python3.11
COPY --from=patch /usr/lib/python3.11 /usr/lib/python3.11
COPY --from=patch /patched-status/. /var/lib/dpkg/status.d/

COPY --from=build /app/deps /app/deps
COPY . .

CMD ["entrypoint.py"]
