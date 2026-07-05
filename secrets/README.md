# secrets/

Place the OCI API signing private key here as `oci_key.pem`. This directory is gitignored
(except this file) — `oci_key.pem` never gets committed.

docker-compose mounts `./secrets/oci_key.pem` into the backend container at the path
set by `OCI_KEY_FILE_PATH` in `.env` (default `/run/secrets/oci_key.pem`).
