# Security

RunOtter is a single-user self-hosted preview. Keep the backend on loopback and use your existing authenticated HTTPS reverse proxy. Do not forward internal ingestion credentials to a phone or browser.

Device cookies are Secure, HttpOnly and SameSite=Strict. Pairing codes are short-lived, one-time and rate-limited. Secrets are never stored in browser localStorage. Passkey step-up grants are device/action bound and single use. HTML artifacts run inside a script-disabled sandbox. Public sharing is explicit, expiring and revocable.

Do not commit `.env`, runtime databases, `.tools`, VAPID private keys or signing keystores. Runtime data and backups are private and may include personal information and push-subscription credentials. Use an independently protected/encrypted backup destination.

Report suspected vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting feature if enabled. Do not include real credentials or private artifact content in public issues.
