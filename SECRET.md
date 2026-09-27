# Credentials must never live in this repository

**This repository is public and serves GitHub Pages.** Anything committed here
is world-readable, and Pages/CDN caches make it hard to walk back.

## What was found

While repointing the site at the Jobby McJobberson brand, these files were found
sitting in `assets/`, in plaintext:

- `Resend and Cloudflare CF Account API Keys.txt`
- `Resend and Cloudflare CF Account API Keys.docx`

They were **never committed** and the live site returned 404 for them, so there
is no evidence of exposure. They were, however, one `git add .` away from being
published — and the archive step initially copied them into `listing/`, which
*would* have published them. That copy has been removed.

## Action required: rotate these

The Resend key on disk should be treated as compromised. It was stored
unencrypted next to a public site directory, which is not a place a credential
can be trusted to stay secret.

To rotate, in the Resend dashboard:

1. Revoke the existing API key.
2. Create a replacement.
3. Update it wherever it is actually consumed. Note that the relay's own keys
   live in `../relay/.env` and are **different** keys — they were not in this
   file, so rotating this one does not affect the running relay.
4. Delete the plaintext file once the replacement is in place.

The Cloudflare account credentials in the same file need the same treatment.

## The rule

- Secrets live in `.env` files that are never committed.
- `.gitignore` blocks the credential-shaped filenames, plus `*.key`, `*.pem`,
  `*.p12`, `*.env` and `console.log*` (a junk artefact).
- Before any push from a public Pages repo, check what is about to be staged:

  ```
  git add -An --dry-run
  ```

  If that output contains anything you would not paste into a chat, stop.

## If a secret is ever committed

Rotation is the only real remedy. Removing it in a later commit does **not**
help: the object stays in history, and Pages builds and CDN caches may retain
it. Revoke first, then clean up.
