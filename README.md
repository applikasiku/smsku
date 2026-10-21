# SMSKU ID V1.0 — Responsive PWA

Static mobile-first PWA ready for Cloudflare Pages. No build command is needed.

## Features
- Responsive dashboard and light/dark mode
- Installable PWA with offline app-shell cache
- Temporary email via Mail.tm API (subject to provider availability and CORS policy)
- Read plain-text email, copy address, detect 4–8 digit numeric strings as OTP candidates
- SMS provider selection UI, intentionally disabled until a legitimate backend is integrated

## Deploy Cloudflare Pages
1. Upload the files in this folder to the root of your `applikasiku/smsku` GitHub repository.
2. In Cloudflare, create a Pages project linked to that repository.
3. Select **None** for Framework preset, leave Build command empty, and use `/` as output directory for this static project (or set output directory `.` if required by the dashboard).
4. Deploy and choose `smsku.pages.dev` if available.

## Security and limitations
- This version is a frontend prototype, NOT a production-ready private OTP vault. There is no admin login.
- SMS numbers cannot be generated randomly; real receiving numbers require a legitimate provider with API and inventory.
- Never embed SMS provider API keys in frontend JavaScript. Implement a Cloudflare Worker API with authentication, rate limits, secrets, and provider-specific adapters.
- Mail.tm accounts are not deleted by clearing the local session. The email account and messages may remain at the provider.
- Email token stays only in JS memory and disappears on refresh. Mailbox session cannot be recovered after refresh.
- OTP detection is heuristic and may show unrelated 4–8 digit numbers.
- Email HTML is not rendered to avoid script injection. Email provider may rate-limit or change API/CORS behavior.
- Offline mode only caches the interface; fetching new messages needs connectivity.
- SVG icon works for many browsers, but add 192px and 512px PNG icons for broad PWA installation compatibility.
