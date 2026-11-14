# Security

## Reporting a problem

Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Don't open a public issue.

Include what you found, how to reproduce it and what it affects. You'll get a reply within a few days.

## What's in place

- Content Security Policy with a fresh nonce on every page, `strict-dynamic`, no inline scripts or styles without the nonce
- HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, locked-down permissions policy
- The YouTube API key stays on the server; the browser only talks to `/api/playlist`
- `/api/playlist` validates every parameter, refuses cross-site browser requests and is rate-limited by estimated YouTube quota per address and per server
- CSV exports are safe to open in spreadsheets (no formula injection); calendar files are escaped
- CI: read-only token, actions pinned to commit SHAs, `npm audit` for production dependencies, CodeQL code scanning, Dependabot

## Supported versions

Only the live site (https://getplaypace.vercel.app) and the `main` branch are maintained.
