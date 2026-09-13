# Debian's multiarch lib directory name, overridden per platform by CI
# (--build-arg DEB_MULTIARCH=aarch64-linux-gnu when building linux/arm64 for
# oks-personal's Ampere nodes) -- default matches local amd64 docker-compose.
# Declared before the first FROM so it's a true global default, inherited by
# any stage that redeclares a bare `ARG DEB_MULTIARCH` (see final stage).
ARG DEB_MULTIARCH=x86_64-linux-gnu

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
# Runs under whatever --platform buildx targets (QEMU-emulated for a
# non-native one), so dpkg -L below naturally reports paths under the right
# multiarch directory for that platform -- only the hardcoded COPY paths in
# the final stage need DEB_MULTIARCH to match.
FROM debian:12-slim AS patch
# Actual root cause (confirmed via the real build log, 2026-09-13, after gh
# auth + `gh run view --log-failed`): `apt-get install` always runs dpkg's
# trigger processing at the end, and trigger processing itself (not
# specifically ldconfig, not apt's seccomp sandbox -- both tried first and
# neither changed anything) crashes under QEMU user-mode emulation with no
# error beyond the generic buildx "exit code: 1"; the log consistently stops
# mid-"Processing triggers for libc-bin". Every individual package's own
# postinst runs fine under emulation -- only dpkg's trigger machinery itself
# does not. Fix: never let apt actually install/configure anything here --
# fetch the .debs only (--download-only) and extract their files directly
# with dpkg-deb, which is pure archive extraction and never runs a
# maintainer script or a trigger.
RUN apt-get update && apt-get install -y --no-install-recommends --download-only \
      libssl3 \
      libkrb5-3 libk5crypto3 libgssapi-krb5-2 libkrb5support0 \
      python3.11-minimal libpython3.11-minimal libpython3.11-stdlib \
    && mkdir -p /patched-status /extracted \
    && for pkg in libssl3 libkrb5-3 libk5crypto3 libgssapi-krb5-2 libkrb5support0 \
                  python3.11-minimal libpython3.11-minimal libpython3.11-stdlib; do \
         deb=$(ls /var/cache/apt/archives/${pkg}_*.deb); \
         dpkg-deb -x "$deb" /extracted; \
         dpkg-deb -f "$deb" > "/patched-status/$pkg"; \
         dpkg-deb -e "$deb" "/tmp/ctrl-$pkg"; \
         cp "/tmp/ctrl-$pkg/md5sums" "/patched-status/$pkg.md5sums"; \
       done

FROM gcr.io/distroless/python3-debian12
ARG DEB_MULTIARCH

WORKDIR /app
ENV PYTHONPATH=/app/deps

# Overlay the patched shared libs/interpreter/stdlib, then the matching dpkg
# status.d records (distroless splits /var/lib/dpkg/status into one file per
# package) so `trivy image` reports the new version instead of the stale one
# baked into this base image.
COPY --from=patch /extracted/usr/lib/${DEB_MULTIARCH}/libssl.so.3 /extracted/usr/lib/${DEB_MULTIARCH}/libcrypto.so.3 /extracted/usr/lib/${DEB_MULTIARCH}/engines-3 /extracted/usr/lib/${DEB_MULTIARCH}/ossl-modules /usr/lib/${DEB_MULTIARCH}/
COPY --from=patch /extracted/usr/lib/${DEB_MULTIARCH}/libkrb5.so.3* /extracted/usr/lib/${DEB_MULTIARCH}/libk5crypto.so.3* /extracted/usr/lib/${DEB_MULTIARCH}/libgssapi_krb5.so.2* /extracted/usr/lib/${DEB_MULTIARCH}/libkrb5support.so.0* /extracted/usr/lib/${DEB_MULTIARCH}/krb5 /usr/lib/${DEB_MULTIARCH}/
COPY --from=patch /extracted/usr/bin/python3.11 /usr/bin/python3.11
COPY --from=patch /extracted/usr/lib/python3.11 /usr/lib/python3.11
COPY --from=patch /patched-status/. /var/lib/dpkg/status.d/

COPY --from=build /app/deps /app/deps
COPY . .

CMD ["entrypoint.py"]
