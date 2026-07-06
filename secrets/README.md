# secrets/

No longer used. AWS and OCI credentials — including the OCI API signing private key —
are configured from the dashboard's Settings page (`/settings`) and stored encrypted in
Postgres instead of being read from files or environment variables. This directory is
kept (gitignored) only in case you still have a local `oci_key.pem` here from before;
it's safe to delete once you've re-entered the key through `/settings`.
