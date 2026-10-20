# Lapis

A private, client-side encrypted case vault.

Nothing in this repository is readable without the owner's credentials. `vault.json` holds only a
key-derivation salt and sealed (AES-256-GCM) values; all case data lives in a separate private
repository, also encrypted in the browser before upload.
