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
# Modern apt sandboxes its dpkg helper processes with seccomp-BPF, which
# routinely crashes under QEMU user-mode emulation (cross-building arm64 on
# an amd64 GitHub runner) -- "apt-get install" fails with no useful error
# beyond exit code 1. Disabling the sandbox only affects this build stage,
# never the final runtime image.
RUN echo 'APT::Sandbox::Seccomp "false";' > /etc/apt/apt.conf.d/no-seccomp-under-qemu
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
ARG DEB_MULTIARCH

WORKDIR /app
ENV PYTHONPATH=/app/deps

# Overlay the patched shared libs/interpreter/stdlib, then the matching dpkg
# status.d records (distroless splits /var/lib/dpkg/status into one file per
# package) so `trivy image` reports the new version instead of the stale one
# baked into this base image.
COPY --from=patch /usr/lib/${DEB_MULTIARCH}/libssl.so.3 /usr/lib/${DEB_MULTIARCH}/libcrypto.so.3 /usr/lib/${DEB_MULTIARCH}/engines-3 /usr/lib/${DEB_MULTIARCH}/ossl-modules /usr/lib/${DEB_MULTIARCH}/
COPY --from=patch /usr/lib/${DEB_MULTIARCH}/libkrb5.so.3* /usr/lib/${DEB_MULTIARCH}/libk5crypto.so.3* /usr/lib/${DEB_MULTIARCH}/libgssapi_krb5.so.2* /usr/lib/${DEB_MULTIARCH}/libkrb5support.so.0* /usr/lib/${DEB_MULTIARCH}/krb5 /usr/lib/${DEB_MULTIARCH}/
COPY --from=patch /usr/bin/python3.11 /usr/bin/python3.11
COPY --from=patch /usr/lib/python3.11 /usr/lib/python3.11
COPY --from=patch /patched-status/. /var/lib/dpkg/status.d/

COPY --from=build /app/deps /app/deps
COPY . .

CMD ["entrypoint.py"]
